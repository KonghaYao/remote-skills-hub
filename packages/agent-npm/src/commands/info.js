"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { agentsDir } = require("../config.js");
const { getPackageDetails } = require("../npm.js");
const { getRegistry } = require("../config.js");
const { bold, dim, cyan, green, yellow, bullet, check } = require("../output.js");

async function run(args) {
  let pkgName = Array.isArray(args) ? args[0] : args;
  if (!pkgName) {
    console.error("Usage: agent-npm info <package>");
    process.exit(1);
  }

  // Ensure @skill/ prefix
  if (!pkgName.startsWith("@skill/")) {
    pkgName = `@skill/${pkgName}`;
  }

  const dir = agentsDir();

  // Fetch remote metadata
  const registry = getRegistry();
  let remote = null;

  try {
    const url = `${registry}/${encodeURIComponent(pkgName)}`;
    const res = await fetch(url);
    if (res.ok) {
      remote = await res.json();
    }
  } catch { /* ignore */ }

  // Check local install
  const installedPath = path.join(dir, "node_modules", pkgName);
  const isInstalled = fs.existsSync(installedPath) && fs.existsSync(path.join(installedPath, "package.json"));

  let localPkg = null;
  if (isInstalled) {
    try {
      localPkg = JSON.parse(fs.readFileSync(path.join(installedPath, "package.json"), "utf-8"));
    } catch { /* ignore */ }
  }

  // Check SKILL.md
  let skillMdInfo = null;
  if (isInstalled) {
    const skillMdPath = path.join(installedPath, "SKILL.md");
    if (fs.existsSync(skillMdPath)) {
      const content = fs.readFileSync(skillMdPath, "utf-8");
      // Parse frontmatter
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (fmMatch) {
        const fmText = fmMatch[1];
        const frontmatter = {};
        for (const line of fmText.split("\n")) {
          const colonIdx = line.indexOf(":");
          if (colonIdx > 0) {
            frontmatter[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
          }
        }
        skillMdInfo = {
          frontmatter,
          bodyLength: fmMatch[2].length,
          size: content.length,
        };
      } else {
        skillMdInfo = { size: content.length };
      }
    }
  }

  // Output
  console.log();
  console.log(`  ${bold(cyan(pkgName))}`);

  const name = pkgName.replace("@skill/", "");
  const desc = remote?.description || localPkg?.description || "";

  if (desc) console.log(`  ${dim(desc)}`);
  console.log();

  if (remote && remote["dist-tags"]) {
    const latest = remote["dist-tags"].latest;
    const versions = Object.keys(remote.versions || {});
    console.log(`  ${bold("Latest:  ")}${green(latest)}`);
    console.log(`  ${bold("Versions:")} ${versions.join(", ")}`);
  }

  if (isInstalled) {
    console.log(`  ${bold("Status:  ")}${green("installed")} @ ${localPkg?.version || "?"}`);
    console.log(`  ${bold("Path:    ")}${installedPath}`);
  } else {
    console.log(`  ${bold("Status:  ")}${yellow("not installed")}`);
  }

  if (skillMdInfo) {
    console.log(`  ${bold("SKILL.md:")} ${skillMdInfo.size} bytes`);
    if (skillMdInfo.frontmatter) {
      console.log(`    ${bold("name:       ")}${skillMdInfo.frontmatter.name || "-"}`);
      console.log(`    ${bold("description:")} ${dim(skillMdInfo.frontmatter.description || "-")}`);
    }
  } else if (remote) {
    console.log(`  ${bold("SKILL.md:")} ${dim("(not installed locally, install to view)")}`);
  }

  console.log();

  if (remote && !isInstalled) {
    console.log(bullet(`Run ${green(`agent-npm install ${name}`)} to install this skill`));
  }

  // List files
  if (isInstalled) {
    console.log(`  ${bold("Files:")}`);
    const files = listFiles(installedPath);
    for (let i = 0; i < files.length; i++) {
      const prefix = i === files.length - 1 ? "  └── " : "  ├── ";
      console.log(`${prefix}${files[i]}`);
    }
    console.log();
  }
}

function listFiles(dir, prefix = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.name !== "node_modules" && !e.name.startsWith("."))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const result = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const curPrefix = prefix + (isLast ? "  └── " : "  ├── ");
    if (entry.isDirectory()) {
      result.push(entry.name + "/");
    } else {
      const stat = fs.statSync(path.join(dir, entry.name));
      const size = stat.size > 1024 ? `${(stat.size / 1024).toFixed(1)} KB` : `${stat.size} B`;
      result.push(`${entry.name}  ${dim(size)}`);
    }
  }
  return result;
}

module.exports = { run };
