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
