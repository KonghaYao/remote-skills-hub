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
