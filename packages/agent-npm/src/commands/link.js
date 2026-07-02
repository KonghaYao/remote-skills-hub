"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { agentsDir } = require("../config.js");
const { listInstalled } = require("../npm.js");
const { check, arrow, bold, dim, green, yellow, red } = require("../output.js");

function skillNameFromPackage(pkgName) {
  return pkgName.replace(/^@skill\//, "");
}

/** Resolve target skills directory based on flags */
function getSkillsDir(args) {
  const globalFlag = args.includes("--global");
  const agentFlag = args.includes("--agent") ? "claude" : null;

  if (globalFlag) {
    return path.join(os.homedir(), ".agents", "skills");
  }
  if (agentFlag === "claude") {
    const dir = agentsDir();
    return path.join(path.dirname(dir), ".claude", "skills");
  }
  // Default: .agents/skills/
  return path.join(agentsDir(), "skills");
}

function cleanArgs(args) {
  return args.filter(a => a !== "--global" && a !== "--agent" && a !== "claude" && a !== "--status" && !a.startsWith("--agent="));
}

async function run(args) {
  const statusFlag = args.includes("--status");
  const skillsDir = getSkillsDir(args);
  const dir = agentsDir();
  const names = cleanArgs(args);

  if (statusFlag) {
    await showStatus(dir, skillsDir);
    return;
  }

  if (names.length === 0) {
    await linkAll(dir, skillsDir);
    return;
  }

  for (const name of names) {
    const pkgName = name.startsWith("@skill/") ? name : `@skill/${name}`;
    await linkOne(dir, skillsDir, pkgName);
  }
}

async function showStatus(agentsDir, skillsDir) {
  const skills = await listInstalled();
  if (skills.length === 0) {
    console.log(yellow("No skills installed."));
    return;
  }

  console.log();
  console.log(`  ${bold("Skills directory:")} ${dim(skillsDir)}`);
  console.log();

  for (const skill of skills) {
    const skillName = skillNameFromPackage(skill.name);
    const linkPath = path.join(skillsDir, skillName);
    const targetPath = path.join(agentsDir, "node_modules", skill.name);

    let status;
    if (fs.existsSync(linkPath)) {
      try {
        const real = fs.realpathSync(linkPath);
        if (real === targetPath) {
          status = green("✓ linked");
        } else {
          status = `${yellow("⚠ broken")} → ${dim(real)}`;
        }
      } catch {
        status = red("✗ broken");
      }
    } else {
      status = dim("not linked");
    }

    console.log(`  ${bold(skillName)} ${status}`);
  }
  console.log();
}

async function linkAll(agentsDir, skillsDir) {
  const skills = await listInstalled();
  if (skills.length === 0) {
    console.log(yellow("No skills installed. Run `agent-npm install <name>` first."));
    return;
  }

  console.log(arrow(`Linking ${skills.length} skill(s) to ${dim(skillsDir)}...`));

  let linked = 0;
  for (const skill of skills) {
    const result = await linkOne(agentsDir, skillsDir, skill.name, true);
    if (result) linked++;
  }

  if (linked > 0) {
    console.log();
    console.log(check(`${linked} skill(s) linked to ${dim(skillsDir)}`));
  }
}

async function linkOne(agentsDir, skillsDir, pkgName, silent) {
  const skillName = skillNameFromPackage(pkgName);
  const targetPath = path.join(agentsDir, "node_modules", pkgName);
  const linkPath = path.join(skillsDir, skillName);

  if (!fs.existsSync(targetPath)) {
    if (!silent) console.log(`${red("✗")} ${pkgName} is not installed`);
    return false;
  }

  fs.mkdirSync(skillsDir, { recursive: true });

  if (fs.existsSync(linkPath)) {
    fs.rmSync(linkPath, { recursive: true });
  }

  fs.symlinkSync(targetPath, linkPath, "dir");

  if (!silent) {
    console.log(check(`${bold(skillName)} → ${dim(linkPath)}`));
  }
  return true;
}

module.exports = { run, getSkillsDir, cleanArgs };
