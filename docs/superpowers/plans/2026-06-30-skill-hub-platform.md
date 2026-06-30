# Skill Hub Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a centralized skill distribution platform — Verdaccio npm registry + Deno/Hono server + vanilla JS portal, all orchestrated via docker-compose.

**Architecture:** Verdaccio (:4873) serves as the npm registry for `@skill/*` packages. The Deno/Hono server (:3000) proxies npm registry APIs, extracts and caches SKILL.md files from tarballs, and serves a static portal frontend. Portal is a vanilla HTML/CSS/JS SPA with tree-view skill browsing.

**Tech Stack:** Verdaccio 6.x, Deno 2.x + Hono 4.x, marked (npm), vanilla HTML/CSS/JS, Docker Compose

---

### Task 1: Verdaccio Configuration

**Files:**
- Create: `verdaccio/config.yaml`

- [ ] **Step 1: Write verdaccio/config.yaml**

```yaml
storage: /verdaccio/storage
plugins: /verdaccio/plugins

web:
  title: Skill Hub Registry
  enable: true

auth:
  htpasswd:
    file: /verdaccio/storage/htpasswd
    max_users: -1

uplinks:
  npmjs:
    url: https://registry.npmjs.org/
    maxage: 30m

packages:
  '@skill/*':
    access: $authenticated
    publish: $authenticated
    unpublish: $authenticated

  '**':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
    proxy: npmjs

server:
  keepAliveTimeout: 60

middlewares:
  audit:
    enabled: true

logs:
  type: stdout
  format: pretty
  level: http
```

- [ ] **Step 2: Commit**

```bash
git add verdaccio/config.yaml
git commit -m "feat: add Verdaccio config with @skill scope access rules"
```

---

### Task 2: Docker Compose Setup

**Files:**
- Create: `docker-compose.yml`
- Create: `server/Dockerfile`

- [ ] **Step 1: Create server/Dockerfile**

```dockerfile
FROM denoland/deno:2

WORKDIR /app

COPY deno.json deno.lock ./
RUN deno install

COPY . .

EXPOSE 3000
CMD ["deno", "task", "start"]
```

- [ ] **Step 2: Create docker-compose.yml**

```yaml
services:
  verdaccio:
    image: verdaccio/verdaccio:6
    container_name: skill-hub-verdaccio
    ports:
      - "4873:4873"
    volumes:
      - verdaccio-storage:/verdaccio/storage
      - ./verdaccio/config.yaml:/verdaccio/conf/config.yaml:ro
    restart: unless-stopped

  server:
    build: ./server
    container_name: skill-hub-server
    ports:
      - "3000:3000"
    environment:
      REGISTRY_URL: http://verdaccio:4873
      REGISTRY_TOKEN: ${REGISTRY_READ_TOKEN:-}
      CACHE_DIR: /app/cache
      PORT: "3000"
    volumes:
      - server-cache:/app/cache
    depends_on:
      - verdaccio
    restart: unless-stopped

volumes:
  verdaccio-storage:
  server-cache:
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml server/Dockerfile
git commit -m "feat: add docker-compose with Verdaccio + Server"
```

---

### Task 3: Deno Server Foundation

**Files:**
- Create: `server/deno.json`
- Create: `server/main.ts`
- Create: `server/deps.ts`
- Create: `server/cache.ts`

- [ ] **Step 1: Create server/deno.json**

```json
{
  "tasks": {
    "dev": "deno run --allow-net --allow-read --allow-write --allow-env --watch main.ts",
    "start": "deno run --allow-net --allow-read --allow-write --allow-env main.ts"
  },
  "imports": {
    "hono": "npm:hono@^4",
    "hono/deno": "npm:hono@^4/dist/middleware/serve-static/index.js",
    "marked": "npm:marked@^15"
  },
  "compilerOptions": {
    "strict": true
  }
}
```

- [ ] **Step 2: Create server/deps.ts**

