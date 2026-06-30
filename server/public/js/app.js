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
