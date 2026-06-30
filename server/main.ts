import { Hono, cors, logger, marked, serveStatic } from "./deps.ts";
import { extractSkillMd } from "./tarball.ts";

const REGISTRY_URL = Deno.env.get("REGISTRY_URL") || "http://localhost:4873";
const REGISTRY_TOKEN = Deno.env.get("REGISTRY_TOKEN");
const port = parseInt(Deno.env.get("PORT") || "3000");
const INDEX_HTML = Deno.readTextFileSync("./public/index.html");

function authHeaders(): Record<string, string> {
  return REGISTRY_TOKEN
    ? { Authorization: `Bearer ${REGISTRY_TOKEN}` }
    : {};
}

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

// --- Static portal ---
app.use("/static/*", serveStatic({ root: "./public" }));
app.get("/", (c) => {
  return c.html(INDEX_HTML);
});

// --- Proxy: pass-through npm registry APIs ---
app.all("/npm/*", async (c) => {
  const upstreamPath = c.req.path.replace(/^\/npm/, "");
  const rawUrl = new URL(c.req.raw.url);
  const url = `${REGISTRY_URL}${upstreamPath}${rawUrl.search}`;

  const res = await fetch(url, {
    method: c.req.method,
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });

  return new Response(res.body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
  });
});

// --- Extended APIs ---
app.get("/api/skills", async (c) => {
  let page = parseInt(c.req.query("page") || "1");
  let limit = parseInt(c.req.query("limit") || "20");
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 20;
  const tag = c.req.query("tag");

  let skills: Array<{ name: string; version: string; description: string; updated: string; score: number }> = [];
  try {
    const searchUrl = `${REGISTRY_URL}/-/v1/search?text=@skill/*&size=250`;
    const res = await fetch(searchUrl, {
      headers: { "Accept": "application/json", ...authHeaders() },
    });
    if (!res.ok) return c.json({ error: "registry unavailable" }, 502);

    type RegistryObject = { package?: { name: string; version: string; description: string; date: string }; score?: { final: number } };
    const data = await res.json() as { objects?: RegistryObject[] };

    skills = (data.objects || []).filter((o) => o.package).map((o) => ({
      name: o.package!.name,
      version: o.package!.version,
      description: o.package!.description || "",
      updated: o.package!.date,
      score: o.score?.final ?? 0,
    }));
  } catch (err) {
    return c.json({ error: String(err) }, 502);
  }

  if (tag) {
    skills = skills.filter((s) => s.description?.includes(`#${tag}`));
  }

  const total = skills.length;
  const start = (page - 1) * limit;
  const items = skills.slice(start, start + limit);

  return c.json({ skills: items, total, page, limit });
});

app.get("/api/skills/:name", async (c) => {
  const name = `@skill/${c.req.param("name")}`;
  const metaUrl = `${REGISTRY_URL}/${encodeURIComponent(name)}`;

  try {
    const res = await fetch(metaUrl, {
      headers: { "Accept": "application/json", ...authHeaders() },
    });
    if (!res.ok) return c.json({ error: "package not found" }, 404);

    const pkg = await res.json() as {
      name: string;
      description: string;
      "dist-tags": Record<string, string>;
      versions: Record<string, unknown>;
      time: Record<string, string>;
      maintainers: Array<{ name: string; email: string }>;
    };

    const versions = Object.keys(pkg.versions || {}).sort().reverse();

    return c.json({
      name: pkg.name,
      description: pkg.description || "",
      latest: pkg["dist-tags"]?.latest || "",
      distTags: pkg["dist-tags"] || {},
      versions,
      createdAt: pkg.time?.created || "",
      updatedAt: pkg.time?.modified || "",
      maintainers: pkg.maintainers || [],
    });
  } catch (e) {
    return c.json({ error: `failed to fetch package: ${String(e)}` }, 502);
  }
});

app.get("/api/skills/:name/SKILL.md", async (c) => {
  const name = `@skill/${c.req.param("name")}`;
  const version = c.req.query("version") || "latest";

  const metaUrl = `${REGISTRY_URL}/${encodeURIComponent(name)}`;
  try {
    const metaRes = await fetch(metaUrl, {
      headers: { "Accept": "application/json", ...authHeaders() },
    });
    if (!metaRes.ok) return c.json({ error: "package not found" }, 404);

    const pkg = await metaRes.json() as {
      "dist-tags": Record<string, string>;
      versions: Record<string, { dist: { tarball: string } }>;
    };

    const resolvedVersion = pkg["dist-tags"]?.[version] || version;
    const verData = pkg.versions?.[resolvedVersion];
    if (!verData?.dist?.tarball) {
      return c.json({ error: "version not found" }, 404);
    }

    const skillMd = await extractSkillMd(name, resolvedVersion, verData.dist.tarball);
    let html = marked.parse(skillMd) as string;
    // Sanitize HTML to prevent XSS: strip dangerous tags and event handlers
    html = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
      .replace(/\son\w+\s*=\s*'[^']*'/gi, "");
    return c.json({ name, version: resolvedVersion, html, raw: skillMd });
  } catch (e) {
    console.error("SKILL.md extraction error:", e);
    return c.json({ error: `failed to extract SKILL.md: ${String(e)}` }, 500);
  }
});

app.get("/api/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ results: [] });

  try {
    const searchUrl = `${REGISTRY_URL}/-/v1/search?text=@skill/*+${encodeURIComponent(q)}&size=50`;
    const res = await fetch(searchUrl, {
      headers: { "Accept": "application/json", ...authHeaders() },
    });
    if (!res.ok) return c.json({ error: "search failed" }, 502);

    const data = await res.json() as { objects: Array<{ package: { name: string; version: string; description: string; date: string }; score: { final: number } }> };

    const results = (data.objects || []).map((o) => ({
      name: o.package?.name ?? "",
      version: o.package?.version ?? "",
      description: o.package?.description || "",
      updated: o.package?.date ?? "",
      score: o.score?.final ?? 0,
    }));

    return c.json({ results });
  } catch (e) {
    console.error("search error:", e);
    return c.json({ error: `search failed: ${String(e)}` }, 502);
  }
});

try {
  Deno.serve({ port }, app.fetch);
} catch (err) {
  console.error("Failed to start server:", err);
  Deno.exit(1);
}
