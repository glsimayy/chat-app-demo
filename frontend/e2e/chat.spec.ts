import {
  APIRequestContext,
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
  expect,
  test,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const apiUrl = "http://127.0.0.1:3000/api";
const accounts = {
  admin: {
    email: "admin@ello.local",
    password: "Admin123!",
    role: "admin",
  },
  user1: {
    email: "user1@ello.local",
    password: "User123!",
    role: "user",
  },
  user2: {
    email: "user2@ello.local",
    password: "User123!",
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
  await page.goto("/auth-login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Log In" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Chats" })).toBeVisible();
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
  ).toBeVisible();
}

async function createAuthenticatedPage(
  browser: Browser,
  session: AuthSession,
  contextOptions: BrowserContextOptions = {},
) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await page.goto("/auth-login");
  await page.evaluate(authUser => {
    window.localStorage.setItem("authUser", JSON.stringify(authUser));
  }, toFrontendAuthUser(session));
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Chats" })).toBeVisible();

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
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/auth-login$/);
  await expect(page.getByRole("button", { name: "Log In" })).toBeVisible();
});

test("invalid sessions are cleared before the dashboard renders", async ({
  page,
}) => {
  await page.goto("/auth-login");
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

  await page.goto("/dashboard");

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
  await page.goto("/auth-login");
  await page.getByLabel("Email").fill(accounts.user1.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(accounts.user1.password);
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

test("contacts open or create a direct conversation", async ({
  browser,
  request,
}) => {
  const suffix = Date.now();
  const username = `contact${suffix}`;
  const response = await request.post(`${apiUrl}/auth/register`, {
    data: {
      email: `${username}@ello.local`,
      username,
      password: "Contact123!",
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const admin = await createAuthenticatedPage(browser, sessions.admin);

  try {
    await admin.page.getByRole("link", { name: "Contacts", exact: true }).click();
    const contact = admin.page
      .locator(".contact-list li")
      .filter({ hasText: username });

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

test("logout clears the session and protects the dashboard", async ({
  browser,
}) => {
  const { context, page } = await createAuthenticatedPage(
    browser,
    sessions.user1,
  );

  try {
    await page.getByLabel("Open profile menu").click();
    await page.getByText("Log out", { exact: true }).click();

    await expect(page).toHaveURL(/\/logout$/);
    await expect(
      page.getByRole("heading", { name: "You are Logged Out" }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("authUser")))
      .toBeNull();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth-login$/);
  } finally {
    await context.close();
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
    await openConversation(user1Page, "user2");
    await openConversation(user2Page, "user1");

    const message = `direct-e2e-${Date.now()}`;
    await user1Page.locator("#chat-input").fill(message);
    await user1Page.locator("#chat-input").press("Enter");

    await expect(user1Page.getByText(message, { exact: true })).toBeVisible();
    await expect(user2Page.getByText(message, { exact: true })).toBeVisible();
    await expect(user1Page.getByText(message, { exact: true })).toHaveCount(1);
    await expect(user2Page.getByText(message, { exact: true })).toHaveCount(1);

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

test("an open conversation reconnects after a temporary network outage", async ({
  browser,
}) => {
  const user = await createAuthenticatedPage(browser, sessions.user1);

  try {
    await openConversation(user.page, "user2");
    await user.context.setOffline(true);
    await expect(
      user.page.getByText("REST fallback active", { exact: true }),
    ).toBeVisible({ timeout: 10_000 });

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
}) => {
  const user = await createAuthenticatedPage(browser, sessions.user1, {
    viewport: { width: 390, height: 844 },
  });

  try {
    await expect(
      user.page.getByRole("heading", { name: "Chats" }),
    ).toBeVisible();
    await openConversation(user.page, "user2");
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

test("login and dashboard have no serious accessibility violations", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto("/auth-login");
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
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Chats" })).toBeVisible();
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
    await openConversation(user1Page, "user2");
    await openConversation(user2Page, "user1");

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

    await recipientMessage.hover();
    await recipientMessage.getByLabel("Message actions").click();
    await expect(
      recipientMessage.getByText("Edit", { exact: true }),
    ).toHaveCount(0);
    await expect(
      recipientMessage.getByText("Delete", { exact: true }),
    ).toHaveCount(0);

    await senderMessage.hover();
    await senderMessage.getByLabel("Message actions").click();
    await senderMessage.getByText("Edit", { exact: true }).click();
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
    await senderMessage.getByText("Delete", { exact: true }).click();
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
      senderMessage.getByText("Delete", { exact: true }),
    ).toHaveCount(0);
  } finally {
    await closeContexts(user1Context, user2Context);
  }
});

test("group messages arrive in the other participant's open conversation", async ({
  browser,
  request,
}) => {
  const groupName = `e2e-group-${Date.now()}`;
  const response = await request.post(`${apiUrl}/conversations/groups`, {
    headers: { Authorization: `Bearer ${sessions.admin.accessToken}` },
    data: {
      name: groupName,
      participantIds: [sessions.user1.user.id, sessions.user2.user.id],
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

    await expect(
      admin.page.getByText("3 online", { exact: true }),
    ).toBeVisible();
    await expect(
      user1Page.getByRole("button", {
        name: "Save group name",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      user1Page.getByRole("button", { name: "Leave group" }),
    ).toBeEnabled();
    await expect(
      admin.page.getByRole("button", { name: "Leave group" }),
    ).toBeDisabled();

    await admin.page.locator("#group-name-input").fill(renamedGroup);
    await admin.page
      .getByRole("button", { name: "Save group name", exact: true })
      .click();
    await expect(
      admin.page.getByRole("heading", { name: renamedGroup }),
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
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();

  const member = await createAuthenticatedPage(browser, sessions.user2);

  try {
    await openConversation(member.page, groupName);
    member.page.once("dialog", dialog => dialog.accept());
    await member.page
      .getByRole("button", { name: "Leave group", exact: true })
      .click();

    await expect(member.page.locator("#chat-input")).toHaveCount(0);
    await expect(
      member.page.locator(".chat-user-list li").filter({ hasText: groupName }),
    ).toHaveCount(0);
  } finally {
    await member.context.close();
  }
});
