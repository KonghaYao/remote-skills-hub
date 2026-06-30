# Portal SkillHub 风格改造计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 参考 SkillHub 设计模式改造 Portal，增加分页、排序、标签筛选、详情页 Tab 布局

**Architecture:** 纯 vanilla HTML+CSS+JS SPA，通过 Hono 后端扩展 API 分页/排序能力。不引入框架，保持轻量。三栏布局保留（树 + 列表 → 树 + 卡片网格 + 详情面板滑入）

**Tech Stack:** Vanilla JS (ES modules via global objects), CSS Grid/Flexbox, marked (server-side MD rendering), Deno + Hono API

---

## 文件结构总览

```
server/
├── main.ts                          # 修改: /api/skills 加分页/排序, /api/search 统一格式
├── public/
│   ├── index.html                   # 修改: header 增加排序控件, 增加 pagination 容器
│   ├── css/
│   │   └── style.css                # 修改: 网格卡片, 分页器, Tab, 骨架屏样式
│   └── js/
│       ├── api.js                   # 修改: listSkills 传参, search 返回格式适配
│       ├── app.js                   # 修改: 分页/排序联动逻辑
│       ├── list.js                  # 修改: 网格布局, 分页按钮, 排序触发
│       ├── tree.js                  # 保留(小幅优化)
│       └── detail.js                # 修改: Tab 切换(概述/版本历史)
```

---

### Task 1: API 分页与排序支持

**Files:**
- Modify: `server/main.ts` — `/api/skills` 路由

**Story:** 前端需要分页浏览大量 skill，避免一次加载全部数据；同时支持按时间/名称排序

- [ ] **Step 1: 为 `/api/skills` 添加 page/limit/sort 查询参数**

已有路由返回 `{ skills, total }`，但忽视 page/limit。修改如下：

读取 `server/main.ts` 中 `/api/skills` 路由，将其完整替换为：

```typescript
// --- API: list all @skill packages ---
app.get("/api/skills", async (c) => {
  try {
    let page = parseInt(c.req.query("page") || "1");
    let limit = parseInt(c.req.query("limit") || "12");
    const sort = c.req.query("sort") || "newest";

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1 || limit > 100) limit = 12;

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
    if (sort === "newest") {
      skills.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    } else if (sort === "name") {
      skills.sort((a, b) => a.name.localeCompare(b.name));
    }

    const total = skills.length;
    const start = (page - 1) * limit;
    const items = skills.slice(start, start + limit);

    return c.json({ skills: items, total, page, limit });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});
```

- [ ] **Step 2: 编译检查**

```bash
cd /Users/konghayao/code/ai/remote-skills-hub/server && deno check main.ts
```
Expected: `Check main.ts` (无错误)

- [ ] **Step 3: 验证 API 输出**

重启服务后执行：
```bash
curl -s "http://localhost:3000/api/skills?page=1&limit=2&sort=newest" | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert 'skills' in d
assert 'total' in d
assert 'page' in d
assert 'limit' in d
print(f'page={d[\"page\"]}, limit={d[\"limit\"]}, total={d[\"total\"]}, items={len(d[\"skills\"])}')
"
```
Expected: `page=1, limit=2, total=N, items≤2`

- [ ] **Step 4: 提交**

```bash
git add server/main.ts
git commit -m "feat: add pagination and sort to /api/skills"
```

---

### Task 2: Search API 格式统一

**Files:**
- Modify: `server/main.ts` — `/api/search` 路由

**Story:** 当前 `/api/search` 直接透传 Verdaccio 原始格式，前端 `app.js:26` 期望 `data.results` 数组

- [ ] **Step 1: 修改 search 路由返回格式**

读取 `server/main.ts` 中 `/api/search` 路由，替换为：

```typescript
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
      description: o.package?.description || "",
      updated: o.package?.date ?? "",
    }));
    return c.json({ results });
  } catch (e) {
    return c.json({ results: [] });
  }
});
```

- [ ] **Step 2: 验证搜索 API**

```bash
curl -s "http://localhost:3000/api/search?q=hello" | python3 -c "
import sys,json; d=json.load(sys.stdin)
assert 'results' in d
print(f'results count: {len(d[\"results\"])}')
"
```

