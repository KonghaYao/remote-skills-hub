const SkillDetail = {
  panel: null,
  container: null,
  _requestId: 0,
  _currentName: null,

  init() {
    this.panel = document.getElementById("detail-panel");
    this.container = document.getElementById("skillDetail");
  },

  async show(name) {
    this.panel.classList.remove("hidden");
    this.container.innerHTML = '<div class="spinner"></div>';
    this._currentName = name;

    const reqId = ++this._requestId;

    try {
      const [detail, md] = await Promise.all([
        API.getSkill(name),
        API.getSkillMd(name),
      ]);

      if (reqId !== this._requestId) return;
      this.render(detail, md);
    } catch (e) {
      if (reqId !== this._requestId) return;
      this.container.innerHTML = `<p class="error">加载失败: ${this.escape(e.message)}</p>`;
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
        <h2>${this.escape(detail.name?.replace("@skill/", "") || "")}</h2>
        <p class="detail-desc">${this.escape(detail.description || "")}</p>
      </div>

      <div class="detail-section">
        <h4>安装命令</h4>
        <pre class="install-cmd"><code>npm install ${this.escape(detail.name || "")}@latest</code></pre>
      </div>

      <div class="detail-tabs">
        <button class="detail-tab active" data-tab="overview">概述</button>
        <button class="detail-tab" data-tab="files">文件</button>
        <button class="detail-tab" data-tab="versions">版本 (${versions.length})</button>
      </div>

      <div class="detail-tab-content active" data-tab-content="overview">
        <div class="skill-md-content">${md?.html || "<p>无 SKILL.md</p>"}</div>
      </div>

      <div class="detail-tab-content" data-tab-content="files">
        <div class="file-tree" id="fileTree"><div class="spinner"></div></div>
        <div class="file-preview hidden" id="filePreview"></div>
      </div>

      <div class="detail-tab-content" data-tab-content="versions">
        <div class="version-list">
          ${versions.map((v) => {
            const isLatest = v === detail.latest;
            return `
              <div class="version-list-item">
                <span class="ver-name">
                  <span class="ver-tag ${isLatest ? "latest" : ""}">${this.escape(v)}</span>
                </span>
                <span class="ver-date">${isLatest ? "最新版本" : ""}</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

    // Tab switching
    const tabs = this.container.querySelectorAll(".detail-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.tab;
        this.container.querySelectorAll(".detail-tab").forEach((t) => t.classList.remove("active"));
        this.container.querySelectorAll(".detail-tab-content").forEach((c) => c.classList.remove("active"));
        tab.classList.add("active");
        this.container.querySelector(`[data-tab-content="${target}"]`).classList.add("active");

        // Lazy-load files on first click
        if (target === "files" && this._currentName) {
          this.loadFiles(this._currentName);
        }
      });
    });
  },

  async loadFiles(name) {
    const tree = document.getElementById("fileTree");
    if (tree && tree.dataset.loaded) return;
    if (tree) tree.dataset.loaded = "1";

    try {
      const data = await API.getSkillFiles(name);
      this.renderFileTree(data.files || []);
    } catch (e) {
      if (tree) tree.innerHTML = `<p class="error">加载文件失败: ${this.escape(e.message)}</p>`;
    }
  },

  renderFileTree(files) {
    const tree = document.getElementById("fileTree");
    if (!tree) return;

    if (!files.length) {
      tree.innerHTML = '<p class="empty">此包无文件</p>';
      return;
    }

    // Group by directory
    const dirs = {};
    for (const f of files) {
      const idx = f.path.lastIndexOf("/");
      const dir = idx > 0 ? f.path.slice(0, idx) : "/";
      const name = idx > 0 ? f.path.slice(idx + 1) : f.path;
      if (!dirs[dir]) dirs[dir] = [];
      dirs[dir].push({ ...f, baseName: name });
    }

    const sortedDirs = Object.keys(dirs).sort();
    let html = "";

    for (const dir of sortedDirs) {
      if (dir !== "/") {
        html += `<div class="file-folder" onclick="this.classList.toggle('collapsed')">
          <span class="file-folder-name">/${dir}/</span>
        </div>`;
      }
      html += `<div class="file-folder-children">`;
      for (const f of dirs[dir]) {
        const cls = this.fileIconClass(f.baseName);
        html += `
          <div class="file-item" data-path="${this.escape(f.path)}" onclick="SkillDetail.previewFile('${this.escape(f.path)}')">
            <span class="file-icon ${cls}"></span>
            <span class="file-name">${this.escape(f.baseName)}</span>
            <span class="file-size">${this.formatSize(f.size)}</span>
          </div>`;
      }
      html += `</div>`;
    }

    tree.innerHTML = html;
  },

  async previewFile(path) {
    const preview = document.getElementById("filePreview");
    if (!preview) return;

    preview.classList.remove("hidden");
    preview.innerHTML = '<div class="spinner"></div>';

    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(this._currentName)}/files?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        preview.innerHTML = `<p class="error">加载失败: HTTP ${res.status}</p>`;
        return;
      }
      const content = await res.text();
      const ext = path.split(".").pop()?.toLowerCase() || "";
      const lang = this.codeLang(ext);
      preview.innerHTML = `
        <div class="file-preview-header">
          <span>${this.escape(path)}</span>
          <button class="close-btn" onclick="document.getElementById('filePreview').classList.add('hidden')">x</button>
        </div>
        <pre class="file-preview-code"><code class="language-${lang}">${this.escape(content)}</code></pre>
      `;
    } catch (e) {
      preview.innerHTML = `<p class="error">加载失败: ${this.escape(e.message)}</p>`;
    }
  },

  fileIconClass(name) {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "md" || ext === "mdx") return "fi-md";
    if (ext === "js" || ext === "ts" || ext === "jsx" || ext === "tsx") return "fi-js";
    if (ext === "json") return "fi-json";
    if (ext === "py") return "fi-py";
    if (ext === "sh" || ext === "bash") return "fi-sh";
    if (ext === "css") return "fi-css";
    if (ext === "html") return "fi-html";
    if (ext === "yml" || ext === "yaml") return "fi-yml";
    return "fi-file";
  },

  codeLang(ext) {
    const map = { js: "javascript", ts: "typescript", jsx: "jsx", tsx: "tsx",
      md: "markdown", json: "json", py: "python", sh: "bash", css: "css",
      html: "html", yml: "yaml", yaml: "yaml" };
    return map[ext] || "";
  },

  formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },

  escape(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  },
};
