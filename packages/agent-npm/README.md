# agent-npm

AI Agent Skill 包管理器。从 npm registry 安装 `@skill/*` 包到本地 `.agents/` 工作区，并自动链接到 agent 框架标准目录。

## 安装

```bash
npm install -g agent-npm
```

## 快速开始

```bash
# 进入你的项目目录
cd my-project

# 初始化 skill 工作区
agent-npm init

# 安装 skill
agent-npm install @skill/hello-world

# 查看已安装
agent-npm list
```

安装后的目录结构：

```
my-project/
├── .agents/
│   ├── package.json          # 依赖清单
│   ├── package-lock.json     # 版本锁定
│   ├── .npmrc                # registry 配置
│   ├── skills/               # agent 发现目录 (符号链接)
│   │   └── hello-world → ../node_modules/@skill/hello-world
│   └── node_modules/
│       └── @skill/
│           └── hello-world/
│               ├── SKILL.md  # AI agent 指令文件
│               └── package.json
└── ...
```

## 命令

### init — 初始化工作区

```bash
agent-npm init
```

在项目根目录创建 `.agents/` 目录，包含 `package.json` 和 `.npmrc`。

### install — 安装 skill

```bash
# 安装最新版
agent-npm install @skill/hello-world

# 安装指定版本
agent-npm install @skill/hello-world@1.2.0

# 安装多个
agent-npm install @skill/hello-world @skill/code-review

# 不带参数 = 安装所有 (从 .agents/package.json 读取)
agent-npm install
```

安装成功后会**自动执行 link**，创建符号链接到 `.agents/skills/`。

### uninstall — 移除 skill

```bash
agent-npm uninstall @skill/hello-world
```

### list — 列出已安装

```bash
agent-npm list

# 输出:
# .agents/node_modules/@skill/
# └── hello-world @1.0.0
```

### search — 搜索 registry

```bash
agent-npm search hello
```

### info — 查看详情

```bash
agent-npm info hello-world

# 输出包元数据、版本列表、SKILL.md 信息、文件树
```

### which — 查看安装路径

```bash
agent-npm which hello-world

# 输出:
# /path/to/project/.agents/node_modules/@skill/hello-world
```

### update — 更新版本

```bash
# 更新全部
agent-npm update

# 更新指定
agent-npm update hello-world
```

### outdated — 检查过期

```bash
agent-npm outdated
```

### link / unlink — 管理符号链接

```bash
# 链接所有已安装 skill → .agents/skills/ (默认)
agent-npm link

# 链接到 .claude/skills/ (Claude Code 格式)
agent-npm link --agent claude

# 链接到全局目录 ~/.agents/skills/
agent-npm link --global

# 查看链接状态
agent-npm link --status

# 移除所有链接
agent-npm unlink

# 移除指定链接
agent-npm unlink hello-world
```

### config — 配置管理

```bash
# 查看当前配置
agent-npm config

# 设置 registry
agent-npm config set registry http://my-hub:4873

# 获取单个配置
agent-npm config get registry

# 删除配置
agent-npm config delete registry
```

配置文件位于 `~/.agent-npmrc`。

## 工作方式

1. **安装** → npm install 到 `.agents/node_modules/@skill/`
2. **自动 link** → 创建符号链接 `.agents/skills/<name>` → `node_modules/@skill/<name>`
3. **Agent 发现** → 框架读取 `.agents/skills/<name>/SKILL.md` 加载指令

## 支持 --agent 参数

| 命令 | 效果 |
|------|------|
| `agent-npm link` | → `.agents/skills/` (默认) |
| `agent-npm link --agent claude` | → `.claude/skills/` |
| `agent-npm link --global` | → `~/.agents/skills/` |

`unlink` 和 `--status` 同样支持上述标志。