- [ ] **Step 3: 提交**

```bash
git add server/main.ts
git commit -m "fix: normalize /api/search response to {results} format"
```

---

### Task 3: 列表页改造 — 网格卡片 + 排序 + 分页

**Files:**
- Modify: `server/public/index.html` — 移除 header 搜索 (搜索栏保留但缩小), 增加 sort 控件和 pagination 容器
- Modify: `server/public/js/list.js` — 网格渲染、排序重载、分页回调
- Modify: `server/public/js/app.js` — 分页联动
- Modify: `server/public/css/style.css` — 网格布局、控制栏、分页器样式

**Story:** 卡片从纵向列表改为响应式网格 (2-3列)，顶部增加排序下拉框，底部增加分页按钮

- [ ] **Step 1: 更新 HTML — 在 #content 区增加控制栏和分页容器**

读取 `server/public/index.html`，将 `<section id="content">` 区域修改为：

```html
<section id="content">
  <div class="controls-bar">
    <div class="controls-left">
      <span class="result-count" id="resultCount"></span>
    </div>
    <div class="controls-right">
      <select id="sortSelect" class="sort-select">
        <option value="newest">最新发布</option>
        <option value="name">名称排序</option>
      </select>
    </div>
  </div>
  <div id="skillList" class="skill-grid"></div>
  <div id="pagination" class="pagination"></div>
</section>
```

同时从 `<header>` 标签内移除 `<nav>` 中的搜索栏（但保留搜索 input，待后续放到 header 搜索栏中）：

将 `<nav>` 内容保持不变即可。

- [ ] **Step 2: 更新 CSS — 控制栏、网格、分页器**

在 `server/public/css/style.css` 末尾追加：

