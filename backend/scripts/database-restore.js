const fs = require("node:fs");
const {
  getDatabaseToolConfig,
  resolveRequiredFile,
  runDocker,
} = require("./database-process");

async function main() {
  const source = resolveRequiredFile(process.argv[2], "Backup input");
  const { container, database, user } = getDatabaseToolConfig();

  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error(`Backup file does not exist: ${source}`);
  }

  if (process.env.CONFIRM_DATABASE_RESTORE !== database) {
    throw new Error(
      `Set CONFIRM_DATABASE_RESTORE=${database} to confirm destructive restore`,
    );
  }

  await runDocker(
    [
      "exec",
      "-i",
      container,
      "pg_restore",
      "--username",
      user,
      "--dbname",
      database,
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
    ],
    { inputFile: source },
  );

  console.log(`Restore completed: ${source} -> ${database}`);
}

main().catch(error => {
  console.error(`Restore failed: ${error.message}`);
  process.exitCode = 1;
});
