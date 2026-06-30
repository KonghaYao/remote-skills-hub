const SkillDetail = {
  panel: null,
  container: null,
  _requestId: 0,

  init() {
    this.panel = document.getElementById("detail-panel");
    this.container = document.getElementById("skillDetail");
  },

  async show(name) {
    this.panel.classList.remove("hidden");
    this.container.innerHTML = '<div class="spinner"></div>';

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
                  <span class="ver-tag ${isLatest ? "latest" : ""}">${this.escape(v)}</span>
                </span>
                <span class="ver-date">${isLatest ? "最新版本" : ""}</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

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
