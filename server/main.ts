import { Hono, cors, logger, serveStatic } from "./deps.ts";

const REGISTRY_URL = Deno.env.get("REGISTRY_URL") || "http://localhost:4873";
const port = parseInt(Deno.env.get("PORT") || "3000");

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

// --- Static portal ---
app.use("/static/*", serveStatic({ root: "./public" }));
app.get("/", (c) => {
  const html = Deno.readTextFileSync("./public/index.html");
  return c.html(html);
});

// --- Proxy: pass-through npm registry APIs ---
app.all("/npm/*", async (c) => {
  const path = c.req.path.replace("/npm", "");
  const url = `${REGISTRY_URL}${path}${c.req.query() ? "?" + new URLSearchParams(c.req.query()).toString() : ""}`;

  const res = await fetch(url, {
    method: c.req.method,
    headers: {
      "Accept": "application/json",
      ...(Deno.env.get("REGISTRY_TOKEN") ? { Authorization: `Bearer ${Deno.env.get("REGISTRY_TOKEN")}` } : {}),
    },
  });

  return new Response(res.body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
  });
});

// --- Extended APIs (stubs for now) ---
app.get("/api/skills", async (c) => {
  return c.json({ skills: [], total: 0 });
});

app.get("/api/skills/:name", async (c) => {
  return c.json({ error: "not implemented" }, 501);
});

app.get("/api/skills/:name/SKILL.md", async (c) => {
  return c.json({ error: "not implemented" }, 501);
});

app.get("/api/search", async (c) => {
  return c.json({ results: [] });
});

Deno.serve({ port }, app.fetch);
