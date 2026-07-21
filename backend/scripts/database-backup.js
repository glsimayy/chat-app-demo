const fs = require("node:fs");
const path = require("node:path");
const {
  getDatabaseToolConfig,
  resolveRequiredFile,
  runDocker,
} = require("./database-process");

async function main() {
  const target = resolveRequiredFile(process.argv[2], "Backup output");
  const temporaryTarget = `${target}.partial`;
  const { container, database, user } = getDatabaseToolConfig();

  if (fs.existsSync(target) || fs.existsSync(temporaryTarget)) {
    throw new Error(`Backup file already exists: ${target}`);
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });

  try {
    await runDocker(
      [
        "exec",
        container,
        "pg_dump",
        "--username",
        user,
        "--dbname",
        database,
        "--format=custom",
        "--no-owner",
        "--no-privileges",
      ],
      { outputFile: temporaryTarget },
    );
    fs.renameSync(temporaryTarget, target);
  } catch (error) {
    fs.rmSync(temporaryTarget, { force: true });
    throw error;
  }

  const size = fs.statSync(target).size;
  console.log(`Backup completed: ${target} (${size} bytes)`);
}

main().catch(error => {
  console.error(`Backup failed: ${error.message}`);
  process.exitCode = 1;
});
