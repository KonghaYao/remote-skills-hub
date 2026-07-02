"use strict";

const { install } = require("../npm.js");
const { check, arrow, bullet, bold, dim } = require("../output.js");

async function run(packages) {
  if (!packages || packages.length === 0) {
    console.log(arrow("Installing all skills from .agents/package.json..."));
  } else {
    const names = packages.map((p) => {
      const namePart = p.split("@").slice(0, -1).join("@") || p;
      return bold(namePart);
    }).join(", ");
    console.log(arrow(`Installing ${names}...`));
  }

  try {
    await install(packages);
    console.log(check("Installation complete"));
    console.log();
    console.log(bullet(`Skills are available at ${bold(".agents/node_modules/@skill/")}`));
    console.log(bullet(dim("Use `agent-npm list` to view installed skills")));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  // Auto-link after install
  try {
    const linkMod = require("./link.js");
    await linkMod.run([]);
  } catch { /* link is best-effort */ }
}

module.exports = { run };
