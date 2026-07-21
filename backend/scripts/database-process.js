const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const POSTGRES_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const CONTAINER_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

function getDatabaseToolConfig() {
  const container = process.env.DB_CONTAINER || "chat-app-demo-postgres";
  const database = process.env.POSTGRES_DB || "chat_app_demo";
  const user = process.env.POSTGRES_USER || "postgres";

  if (!CONTAINER_NAME.test(container)) {
    throw new Error("DB_CONTAINER contains unsupported characters");
  }

  for (const [name, value] of [
    ["POSTGRES_DB", database],
    ["POSTGRES_USER", user],
  ]) {
    if (!POSTGRES_IDENTIFIER.test(value)) {
      throw new Error(`${name} must be a valid PostgreSQL identifier`);
    }
  }

  return { container, database, user };
}

function resolveRequiredFile(rawPath, label) {
  if (!rawPath?.trim()) {
    throw new Error(`${label} path is required`);
  }

  return path.resolve(process.cwd(), rawPath);
}

async function runDocker(args, options = {}) {
  let inputFd;
  let outputFd;

  try {
    if (options.inputFile) {
      inputFd = fs.openSync(options.inputFile, "r");
    }
    if (options.outputFile) {
      outputFd = fs.openSync(options.outputFile, "wx");
    }

    const child = spawn("docker", args, {
      shell: false,
      stdio: [inputFd ?? "ignore", outputFd ?? "inherit", "inherit"],
    });

    const exitCode = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });

    if (exitCode !== 0) {
      throw new Error(`docker ${args[0]} failed with exit code ${exitCode}`);
    }
  } finally {
    if (inputFd !== undefined) {
      fs.closeSync(inputFd);
    }
    if (outputFd !== undefined) {
      fs.closeSync(outputFd);
    }
  }
}

module.exports = {
  getDatabaseToolConfig,
  resolveRequiredFile,
  runDocker,
};
