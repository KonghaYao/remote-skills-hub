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
        App.selectSkill(el.dataset.skill);
      });
    });

    this.container.querySelectorAll(".tree-folder").forEach((el) => {
      el.addEventListener("click", () => {
        el.classList.toggle("collapsed");
      });
    });
  },

  renderNode(node, depth = 0) {
    if (!node.isSkill) {
      const children = node.children.map((c) => this.renderNode(c, depth + 1)).join("");
      return `
        <div class="tree-folder">
          <div class="tree-folder-label">${node.name}</div>
          <div class="tree-folder-children">${children}</div>
        </div>`;
    }
    return `
      <div class="tree-item" data-skill="${node.name}" style="padding-left: ${12 + depth * 16}px">
        ${node.name}
      </div>`;
  },
};
