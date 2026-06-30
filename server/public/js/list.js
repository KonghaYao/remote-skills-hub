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
