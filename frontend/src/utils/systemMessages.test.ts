import i18n from "../i18n";
import { translateKnownSystemMessage } from "./systemMessages";

describe("known system message translations", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("translates known group lifecycle templates", async () => {
    await i18n.changeLanguage("tr");
    const translate = i18n.t.bind(i18n);

    expect(
      translateKnownSystemMessage('Group "Demo" was created.', translate),
    ).toBe('"Demo" grubu oluşturuldu.');
    expect(
      translateKnownSystemMessage("aslıuser joined the group.", translate),
    ).toBe("aslıuser gruba katıldı.");
    expect(
      translateKnownSystemMessage(
        "A user was removed from the group.",
        translate,
      ),
    ).toBe("Bir kullanıcı gruptan çıkarıldı.");
  });

  it("translates combined group setting events without touching other text", async () => {
    await i18n.changeLanguage("tr");
    const translate = i18n.t.bind(i18n);

    expect(
      translateKnownSystemMessage(
        "Group description was updated. Members can now send messages.",
        translate,
      ),
    ).toBe("Grup açıklaması güncellendi. Üyeler artık mesaj gönderebilir.");
    expect(
      translateKnownSystemMessage(
        "User-authored text stays the same.",
        translate,
      ),
    ).toBe("User-authored text stays the same.");
  });
});
