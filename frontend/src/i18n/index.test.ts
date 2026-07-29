import fs from "fs";
import path from "path";
import {
  detectInitialLanguage,
  LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
} from "./index";
import i18n from "./index";
import { en, tr } from "./resources";

const collectLeafKeys = (value: unknown, prefix = ""): string[] => {
  if (!value || typeof value !== "object") {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    collectLeafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
};

const collectSourceFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });

describe("language preferences", () => {
  afterEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("normalizes Turkish regional locales", () => {
    expect(normalizeLanguage("tr-TR")).toBe("tr");
    expect(normalizeLanguage("en-US")).toBe("en");
    expect(normalizeLanguage("de-DE")).toBe("en");
  });

  it("prefers a stored language over the browser locale", () => {
    expect(detectInitialLanguage("en", "tr-TR")).toBe("en");
    expect(detectInitialLanguage(null, "tr-TR")).toBe("tr");
  });

  it("persists language changes and updates the document language", async () => {
    await i18n.changeLanguage("tr");

    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("tr");
    expect(document.documentElement.lang).toBe("tr");
    expect(i18n.t("nav.chats")).toBe("Sohbetler");
  });

  it("keeps English and Turkish translation keys in sync", () => {
    expect(collectLeafKeys(tr).sort()).toEqual(collectLeafKeys(en).sort());
  });

  it("defines every statically referenced translation key", () => {
    const missingKeys = new Set<string>();
    const translationCallPattern = /\bt\(\s*["']([A-Za-z0-9_.-]+)["']/g;
    const languageDefinesKey = (key: string, language: "en" | "tr") =>
      i18n.exists(key, { lng: language }) ||
      (i18n.exists(`${key}_one`, { lng: language }) &&
        i18n.exists(`${key}_other`, { lng: language }));

    collectSourceFiles(path.join(process.cwd(), "src")).forEach(filePath => {
      const source = fs.readFileSync(filePath, "utf8");
      let match: RegExpExecArray | null;

      while ((match = translationCallPattern.exec(source)) !== null) {
        const key = match[1];

        if (!languageDefinesKey(key, "en") || !languageDefinesKey(key, "tr")) {
          missingKeys.add(key);
        }
      }
    });

    expect(Array.from(missingKeys).sort()).toEqual([]);
  });
});
