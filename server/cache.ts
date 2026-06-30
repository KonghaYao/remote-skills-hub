import { join } from "node:path";

const CACHE_DIR = Deno.env.get("CACHE_DIR") || join(Deno.cwd(), "cache");
// Note: CACHE_DIR is read once at startup. Server restart is required to pick up env changes.

async function ensureCacheDir(): Promise<string> {
  await Deno.mkdir(CACHE_DIR, { recursive: true });
  return CACHE_DIR;
}

export async function getCachedSKILL(
  name: string,
  version: string,
): Promise<string | null> {
  const cacheKey = `${name.replace("/", "_")}@${version}`;
  const cachePath = join(await ensureCacheDir(), cacheKey);

  try {
    const content = await Deno.readTextFile(cachePath);
    const stat = await Deno.stat(cachePath);
    const mtime = stat.mtime;
    if (mtime && Date.now() - mtime.getTime() < 3600_000) return content;
    return null;
  } catch {
    return null;
  }
}

export async function setCachedSKILL(
  name: string,
  version: string,
  content: string,
): Promise<void> {
  const cacheKey = `${name.replace("/", "_")}@${version}`;
  const cachePath = join(await ensureCacheDir(), cacheKey);
  await Deno.writeTextFile(cachePath, content);
}

export async function cacheTarball(
  tarballUrl: string,
  cacheDir: string,
): Promise<string> {
  const filename = tarballUrl.split("/").pop() || "pkg.tgz";
  const dest = join(cacheDir, filename);

  try {
    await Deno.stat(dest);
    return dest;
  } catch {
    // file does not exist, proceed to download
  }

  const res = await fetch(tarballUrl);
  if (!res.ok) throw new Error(`fetch tarball failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  await Deno.writeFile(dest, new Uint8Array(buf));
  return dest;
}

export async function ensureTempDir(): Promise<string> {
  const tmp = join(await ensureCacheDir(), "tmp");
  await Deno.mkdir(tmp, { recursive: true });
  return tmp;
}
