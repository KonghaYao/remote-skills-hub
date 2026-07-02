"use strict";

const { runNpm, listInstalled } = require("../npm.js");
const { bold, dim, cyan, green, yellow, red } = require("../output.js");

async function run() {
  const skills = await listInstalled();

  if (skills.length === 0) {
    console.log(yellow("No skills installed."));
    return;
  }

  let hasUpdates = false;
  const results = [];

  for (const skill of skills) {
    try {
      const { stdout } = await runNpm(
        ["view", skill.name, "version", "--json"],
        { capture: true, ignoreError: true }
      );
      const latest = JSON.parse(stdout.trim());
      if (latest !== skill.version) {
        results.push({ ...skill, latest, outdated: true });
        hasUpdates = true;
      } else {
        results.push({ ...skill, latest, outdated: false });
      }
    } catch {
      results.push({ ...skill, latest: "?", outdated: false });
    }
  }

  if (!hasUpdates) {
    console.log(green("All skills are up to date."));
    return;
  }

  console.log();
  console.log(`  ${bold("Package")}           ${bold("Current")}  ${bold("Latest")}`);
  console.log(`  ${dim("───────")}           ${dim("───────")}  ${dim("──────")}`);
  for (const r of results) {
    const name = r.name.replace("@skill/", "");
    if (r.outdated) {
      console.log(`  ${cyan(name)}  ${yellow(r.version)}  → ${green(r.latest)}`);
    } else {
      console.log(`  ${dim(name)}  ${dim(r.version)}  ${dim("✓")}`);
    }
  }
  console.log();
}

module.exports = { run };
