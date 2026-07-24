import {
  APIRequestContext,
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Locator,
  Page,
  expect,
  test,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const apiUrl = `${process.env.E2E_BACKEND_URL || "http://127.0.0.1:3100"}/api`;
const botWebhookSecret =
  process.env.E2E_BOT_WEBHOOK_SECRET ||
  "playwright-bot-secret-with-at-least-32-characters";
const accounts = {
  admin: {
    email: "emiradmin@ello.com",
    password: "123456",
    role: "admin",
  },
  user1: {
    email: "emiruser@ello.com",
    password: "123456",
    role: "user",
  },
  user2: {
    email: "asliuser@ello.com",
    password: "123456",
    role: "user",
  },
} as const;

interface AuthSession {
  accessToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    role: string;
  };
}

type AccountKey = keyof typeof accounts;

let sessions: Record<AccountKey, AuthSession>;

async function loginWithApi(
  request: APIRequestContext,
  account: (typeof accounts)[keyof typeof accounts],
): Promise<AuthSession> {
  const response = await request.post(`${apiUrl}/auth/login`, {
    data: { email: account.email, password: account.password },
  });

  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  return body.data;
}

function toFrontendAuthUser(session: AuthSession) {
  const nameParts = session.user.username.split(/[\s._-]+/).filter(Boolean);

  return {
    ...session.user,
    uid: session.user.id,
    firstName: nameParts[0] || session.user.username,
    lastName: nameParts.slice(1).join(" "),
    status: "active",
    accessToken: session.accessToken,
    token: session.accessToken,
  };
}

async function loginThroughUi(
  page: Page,
  account: (typeof accounts)[keyof typeof accounts],
) {
  await page.goto("/auth-login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(account.email);
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill(account.password);
  await page.getByRole("button", { name: "Log In" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Chats", exact: true }),
  ).toBeVisible();
}

async function openConversation(page: Page, label: string) {
  const conversation = page
    .locator(".chat-user-list li")
    .filter({ hasText: label })
    .first();

  await expect(conversation).toBeVisible({ timeout: 10_000 });
  await conversation.click();
  await expect(page.locator("#chat-input")).toBeVisible();
  await expect(
    page.getByText("Realtime connected", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
}

async function expectMessageMenuWithinViewport(
  page: Page,
  messageRow: Locator,
) {
  await messageRow.scrollIntoViewIfNeeded();
  await messageRow.hover();
  await messageRow.getByLabel("Message actions").click();

  const menu = page.locator(".message-actions-menu.show");
  await expect(menu).toBeVisible();
  const bounds = await menu.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight);
  await page.keyboard.press("Escape");
}

async function openGroupInfo(page: Page) {
  await page
    .getByRole("button", { name: "Conversation details", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Group overview", exact: true }),
  ).toBeVisible();
}

async function createAuthenticatedPage(
  browser: Browser,
  session: AuthSession,
  contextOptions: BrowserContextOptions = {},
) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await page.goto("/auth-login", { waitUntil: "domcontentloaded" });
  await page.evaluate(authUser => {
    window.localStorage.setItem("authUser", JSON.stringify(authUser));
  }, toFrontendAuthUser(session));
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Chats", exact: true }),
  ).toBeVisible();

  return { context, page };
}

async function createUserPages(browser: Browser) {
  const [user1, user2] = await Promise.all([
    createAuthenticatedPage(browser, sessions.user1),
    createAuthenticatedPage(browser, sessions.user2),
  ]);

  return {
    user1Context: user1.context,
    user2Context: user2.context,
    user1Page: user1.page,
    user2Page: user2.page,
  };
}

async function closeContexts(...contexts: BrowserContext[]) {
  await Promise.all(contexts.map(context => context.close()));
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext();

  try {
    sessions = {
      admin: await loginWithApi(request, accounts.admin),
      user1: await loginWithApi(request, accounts.user1),
      user2: await loginWithApi(request, accounts.user2),
    };
  } finally {
    await request.dispose();
  }
});

test("development accounts authenticate with the expected roles", async ({
  page,
}) => {
  for (const key of Object.keys(accounts) as AccountKey[]) {
    expect(sessions[key].user.role).toBe(accounts[key].role);
  }

  await loginThroughUi(page, accounts.admin);
});

test("protected routes redirect unauthenticated visitors", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/auth-login$/);
  await expect(page.getByRole("button", { name: "Log In" })).toBeVisible();
});

test("invalid sessions are cleared before the dashboard renders", async ({
  page,
}) => {
  await page.goto("/auth-login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.setItem(
      "authUser",
      JSON.stringify({
        id: "invalid-user",
        role: "admin",
        accessToken: "invalid.jwt.token",
      }),
    );
  });

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/auth-login$/);
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("authUser")))
    .toBeNull();
});

