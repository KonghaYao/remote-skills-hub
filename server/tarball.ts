import { join } from "node:path";
import { cacheTarball, ensureTempDir, getCachedSKILL, setCachedSKILL } from "./cache.ts";

export async function extractSkillMd(
  name: string,
  version: string,
  tarballUrl: string,
): Promise<string> {
  const cached = await getCachedSKILL(name, version);
  if (cached) return cached;

  const tmp = ensureTempDir();
  let tgzPath: string;
  try {
    tgzPath = await cacheTarball(tarballUrl, tmp);
  } catch (e) {
    throw new Error(`failed to download tarball: ${(e as Error).message}`);
  }

  const extractDir = join(tmp, `${name.replace(/\//g, "_")}@${version}`);

  let dirExists = false;
  try {
    await Deno.stat(extractDir);
    dirExists = true;
  } catch { /* does not exist */ }

  if (!dirExists) {
    await Deno.mkdir(extractDir, { recursive: true });
    const p = new Deno.Command("tar", {
      args: ["-xzf", tgzPath, "-C", extractDir],
    });
    const out = await p.output();
    if (!out.success) {
      const stderr = new TextDecoder().decode(out.stderr);
      throw new Error(`tar extract failed: ${stderr}`);
    }
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
