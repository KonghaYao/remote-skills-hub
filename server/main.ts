import { Hono, cors, logger, marked } from "./deps.ts";
import { extractSkillMd, listSkillFiles, readSkillFile } from "./tarball.ts";
import { join, extname } from "node:path";

const REGISTRY_URL = Deno.env.get("REGISTRY_URL") || "http://localhost:4873";
const REGISTRY_TOKEN = Deno.env.get("REGISTRY_TOKEN");
const port = parseInt(Deno.env.get("PORT") || "3000");
const PUBLIC_DIR = join(Deno.cwd(), "public");
const INDEX_HTML = Deno.readTextFileSync(join(PUBLIC_DIR, "index.html"));

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function authHeaders(): Record<string, string> {
  return REGISTRY_TOKEN
    ? { Authorization: `Bearer ${REGISTRY_TOKEN}` }
    : {};
}

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

// --- Static file serving ---
app.get("/static/*", async (c) => {
  const filePath = c.req.path.replace("/static", "");
  const fullPath = join(PUBLIC_DIR, filePath);
  const ext = extname(fullPath).toLowerCase();

  try {
    const content = await Deno.readFile(fullPath);
    return new Response(content, {
      headers: { "Content-Type": MIME[ext] || "application/octet-stream" },
    });
  } catch {
    return c.notFound();
  }
});

app.get("/", (c) => c.html(INDEX_HTML));

// --- Proxy: pass-through npm registry APIs ---
app.all("/npm/*", async (c) => {
  const path = c.req.path.replace("/npm", "");
  const url = `${REGISTRY_URL}${path}`;

  const headers: Record<string, string> = { ...authHeaders() };
  if (c.req.header("content-type")) {
    headers["Content-Type"] = c.req.header("content-type")!;
  }
  if (c.req.header("accept")) {
    headers["Accept"] = c.req.header("accept")!;
  }

  const body = c.req.method !== "GET" && c.req.method !== "HEAD"
    ? await c.req.text()
    : undefined;

  const res = await fetch(url, {
    method: c.req.method,
    headers,
    body,
  });

  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
});

// --- API: list all @skill packages ---
app.get("/api/skills", async (c) => {
  try {
    let page = parseInt(c.req.query("page") || "1");
    let limit = parseInt(c.req.query("limit") || "12");
    const sort = c.req.query("sort") || "newest";

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1 || limit > 250) limit = 12;

    const url = `${REGISTRY_URL}/-/verdaccio/data/packages`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      return c.json({ error: `registry returned ${res.status}` }, 502);
    }
    const packages: Array<{
      name: string;
      version: string;
      description: string;
      time: string;
    }> = await res.json();

    let skills = packages
      .filter((p) => p.name?.startsWith("@skill/"))
      .map((p) => ({
        ...p,
        updated: p.time,
      }));

    // 排序
    if (sort === "name") {
      skills.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // 默认按时间降序（覆盖 "newest" 及任何无效值）
      skills.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    }

    const total = skills.length;
    const start = (page - 1) * limit;
    const items = skills.slice(start, start + limit);

    return c.json({ skills: items, total, page, limit });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// --- API: get single skill metadata ---
app.get("/api/skills/:name", async (c) => {
  const name = `@skill/${c.req.param("name")}`;
  try {
    const url = `${REGISTRY_URL}/${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) return c.json({ error: "not found" }, 404);
    const data = await res.json();
    const versions = data.versions ? Object.keys(data.versions) : [];
    const latest = data["dist-tags"]?.latest;
    const pkg = latest && data.versions[latest];
    return c.json({
      ...data,
      ...pkg,
      versions,
      latest,
    });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// --- API: get SKILL.md rendered as HTML ---
app.get("/api/skills/:name/SKILL.md", async (c) => {
  const name = `@skill/${c.req.param("name")}`;
  try {
    const metaUrl = `${REGISTRY_URL}/${encodeURIComponent(name)}`;
    const metaRes = await fetch(metaUrl, { headers: authHeaders() });
    if (!metaRes.ok) return c.json({ error: "package not found" }, 404);

    const meta = await metaRes.json();
    const versions = meta.versions;
    if (!versions) return c.json({ error: "no versions" }, 404);

    const distTag = meta["dist-tags"]?.latest;
    const version = distTag && versions[distTag]
      ? distTag
      : Object.keys(versions).pop()!;
    const pkg = versions[version];
    const tarballUrl = pkg.dist?.tarball;
    if (!tarballUrl) return c.json({ error: "no tarball" }, 500);

    const skillMd = await extractSkillMd(name, version, tarballUrl);

    let body = skillMd;
    let frontmatter: Record<string, string> = {};
    const fmMatch = skillMd.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (fmMatch) {
      const fmText = fmMatch[1];
      body = fmMatch[2];
      for (const line of fmText.split("\n")) {
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          const value = line.slice(colonIdx + 1).trim();
          frontmatter[key] = value;
        }
      }
    }

    const htmlBody = marked.parse(body, { breaks: true, gfm: true }) as string;
    const safeHtml = htmlBody
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
      .replace(/\son\w+\s*=\s*'[^']*'/gi, "");

    return c.json({
      name,
      version,
      frontmatter,
      html: safeHtml,
    });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// --- API: list skill files ---
app.get("/api/skills/:name/files", async (c) => {
  const name = `@skill/${c.req.param("name")}`;
  const filePath = c.req.query("path");
  try {
    // Fetch package metadata to get tarball URL
    const metaUrl = `${REGISTRY_URL}/${encodeURIComponent(name)}`;
    const metaRes = await fetch(metaUrl, { headers: authHeaders() });
    if (!metaRes.ok) return c.json({ error: "package not found" }, 404);

    const meta = await metaRes.json();
    const versions = meta.versions;
    if (!versions) return c.json({ error: "no versions" }, 404);

    const distTag = meta["dist-tags"]?.latest;
    const version = distTag && versions[distTag]
      ? distTag
      : Object.keys(versions).pop()!;
    const pkg = versions[version];
    const tarballUrl = pkg.dist?.tarball;
    if (!tarballUrl) return c.json({ error: "no tarball" }, 500);

    if (filePath) {
      // Return single file content
      try {
        const content = await readSkillFile(name, version, tarballUrl, filePath);
        const ext = extname(filePath).toLowerCase();
        const mime = MIME[ext] || "text/plain";
        return new Response(content, {
          headers: { "Content-Type": `${mime}; charset=utf-8` },
        });
      } catch {
        return c.json({ error: "file not found" }, 404);
      }
    }

    // Return file tree
    const files = await listSkillFiles(name, version, tarballUrl);
    return c.json({ version, files });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// --- API: search ---
app.get("/api/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ results: [] });
  try {
    const url =
      `${REGISTRY_URL}/-/v1/search?text=@skill/${encodeURIComponent(q)}&size=20`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) return c.json({ results: [] });
    const data = await res.json();
    const results = (data.objects || []).map((o: {
      package?: { name: string; version: string; description: string; date: string };
    }) => ({
      name: o.package?.name ?? "",
      version: o.package?.version ?? "",
      description: o.package?.description ?? "",
      updated: o.package?.date ?? "",
    }));
    return c.json({ results });
  } catch (e) {
    return c.json({ results: [] });
  }
});

try {
  Deno.serve({ port }, app.fetch);
  console.log(`Server running on http://localhost:${port}`);
} catch (e) {
  console.error("Failed to start server:", (e as Error).message);
  Deno.exit(1);
}
