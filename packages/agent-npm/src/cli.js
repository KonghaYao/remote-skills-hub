"use strict";

const { bold, cyan, dim, yellow, red, green } = require("./output.js");
const { getRegistry } = require("./config.js");

const COMMANDS = {
  init:      () => require("./commands/init.js"),
  install:   () => require("./commands/install.js"),
  uninstall: () => require("./commands/uninstall.js"),
  remove:    () => require("./commands/uninstall.js"),   // alias
  list:      () => require("./commands/list.js"),
  ls:        () => require("./commands/list.js"),         // alias
  search:    () => require("./commands/search.js"),
  info:      () => require("./commands/info.js"),
  update:    () => require("./commands/update.js"),
  outdated:  () => require("./commands/outdated.js"),
  config:    () => require("./commands/config.js"),
  which:     () => require("./commands/which.js"),
  link:      () => require("./commands/link.js"),
  unlink:    () => require("./commands/unlink.js"),
  help:      () => null,
};

function showHelp() {
  const registry = getRegistry();
  console.log();
  console.log(`  ${bold("agent-npm")} — AI Agent Skill Package Manager`);
  console.log(`  ${dim(`Registry: ${registry}`)}`);
  console.log();
  console.log(`  ${bold("Commands:")}`);
  console.log();
  console.log(`  ${cyan("init")}                  Initialize .agents/ skill workspace`);
  console.log(`  ${cyan("install [pkg...]")}      Install skills from registry`);
  console.log(`  ${cyan("uninstall <pkg...>")}    Remove installed skills`);
  console.log(`  ${cyan("list")}                  List installed skills`);
  console.log(`  ${cyan("search <query>")}        Search registry for skills`);
  console.log(`  ${cyan("info <pkg>")}            Show skill details (versions, SKILL.md, files)`);
  console.log(`  ${cyan("update [pkg...]")}       Update skills to latest versions`);
  console.log(`  ${cyan("outdated")}              Check for outdated skills`);
  console.log(`  ${cyan("which <pkg>")}           Show install path of a skill`);
  console.log(`  ${cyan("link [pkg]")}            Create symlink to ${dim(".agents/skills/")} (default) for agent discovery`);
  console.log(`  ${cyan("unlink [pkg]")}          Remove symlink from skills directory`);
  console.log(`  ${cyan("config [set|get]")}      Manage configuration`);
  console.log();
  console.log(`  ${dim("Link flags:")}`);
  console.log(`    --agent claude         Link to ${dim(".claude/skills/")} instead of default`);
  console.log(`    --global               Link to ${dim("~/.agents/skills/")} (global skills dir)`);
  console.log(`    --status               Show link status without making changes`);
  console.log();
  console.log(`  ${dim("Examples:")}`);
  console.log(`    agent-npm init`);
  console.log(`    agent-npm install @skill/hello-world`);
  console.log(`    agent-npm search hello`);
  console.log(`    agent-npm list`);
  console.log(`    agent-npm update`);
  console.log(`    agent-npm link                  # → .agents/skills/ (default)`);
  console.log(`    agent-npm link --agent claude   # → .claude/skills/`);
  console.log(`    agent-npm link --global         # → ~/.agents/skills/`);
  console.log();
  console.log(`  ${dim("Config file: ~/.agent-npmrc")}`);
  console.log();
}

async function main(argv) {
  const cmd = argv[0];
  const args = argv.slice(1);

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    showHelp();
    return;
  }

  if (cmd === "--version" || cmd === "-v") {
    const pkg = require("../package.json");
    console.log(pkg.version);
    return;
  }

  const loader = COMMANDS[cmd];
  if (!loader) {
    console.error(`${red("Unknown command:")} ${cmd}`);
    console.error(`Run ${green("agent-npm help")} for available commands.`);
    process.exit(1);
  }

  const mod = loader();
  if (!mod || !mod.run) {
    showHelp();
    return;
  }

  try {
    await mod.run(args);
  } catch (e) {
    console.error(`${red("Error:")} ${e.message}`);
    process.exit(1);
  }
}

module.exports = { main };
