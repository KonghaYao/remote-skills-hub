import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

const CACHE_DIR = Deno.env.get("CACHE_DIR") || join(Deno.cwd(), "cache");

function ensureCacheDir(): string {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
  return CACHE_DIR;
}

export async function getCachedSKILL(
  name: string,
  version: string,
  tarballUrl: string,
): Promise<string | null> {
  const cacheKey = `${name.replace("/", "_")}@${version}`;
  const cachePath = join(ensureCacheDir(), cacheKey);

  if (existsSync(cachePath)) {
    const content = Deno.readTextFileSync(cachePath);
    const age = Date.now() - (await Deno.stat(cachePath)).mtime!.getTime();
    if (age < 3600_000) return content;
  }

  return null;
}

export async function setCachedSKILL(
  name: string,
  version: string,
  content: string,
): Promise<void> {
  const cacheKey = `${name.replace("/", "_")}@${version}`;
  const cachePath = join(ensureCacheDir(), cacheKey);
  Deno.writeTextFileSync(cachePath, content);
}

export async function cacheTarball(
  tarballUrl: string,
  cacheDir: string,
): Promise<string> {
  const filename = tarballUrl.split("/").pop() || "pkg.tgz";
  const dest = join(cacheDir, filename);

  if (existsSync(dest)) return dest;

  const res = await fetch(tarballUrl);
  if (!res.ok) throw new Error(`fetch tarball failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  Deno.writeFileSync(dest, new Uint8Array(buf));
  return dest;
}

export function ensureTempDir(): string {
  const tmp = join(ensureCacheDir(), "tmp");
  if (!existsSync(tmp)) mkdirSync(tmp, { recursive: true });
  return tmp;
}
