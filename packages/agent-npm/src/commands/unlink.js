"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { agentsDir } = require("../config.js");
const { listInstalled } = require("../npm.js");
const { check, bold, dim, yellow } = require("../output.js");
const { getSkillsDir, cleanArgs } = require("./link.js");

async function run(args) {
  const skillsDir = getSkillsDir(args);
  const names = cleanArgs(args);

  if (names.length === 0) {
    const skills = await listInstalled();
    if (skills.length === 0) {
      console.log(yellow("No skills installed."));
      return;
    }
    let count = 0;
    for (const skill of skills) {
      const name = skill.name.replace(/^@skill\//, "");
      const linkPath = path.join(skillsDir, name);
      if (fs.existsSync(linkPath)) {
        fs.rmSync(linkPath, { recursive: true });
        console.log(check(`Unlinked ${bold(name)}`));
        count++;
      }
    }
    if (count === 0) console.log(dim("No links to remove."));
    return;
  }

  for (const name of names) {
    const linkPath = path.join(skillsDir, name);
    if (fs.existsSync(linkPath)) {
      fs.rmSync(linkPath, { recursive: true });
      console.log(check(`Unlinked ${bold(name)}`));
    } else {
      console.log(`${dim("Not linked:")} ${name}`);
    }
  }
}

module.exports = { run };
