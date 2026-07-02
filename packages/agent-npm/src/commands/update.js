"use strict";

const { runNpm, listInstalled } = require("../npm.js");
const { check, arrow, bold, dim, cyan, green, yellow, bullet } = require("../output.js");

async function run(packages) {
  const skills = await listInstalled();

  if (skills.length === 0) {
    console.log(yellow("No skills installed. Nothing to update."));
    return;
  }

  if (packages && packages.length > 0) {
    // Update specific packages
    console.log(arrow("Updating selected skills..."));
    await runNpm(["update", ...packages]);
  } else {
    // Update all
    const names = skills.map((s) => s.name);
    console.log(arrow(`Updating ${names.length} skill(s)...`));
    await runNpm(["update", ...names]);
  }

  console.log(check("Update complete"));

  // Show new versions
  const updated = await listInstalled();
  console.log();
  for (const s of updated) {
    console.log(`  ${cyan(s.name.replace("@skill/", ""))} ${green("@" + s.version)}`);
  }
}

module.exports = { run };
