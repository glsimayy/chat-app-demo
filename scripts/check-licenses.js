const fs = require("node:fs");
const path = require("node:path");

const workspaces = [".", "backend", "frontend"];
const forbidden = /AGPL|SSPL|BUSL/i;
const copyleft = /(^|[^L])GPL/i;
const permissiveAlternative = /MIT|Apache|BSD|ISC|MPL/i;
const findings = [];
let checked = 0;

const legacyLicenses = new Map([
  ["pause@0.0.1", "MIT"],
]);

function normalizeLicense(value) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeLicense).filter(Boolean).join(" OR ");
  }

  return value?.type;
}

function readPackageLicense(workspace, packagePath, lockEntry) {
  const lockLicense = normalizeLicense(lockEntry.license);
  if (lockLicense) {
    return lockLicense;
  }

  try {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(workspace, packagePath, "package.json"),
        "utf8",
      ),
    );
    return (
      normalizeLicense(manifest.license) ||
      normalizeLicense(manifest.licenses) ||
      legacyLicenses.get(`${manifest.name}@${manifest.version}`)
    );
  } catch {
    return undefined;
  }
}

for (const workspace of workspaces) {
  const lockPath = path.join(workspace, "package-lock.json");
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));

  for (const [packagePath, entry] of Object.entries(lock.packages || {})) {
    if (!packagePath || entry.link) {
      continue;
    }

    checked += 1;
    const license = readPackageLicense(workspace, packagePath, entry);
    const packageName = packagePath.replace(/^.*node_modules\//, "");

    if (!license) {
      findings.push(`${workspace}: ${packageName} has no license metadata`);
      continue;
    }

    if (
      forbidden.test(license) ||
      (copyleft.test(license) && !permissiveAlternative.test(license))
    ) {
      findings.push(`${workspace}: ${packageName} uses ${license}`);
    }
  }
}

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log(`License check passed for ${checked} installed package entries.`);
