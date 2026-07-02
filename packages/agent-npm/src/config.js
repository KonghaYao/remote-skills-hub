"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const AGENTS_DIR_NAME = ".agents";

/** Resolve project root: walk up from cwd to find an .agents dir, else cwd */
function findProjectRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(path.join(dir, AGENTS_DIR_NAME))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function agentsDir(projectRoot) {
  return path.join(projectRoot || findProjectRoot(), AGENTS_DIR_NAME);
}

/** Always returns cwd/.agents — used by init/ensureInit (never walks up) */
function cwdAgentsDir() {
  return path.join(process.cwd(), AGENTS_DIR_NAME);
}

function globalConfigPath() {
  return path.join(os.homedir(), ".agent-npmrc");
}

function loadGlobalConfig() {
  const p = globalConfigPath();
  if (!fs.existsSync(p)) return {};
  const cfg = {};
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) cfg[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return cfg;
}

function saveGlobalConfig(cfg) {
  const lines = Object.entries(cfg).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(globalConfigPath(), lines.join("\n") + "\n");
}

function getRegistry() {
  const globalCfg = loadGlobalConfig();
  return globalCfg.registry || "http://localhost:4873";
}

module.exports = { AGENTS_DIR_NAME, findProjectRoot, agentsDir, cwdAgentsDir, globalConfigPath, loadGlobalConfig, saveGlobalConfig, getRegistry };
