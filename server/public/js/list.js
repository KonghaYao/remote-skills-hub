const SkillList = {
  container: null,
  pagination: null,
  countLabel: null,
  sortSelect: null,
  currentPage: 1,
  currentSort: "newest",
  limit: 12,

  init() {
    this.container = document.getElementById("skillList");
    this.pagination = document.getElementById("pagination");
    this.countLabel = document.getElementById("resultCount");
    this.sortSelect = document.getElementById("sortSelect");
  },

  async load(page = 1, sort = "newest") {
    this.currentPage = page;
    this.currentSort = sort;
    this.container.innerHTML = this.skeletonHTML(this.limit);
    this.sortSelect.value = sort;

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

    this.container.innerHTML = skills.map((s) => {
      const safeName = s.name.replace("@skill/", "");
      const escaped = this.escape(safeName);
      return `
      <article class="skill-card" data-name="${escaped}">
        <h3 title="${escaped}">${escaped}</h3>
        <p class="desc">${this.escape(s.description || "")}</p>
        <div class="meta">
          <span class="version">v${this.escape(s.version)}</span>
          <span class="date">${this.formatDate(s.updated)}</span>
        </div>
      </article>
    `}).join("");

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
