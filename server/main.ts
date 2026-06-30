import { Hono, cors, logger, serveStatic } from "./deps.ts";

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

app.get("/api/skills/:name", (c) => {
  return c.json({ error: "not implemented" }, 501);
});

app.get("/api/skills/:name/SKILL.md", (c) => {
  return c.json({ error: "not implemented" }, 501);
});

app.get("/api/search", (c) => {
  return c.json({ results: [] });
});

try {
  Deno.serve({ port }, app.fetch);
} catch (err) {
  console.error("Failed to start server:", err);
  Deno.exit(1);
}