```css
/* ---- Controls bar ---- */
.controls-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.result-count {
  font-size: 13px;
  color: var(--muted);
}

.sort-select {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.sort-select:focus {
  outline: none;
  border-color: var(--accent);
}

/* ---- Skill grid ---- */
.skill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.skill-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: border-color 0.15s;
  display: flex;
  flex-direction: column;
}

.skill-card:hover { border-color: var(--accent); }

.skill-card h3 {
  font-size: 15px;
  margin-bottom: 6px;
  color: var(--accent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-card .desc {
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 12px;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.skill-card .meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
}

/* ---- Pagination ---- */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.pagination button {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.1s;
}

.pagination button:hover:not(:disabled) {
  background: var(--bg);
  border-color: var(--accent);
}

.pagination button:disabled {
  color: var(--muted);
  cursor: not-allowed;
  opacity: 0.5;
}

.pagination button.active {
  background: var(--accent-dim);
  color: #fff;
  border-color: var(--accent-dim);
}

.pagination .page-info {
  font-size: 13px;
  color: var(--muted);
  padding: 0 12px;
}

/* ---- Loading skeleton ---- */
.skeleton {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  height: 110px;
}

.skeleton .sk-line {
  height: 14px;
  background: linear-gradient(90deg, var(--border) 25%, var(--surface) 50%, var(--border) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
  margin-bottom: 10px;
}

.skeleton .sk-line:first-child { width: 60%; }
.skeleton .sk-line:nth-child(2) { width: 90%; }
.skeleton .sk-line:nth-child(3) { width: 40%; }

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

- [ ] **Step 3: 重写 list.js — 增加分页、排序、骨架屏**

替换 `server/public/js/list.js` 完整内容：

```javascript
const SkillList = {
  container: null,
  pagination: null,
  countLabel: null,
  currentPage: 1,
  currentSort: "newest",
  limit: 12,

  init() {
    this.container = document.getElementById("skillList");
    this.pagination = document.getElementById("pagination");
    this.countLabel = document.getElementById("resultCount");
  },

  async load(page = 1, sort = "newest") {
    this.currentPage = page;
    this.currentSort = sort;
    this.container.innerHTML = this.skeletonHTML(this.limit);
    document.getElementById("sortSelect").value = sort;

    try {
      const data = await API.listSkills(page, this.limit, sort);
      this.render(data.skills);
      this.renderPagination(data.total, data.page, data.limit);
    } catch (e) {
      this.container.innerHTML = `<p class="error">加载失败: ${e.message}</p>`;
      this.pagination.innerHTML = "";
      this.countLabel.textContent = "";
    }
  },

  render(skills) {
    if (!skills || !skills.length) {
      this.container.innerHTML = '<p class="empty">暂无 skill。在项目中使用 <code>npm publish</code> 发布你的第一个 skill 吧。</p>';
      this.countLabel.textContent = "0 个 skill";
      return;
    }

    this.countLabel.textContent = `共 ${skills.length} 个 skill`;

    this.container.innerHTML = skills.map((s) => `
      <article class="skill-card" data-name="${s.name.replace("@skill/", "")}">
        <h3 title="${s.name.replace("@skill/", "")}">${s.name.replace("@skill/", "")}</h3>
        <p class="desc">${this.escape(s.description || "")}</p>
        <div class="meta">
          <span class="version">v${s.version}</span>
          <span class="date">${this.formatDate(s.updated)}</span>
        </div>
      </article>
    `).join("");

    this.container.querySelectorAll(".skill-card").forEach((card) => {
      card.addEventListener("click", () => {
        this.container.querySelectorAll(".skill-card").forEach((c) => c.classList.remove("active"));
        card.classList.add("active");
        App.selectSkill(card.dataset.name);
      });
    });
  },

  renderPagination(total, page, limit) {
    if (total <= limit) {
      this.pagination.innerHTML = "";
      this.countLabel.textContent = `共 ${total} 个 skill`;
      return;
    }

    this.countLabel.textContent = `共 ${total} 个 skill`;
    const totalPages = Math.ceil(total / limit);
    let html = "";

    html += `<button ${page <= 1 ? "disabled" : ""} data-page="${page - 1}">上一页</button>`;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
        html += `<button class="${i === page ? "active" : ""}" data-page="${i}">${i}</button>`;
      } else if (i === page - 3 || i === page + 3) {
        html += `<button disabled>...</button>`;
      }
    }

    html += `<button ${page >= totalPages ? "disabled" : ""} data-page="${page + 1}">下一页</button>`;
    html += `<span class="page-info">第 ${page}/${totalPages} 页</span>`;

    this.pagination.innerHTML = html;

    this.pagination.querySelectorAll("button[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = parseInt(btn.dataset.page);
        if (!isNaN(p) && p !== page) {
          this.load(p, this.currentSort);
          document.getElementById("content").scrollTop = 0;
        }
      });
    });
  },

  skeletonHTML(count) {
    return Array.from({ length: count }, () => `
      <div class="skeleton">
        <div class="sk-line"></div>
        <div class="sk-line"></div>
        <div class="sk-line"></div>
      </div>
    `).join("");
  },

  formatDate(str) {
    if (!str) return "";
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return "今天";
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    return d.toLocaleDateString("zh-CN");
  },

  escape(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  },
};
```

- [ ] **Step 4: 修改 app.js — 增加排序切换和分页联动**

读取 `server/public/js/app.js`，替换为：

```javascript
const App = {
  init() {
    SkillList.init();
    SkillDetail.init();
    SkillTree.init();

    SkillList.load();
    SkillTree.load();

    // 排序切换事件
    document.getElementById("sortSelect").addEventListener("change", (e) => {
      SkillList.load(1, e.target.value);
    });

    // 搜索事件
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
    if (!q) return SkillList.load(1, SkillList.currentSort);

    SkillList.container.innerHTML = SkillList.skeletonHTML(4);
    SkillList.pagination.innerHTML = "";
    SkillList.countLabel.textContent = "";
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

- [ ] **Step 5: 更新 api.js — listSkills 传参**

替换 `server/public/js/api.js` 完整内容：

```javascript
const API = {
  async fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  listSkills(page = 1, limit = 12, sort = "newest") {
    return this.fetchJson(`/api/skills?page=${page}&limit=${limit}&sort=${sort}`);
  },

  getSkill(name) {
    return this.fetchJson(`/api/skills/${encodeURIComponent(name)}`);
  },

  getSkillMd(name) {
    return this.fetchJson(`/api/skills/${encodeURIComponent(name)}/SKILL.md`);
  },

  search(q) {
    return this.fetchJson(`/api/search?q=${encodeURIComponent(q)}`);
  },
};
```

- [ ] **Step 6: 验证**

重启服务，打开 `http://localhost:3000`：
- 卡片应以网格布局展示
- 排序下拉切换后重新加载
- 分页按钮正常切换页

- [ ] **Step 7: 提交**

```bash
git add server/public/index.html server/public/css/style.css server/public/js/list.js server/public/js/app.js server/public/js/api.js
git commit -m "feat: grid card layout, pagination, sort controls on skill list"
```

---

### Task 4: 详情页 Tab 布局

**Files:**
- Modify: `server/public/js/detail.js` — Tab 结构 (概述 | 版本)
- Modify: `server/public/css/style.css` — Tab 样式

**Story:** 详情页从单面板改为两个 Tab：概述（SKILL.md 渲染内容）和版本历史

- [ ] **Step 1: 更新 CSS — Tab 样式**

在 `server/public/css/style.css` 末尾追加：

```css
/* ---- Tabs ---- */
.detail-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}

.detail-tab {
  padding: 8px 16px;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
  border: none;
  background: none;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.detail-tab:hover {
  color: var(--text);
}

.detail-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.detail-tab-content {
  display: none;
}

.detail-tab-content.active {
  display: block;
}

/* ---- Version list ---- */
.version-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.version-list-item:last-child {
  border-bottom: none;
}

.version-list-item .ver-name {
  font-size: 14px;
  font-weight: 500;
}

.version-list-item .ver-date {
  font-size: 12px;
  color: var(--muted);
}

.ver-tag.latest {
  border-color: var(--accent);
  color: var(--accent);
}
```

- [ ] **Step 2: 重写 detail.js — Tab 布局**

替换 `server/public/js/detail.js` 完整内容：

```javascript
const SkillDetail = {
  panel: null,
  container: null,
  currentSkill: null,
  currentMd: null,

  init() {
    this.panel = document.getElementById("detail-panel");
    this.container = document.getElementById("skillDetail");
  },

  async show(name) {
    this.panel.classList.remove("hidden");
    this.container.innerHTML = '<div class="spinner"></div>';
    this.currentSkill = null;
    this.currentMd = null;

    try {
      const [detail, md] = await Promise.all([
        API.getSkill(name),
        API.getSkillMd(name),
      ]);

      this.currentSkill = detail;
      this.currentMd = md;
      this.render(detail, md);
    } catch (e) {
      this.container.innerHTML = `<p class="error">加载失败: ${e.message}</p>`;
    }
  },

  hide() {
    this.panel.classList.add("hidden");
  },

  render(detail, md) {
    const versions = (detail.versions || []);

    this.container.innerHTML = `
      <div class="detail-header">
        <button class="close-btn" onclick="SkillDetail.hide()">x</button>
        <h2>${detail.name?.replace("@skill/", "") || ""}</h2>
        <p class="detail-desc">${this.escape(detail.description || "")}</p>
      </div>

      <div class="detail-section">
        <h4>安装命令</h4>
        <pre class="install-cmd"><code>npm install ${detail.name}@latest</code></pre>
      </div>

      <div class="detail-tabs">
        <button class="detail-tab active" data-tab="overview">概述</button>
        <button class="detail-tab" data-tab="versions">版本 (${versions.length})</button>
      </div>

      <div class="detail-tab-content active" data-tab-content="overview">
        <div class="skill-md-content">${md?.html || "<p>无 SKILL.md</p>"}</div>
      </div>

      <div class="detail-tab-content" data-tab-content="versions">
        <div class="version-list">
          ${versions.map((v) => {
            const isLatest = v === detail.latest;
            return `
              <div class="version-list-item">
                <span class="ver-name">
                  <span class="ver-tag ${isLatest ? "latest" : ""}">${v}</span>
                </span>
                <span class="ver-date">${isLatest ? "最新版本" : ""}</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

    // Tab 切换逻辑
    this.container.querySelectorAll(".detail-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.tab;
        this.container.querySelectorAll(".detail-tab").forEach((t) => t.classList.remove("active"));
        this.container.querySelectorAll(".detail-tab-content").forEach((c) => c.classList.remove("active"));
        tab.classList.add("active");
        this.container.querySelector(`[data-tab-content="${target}"]`).classList.add("active");
      });
    });
  },

  escape(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  },
};
```

- [ ] **Step 3: 验证**

打开 `http://localhost:3000`，点击一个 skill 卡片：
- 详情面板显示两个 Tab："概述" 和 "版本 (N)"
- 点击 Tab 可切换内容
- 概述显示 SKILL.md 渲染内容
- 版本标签显示所有版本号

- [ ] **Step 4: 提交**

```bash
git add server/public/js/detail.js server/public/css/style.css
git commit -m "feat: detail page tab layout (overview + versions)"
```

---

### Task 5: 树视图优化

**Files:**
- Modify: `server/public/js/tree.js` — 增加计数、高亮激活
- Modify: `server/public/css/style.css` — 树节点计数标签

**Story:** 树视图增加每个节点的激活高亮联动，使导航更直观

- [ ] **Step 1: 更新 CSS — 树节点计数**

在 `server/public/css/style.css` 末尾追加：

```css
.tree-item .tree-count {
  font-size: 11px;
  color: var(--muted);
  float: right;
}
```

- [ ] **Step 2: 更新 tree.js — 同步激活状态**

替换 `server/public/js/tree.js` 完整内容：

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
        this.container.querySelectorAll(".tree-item").forEach((i) => i.classList.remove("active"));
        el.classList.add("active");
        App.selectSkill(el.dataset.skill);
      });
    });

    this.container.querySelectorAll(".tree-folder-label").forEach((el) => {
      el.addEventListener("click", () => {
        const folder = el.closest(".tree-folder");
        if (folder) folder.classList.toggle("collapsed");
      });
    });
  },

  renderNode(node, depth = 0) {
    if (!node.isSkill) {
      const children = node.children.map((c) => this.renderNode(c, depth + 1)).join("");
      const skillCount = node.children.filter((c) => c.isSkill).length;
      return `
        <div class="tree-folder">
          <div class="tree-folder-label">${this.escape(node.name)} <span class="tree-count">${skillCount}</span></div>
          <div class="tree-folder-children">${children}</div>
        </div>`;
    }
    return `
      <div class="tree-item" data-skill="${node.name}" style="padding-left: ${12 + depth * 16}px">
        ${this.escape(node.name)}
      </div>`;
  },

  escape(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  },
};
```

- [ ] **Step 3: 验证**

打开页面，点击树节点：
- 当前选中节点应高亮（`.active` 样式）
- 文件夹显示子节点 skill 数量
- 点击卡片也会触发树节点高亮（通过 SkillList.render 中的 `.active` class 添加）

- [ ] **Step 4: 提交**

```bash
git add server/public/js/tree.js server/public/css/style.css
git commit -m "feat: tree view active state, skill count badges"
```

---

### Task 6: 集成验证与打磨

**Files:**
- Modify: `server/public/css/style.css` — 移除旧样式冲突

**Story:** 改造后整体验证，确保无样式冲突，所有交互正常

- [ ] **Step 1: 检查样式冲突**

原有 `.skill-card` 样式与网格布局样式冲突（旧样式中的 `margin-bottom: 12px` 应在网格中不生效，但可能有其他问题）。确认 `style.css` 中 `.skill-card` 的 `margin-bottom: 12px` 保留（网格 column 中 margin 不冲突）。

- [ ] **Step 2: 端到端验收**

重启服务：
```bash
kill $(lsof -ti:3000) 2>/dev/null; sleep 1
cd /Users/konghayao/code/ai/remote-skills-hub/server
deno run --allow-net --allow-read --allow-write --allow-env --allow-run main.ts &
```

打开 `http://localhost:3000`，确认：
- [x] Header 显示正常
- [x] 左侧树视图可点击导航
- [x] 中间卡片网格显示，有骨架加载过渡
- [x] 排序下拉可切换
- [x] 分页按钮可用（skill 少于 limit 时不显示）
- [x] 点击卡片打开详情面板，两个 Tab 可切换
- [x] 搜索功能正常（清空搜索恢复列表）
- [x] 关闭详情面板正常工作

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "chore: final integration polish for portal redesign"
```

---