test("login shows an actionable error while the backend is unreachable", async ({
  page,
}) => {
  await page.route("**/api/auth/login", route =>
    route.abort("connectionrefused"),
  );
  await page.goto("/auth-login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(accounts.user1.email);
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill(accounts.user1.password);
  await page.getByRole("button", { name: "Log In" }).click();

  await expect(
    page.getByText("Server unavailable. Check your connection and try again.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("server roles control group creation access", async ({
  browser,
  request,
}) => {
  const tamperedUserSession: AuthSession = {
    ...sessions.user1,
    user: { ...sessions.user1.user, role: "admin" },
  };
  const user = await createAuthenticatedPage(browser, tamperedUserSession);
  const admin = await createAuthenticatedPage(browser, sessions.admin);

  try {
    await expect(
      user.page.getByRole("button", { name: "Create group" }),
    ).toHaveCount(0);
    await expect(
      admin.page.getByRole("button", { name: "Create group" }),
    ).toBeVisible();

    const storedRole = await user.page.evaluate(() => {
      const authUser = window.localStorage.getItem("authUser");
      return authUser ? JSON.parse(authUser).role : null;
    });
    expect(storedRole).toBe("user");

    const forbiddenResponse = await request.post(
      `${apiUrl}/conversations/groups`,
      {
        headers: {
          Authorization: `Bearer ${sessions.user1.accessToken}`,
        },
        data: {
          name: `forbidden-group-${Date.now()}`,
          participantIds: [sessions.user2.user.id],
        },
      },
    );
    expect(forbiddenResponse.status()).toBe(403);
  } finally {
    await closeContexts(user.context, admin.context);
  }
});

test("external automation groups and bot messages appear realtime", async ({
  browser,
  request,
}) => {
  const suffix = Date.now();
  const groupName = `Automated Alert ${suffix}`;
  const created = await request.post(`${apiUrl}/bot/groups`, {
    headers: {
      "x-bot-secret": botWebhookSecret,
    },
    data: {
      name: groupName,
      participantIds: [sessions.user1.user.id],
      managerIds: [sessions.admin.user.id],
      externalRef: `playwright-alert-${suffix}`,
      initialBotMessage: "Automated group is ready.",
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const group = (await created.json()).data;
  const admin = await createAuthenticatedPage(browser, sessions.admin);

  try {
    await openConversation(admin.page, groupName);
    await expect(
      admin.page.getByText("BOT | 3 members", { exact: true }),
    ).toBeVisible();
    await expect(
      admin.page.getByText("Automated group is ready.", { exact: true }),
    ).toBeVisible();

    const update = await request.post(
      `${apiUrl}/bot/groups/${group.id}/messages`,
      {
        headers: {
          "x-bot-secret": botWebhookSecret,
        },
        data: {
          content: "Monitoring status changed to critical.",
          clientMessageId: crypto.randomUUID(),
        },
      },
    );
    expect(update.ok(), await update.text()).toBeTruthy();

    await expect(
      admin.page.getByText("Monitoring status changed to critical.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      admin.page.getByRole("button", {
        name: "Remove ellO Automation Bot",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      admin.page.getByRole("option", {
        name: "ellO Automation Bot",
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    await admin.context.close();
  }
});

test("contacts only show users with a direct connection", async ({
  browser,
  request,
}) => {
  const response = await request.post(`${apiUrl}/conversations/direct`, {
    headers: { Authorization: `Bearer ${sessions.admin.accessToken}` },
    data: { participantId: sessions.user2.user.id },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const admin = await createAuthenticatedPage(browser, sessions.admin);

  try {
    await admin.page
      .getByRole("link", { name: "Contacts", exact: true })
      .click();
    const contact = admin.page
      .locator(".contact-list li")
      .filter({ hasText: sessions.user2.user.username });

    await expect(contact).toHaveCount(1);
    await contact.click();

    await expect(admin.page.locator("#chat-input")).toBeVisible();
    await expect(
      admin.page.getByText("Conversation not found", { exact: true }),
    ).toHaveCount(0);
    await expect(
      admin.page.getByText("Realtime connected", { exact: true }),
    ).toBeVisible();
  } finally {
    await admin.context.close();
  }
});

test("a direct contact is available in the group member picker", async ({
  browser,
  request,
}) => {
  const suffix = Date.now();
  const username = `dmcontact${suffix}`;
  const registration = await request.post(`${apiUrl}/auth/register`, {
    data: {
      email: `${username}@ello.local`,
      username,
      password: "DirectContact123!",
    },
  });
  expect(registration.ok(), await registration.text()).toBeTruthy();
  const contactSession = (await registration.json()).data as AuthSession;

  const direct = await request.post(`${apiUrl}/conversations/direct`, {
    headers: { Authorization: `Bearer ${sessions.admin.accessToken}` },
    data: { participantId: contactSession.user.id },
  });
  expect(direct.ok(), await direct.text()).toBeTruthy();

  const contactsResponse = await request.get(
    `${apiUrl}/conversations/contacts`,
    {
      headers: { Authorization: `Bearer ${sessions.admin.accessToken}` },
    },
  );
  expect(contactsResponse.ok(), await contactsResponse.text()).toBeTruthy();
  const contactsBody = await contactsResponse.json();
  expect(contactsBody.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: contactSession.user.id }),
    ]),
  );

  const admin = await createAuthenticatedPage(browser, sessions.admin);

  try {
    await admin.page
      .getByRole("button", { name: "Create group", exact: true })
      .click();
    const dialog = admin.page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Create New Group" }),
    ).toBeVisible();
    await dialog.getByLabel("Group Name").fill(`dm-group-${suffix}`);
    await dialog
      .getByRole("button", { name: "Select Members", exact: true })
      .click();

    const contactCheckbox = dialog.locator(
      `[id="contact-${contactSession.user.id}"]`,
    );
    await expect(contactCheckbox).toBeVisible();
    await contactCheckbox.check();
    await dialog
      .getByRole("button", { name: "Create Groups", exact: true })
      .click();

    await expect(dialog).toHaveCount(0);
    await expect(
      admin.page
        .locator(".chat-user-list li")
        .filter({ hasText: `dm-group-${suffix}` }),
    ).toBeVisible();
  } finally {
    await admin.context.close();
  }
});

test("contact invitations persist and create a chat when accepted", async ({
  browser,
  request,
}) => {
  const suffix = Date.now();
  const email = `invitee-${suffix}@ello.local`;
  const registration = await request.post(`${apiUrl}/auth/register`, {
    data: {
      email,
      username: `invitee_${suffix}`,
      password: "Invitee123!",
    },
  });
  expect(registration.ok(), await registration.text()).toBeTruthy();
  const inviteeSession = (await registration.json()).data as AuthSession;
  const invitee = await createAuthenticatedPage(browser, inviteeSession);

  try {
    const invitation = await request.post(`${apiUrl}/contact-invitations`, {
      headers: { Authorization: `Bearer ${sessions.user1.accessToken}` },
      data: { email, message: "Join me on ellO." },
    });
    expect(invitation.ok(), await invitation.text()).toBeTruthy();

    await invitee.page.reload();
    await expect(
      invitee.page.getByRole("heading", { name: "Chats", exact: true }),
    ).toBeVisible();
    await invitee.page
      .getByRole("button", { name: "Open contact invitations" })
      .click();
    await expect(invitee.page.getByText("Join me on ellO.")).toBeVisible();
    await invitee.page
      .getByRole("button", { name: "Accept invitation from emiruser" })
      .click();

    await expect(
      invitee.page
        .locator(".chat-user-list li")
        .filter({ hasText: "emiruser" })
        .first(),
    ).toBeVisible();
  } finally {
    await invitee.context.close();
  }
});

test("logout clears the session and protects the dashboard", async ({
  browser,
}) => {
  const { context, page } = await createAuthenticatedPage(
    browser,
    sessions.user1,
  );

  try {
    await page.getByLabel("Open profile menu").click();
    await page.evaluate(() => {
      const logoutLink =
        document.querySelector<HTMLAnchorElement>('a[href="/logout"]');
      if (!logoutLink) {
        throw new Error("Logout link is missing from the profile panel");
      }
      logoutLink.click();
    });

    await expect(page).toHaveURL(/\/logout$/);
    await expect(
      page.getByRole("heading", { name: "You are Logged Out" }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("authUser")))
      .toBeNull();

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/auth-login$/);
  } finally {
    await context.close();
  }
});

test("profile details and image are saved through settings", async ({
  browser,
  request,
}) => {
  const user = await createAuthenticatedPage(browser, sessions.user1);
  const about = `ellO profile e2e ${Date.now()}`;
  const location = "Istanbul, TR";

  try {
    await user.page.getByLabel("Open profile menu").click();
    await user.page.evaluate(() => {
      const settingsButton = document.querySelector<HTMLButtonElement>(
        ".profile-account-actions button",
      );
      if (!settingsButton) {
        throw new Error("Profile settings button is missing");
      }
      settingsButton.click();
    });
    await expect(
      user.page.getByRole("heading", { name: "Profile settings" }),
    ).toBeVisible();

    await user.page.getByRole("button", { name: "Personal Info" }).click();
    await user.page.getByRole("button", { name: "Edit personal info" }).click();
    await user.page.getByLabel("About").fill(about);
    await user.page.getByLabel("Location").fill(location);
    await user.page.getByRole("button", { name: "Save profile" }).click();
    await expect(
      user.page.locator("#settingprofile").getByText(about, { exact: true }),
    ).toBeVisible();

    await user.page.locator("#profile-img-file-input").setInputFiles({
      name: "profile.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nXQAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await expect(
      user.page.getByLabel("Open profile menu").locator("img"),
    ).toHaveAttribute("src", /^data:image\/jpeg;base64,/);

    await user.page.getByLabel("Open profile menu").click();
    const profilePanel = user.page.locator(".profile-desc");
    await expect(profilePanel.getByText(about, { exact: true })).toBeVisible();
    await expect(
      profilePanel.getByText(location, { exact: true }),
    ).toBeVisible();
  } finally {
    await request.patch(`${apiUrl}/users/me`, {
      headers: { Authorization: `Bearer ${sessions.user1.accessToken}` },
      data: { about: null, location: null, profileImage: null },
    });
    await user.context.close();
  }
});

test("direct messages arrive in the other user's open conversation", async ({
  browser,
  request,
}) => {
  const response = await request.post(`${apiUrl}/conversations/direct`, {
    headers: { Authorization: `Bearer ${sessions.user1.accessToken}` },
    data: { participantId: sessions.user2.user.id },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const { user1Context, user2Context, user1Page, user2Page } =
    await createUserPages(browser);

  try {
    await openConversation(user1Page, "aslıuser");
    await openConversation(user2Page, "emiruser");

    const message = `direct-e2e-${Date.now()}`;
    await user1Page.locator("#chat-input").fill(message);
    await user1Page.locator("#chat-input").press("Enter");

    await expect(user1Page.getByText(message, { exact: true })).toBeVisible();
    await expect(user2Page.getByText(message, { exact: true })).toBeVisible();
    await expect(user1Page.getByText(message, { exact: true })).toHaveCount(1);
    await expect(user2Page.getByText(message, { exact: true })).toHaveCount(1);
    const incomingToast = user2Page
      .locator(".incoming-message-toast")
      .filter({ hasText: message });
    await expect(incomingToast).toBeVisible();
    await expect(incomingToast).toContainText("emiruser in emiruser");

    const reply = `direct-reply-e2e-${Date.now()}`;
    await user2Page.locator("#chat-input").fill(reply);
    await user2Page.locator("#chat-input").press("Enter");

    await expect(user1Page.getByText(reply, { exact: true })).toBeVisible();
    await expect(user2Page.getByText(reply, { exact: true })).toBeVisible();
    await expect(user1Page.getByText(reply, { exact: true })).toHaveCount(1);
    await expect(user2Page.getByText(reply, { exact: true })).toHaveCount(1);
  } finally {
    await closeContexts(user1Context, user2Context);
  }
});

test("presence follows authenticated socket connections", async ({
  browser,
  request,
}) => {
  const response = await request.post(`${apiUrl}/conversations/direct`, {
    headers: { Authorization: `Bearer ${sessions.user1.accessToken}` },
    data: { participantId: sessions.user2.user.id },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const user1 = await createAuthenticatedPage(browser, sessions.user1);
  const user2 = await createAuthenticatedPage(browser, sessions.user2);

  try {
    await openConversation(user1.page, sessions.user2.user.username);
    await expect(
      user1.page.getByText("Online", { exact: true }).first(),
    ).toBeVisible();

    await user2.context.close();

    await expect(
      user1.page.getByText("Offline", { exact: true }).first(),
    ).toBeVisible();
    const directRow = user1.page
      .locator(".chat-user-list li")
      .filter({ hasText: sessions.user2.user.username })
      .first();
    await expect(directRow.locator(".chat-user-img")).not.toHaveClass(/online/);
  } finally {
    await user1.context.close();
  }
});

test("direct profile supports presence, bookmark, archive, and delete", async ({
  browser,
  request,
}) => {
  const response = await request.post(`${apiUrl}/conversations/direct`, {
    headers: { Authorization: `Bearer ${sessions.user1.accessToken}` },
    data: { participantId: sessions.user2.user.id },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const conversation = (await response.json()).data;
  const conversationId = conversation.id;
  const authHeaders = {
    Authorization: `Bearer ${sessions.user1.accessToken}`,
  };

  if (conversation.isBookmarked) {
    await request.patch(`${apiUrl}/conversations/${conversationId}/bookmark`, {
      headers: authHeaders,
    });
  }
  if (conversation.isArchived) {
    await request.patch(`${apiUrl}/conversations/${conversationId}/archive`, {
      headers: authHeaders,
    });
  }

  const user = await createAuthenticatedPage(browser, sessions.user1);

  try {
    await openConversation(user.page, sessions.user2.user.username);
    await user.page
      .getByRole("button", { name: "Conversation details", exact: true })
      .click();
    const profileStatus = user.page
      .locator(".user-profile-sidebar")
      .getByText("Offline", { exact: true });
    await expect(profileStatus).toBeVisible();
    await expect(profileStatus.locator("i")).toHaveClass(/text-muted/);

    const bookmarkResponsePromise = user.page.waitForResponse(
      apiResponse =>
        apiResponse.request().method() === "PATCH" &&
        apiResponse
          .url()
          .endsWith(`/api/conversations/${conversationId}/bookmark`),
    );
    await user.page
      .getByRole("button", { name: "Pin conversation", exact: true })
      .click();
    expect((await bookmarkResponsePromise).status()).toBe(200);
    await expect(
      user.page.getByRole("button", {
        name: "Unpin conversation",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      user.page
        .locator(".chat-room-list")
        .getByRole("heading", { name: "Pinned Chats", exact: true }),
    ).toBeVisible();

    const removeBookmarkResponsePromise = user.page.waitForResponse(
      apiResponse =>
        apiResponse.request().method() === "PATCH" &&
        apiResponse
          .url()
          .endsWith(`/api/conversations/${conversationId}/bookmark`),
    );
    await user.page
      .getByRole("button", {
        name: "Unpin conversation",
        exact: true,
      })
      .click();
    expect((await removeBookmarkResponsePromise).status()).toBe(200);

    await user.page
      .getByRole("button", { name: "More conversation actions" })
      .click();
    const [archiveResponse] = await Promise.all([
      user.page.waitForResponse(
        apiResponse =>
          apiResponse.request().method() === "PATCH" &&
          apiResponse
            .url()
            .endsWith(`/api/conversations/${conversationId}/archive`),
      ),
      user.page
        .locator(".user-profile-sidebar .dropdown-menu.show")
        .getByText("Archive", { exact: true })
        .click(),
    ]);
    expect(archiveResponse.status()).toBe(200);
    await user.page.getByText("Archived Contacts", { exact: false }).click();
    await openConversation(user.page, sessions.user2.user.username);
    await user.page
      .getByRole("button", { name: "Conversation details", exact: true })
      .click();
    await user.page
      .getByRole("button", { name: "More conversation actions" })
      .click();
    const [restoreResponse] = await Promise.all([
      user.page.waitForResponse(
        apiResponse =>
          apiResponse.request().method() === "PATCH" &&
          apiResponse
            .url()
            .endsWith(`/api/conversations/${conversationId}/archive`),
      ),
      user.page
        .locator(".user-profile-sidebar .dropdown-menu.show")
        .getByText("Un-Archive", { exact: true })
        .click(),
    ]);
    expect(restoreResponse.status()).toBe(200);

    await user.page
      .locator(".chat-room-list")
      .getByRole("link", { name: /^Chats/ })
      .click();
    await openConversation(user.page, sessions.user2.user.username);
    await user.page
      .getByRole("button", { name: "Conversation details", exact: true })
      .click();
    await user.page
      .getByRole("button", { name: "More conversation actions" })
      .click();
    await user.page
      .locator(".user-profile-sidebar .dropdown-menu.show")
      .getByText("Delete", { exact: true })
      .click();
    await expect(
      user.page.getByRole("heading", {
        name: "Delete conversation?",
        exact: true,
      }),
    ).toBeVisible();
    const [deleteResponse] = await Promise.all([
      user.page.waitForResponse(
        apiResponse =>
          apiResponse.request().method() === "DELETE" &&
          apiResponse.url().endsWith(`/api/conversations/${conversationId}`),
      ),
      user.page
        .getByRole("dialog")
        .getByRole("button", { name: "Delete", exact: true })
        .click(),
    ]);
    expect(deleteResponse.status()).toBe(200);
    await expect(user.page.locator("#chat-input")).not.toBeVisible();
  } finally {
    await request.post(`${apiUrl}/conversations/direct`, {
      headers: authHeaders,
      data: { participantId: sessions.user2.user.id },
    });
    const detailResponse = await request.get(
      `${apiUrl}/conversations/${conversationId}`,
      { headers: authHeaders },
    );
    if (detailResponse.ok()) {
      const detail = (await detailResponse.json()).data;
      if (detail.isBookmarked) {
        await request.patch(
          `${apiUrl}/conversations/${conversationId}/bookmark`,
          { headers: authHeaders },
        );
      }
      if (detail.isArchived) {
        await request.patch(
          `${apiUrl}/conversations/${conversationId}/archive`,
          { headers: authHeaders },
        );
      }
    }
    await user.context.close();
  }
});

test("messages can be searched, bookmarked, reopened, and removed", async ({
  browser,
  request,
}) => {
  const response = await request.post(`${apiUrl}/conversations/direct`, {
    headers: { Authorization: `Bearer ${sessions.user1.accessToken}` },
    data: { participantId: sessions.user2.user.id },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const user = await createAuthenticatedPage(browser, sessions.user1, {
    viewport: { width: 1000, height: 620 },
  });
  const message = `search-bookmark-e2e-${Date.now()}`;

  try {
    await openConversation(user.page, sessions.user2.user.username);
    await user.page.locator("#chat-input").fill(message);
    await user.page.locator("#chat-input").press("Enter");

    const messageItem = user.page
      .locator("li.chat-list")
      .filter({ hasText: message })
      .last();
    await expect(messageItem).toBeVisible();

    await user.page.getByRole("button", { name: "Search messages" }).click();
    const searchInput = user.page.getByLabel(
      "Search messages in this conversation",
    );
    await searchInput.fill(message);
    const searchResult = user.page
      .locator(".message-search-result")
      .filter({ hasText: message });
    await expect(searchResult).toBeVisible();
    await searchResult.click();
    await expect(messageItem).toHaveClass(/message-search-highlight/);

    await messageItem.hover();
    await messageItem.getByRole("button", { name: "Message actions" }).click();
    const createResponsePromise = user.page.waitForResponse(
      apiResponse =>
        apiResponse.request().method() === "POST" &&
        apiResponse.url().endsWith("/api/bookmarks"),
    );
    await user.page
      .locator(".message-actions-menu.show")
      .getByText("Save message", { exact: true })
      .click();
    expect((await createResponsePromise).status()).toBe(201);

    await user.page.locator("#pills-bookmark-tab").click();
    await expect(
      user.page.getByRole("heading", { name: "Saved Messages", exact: true }),
    ).toBeVisible();
    const bookmarkItem = user.page
      .locator(".bookmark-message-item")
      .filter({ hasText: message });
    await expect(bookmarkItem).toBeVisible();
    await bookmarkItem.getByLabel("Saved message actions").click();
    const savedMenu = user.page.locator(".saved-message-actions-menu.show");
    await expect(savedMenu).toBeVisible();
    const savedMenuBounds = await savedMenu.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    expect(savedMenuBounds.top).toBeGreaterThanOrEqual(0);
    expect(savedMenuBounds.left).toBeGreaterThanOrEqual(0);
    expect(savedMenuBounds.right).toBeLessThanOrEqual(
      savedMenuBounds.viewportWidth,
    );
    expect(savedMenuBounds.bottom).toBeLessThanOrEqual(
      savedMenuBounds.viewportHeight,
    );
    await user.page.keyboard.press("Escape");
    await bookmarkItem
      .getByRole("button", {
        name: `Go to saved message: ${message}`,
        exact: true,
      })
      .click();

    await expect(messageItem).toBeVisible();
    await expect(messageItem).toHaveClass(/message-search-highlight/);
    const inputBounds = await user.page.locator("#chat-input").boundingBox();
    expect(inputBounds).not.toBeNull();
    expect((inputBounds?.y || 0) + (inputBounds?.height || 0)).toBeLessThanOrEqual(
      620,
    );
    expect(inputBounds?.y || 0).toBeGreaterThan(450);
    expect(await user.page.evaluate(() => window.scrollY)).toBe(0);
    await messageItem.hover();
    await messageItem.getByRole("button", { name: "Message actions" }).click();
    const deleteResponsePromise = user.page.waitForResponse(
      apiResponse =>
        apiResponse.request().method() === "DELETE" &&
        apiResponse.url().includes("/api/bookmarks/"),
    );
    await user.page
      .locator(".message-actions-menu.show")
      .getByText("Remove from saved", { exact: true })
      .click();
    expect((await deleteResponsePromise).status()).toBe(200);

    const bookmarksResponse = await request.get(`${apiUrl}/bookmarks`, {
      headers: { Authorization: `Bearer ${sessions.user1.accessToken}` },
    });
    expect(bookmarksResponse.ok(), await bookmarksResponse.text()).toBeTruthy();
    const bookmarkBody = await bookmarksResponse.json();
    expect(
      bookmarkBody.data.some(
        (bookmark: any) => bookmark.message?.content === message,
      ),
    ).toBeFalsy();
  } finally {
    await user.context.close();
  }
});

test("image attachments upload and render from the chat composer", async ({
  browser,
  request,
}) => {
  const response = await request.post(`${apiUrl}/conversations/direct`, {
    headers: { Authorization: `Bearer ${sessions.user1.accessToken}` },
    data: { participantId: sessions.user2.user.id },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const user = await createAuthenticatedPage(browser, sessions.user1);
  const fileName = `chat-image-${Date.now()}.png`;

  try {
    await openConversation(user.page, "aslıuser");
    await user.page
      .getByRole("button", { name: "More message options" })
      .click();
    await user.page.locator("#attached-image-input").setInputFiles({
      name: fileName,
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nXQAAAAASUVORK5CYII=",
        "base64",
      ),
    });

    const uploadResponse = user.page.waitForResponse(
      apiResponse =>
        apiResponse.request().method() === "POST" &&
        apiResponse.url().includes("/messages/attachments"),
    );
    await user.page.getByRole("button", { name: "Send message" }).click();
    expect((await uploadResponse).status()).toBe(201);

    const image = user.page.locator(`img[alt="${fileName}"]`);
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute("src", /^blob:/);
  } finally {
    await user.context.close();
  }
});

test("composer actions work and empty media counts do not render as zero", async ({
  browser,
  request,
}) => {
  const response = await request.post(`${apiUrl}/conversations/direct`, {
    headers: { Authorization: `Bearer ${sessions.user1.accessToken}` },
    data: { participantId: sessions.user2.user.id },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const user = await createAuthenticatedPage(browser, sessions.user1, {
    permissions: ["geolocation"],
    geolocation: { latitude: 41.0082, longitude: 28.9784 },
  });

  try {
    await openConversation(user.page, "aslıuser");
    const textMessage = `zero-regression-${Date.now()}`;
    await user.page.locator("#chat-input").fill(textMessage);
    await user.page.locator("#chat-input").press("Enter");
    const messageItem = user.page
      .locator("li.chat-list")
      .filter({ hasText: textMessage })
      .last();
    await expect(messageItem).toBeVisible();
    const zeroTextNodes = await messageItem.evaluate(root => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let count = 0;
      while (walker.nextNode()) {
        if (walker.currentNode.textContent?.trim() === "0") {
          count += 1;
        }
      }
      return count;
    });
    expect(zeroTextNodes).toBe(0);

    await user.page
      .getByRole("button", { name: "More message options" })
      .click();
    await user.page.getByRole("button", { name: "Open camera" }).click();
    const cameraDialog = user.page.getByRole("dialog");
    await expect(
      cameraDialog.getByRole("heading", { name: "Camera", exact: true }),
    ).toBeVisible();
    await expect(
      cameraDialog.locator('input[type="file"][accept="image/*"]'),
    ).toHaveAttribute("capture", "environment");
    await user.page.keyboard.press("Escape");

    await user.page
      .getByRole("button", { name: "More message options" })
      .click();
    await user.page.getByRole("button", { name: "Share location" }).click();
    await expect(user.page.locator("#chat-input")).toHaveValue(
      /41\.008200,28\.978400/,
    );
    await user.page.locator("#chat-input").fill("");

    await user.page
      .getByRole("button", { name: "More message options" })
      .click();
    await user.page.getByRole("button", { name: "Share contact" }).click();
    await expect(
      user.page.getByRole("heading", { name: "Share contact" }),
    ).toBeVisible();
    const sharedContact = user.page
      .locator(".list-group-item.list-group-item-action")
      .first();
    const sharedUsername = (
      (await sharedContact.locator("strong").textContent()) || ""
    ).trim();
    await sharedContact.click();
    await expect(
      user.page.getByText(`Sharing contact: ${sharedUsername}`, {
        exact: true,
      }),
    ).toBeVisible();
    await user.page.getByRole("button", { name: "Send message" }).click();
    const sharedContactCard = user.page
      .getByRole("button", {
        name: `Open ${sharedUsername} profile`,
      })
      .last();
    await expect(sharedContactCard).toBeVisible();
    await sharedContactCard.click();
    await expect(
      user.page.getByRole("heading", { name: "User profile" }),
    ).toBeVisible();
    const userProfileDialog = user.page.getByRole("dialog");
    await expect(
      userProfileDialog.getByRole("button", {
        name: "Already a contact",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      userProfileDialog.getByRole("button", {
        name: "Add contact",
        exact: true,
      }),
    ).toHaveCount(0);
    await user.page.keyboard.press("Escape");

    const audioName = `audio-${Date.now()}.mp3`;
    await user.page
      .getByRole("button", { name: "More message options" })
      .click();
    await user.page.locator("#audio-file-input").setInputFiles({
      name: audioName,
      mimeType: "audio/mpeg",
      buffer: Buffer.concat([Buffer.from("ID3"), Buffer.alloc(64)]),
    });
    const uploadResponse = user.page.waitForResponse(
      apiResponse =>
        apiResponse.request().method() === "POST" &&
        apiResponse.url().includes("/messages/attachments"),
    );
    await user.page.getByRole("button", { name: "Send message" }).click();
    expect((await uploadResponse).status()).toBe(201);
    await expect(user.page.getByText(audioName, { exact: true })).toBeVisible();
  } finally {
    await user.context.close();
  }
});

test("an open conversation reconnects after a temporary network outage", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const user = await createAuthenticatedPage(browser, sessions.user1);

  try {
    await openConversation(user.page, "aslıuser");
    await user.context.setOffline(true);
    await expect(
      user.page.getByText("REST fallback active", { exact: true }),
    ).toBeVisible({ timeout: 60_000 });

    await user.context.setOffline(false);
    await expect(
      user.page.getByText("Realtime connected", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    const message = `reconnect-e2e-${Date.now()}`;
    await user.page.locator("#chat-input").fill(message);
    await user.page.locator("#chat-input").press("Enter");
    await expect(user.page.getByText(message, { exact: true })).toHaveCount(1);
  } finally {
    await user.context.close();
  }
});

test("the core chat flow fits a mobile viewport without horizontal overflow", async ({
  browser,
  request,
}) => {
  const response = await request.post(`${apiUrl}/conversations/direct`, {
    headers: { Authorization: `Bearer ${sessions.user1.accessToken}` },
    data: { participantId: sessions.user2.user.id },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const user = await createAuthenticatedPage(browser, sessions.user1, {
    viewport: { width: 390, height: 844 },
  });

  try {
    await expect(
      user.page.getByRole("heading", { name: "Chats", exact: true }),
    ).toBeVisible();
    await openConversation(user.page, sessions.user2.user.username);
    await expect(user.page.locator("#chat-input")).toBeVisible();

    const layout = await user.page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);

    const inputBox = await user.page.locator("#chat-input").boundingBox();
    expect(inputBox).not.toBeNull();
    expect(inputBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((inputBox?.x ?? 0) + (inputBox?.width ?? 0)).toBeLessThanOrEqual(
      390,
    );
  } finally {
    await user.context.close();
  }
});

test("group info fits a mobile viewport without horizontal overflow", async ({
  browser,
  request,
}) => {
  const groupName = `mobile-group-info-${Date.now()}`;
  const response = await request.post(`${apiUrl}/conversations/groups`, {
    headers: { Authorization: `Bearer ${sessions.admin.accessToken}` },
    data: {
      name: groupName,
      participantIds: [sessions.user1.user.id],
      memberCanSendMessages: true,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const admin = await createAuthenticatedPage(browser, sessions.admin, {
    viewport: { width: 390, height: 844 },
  });

  try {
    await openConversation(admin.page, groupName);
    await openGroupInfo(admin.page);

    const layout = await admin.page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);

    const panelBox = await admin.page
      .locator(".user-profile-sidebar")
      .boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((panelBox?.x ?? 0) + (panelBox?.width ?? 0)).toBeLessThanOrEqual(
      390,
    );
  } finally {
    await admin.context.close();
  }
});

test("login and dashboard have no serious accessibility violations", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto("/auth-login", { waitUntil: "domcontentloaded" });
    const loginResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      loginResults.violations.filter(violation =>
        ["serious", "critical"].includes(violation.impact || ""),
      ),
    ).toEqual([]);

    await page.evaluate(authUser => {
      window.localStorage.setItem("authUser", JSON.stringify(authUser));
    }, toFrontendAuthUser(sessions.user1));
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Chats", exact: true }),
    ).toBeVisible();
    const dashboardResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      dashboardResults.violations.filter(violation =>
        ["serious", "critical"].includes(violation.impact || ""),
      ),
    ).toEqual([]);
  } finally {
    await context.close();
  }
});

test("message owners can edit and delete for both open clients", async ({
  browser,
  request,
}) => {
  const response = await request.post(`${apiUrl}/conversations/direct`, {
    headers: { Authorization: `Bearer ${sessions.user1.accessToken}` },
    data: { participantId: sessions.user2.user.id },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const { user1Context, user2Context, user1Page, user2Page } =
    await createUserPages(browser);

  try {
    await openConversation(user1Page, "aslıuser");
    await openConversation(user2Page, "emiruser");

    const originalMessage = `message-actions-${Date.now()}`;
    const editedMessage = `${originalMessage}-edited`;
    await user1Page.locator("#chat-input").fill(originalMessage);
    await user1Page.locator("#chat-input").press("Enter");

    await expect(
      user1Page.getByText(originalMessage, { exact: true }),
    ).toBeVisible();
    await expect(
      user2Page.getByText(originalMessage, { exact: true }),
    ).toBeVisible();

    const senderRow = user1Page
      .locator("li.chat-list")
      .filter({ hasText: originalMessage })
      .last();
    const messageId = await senderRow.getAttribute("data-message-id");
    expect(messageId).toBeTruthy();

    const senderMessage = user1Page.locator(
      `li.chat-list[data-message-id="${messageId}"]`,
    );
    const recipientMessage = user2Page.locator(
      `li.chat-list[data-message-id="${messageId}"]`,
    );

    const senderActionRows = user1Page
      .locator("li.chat-list[data-message-id]")
      .filter({ has: user1Page.getByLabel("Message actions") });
    await expectMessageMenuWithinViewport(user1Page, senderActionRows.first());
    await expectMessageMenuWithinViewport(user1Page, senderActionRows.last());

    await recipientMessage.hover();
    await recipientMessage.getByLabel("Message actions").click();
    const recipientActions = user2Page.locator(".message-actions-menu.show");
    await expect(
      recipientActions.getByText("Edit", { exact: true }),
    ).toHaveCount(0);
    await expect(
      recipientActions.getByText("Delete", { exact: true }),
    ).toHaveCount(0);
    await user2Page.keyboard.press("Escape");

    await senderMessage.hover();
    await senderMessage.getByLabel("Message actions").click();
    await user1Page
      .locator(".message-actions-menu.show")
      .getByText("Edit", { exact: true })
      .click();
    await senderMessage.getByLabel("Edit message").fill(editedMessage);
    await senderMessage.getByLabel("Save message edit").click();

    await expect(
      senderMessage.getByText(editedMessage, { exact: true }),
    ).toBeVisible();
    await expect(
      recipientMessage.getByText(editedMessage, { exact: true }),
    ).toBeVisible();
    await expect(
      senderMessage.getByText("edited", { exact: true }),
    ).toBeVisible();

    await senderMessage.hover();
    await senderMessage.getByLabel("Message actions").click();
    await user1Page
      .locator(".message-actions-menu.show")
      .getByText("Delete", { exact: true })
      .click();
    await user1Page
      .getByRole("button", { name: "Delete message", exact: true })
      .click();

    await expect(
      senderMessage.getByText("This message was deleted", { exact: true }),
    ).toBeVisible();
    await expect(
      recipientMessage.getByText("This message was deleted", { exact: true }),
    ).toBeVisible();
    await senderMessage.hover();
    await senderMessage.getByLabel("Message actions").click();
    await expect(
      user1Page
        .locator(".message-actions-menu.show")
        .getByText("Delete", { exact: true }),
    ).toHaveCount(0);
  } finally {
    await closeContexts(user1Context, user2Context);
  }
});

test("locked members cannot see the private manager chat", async ({
  browser,
  request,
}) => {
  const groupName = `manager-chat-${Date.now()}`;
  const response = await request.post(`${apiUrl}/conversations/groups`, {
    headers: { Authorization: `Bearer ${sessions.admin.accessToken}` },
    data: {
      name: groupName,
      description: "Manager chat visibility test",
      participantIds: [sessions.user1.user.id, sessions.user2.user.id],
      managerIds: [sessions.user1.user.id],
      memberCanSendMessages: false,
      membersCanLeave: false,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const admin = await createAuthenticatedPage(browser, sessions.admin);
  const { user1Context, user2Context, user1Page, user2Page } =
    await createUserPages(browser);

  try {
    await openConversation(admin.page, groupName);
    await openConversation(user1Page, groupName);

    const memberConversation = user2Page
      .locator(".chat-user-list li")
      .filter({ hasText: groupName })
      .first();
    await expect(memberConversation).toBeVisible();
    await memberConversation.click();
    await expect(
      user2Page.getByText(
        "Members cannot send messages in this group. Only group management can send.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(user2Page.locator("#chat-input")).toHaveCount(0);
    await expect(
      user2Page.getByRole("button", { name: "Manager Chat", exact: true }),
    ).toHaveCount(0);

    await admin.page
      .getByRole("button", { name: "Manager Chat", exact: true })
      .click();
    await user1Page
      .getByRole("button", { name: "Manager Chat", exact: true })
      .click();

    const privateMessage = `private-manager-note-${Date.now()}`;
    await user1Page.locator("#chat-input").fill(privateMessage);
    await user1Page.locator("#chat-input").press("Enter");

    await expect(
      user1Page.getByText(privateMessage, { exact: true }),
    ).toBeVisible();
    await expect(
      admin.page.getByText(privateMessage, { exact: true }),
    ).toBeVisible();
    await expect(
      user2Page.getByText(privateMessage, { exact: true }),
    ).toHaveCount(0);
  } finally {
    await closeContexts(admin.context, user1Context, user2Context);
  }
});

test("group messages arrive in the other participant's open conversation", async ({
  browser,
  request,
}) => {
  const directResponse = await request.post(`${apiUrl}/conversations/direct`, {
    headers: { Authorization: `Bearer ${sessions.user1.accessToken}` },
    data: { participantId: sessions.user2.user.id },
  });
  expect(directResponse.ok(), await directResponse.text()).toBeTruthy();

  const groupName = `e2e-group-${Date.now()}`;
  const response = await request.post(`${apiUrl}/conversations/groups`, {
    headers: { Authorization: `Bearer ${sessions.admin.accessToken}` },
    data: {
      name: groupName,
      participantIds: [sessions.user1.user.id, sessions.user2.user.id],
      memberCanSendMessages: true,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const { user1Context, user2Context, user1Page, user2Page } =
    await createUserPages(browser);

  try {
    await openConversation(user1Page, groupName);
    await openConversation(user2Page, groupName);

    const message = `group-e2e-${Date.now()}`;
    await user1Page.locator("#chat-input").fill(message);
    await user1Page.locator("#chat-input").press("Enter");

    await expect(user1Page.getByText(message, { exact: true })).toBeVisible();
    await expect(user2Page.getByText(message, { exact: true })).toBeVisible();
    await expect(user1Page.getByText(message, { exact: true })).toHaveCount(1);
    await expect(user2Page.getByText(message, { exact: true })).toHaveCount(1);
    const incomingMessage = user2Page
      .locator("li.chat-list")
      .filter({ hasText: message })
      .last();
    await incomingMessage
      .getByRole("button", { name: "Open emiruser profile" })
      .click();
    await expect(
      user2Page.getByRole("heading", { name: "User profile" }),
    ).toBeVisible();
    const profileDialog = user2Page.getByRole("dialog");
    await expect(
      profileDialog.getByRole("button", {
        name: "Already a contact",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      profileDialog.getByRole("button", {
        name: "Add contact",
        exact: true,
      }),
    ).toHaveCount(0);
    await user2Page.keyboard.press("Escape");

    const reply = `group-reply-e2e-${Date.now()}`;
    await user2Page.locator("#chat-input").fill(reply);
    await user2Page.locator("#chat-input").press("Enter");

    await expect(user1Page.getByText(reply, { exact: true })).toBeVisible();
    await expect(user2Page.getByText(reply, { exact: true })).toBeVisible();
    await expect(user1Page.getByText(reply, { exact: true })).toHaveCount(1);
    await expect(user2Page.getByText(reply, { exact: true })).toHaveCount(1);
  } finally {
    await closeContexts(user1Context, user2Context);
  }
});

test("users can answer, mute, and end a direct audio call", async ({
  browser,
  request,
}) => {
  const response = await request.post(`${apiUrl}/conversations/direct`, {
    headers: { Authorization: `Bearer ${sessions.user1.accessToken}` },
    data: { participantId: sessions.user2.user.id },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const [caller, recipient] = await Promise.all([
    createAuthenticatedPage(browser, sessions.user1, {
      permissions: ["microphone"],
    }),
    createAuthenticatedPage(browser, sessions.user2, {
      permissions: ["microphone"],
      viewport: { width: 390, height: 844 },
    }),
  ]);

  try {
    await openConversation(caller.page, sessions.user2.user.username);
    await expect(
      caller.page.getByText("Online", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await caller.page
      .getByRole("button", { name: "Conversation details", exact: true })
      .click();
    await caller.page
      .getByRole("button", { name: "Start audio call", exact: true })
      .click();

    const incomingDialog = recipient.page.getByRole("dialog");
    await expect(
      incomingDialog.getByText("Incoming audio call", { exact: true }),
    ).toBeVisible();
    await expect(
      incomingDialog.getByRole("heading", {
        name: sessions.user1.user.username,
        exact: true,
      }),
    ).toBeVisible();
    await incomingDialog
      .getByRole("button", { name: "Answer audio call", exact: true })
      .click();

    await expect(
      caller.page.getByText("Connected", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      recipient.page.getByText("Connected", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    const muteButton = caller.page.getByRole("button", {
      name: "Mute microphone",
      exact: true,
    });
    await muteButton.click();
    await expect(
      caller.page.getByRole("button", {
        name: "Unmute microphone",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");

    await caller.page
      .getByRole("button", { name: "End audio call", exact: true })
      .click();
    await expect(caller.page.getByRole("dialog")).toHaveCount(0);
    await expect(
      recipient.page.getByText("Call ended", { exact: true }),
    ).toBeVisible();
    await recipient.page.getByRole("button", { name: "Close" }).click();

    await caller.page.locator("#pills-calls-tab").click();
    await expect(
      caller.page.getByRole("heading", { name: "Calls", exact: true }),
    ).toBeVisible();
    const callerHistory = caller.page
      .locator(".call-history-item")
      .filter({ hasText: sessions.user2.user.username })
      .first();
    await expect(callerHistory).toContainText("Completed");
    await expect(callerHistory).toContainText(/(< 1s|\d{2}:\d{2})/);
    await expect(
      callerHistory.getByRole("button", {
        name: `Call ${sessions.user2.user.username}`,
        exact: true,
      }),
    ).toBeEnabled();

    await recipient.page.locator("#pills-calls-tab").click();
    const recipientHistory = recipient.page
      .locator(".call-history-item")
      .filter({ hasText: sessions.user1.user.username })
      .first();
    await expect(recipientHistory).toContainText("Completed");
  } finally {
    await closeContexts(caller.context, recipient.context);
  }
});

test("a ringing audio call survives a temporary socket outage", async ({
  browser,
  request,
}) => {
  test.setTimeout(90_000);
  const response = await request.post(`${apiUrl}/conversations/direct`, {
    headers: { Authorization: `Bearer ${sessions.user1.accessToken}` },
    data: { participantId: sessions.user2.user.id },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const [caller, recipient] = await Promise.all([
    createAuthenticatedPage(browser, sessions.user1, {
      permissions: ["microphone"],
    }),
    createAuthenticatedPage(browser, sessions.user2, {
      permissions: ["microphone"],
    }),
  ]);

  try {
    await openConversation(caller.page, sessions.user2.user.username);
    await expect(
      caller.page.getByText("Online", { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await caller.page
      .getByRole("button", { name: "Conversation details", exact: true })
      .click();
    await caller.page
      .getByRole("button", { name: "Start audio call", exact: true })
      .click();

    await expect(
      recipient.page.getByText("Incoming audio call", { exact: true }),
    ).toBeVisible();
    await caller.context.setOffline(true);
    await expect(
      caller.page.getByText("Reconnecting to the call...", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      recipient.page.getByText("Incoming audio call", { exact: true }),
    ).toBeVisible();

    await caller.context.setOffline(false);
    await expect(
      caller.page.getByText("Calling...", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      recipient.page.getByText("Incoming audio call", { exact: true }),
    ).toBeVisible();

    await recipient.page
      .getByRole("button", { name: "Decline audio call", exact: true })
      .click();
    await expect(
      caller.page.getByText(/declined the call$/, { exact: false }),
    ).toBeVisible();
  } finally {
    await caller.context.setOffline(false);
    await closeContexts(caller.context, recipient.context);
  }
});

test("group management actions are visible, authorized, and realtime", async ({
  browser,
  request,
}) => {
  const groupName = `manage-group-${Date.now()}`;
  const renamedGroup = `${groupName}-renamed`;
  const response = await request.post(`${apiUrl}/conversations/groups`, {
    headers: { Authorization: `Bearer ${sessions.admin.accessToken}` },
    data: {
      name: groupName,
      participantIds: [sessions.user1.user.id, sessions.user2.user.id],
      memberCanSendMessages: true,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const admin = await createAuthenticatedPage(browser, sessions.admin);
  const { user1Context, user2Context, user1Page, user2Page } =
    await createUserPages(browser);

  try {
    await openConversation(admin.page, groupName);
    await openConversation(user1Page, groupName);
    await openConversation(user2Page, groupName);
    await openGroupInfo(admin.page);
    await openGroupInfo(user1Page);
    await openGroupInfo(user2Page);

    await expect(
      admin.page.getByText("3 online", { exact: true }),
    ).toBeVisible();
    await expect(
      user1Page.getByRole("button", {
        name: "Save group details",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      user1Page.getByRole("button", { name: "Leave group" }),
    ).toBeEnabled();
    await expect(
      admin.page.getByRole("button", { name: "Leave group" }),
    ).toBeDisabled();

    await admin.page.getByLabel("Members can message").uncheck();
    await expect(
      admin.page.getByText("Member messaging disabled", { exact: true }),
    ).toBeVisible();
    await expect(
      user2Page.getByText(
        "Members cannot send messages in this group. Only group management can send.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(user2Page.locator("#chat-input")).toHaveCount(0);

    await admin.page.getByLabel("Members can message").check();
    await expect(
      admin.page.getByText("Members can now send messages", { exact: true }),
    ).toBeVisible();
    await expect(user2Page.locator("#chat-input")).toBeVisible();
    const policyEnabledMessage = `policy-enabled-${Date.now()}`;
    await user2Page.locator("#chat-input").fill(policyEnabledMessage);
    await user2Page.locator("#chat-input").press("Enter");
    await expect(
      admin.page.getByText(policyEnabledMessage, { exact: true }),
    ).toBeVisible();

    await admin.page.locator("#group-name-input").fill(renamedGroup);
    await admin.page
      .getByRole("button", { name: "Save group details", exact: true })
      .click();
    await expect(
      admin.page
        .locator(".user-chat-topbar")
        .getByRole("heading", { name: renamedGroup }),
    ).toBeVisible();

    await admin.page
      .locator("#group-owner-input")
      .selectOption({ label: sessions.user1.user.username });
    admin.page.once("dialog", dialog => dialog.accept());
    await admin.page
      .getByRole("button", { name: "Transfer ownership", exact: true })
      .click();
    await expect(
      admin.page.getByText("Group ownership transferred", { exact: true }),
    ).toBeVisible();
    await expect(
      admin.page.getByRole("button", { name: "Leave group" }),
    ).toBeEnabled();

    admin.page.once("dialog", dialog => dialog.accept());
    await admin.page
      .getByLabel(`Remove ${sessions.user2.user.username}`)
      .click();
    await expect(
      admin.page.getByText("2 online", { exact: true }),
    ).toBeVisible();
    await expect(user2Page.locator("#chat-input")).toHaveCount(0);
    await expect(
      user1Page.getByRole("button", { name: "Leave group" }),
    ).toBeDisabled();
  } finally {
    await closeContexts(admin.context, user1Context, user2Context);
  }
});

test("a group member can leave from the conversation controls", async ({
  browser,
  request,
}) => {
  const groupName = `leave-group-${Date.now()}`;
  const response = await request.post(`${apiUrl}/conversations/groups`, {
    headers: { Authorization: `Bearer ${sessions.admin.accessToken}` },
    data: {
      name: groupName,
      participantIds: [sessions.user2.user.id],
      memberCanSendMessages: true,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const member = await createAuthenticatedPage(browser, sessions.user2);

  try {
    await openConversation(member.page, groupName);
    await openGroupInfo(member.page);
    member.page.once("dialog", dialog => dialog.accept());
    await member.page
      .getByRole("button", { name: "Leave group", exact: true })
      .click();

    await expect(member.page.locator("#chat-input")).toHaveCount(0);
    await expect(
      member.page.locator(".chat-user-list li").filter({ hasText: groupName }),
    ).toHaveCount(0, { timeout: 15_000 });
  } finally {
    await member.context.close();
  }
});

test("group info member action opens a valid direct conversation", async ({
  browser,
  request,
}) => {
  const groupName = `member-direct-${Date.now()}`;
  const response = await request.post(`${apiUrl}/conversations/groups`, {
    headers: { Authorization: `Bearer ${sessions.admin.accessToken}` },
    data: {
      name: groupName,
      participantIds: [sessions.user1.user.id],
      memberCanSendMessages: true,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const admin = await createAuthenticatedPage(browser, sessions.admin);

  try {
    await openConversation(admin.page, groupName);
    await openGroupInfo(admin.page);
    await admin.page
      .getByRole("button", {
        name: `Message ${sessions.user1.user.username}`,
        exact: true,
      })
      .click();

    await expect(
      admin.page.getByRole("heading", {
        name: sessions.user1.user.username,
        exact: true,
      }),
    ).toBeVisible();
    await expect(admin.page.locator("#chat-input")).toBeVisible();

    const message = `group-info-direct-${Date.now()}`;
    await admin.page.locator("#chat-input").fill(message);
    await admin.page.locator("#chat-input").press("Enter");
    await expect(admin.page.getByText(message, { exact: true })).toBeVisible();
    await expect(
      admin.page.getByText("Invalid socket payload", { exact: true }),
    ).toHaveCount(0);
  } finally {
    await admin.context.close();
  }
});
