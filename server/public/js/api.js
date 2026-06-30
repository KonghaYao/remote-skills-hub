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
