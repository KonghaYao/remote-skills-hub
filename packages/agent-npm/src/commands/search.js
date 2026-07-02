"use strict";

const { getRegistry } = require("../config.js");
const { bold, dim, cyan, yellow, bullet, arrow } = require("../output.js");

async function run(args) {
  const query = Array.isArray(args) ? args[0] : args;
  if (!query || query.length === 0) {
    console.error("Usage: agent-npm search <query>");
    process.exit(1);
  }

  const registry = getRegistry();
  const searchUrl = `${registry}/-/v1/search?text=@skill/${encodeURIComponent(query)}&size=20`;

  console.log(arrow(`Searching registry for "${query}"...`));

  try {
    const res = await fetch(searchUrl);
    if (!res.ok) {
      console.log(yellow("No results found."));
      return;
    }

    const data = await res.json();
    const objects = data.objects || [];

    if (objects.length === 0) {
      console.log(yellow(`No skills matching "${query}"`));
      return;
    }

    console.log();
    for (const obj of objects) {
      const pkg = obj.package;
      if (!pkg) continue;
      const name = pkg.name;
      const ver = pkg.version || (pkg["dist-tags"] && pkg["dist-tags"].latest) || "unknown";
      const desc = pkg.description || "";

      console.log(`${bold(cyan(name))} ${dim("@" + ver)}`);
      if (desc) console.log(bullet(dim(desc)));
    }
    console.log();
    console.log(bullet(dim(`Found ${objects.length} result(s)`)));
  } catch (e) {
    console.error(`Failed to search registry: ${e.message}`);
    process.exit(1);
  }
}

module.exports = { run };
