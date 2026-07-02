"use strict";

const { globalConfigPath, loadGlobalConfig, saveGlobalConfig, getRegistry } = require("../config.js");
const { bold, dim, cyan, green, yellow } = require("../output.js");

async function run(args) {
  if (args.length === 0) {
    // Show config
    const cfg = loadGlobalConfig();
    const file = globalConfigPath();
    const fs = require("node:fs");

    console.log();
    console.log(`  ${bold("Config file:")} ${dim(file)}`);

    if (Object.keys(cfg).length === 0) {
      console.log(`  ${dim("(no custom config — using defaults)")}`);
    } else {
      for (const [k, v] of Object.entries(cfg)) {
        console.log(`  ${cyan(k)} = ${v}`);
      }
    }

    console.log();
    console.log(`  ${bold("Current registry:")} ${green(getRegistry())}`);
    console.log();
    return;
  }

  const sub = args[0];

  if (sub === "set" && args.length >= 3) {
    const key = args[1];
    const value = args[2];
    const cfg = loadGlobalConfig();
    cfg[key] = value;
    saveGlobalConfig(cfg);
    console.log(`  ${green("✓")} Set ${cyan(key)} = ${value}`);
  } else if (sub === "get" && args.length >= 2) {
    const key = args[1];
    const cfg = loadGlobalConfig();
    if (cfg[key] !== undefined) {
      console.log(cfg[key]);
    } else {
      // Check defaults
      if (key === "registry") {
        console.log(getRegistry());
      } else {
        console.log(yellow(`No value set for "${key}"`));
      }
    }
  } else if (sub === "delete" && args.length >= 2) {
    const key = args[1];
    const cfg = loadGlobalConfig();
    if (cfg[key] !== undefined) {
      delete cfg[key];
      saveGlobalConfig(cfg);
      console.log(`  ${green("✓")} Removed ${cyan(key)}`);
    } else {
      console.log(yellow(`"${key}" was not set`));
    }
  } else {
    console.error("Usage: agent-npm config [set|get|delete] <key> [value]");
    process.exit(1);
  }
}

module.exports = { run };
