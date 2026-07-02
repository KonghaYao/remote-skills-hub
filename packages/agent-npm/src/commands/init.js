"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { cwdAgentsDir, getRegistry } = require("../config.js");
const { check, bullet, green, bold } = require("../output.js");

async function run() {
  const dir = cwdAgentsDir();
  fs.mkdirSync(dir, { recursive: true });

  const pkgJsonPath = path.join(dir, "package.json");
  const npmrcPath = path.join(dir, ".npmrc");

  fs.writeFileSync(pkgJsonPath, JSON.stringify({
    name: "agent-skills",
    private: true,
    dependencies: {}
  }, null, 2));

  fs.writeFileSync(npmrcPath, `@skill:registry=${getRegistry()}\n`);

  console.log(check(`Created ${bold(".agents/package.json")}`));
  console.log(check(`Created ${bold(".agents/.npmrc")} (registry = ${getRegistry()})`));
  console.log();
  console.log(bullet(`Initialized skill workspace. Run ${green("agent-npm install @skill/<name>")} to add skills.`));
}

module.exports = { run };
