"use strict";

const { uninstall } = require("../npm.js");
const { check, bold } = require("../output.js");

async function run(packages) {
  if (!packages || packages.length === 0) {
    console.error("Usage: agent-npm uninstall <package...>");
    process.exit(1);
  }

  const names = packages.map((p) => bold(p)).join(", ");
  console.log(`Removing ${names}...`);

  try {
    await uninstall(packages);
    console.log(check("Uninstalled successfully"));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

module.exports = { run };
