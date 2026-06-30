import { join } from "node:path";
import { cacheTarball, ensureTempDir, getCachedSKILL, setCachedSKILL } from "./cache.ts";

/**
 * Verify that no file in the extracted directory escapes via path traversal
 * or uses symlinks pointing outside the extraction directory.
 */
async function verifyNoTraversal(extractDir: string): Promise<void> {
  const realExtractDir = await Deno.realPath(extractDir);

  async function walk(dir: string): Promise<void> {
    for await (const entry of Deno.readDir(dir)) {
      const fullPath = join(dir, entry.name);
      let realPath: string;
      try {
        realPath = await Deno.realPath(fullPath);
      } catch {
        // File may have been removed or be a dangling symlink; treat as traversal
        throw new Error(
          `path traversal detected: ${fullPath} cannot be resolved`,
        );
      }

      if (
        !realPath.startsWith(realExtractDir + "/") &&
        realPath !== realExtractDir
      ) {
        throw new Error(
          `path traversal detected: ${fullPath} -> ${realPath}`,
        );
      }

      if (entry.isDirectory) {
        await walk(fullPath);
      }
    }
  }

  await walk(extractDir);
}

/**
 * Check tarball entries for path traversal components (`..`) before extraction.
 */
async function checkTarballEntries(tgzPath: string): Promise<void> {
  const p = new Deno.Command("tar", {
    args: ["-tzf", tgzPath],
  });
  const out = await p.output();
  if (!out.success) {
    const stderr = new TextDecoder().decode(out.stderr);
    throw new Error(`tar list failed: ${stderr}`);
  }

  const entries = new TextDecoder().decode(out.stdout);
  for (const entry of entries.split("\n")) {
    // Check for any path component that navigates upward
    const parts = entry.split("/");
    for (const part of parts) {
      if (part === "..") {
        throw new Error(
          `rejected tarball with path traversal entry: ${entry}`,
        );
      }
    }
  }
}

export async function extractSkillMd(
  name: string,
  version: string,
  tarballUrl: string,
): Promise<string> {
  const cached = await getCachedSKILL(name, version);
  if (cached) return cached;

  const tmp = await ensureTempDir();
  let tgzPath: string;
  try {
    tgzPath = await cacheTarball(tarballUrl, tmp);
  } catch (e) {
    throw new Error(`failed to download tarball: ${(e as Error).message}`);
  }

  const extractDir = join(tmp, `${name.replace(/\//g, "_")}@${version}`);

  let dirExists = false;
  try {
    const stat = await Deno.stat(extractDir);
    dirExists = stat.isDirectory;
  } catch { /* does not exist */ }

  if (dirExists) {
    // Check if previous extraction was actually successful
    try {
      await Deno.readTextFile(join(extractDir, "package", "SKILL.md"));
    } catch {
      // Directory exists but extraction was incomplete, clean up and re-extract
      try { await Deno.remove(extractDir, { recursive: true }); } catch { /* best effort */ }
      dirExists = false;
    }
  }

  if (!dirExists) {
    await Deno.mkdir(extractDir, { recursive: true });

    // Pre-extraction check: verify no `..` entries in the tarball
    await checkTarballEntries(tgzPath);

    const p = new Deno.Command("tar", {
      args: ["-xzf", tgzPath, "-C", extractDir],
    });
    const out = await p.output();
    if (!out.success) {
      const stderr = new TextDecoder().decode(out.stderr);
      throw new Error(`tar extract failed: ${stderr}`);
    }

    // Post-extraction check: verify no symlinks escape the extract directory
    await verifyNoTraversal(extractDir);
  }

  // walk the extracted dir for package/SKILL.md
  let skillMdContent = "";
  for await (const entry of Deno.readDir(extractDir)) {
    if (entry.isDirectory && entry.name === "package") {
      const skillPath = join(extractDir, entry.name, "SKILL.md");
      try {
        skillMdContent = await Deno.readTextFile(skillPath);
        break;
      } catch {
        continue;
      }
    }
  }

  if (!skillMdContent) throw new Error("SKILL.md not found in package");

  await setCachedSKILL(name, version, skillMdContent);

  return skillMdContent;
}

// ---- File listing / reading ----

function extractDirPath(name: string, version: string, tmp: string): string {
  return join(tmp, `${name.replace(/\//g, "_")}@${version}`);
}

async function ensureSkillExtracted(
  name: string,
  version: string,
  tarballUrl: string,
): Promise<string> {
  const tmp = await ensureTempDir();
  const extractDir = extractDirPath(name, version, tmp);

  // Check if already extracted and valid
  try {
    await Deno.stat(join(extractDir, "package"));
    return extractDir;
  } catch { /* not extracted yet */ }

  // Clean any partial extraction
  try { await Deno.remove(extractDir, { recursive: true }); } catch { /* ok */ }

  let tgzPath: string;
  try {
    tgzPath = await cacheTarball(tarballUrl, tmp);
  } catch (e) {
    throw new Error(`failed to download tarball: ${(e as Error).message}`);
  }

  await Deno.mkdir(extractDir, { recursive: true });
  await checkTarballEntries(tgzPath);

  const p = new Deno.Command("tar", {
    args: ["-xzf", tgzPath, "-C", extractDir],
  });
  const out = await p.output();
  if (!out.success) {
    const stderr = new TextDecoder().decode(out.stderr);
    throw new Error(`tar extract failed: ${stderr}`);
  }

  await verifyNoTraversal(extractDir);
  return extractDir;
}

export async function listSkillFiles(
  name: string,
  version: string,
  tarballUrl: string,
): Promise<{ path: string; size: number }[]> {
  const extractDir = await ensureSkillExtracted(name, version, tarballUrl);
  const pkgDir = join(extractDir, "package");
  const files: { path: string; size: number }[] = [];

  async function walk(dir: string, prefix: string): Promise<void> {
    for await (const entry of Deno.readDir(dir)) {
      const fullPath = join(dir, entry.name);
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isFile) {
        files.push({ path: relPath, size: (await Deno.stat(fullPath)).size });
      } else if (entry.isDirectory) {
        await walk(fullPath, relPath);
      }
    }
  }

  await walk(pkgDir, "");
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function readSkillFile(
  name: string,
  version: string,
  tarballUrl: string,
  filePath: string,
): Promise<string> {
  const extractDir = await ensureSkillExtracted(name, version, tarballUrl);
  const fullPath = join(extractDir, "package", filePath);

  // Prevent path traversal in filePath
  const realDir = await Deno.realPath(extractDir);
  const realFile = await Deno.realPath(fullPath);
  if (!realFile.startsWith(realDir + "/") && realFile !== realDir) {
    throw new Error(`path traversal detected: ${filePath}`);
  }

  return await Deno.readTextFile(fullPath);
}