```typescript
export { Hono } from "hono";
export { cors } from "hono/cors";
export { logger } from "hono/logger";
export { serveStatic } from "hono/deno";
export { marked } from "marked";
```

- [ ] **Step 3: Create server/cache.ts** — tarball cache with filesystem storage

```typescript
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
```

- [ ] **Step 4: Create server/main.ts** — minimal skeleton, routes stubbed

```typescript
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
```

- [ ] **Step 5: Commit**

```bash
git add server/deno.json server/deps.ts server/cache.ts server/main.ts
git commit -m "feat: add Deno+Hono server skeleton with cache module"
```

---

### Task 4: Skill List API — `/api/skills`

**Files:**
- Modify: `server/main.ts` (replace stub)

- [ ] **Step 1: Replace the `/api/skills` stub in server/main.ts**

```typescript
app.get("/api/skills", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const tag = c.req.query("tag");

  const searchUrl = `${REGISTRY_URL}/-/v1/search?text=@skill/*&size=250`;
  const res = await fetch(searchUrl, {
    headers: { "Accept": "application/json", ...authHeaders() },
  });
  if (!res.ok) return c.json({ error: "registry unavailable" }, 502);

  const data = await res.json() as { objects: Array<{ package: { name: string; version: string; description: string; date: string }; score: { final: number } }> };

  let skills = (data.objects || []).map((o) => ({
    name: o.package.name,
    version: o.package.version,
    description: o.package.description || "",
    updated: o.package.date,
    score: o.score?.final ?? 0,
  }));

  if (tag) {
    skills = skills.filter((s) => s.description?.includes(`#${tag}`));
  }

  const total = skills.length;
  const start = (page - 1) * limit;
  const items = skills.slice(start, start + limit);

  return c.json({ skills: items, total, page, limit });
});
```

- [ ] **Step 2: Add authHeaders helper before routes**

```typescript
function authHeaders(): Record<string, string> {
  return Deno.env.get("REGISTRY_TOKEN")
    ? { Authorization: `Bearer ${Deno.env.get("REGISTRY_TOKEN")}` }
    : {};
}
```

- [ ] **Step 3: Commit**

```bash
git add server/main.ts
git commit -m "feat: implement /api/skills list with search, pagination, tag filter"
```

---

### Task 5: Skill Detail API — `/api/skills/:name`

**Files:**
- Modify: `server/main.ts` (replace stub)

- [ ] **Step 1: Replace the `/api/skills/:name` stub in server/main.ts**

```typescript
app.get("/api/skills/:name", async (c) => {
  const name = `@skill/${c.req.param("name")}`;
  const metaUrl = `${REGISTRY_URL}/${encodeURIComponent(name)}`;

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
});
```

- [ ] **Step 2: Commit**

```bash
git add server/main.ts
git commit -m "feat: implement /api/skills/:name detail from registry metadata"
```

---

### Task 6: SKILL.md Extraction API — `/api/skills/:name/SKILL.md`

**Files:**
- Modify: `server/main.ts` (replace stub)
- Create: `server/tarball.ts`

- [ ] **Step 1: Create server/tarball.ts** — extract SKILL.md from npm tarball

```typescript
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { cacheTarball, ensureTempDir, getCachedSKILL, setCachedSKILL } from "./cache.ts";

export async function extractSkillMd(
  name: string,
  version: string,
  tarballUrl: string,
): Promise<string> {
  const cached = await getCachedSKILL(name, version, tarballUrl);
  if (cached) return cached;

  const tmp = ensureTempDir();
  const tgzPath = await cacheTarball(tarballUrl, tmp);
  const extractDir = join(tmp, `${name.replace("/", "_")}@${version}`);

  if (!existsSync(extractDir)) {
    mkdirSync(extractDir, { recursive: true });
    const p = new Deno.Command("tar", {
      args: ["-xzf", tgzPath, "-C", extractDir],
    });
    const out = await p.output();
    if (!out.success) throw new Error("tar extract failed");
  }

  // walk the extracted dir for package/SKILL.md
  let skillMdContent = "";
  for (const entry of Deno.readDirSync(extractDir)) {
    if (entry.isDirectory && entry.name === "package") {
      const skillPath = join(extractDir, entry.name, "SKILL.md");
      if (existsSync(skillPath)) {
        skillMdContent = Deno.readTextFileSync(skillPath);
        break;
      }
    }
  }

  if (!skillMdContent) throw new Error("SKILL.md not found in package");

  await setCachedSKILL(name, version, skillMdContent);
  return skillMdContent;
}
```

- [ ] **Step 2: Replace the `/api/skills/:name/SKILL.md` stub in server/main.ts**

```typescript
app.get("/api/skills/:name/SKILL.md", async (c) => {
  const name = `@skill/${c.req.param("name")}`;
  const version = c.req.query("version") || "latest";

  // resolve version tag
  const metaUrl = `${REGISTRY_URL}/${encodeURIComponent(name)}`;
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

  try {
    const skillMd = await extractSkillMd(name, resolvedVersion, verData.dist.tarball);
    const html = marked.parse(skillMd) as string;
    return c.json({ name, version: resolvedVersion, html, raw: skillMd });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});
```

- [ ] **Step 3: Add `extractSkillMd` import to server/main.ts**

```typescript
import { extractSkillMd } from "./tarball.ts";
```

- [ ] **Step 4: Commit**

```bash
git add server/tarball.ts server/main.ts
git commit -m "feat: implement SKILL.md extraction from npm tarball with cache"
```

---

### Task 7: Search API — `/api/search`

**Files:**
- Modify: `server/main.ts` (replace stub)

- [ ] **Step 1: Replace the `/api/search` stub in server/main.ts**

```typescript
app.get("/api/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ results: [] });

  const searchUrl = `${REGISTRY_URL}/-/v1/search?text=@skill/*+${encodeURIComponent(q)}&size=50`;
  const res = await fetch(searchUrl, {
    headers: { "Accept": "application/json", ...authHeaders() },
  });
  if (!res.ok) return c.json({ error: "search failed" }, 502);

  const data = await res.json() as { objects: Array<{ package: { name: string; version: string; description: string; date: string }; score: { final: number } }> };

  const results = (data.objects || []).map((o) => ({
    name: o.package.name,
    version: o.package.version,
    description: o.package.description || "",
    updated: o.package.date,
    score: o.score?.final ?? 0,
  }));

  return c.json({ results });
});
```

- [ ] **Step 2: Commit**

```bash
git add server/main.ts
git commit -m "feat: implement /api/search endpoint"
```

---

### Task 8: Portal — Skeleton and Shell

**Files:**
- Create: `server/public/index.html`
- Create: `server/public/css/style.css`
- Create: `server/public/js/api.js`

- [ ] **Step 1: Create server/public/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Skill Hub</title>
  <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
  <header>
    <h1><a href="/">Skill Hub</a></h1>
    <nav>
      <input type="search" id="searchInput" placeholder="搜索 skill..." autocomplete="off">
      <button id="searchBtn">搜索</button>
    </nav>
  </header>

  <main>
    <aside id="sidebar">
      <div id="skillTree"></div>
    </aside>
    <section id="content">
      <div id="skillList"></div>
    </section>
    <aside id="detail-panel" class="hidden">
      <div id="skillDetail"></div>
    </aside>
  </main>

  <script src="/static/js/api.js"></script>
  <script src="/static/js/tree.js"></script>
  <script src="/static/js/list.js"></script>
  <script src="/static/js/detail.js"></script>
  <script src="/static/js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create server/public/css/style.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0d1117;
  --surface: #161b22;
  --border: #30363d;
  --text: #c9d1d9;
  --muted: #8b949e;
  --accent: #58a6ff;
  --accent-dim: #1f6feb;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

header h1 { font-size: 18px; }
header h1 a { color: var(--text); text-decoration: none; }

nav { display: flex; gap: 8px; }

#searchInput {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 6px 12px;
  border-radius: 6px;
  width: 240px;
  font-size: 14px;
}
#searchInput:focus { outline: none; border-color: var(--accent); }
#searchBtn {
  background: var(--accent-dim);
  color: #fff;
  border: none;
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

main {
  display: grid;
  grid-template-columns: 240px 1fr 0fr;
  flex: 1;
  overflow: hidden;
}

#sidebar {
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  padding: 12px;
}

#content {
  overflow-y: auto;
  padding: 24px;
}

#detail-panel {
  background: var(--surface);
  border-left: 1px solid var(--border);
  overflow-y: auto;
  padding: 24px;
  width: 420px;
}
#detail-panel.hidden { display: none; }

.spinner {
  width: 24px; height: 24px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

- [ ] **Step 3: Create server/public/js/api.js**

```javascript
const API = {
  async fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  listSkills(page = 1, limit = 20) {
    return this.fetchJson(`/api/skills?page=${page}&limit=${limit}`);
  },

  getSkill(name) {
    return this.fetchJson(`/api/skills/${encodeURIComponent(name)}`);
  },

  getSkillMd(name, version = "latest") {
    return this.fetchJson(`/api/skills/${encodeURIComponent(name)}/SKILL.md?version=${version}`);
  },

  search(q) {
    return this.fetchJson(`/api/search?q=${encodeURIComponent(q)}`);
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add server/public/
git commit -m "feat: add portal skeleton — index.html, base CSS, API client"
```

---

### Task 9: Portal — Skill List View

**Files:**
- Create: `server/public/js/list.js`

- [ ] **Step 1: Create server/public/js/list.js**

```javascript
const SkillList = {
  container: null,

  init() {
    this.container = document.getElementById("skillList");
  },

  async load() {
    this.container.innerHTML = '<div class="spinner"></div>';
    try {
      const data = await API.listSkills(1, 50);
      this.render(data.skills);
    } catch (e) {
      this.container.innerHTML = `<p class="error">加载失败: ${e.message}</p>`;
    }
  },

  render(skills) {
    if (!skills.length) {
      this.container.innerHTML = '<p class="empty">暂无 skill。在项目中使用 <code>npm publish</code> 发布你的第一个 skill 吧。</p>';
      return;
    }

    const html = skills.map((s) => `
      <article class="skill-card" data-name="${s.name.replace('@skill/', '')}">
        <h3>${s.name.replace("@skill/", "")}</h3>
        <p class="desc">${this.escape(s.description)}</p>
        <div class="meta">
          <span class="version">v${s.version}</span>
          <span class="date">${new Date(s.updated).toLocaleDateString()}</span>
        </div>
      </article>
    `).join("");

    this.container.innerHTML = html;

    this.container.querySelectorAll(".skill-card").forEach((card) => {
      card.addEventListener("click", () => {
        App.selectSkill(card.dataset.name);
      });
    });
  },

  escape(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  },
};
```

- [ ] **Step 2: Add list styles to style.css**

```css
.skill-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.skill-card:hover { border-color: var(--accent); }
.skill-card h3 { font-size: 16px; margin-bottom: 6px; color: var(--accent); }
.skill-card .desc { font-size: 14px; color: var(--muted); margin-bottom: 10px; }
.skill-card .meta { display: flex; gap: 16px; font-size: 12px; color: var(--muted); }
.error, .empty { padding: 24px; color: var(--muted); text-align: center; }
.empty code { background: var(--surface); padding: 2px 6px; border-radius: 3px; }
```

- [ ] **Step 3: Commit**

```bash
git add server/public/js/list.js server/public/css/style.css
git commit -m "feat: add portal skill list view with cards"
```

---

### Task 10: Portal — Skill Detail Panel

**Files:**
- Create: `server/public/js/detail.js`

- [ ] **Step 1: Create server/public/js/detail.js**

```javascript
const SkillDetail = {
  panel: null,
  container: null,

  init() {
    this.panel = document.getElementById("detail-panel");
    this.container = document.getElementById("skillDetail");
  },

  async show(name) {
    this.panel.classList.remove("hidden");
    this.container.innerHTML = '<div class="spinner"></div>';

    try {
      const [detail, md] = await Promise.all([
        API.getSkill(name),
        API.getSkillMd(name),
      ]);

      this.render(detail, md);
    } catch (e) {
      this.container.innerHTML = `<p class="error">加载失败: ${e.message}</p>`;
    }
  },

  hide() {
    this.panel.classList.add("hidden");
  },

  render(detail, md) {
    const versions = (detail.versions || []).slice(0, 10);

    this.container.innerHTML = `
      <div class="detail-header">
        <button class="close-btn" onclick="SkillDetail.hide()">x</button>
        <h2>${detail.name?.replace("@skill/", "") || ""}</h2>
        <p class="detail-desc">${detail.description || ""}</p>
      </div>

      <div class="detail-section">
        <h4>版本</h4>
        <div class="version-tags">
          ${versions.map((v) => `<span class="ver-tag ${v === detail.latest ? 'latest' : ''}">${v}</span>`).join("")}
        </div>
      </div>

      <div class="detail-section">
        <h4>安装</h4>
        <pre class="install-cmd"><code>npm install ${detail.name}@latest</code></pre>
      </div>

      <div class="detail-section">
        <h4>说明</h4>
        <div class="skill-md-content">${md?.html || "无 SKILL.md"}</div>
      </div>
    `;
  },
};
```

- [ ] **Step 2: Add detail styles to style.css**

```css
.detail-header { margin-bottom: 20px; }
.detail-header h2 { font-size: 22px; margin-bottom: 8px; }
.detail-desc { color: var(--muted); font-size: 14px; }
.close-btn {
  float: right;
  background: none; border: 1px solid var(--border); color: var(--text);
  padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 14px;
}
.close-btn:hover { background: var(--border); }

.detail-section { margin-bottom: 20px; }
.detail-section h4 { font-size: 13px; color: var(--muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }

.version-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.ver-tag {
  background: var(--bg); border: 1px solid var(--border); border-radius: 4px;
  padding: 2px 8px; font-size: 13px; color: var(--text);
}
.ver-tag.latest { border-color: var(--accent); color: var(--accent); }

.install-cmd {
  background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
  padding: 10px 14px; font-size: 13px; overflow-x: auto;
}

.skill-md-content { font-size: 14px; line-height: 1.7; }
.skill-md-content h1, .skill-md-content h2, .skill-md-content h3 { margin: 16px 0 8px; }
.skill-md-content pre { background: var(--bg); padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 13px; }
.skill-md-content code { background: var(--bg); padding: 1px 4px; border-radius: 3px; font-size: 13px; }
.skill-md-content pre code { background: none; padding: 0; }
.skill-md-content ul, .skill-md-content ol { padding-left: 20px; margin: 8px 0; }
.skill-md-content li { margin: 4px 0; }
```

- [ ] **Step 3: Commit**

```bash
git add server/public/js/detail.js server/public/css/style.css
git commit -m "feat: add portal skill detail panel with version list and markdown rendering"
```

---

### Task 11: Portal — Tree View + App Shell

**Files:**
- Create: `server/public/js/tree.js`
- Create: `server/public/js/app.js`

- [ ] **Step 1: Create server/public/js/tree.js**

```javascript
const SkillTree = {
  container: null,

  init() {
    this.container = document.getElementById("skillTree");
  },

  async load() {
    try {
      const data = await API.listSkills(1, 200);
      const skills = data.skills || [];
      const tree = this.buildTree(skills);
      this.render(tree);
    } catch (e) {
      this.container.innerHTML = `<p class="error">Tree load error</p>`;
    }
  },

  buildTree(skills) {
    const map = {};
    for (const s of skills) {
      const name = s.name.replace("@skill/", "");
      map[name] = { name, fullName: s.name, children: [], isSkill: true };
    }

    const roots = [];
    for (const [name, node] of Object.entries(map)) {
      const slashIdx = name.lastIndexOf("/");
      if (slashIdx > 0) {
        const parent = name.slice(0, slashIdx);
        if (map[parent]) {
          map[parent].children.push(node);
          continue;
        }
        // create category parent
        if (!map["_cat_" + parent]) {
          map["_cat_" + parent] = { name: parent, children: [node], isSkill: false };
          roots.push(map["_cat_" + parent]);
        } else {
          map["_cat_" + parent].children.push(node);
        }
        continue;
      }
      roots.push(node);
    }

    return roots;
  },

  render(tree) {
    const html = '<div class="tree-title">Skills</div>' + tree.map((n) => this.renderNode(n)).join("");
    this.container.innerHTML = html;

    this.container.querySelectorAll(".tree-item[data-skill]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        App.selectSkill(el.dataset.skill);
      });
    });

    this.container.querySelectorAll(".tree-folder").forEach((el) => {
      el.addEventListener("click", () => {
        el.classList.toggle("collapsed");
      });
    });
  },

  renderNode(node, depth = 0) {
    if (!node.isSkill) {
      const children = node.children.map((c) => this.renderNode(c, depth + 1)).join("");
      return `
        <div class="tree-folder">
          <div class="tree-folder-label">${node.name}</div>
          <div class="tree-folder-children">${children}</div>
        </div>`;
    }
    return `
      <div class="tree-item" data-skill="${node.name}" style="padding-left: ${12 + depth * 16}px">
        ${node.name}
      </div>`;
  },
};
```

- [ ] **Step 2: Create server/public/js/app.js**

```javascript
const App = {
  init() {
    SkillList.init();
    SkillDetail.init();
    SkillTree.init();

    SkillList.load();
    SkillTree.load();

    document.getElementById("searchBtn").addEventListener("click", () => this.search());
    document.getElementById("searchInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.search();
    });
  },

  selectSkill(name) {
    SkillDetail.show(name);
  },

  async search() {
    const q = document.getElementById("searchInput").value.trim();
    if (!q) return SkillList.load();

    SkillList.container.innerHTML = '<div class="spinner"></div>';
    try {
      const data = await API.search(q);
      SkillList.render(data.results || []);
    } catch (e) {
      SkillList.container.innerHTML = `<p class="error">搜索失败: ${e.message}</p>`;
    }
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
```

- [ ] **Step 3: Add tree styles to style.css**

```css
.tree-title { font-size: 12px; color: var(--muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }

.tree-folder { margin-bottom: 4px; }
.tree-folder-label {
  font-size: 13px; color: var(--muted); padding: 4px 8px; cursor: pointer;
  border-radius: 4px;
}
.tree-folder-label:hover { background: var(--bg); }

.tree-folder.collapsed .tree-folder-children { display: none; }

.tree-item {
  font-size: 14px; padding: 6px 12px; cursor: pointer; border-radius: 4px;
  transition: background 0.1s; color: var(--text);
}
.tree-item:hover { background: var(--bg); color: var(--accent); }
.tree-item.active { background: var(--accent-dim); color: #fff; }
```

- [ ] **Step 4: Commit**

```bash
git add server/public/js/tree.js server/public/js/app.js server/public/css/style.css
git commit -m "feat: add portal tree view and app shell with search"
```

---

### Task 12: Example Skill Package

**Files:**
- Create: `skills/hello-world/SKILL.md`
- Create: `skills/hello-world/package.json`

- [ ] **Step 1: Create skills/hello-world/package.json**

```json
{
  "name": "@skill/hello-world",
  "version": "1.0.0",
  "description": "A minimal example skill for the Skill Hub platform #demo #getting-started",
  "main": "SKILL.md",
  "skill": {
    "category": "examples",
    "tags": ["demo", "getting-started"]
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/example/skill-hello-world"
  },
  "keywords": ["skill", "skill-hub"],
  "license": "MIT"
}
```

- [ ] **Step 2: Create skills/hello-world/SKILL.md**

```markdown
---
name: hello-world
description: A minimal example skill demonstrating the Skill Hub platform format. Use when trying out or testing the Skill Hub.
---

# Hello World Skill

This is a minimal example skill for the Skill Hub platform.

## What it does

Greets the world and demonstrates the standard skill package format.

## Usage

When you ask your AI agent to "say hello with the hello-world skill", it will respond with a friendly greeting.

## Response Format

Always respond with this exact template:

```
Hello from Skill Hub! This is the hello-world skill v1.0.0.

I can help you understand how Skill Hub packages work.
Each skill is an npm package under the @skill scope,
with a SKILL.md file that contains the instructions for AI agents.
```
```

- [ ] **Step 3: Commit**

```bash
git add skills/hello-world/
git commit -m "feat: add hello-world example skill package"
```

---

### Task 13: Docker Compose Verification

- [ ] **Step 1: Build images**

```bash
docker compose build
```

Expected: both services build without error.

- [ ] **Step 2: Start services**

```bash
docker compose up -d
```

Expected: both containers running, check with `docker compose ps`.

- [ ] **Step 3: Verify Verdaccio is alive**

```bash
curl http://localhost:4873/
```

Expected: HTML response or 200 status.

- [ ] **Step 4: Verify Server is alive**

```bash
curl http://localhost:3000/
```

Expected: Portal index.html rendered. (Skills list may be empty since no packages published yet.)

- [ ] **Step 5: Verify API passthrough**

```bash
curl http://localhost:3000/npm/@skill/nonexistent
```

Expected: 404 from Verdaccio proxied through server.

- [ ] **Step 6: Bring down services**

```bash
docker compose down
```

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: verify docker compose builds and starts correctly"
```

---

### Task 14: Final Integration Verification

- [ ] **Step 1: Start services and publish example skill**

```bash
docker compose up -d
# Register a user on Verdaccio
npm adduser --registry http://localhost:4873
# Publish the example skill
cd skills/hello-world
npm publish --registry http://localhost:4873
cd ../..
```

Expected: publish succeeds.

- [ ] **Step 2: Verify skill appears in API**

```bash
curl http://localhost:3000/api/skills
```

Expected: response contains `@skill/hello-world` in skills array.

- [ ] **Step 3: Verify skill detail**

```bash
curl http://localhost:3000/api/skills/hello-world
```

Expected: response contains version info and metadata.

- [ ] **Step 4: Verify SKILL.md extraction**

```bash
curl http://localhost:3000/api/skills/hello-world/SKILL.md
```

Expected: response contains `html` and `raw` fields with SKILL.md content.

- [ ] **Step 5: Verify portal loads skill**

Open `http://localhost:3000` in browser. Click on `hello-world` in the skill list → detail panel should show version, install command, and rendered SKILL.md.

- [ ] **Step 6: Cleanup**

```bash
docker compose down
```

---

## Self-Review

**1. Spec coverage (against CLAUDE.md):**
- `docker-compose.yml` → Task 2
- `verdaccio/config.yaml` → Task 1
- Deno + Hono server → Tasks 3-7
- API passthrough + extended APIs → Tasks 4-7
- SKILL.md extraction with cache → Task 6
- Portal static files → Tasks 8-11
- Tree view → Task 11
- Example skill → Task 12
- 双 token 鉴权 → Task 2 (docker-compose env) + Task 4 (authHeaders)
- npm 标准协议优先 → Tasks 4-7 use registry API, not storage

**2. Placeholder scan:** No TBD, TODO, or "implement later" found. All code is complete.

**3. Type consistency:** API response shapes are consistent across list.js (reads `skills[].name`, `skills[].description`) and detail.js (reads `detail.name`, `detail.description`, `detail.versions`, `detail.latest`). Same for tree.js. Cache keys use consistent `name.replace("/", "_")` pattern across cache.ts and tarball.ts.
