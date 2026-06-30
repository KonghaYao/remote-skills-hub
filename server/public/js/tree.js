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
