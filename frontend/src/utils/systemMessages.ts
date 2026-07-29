type Translate = (
  key: string,
  options?: Record<string, string | number>,
) => string;

const localizeUsername = (username: string, t: Translate) =>
  username === "A user" ? t("system.unknownUser") : username;

export const translateKnownSystemMessage = (
  content: string,
  t: Translate,
): string => {
  let translated = content;

  translated = translated.replace(
    /Group name changed from "([^"]+)" to "([^"]+)"\./g,
    (_match, oldName: string, newName: string) =>
      t("system.nameChanged", { oldName, newName }),
  );
  translated = translated.replace(
    /Group "([^"]+)" was created\./g,
    (_match, name: string) => t("system.groupCreated", { name }),
  );
  translated = translated.replace(
    /(.+?) joined through automation\./g,
    (_match, users: string) => t("system.automationJoined", { users }),
  );
  translated = translated.replace(
    /Group description was updated\./g,
    t("system.descriptionUpdated"),
  );
  translated = translated.replace(
    /Members can now send messages\./g,
    t("system.membersCanSend"),
  );
  translated = translated.replace(
    /Only group management can send messages\./g,
    t("system.managementOnly"),
  );
  translated = translated.replace(
    /Members can now leave the group\./g,
    t("system.membersCanLeave"),
  );
  translated = translated.replace(
    /Members can no longer leave the group\./g,
    t("system.membersCannotLeave"),
  );
  translated = translated.replace(
    /Group status changed to (active|closed|archived)\./g,
    (_match, status: string) =>
      t("system.statusChanged", {
        status: t(`system.status.${status}`),
      }),
  );
  translated = translated.replace(
    /(.+?) is now the group owner\./g,
    (_match, username: string) =>
      t("system.ownerChanged", {
        username: localizeUsername(username, t),
      }),
  );
  translated = translated.replace(
    /(.+?) is now a (manager|member)\./g,
    (_match, username: string, role: string) =>
      t("system.roleChanged", {
        username: localizeUsername(username, t),
        role: t(`system.role.${role}`),
      }),
  );
  translated = translated.replace(
    /(.+?) left the group\./g,
    (_match, username: string) =>
      t("system.leftGroup", {
        username: localizeUsername(username, t),
      }),
  );
  translated = translated.replace(
    /(.+?) joined the group\./g,
    (_match, username: string) =>
      t("system.joinedGroup", {
        username: localizeUsername(username, t),
      }),
  );
  translated = translated.replace(
    /(.+?) was removed from the group\./g,
    (_match, username: string) =>
      t("system.removedGroup", {
        username: localizeUsername(username, t),
      }),
  );

  return translated;
};
