"use strict";

const { listInstalled } = require("../npm.js");
const { bold, dim, cyan, yellow } = require("../output.js");

async function run() {
  const skills = await listInstalled();

  if (skills.length === 0) {
    console.log(yellow("No skills installed. Run `agent-npm install <package>` to add one."));
    return;
  }

  console.log(`${bold(".agents/node_modules/@skill/")}`);
  for (let i = 0; i < skills.length; i++) {
    const s = skills[i];
    const prefix = i === skills.length - 1 ? "└── " : "├── ";
    const name = s.name.replace("@skill/", "");
    const desc = s.description ? ` — ${dim(s.description)}` : "";
    console.log(`${prefix}${cyan(name)} ${dim("@" + s.version)}${desc}`);
  }
}

module.exports = { run };
