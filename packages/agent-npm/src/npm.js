"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");
const { agentsDir, getRegistry } = require("./config.js");

/**
 * Run an npm command in the .agents/ directory context.
 * @param {string[]} args - npm arguments
 * @param {object} opts - { silent?: boolean, capture?: boolean }
 * @returns {Promise<{code:number, stdout:string, stderr:string}>}
 */
function runNpm(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const cwd = agentsDir();
    const child = spawn("npm", args, {
      cwd,
      stdio: opts.capture ? "pipe" : "inherit",
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    if (opts.capture) {
      child.stdout.on("data", (d) => { stdout += d.toString(); });
      child.stderr.on("data", (d) => { stderr += d.toString(); });
    }

    child.on("close", (code) => {
      if (code !== 0 && !opts.ignoreError) {
        reject(new Error(stderr || `npm exited with code ${code}`));
      } else {
        resolve({ code: code || 0, stdout, stderr });
      }
    });

    child.on("error", reject);
  });
}

/**
 * Ensure .agents/ exists and is initialized.
 */
async function ensureInit() {
  const dir = agentsDir();
  const pkgJson = path.join(dir, "package.json");
  const fs = require("node:fs");

  if (!fs.existsSync(pkgJson)) {
    await init(cwd => {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(pkgJson, JSON.stringify({
        name: "agent-skills",
        private: true,
        dependencies: {}
      }, null, 2));
      fs.writeFileSync(path.join(dir, ".npmrc"), `@skill:registry=${getRegistry()}\n`);
    });
  }
}

async function init(writeFn) {
  const dir = agentsDir();
  const fs = require("node:fs");
  fs.mkdirSync(dir, { recursive: true });
  writeFn(dir);
}

async function install(packages, opts = {}) {
  await ensureInit();

  const args = ["install"];
  if (opts.save !== false) args.push("--save");

  // If no packages specified, install all from package.json
  if (!packages || packages.length === 0) {
    // npm install (no args) = install all
  } else {
    args.push(...packages);
  }

  return runNpm(args);
}

async function uninstall(packages) {
  await ensureInit();
  return runNpm(["uninstall", ...packages]);
}

async function listInstalled() {
  const { stdout } = await runNpm(["ls", "--depth=0", "--json"], { capture: true, ignoreError: true });
  try {
    const data = JSON.parse(stdout);
    const deps = data.dependencies || {};
    return Object.entries(deps)
      .filter(([name]) => name.startsWith("@skill/"))
      .map(([name, info]) => ({
        name,
        version: info.version,
        description: "",
      }));
  } catch {
    return [];
  }
}

async function getPackageDetails(pkgName) {
  // Get local version
  const local = (await listInstalled()).find((p) => p.name === pkgName);

  // Get remote info
  let remote = null;
  try {
    const { stdout } = await runNpm(["view", pkgName, "--json"], { capture: true, ignoreError: true });
    remote = JSON.parse(stdout);
  } catch { /* ignore */ }

  return { local, remote };
}

module.exports = { runNpm, ensureInit, init, install, uninstall, listInstalled, getPackageDetails };
