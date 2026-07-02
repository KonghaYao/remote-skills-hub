"use strict";

const path = require("node:path");
const fs = require("node:fs");
const { agentsDir } = require("../config.js");
const { dim, green, cyan, yellow } = require("../output.js");

async function run(args) {
  let pkgName = Array.isArray(args) ? args[0] : args;
  if (!pkgName) {
    console.error("Usage: agent-npm which <package>");
    process.exit(1);
  }

  if (!pkgName.startsWith("@skill/")) {
    pkgName = `@skill/${pkgName}`;
  }

  const dir = agentsDir();
  const pkgPath = path.join(dir, "node_modules", pkgName);

  if (fs.existsSync(pkgPath) && fs.existsSync(path.join(pkgPath, "package.json"))) {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgPath, "package.json"), "utf-8"));
    console.log(pkgPath);
    console.log();
    console.log(`  ${green("✓")} Version: ${cyan(pkg.version)}`);

    const skillMdPath = path.join(pkgPath, "SKILL.md");
    if (fs.existsSync(skillMdPath)) {
      console.log(`  ${green("✓")} SKILL.md: ${dim(skillMdPath)}`);
    }
  } else {
    console.log(`${yellow(pkgName)} is not installed`);
    console.log();
    console.log(`  Run ${green(`agent-npm install ${pkgName.replace("@skill/", "")}`)} to install`);
    process.exit(1);
  }
}

module.exports = { run };
