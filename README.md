# Remote Skills Hub

中心化 Skill 分发平台。底层基于 [Verdaccio](https://verdaccio.org/) 私有 npm registry，上层自建 Deno + Hono server + 静态门户。所有 skill 以 `@skill/*` scope 的 npm 包形式版本化存储和分发。

---

## 目录

- [快速开始](#快速开始)
- [平台架构](#平台架构)
- [Portal 使用指南](#portal-使用指南)
  - [浏览与搜索](#浏览与搜索)
  - [查看 Skill 详情](#查看-skill-详情)
- [发布 Skill](#发布-skill)
  - [准备工作](#准备工作)
  - [创建 Skill 包](#创建-skill-包)
  - [发布](#发布)
- [消费 Skill](#消费-skill)
  - [方式一：通过 agent-npm CLI（推荐）](#方式一通过-agent-npm-cli推荐)
  - [方式二：npm install](#方式二npm-install)
  - [方式三：通过 Server API 获取 SKILL.md](#方式三通过-server-api-获取-skillmd)
- [agent-npm 命令参考](#agent-npm-命令参考)
- [Server API 参考](#server-api-参考)
- [项目结构](#项目结构)
- [技术选型](#技术选型)
- [开发指南](#开发指南)
- [鉴权说明](#鉴权说明)

---

## 快速开始

```bash
# 1. 启动全部服务（Verdaccio + Server）
docker compose up -d

# 2. 访问 Portal
open http://localhost:3000
```

启动后：
- **Portal**：`http://localhost:3000` — 浏览、搜索 skill 的 Web 界面
- **Registry**：`http://localhost:4873` — npm registry（Verdaccio Web UI 可直接访问）

---

## 平台架构

```
┌──────────────────────────────────────────────────┐
│ docker-compose                                    │
│  ┌──────────────┐   ┌──────────────────────────┐  │
│  │  Verdaccio    │   │  Server (Deno + Hono)    │  │
│  │  :4873        │◄──│  :3000                   │  │
│  │  (npm registry│   │  ┌───────────────────┐  │  │
│  │   + storage)  │   │  │ public/ (Portal)   │  │  │
│  └──────────────┘   │  │ 静态 HTML+CSS+JS    │  │  │
│                     │  └───────────────────┘  │  │
│                     └──────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

| 组件 | 端口 | 职责 |
|------|------|------|
| **Verdaccio** | 4873 | npm registry — 包存储、鉴权、分发 |
| **Server** | 3000 | Deno + Hono — API 透传、SKILL.md 提取渲染、静态文件 serve |
| **Portal** | (内嵌) | 单页 Web 应用 — Skill 目录浏览、搜索、详情查看 |

---

## Skill 包格式

遵循 skill-creator 标准，每个 `@skill/*` 包必须包含：

```
@skill/example/
├── SKILL.md          # 必需 — YAML frontmatter + Markdown 指令
├── package.json      # npm 标准包元数据
└── ...               # 可选 — scripts/、references/、assets/
```

- `SKILL.md` frontmatter 必须包含 `name` 和 `description` 字段
- `package.json` 中可使用 `skill` 字段存放平台特有元数据（分类、标签等）
- **框架无关**：任何人 `npm install` 后读取 `node_modules/@skill/xxx/SKILL.md` 即可使用

示例 `SKILL.md`：

```markdown
---
name: hello-world
description: 一个简单的示例 skill，用于演示 Skill Hub 的使用方式
---

## 功能

当你提到"打个招呼"或"hello"时，回复"Hello from Skill Hub!"
```

---

## Portal 使用指南

Portal 是一个单页 Web 应用，提供 Skill 目录的浏览、搜索和详情查看功能。

### 浏览与搜索

1. 打开 `http://localhost:3000`
2. 左侧边栏以树状结构展示所有已发布的 skill，点击任意 skill 查看详情
3. 顶部搜索框输入关键词，支持模糊匹配 skill 名称和描述
4. 右上角排序下拉框支持按**最新发布**或**名称排序**

### 查看 Skill 详情

- 点击左侧树状列表中的 skill 名称，或
- 点击中间卡片列表中的 skill 卡片

右侧详情面板展示以下内容：
- Skill 名称、版本、描述
- 分类和标签
- **SKILL.md 渲染后的 HTML**（完整指令内容）
- 版本历史列表

---

## 发布 Skill

### 准备工作

1. **登录 Verdaccio 并获取 token**：

```bash
# 在 Verdaccio Web UI 注册/登录获取 token
# 或者通过命令行:
npm adduser --registry http://localhost:4873
```

2. **配置 npm**（可选，便于后续操作）：

```bash
npm config set @skill:registry http://localhost:4873
```

### 创建 Skill 包

参考 `skills/hello-world/` 示例，一个最小可发布包需要两个文件：

**`package.json`**：

```json
{
  "name": "@skill/my-skill",
  "version": "1.0.0",
  "description": "我的 skill 描述",
  "skill": {
    "category": "utility",
    "tags": ["example"]
  },
  "publishConfig": {
    "registry": "http://localhost:4873"
  }
}
```

> `skill` 字段为可选，用于 Portal 展示分类和标签。

**`SKILL.md`**：

```markdown
---
name: my-skill
description: 我的 skill 简短描述
---

## 功能

你的 skill 指令内容...
```

### 发布

```bash
cd path/to/your/skill
npm publish
```

发布成功后，Portal 会自动展示新 skill。

---

## 消费 Skill

### 方式一：通过 agent-npm CLI（推荐）

`agent-npm` 是 Skill Hub 的官方命令行工具，专为管理 `@skill/*` 包设计。所有 skill 统一安装到 `.agents/node_modules/` 下，和项目代码清晰隔离。

```bash
# 安装 agent-npm
npm install -g agent-npm

# 初始化 skill 工作区
agent-npm init

# 安装 skill
agent-npm install @skill/hello-world

# 查看已安装
agent-npm list

# 搜索 registry
agent-npm search hello

# 查看详情
agent-npm info hello-world
```

### 方式二：npm install

像使用普通 npm 包一样安装，然后读取 `SKILL.md`：

```bash
# 配置 scope registry
npm config set @skill:registry http://localhost:4873

# 安装
npm install @skill/my-skill

# 读取 SKILL.md
cat node_modules/@skill/my-skill/SKILL.md
```

### 方式三：通过 Server API 获取 SKILL.md

无需安装，直接通过 API 获取渲染后的 SKILL.md 内容：

```bash
# 获取渲染后的 HTML（推荐，Portal 同款渲染效果）
curl http://localhost:3000/api/skills/my-skill/SKILL.md | jq .

# 响应示例
# {
#   "name": "@skill/my-skill",
#   "version": "1.0.0",
#   "frontmatter": { "name": "my-skill", "description": "..." },
#   "html": "<h2>功能</h2><p>你的 skill 指令内容...</p>"
# }
```

> SKILL.md API 会从 registry 下载 tarball、解压、读取 SKILL.md 并用 marked 渲染为 HTML，同时缓存到本地文件系统以提高后续访问速度。

---

## Server API 参考

### 透传 npm registry 接口

所有 `/npm/*` 请求代理到 Verdaccio：

| 端点 | 说明 |
|------|------|
| `GET /npm/@skill/:name` | 包元数据（版本、dist-tags、author 等） |
| `GET /npm/-/v1/search?text=@skill` | npm 原生搜索 |

### 扩展接口

| 端点 | 方法 | 参数 | 说明 |
|------|------|------|------|
| `/api/skills` | GET | `page`、`limit`、`sort` | 聚合所有 @skill 包摘要列表 |
| `/api/skills/:name` | GET | — | 单个 skill 详情（版本列表、元数据） |
| `/api/skills/:name/SKILL.md` | GET | — | 提取并渲染 SKILL.md（返回 HTML） |
| `/api/skills/:name/files` | GET | `path`（可选） | 查看包内文件树或读取单个文件内容 |
| `/api/search` | GET | `q` | 全文搜索 skill 名称和描述 |

示例：

```bash
# 分页获取 skill 列表（每页 12 个，按名称排序）
curl "http://localhost:3000/api/skills?page=1&limit=12&sort=name" | jq .

# 搜索
curl "http://localhost:3000/api/search?q=hello" | jq .

# 查看包内文件树
curl "http://localhost:3000/api/skills/my-skill/files" | jq .

# 读取包内特定文件
curl "http://localhost:3000/api/skills/my-skill/files?path=references/demo.md"
```

---

## agent-npm 命令参考

| 命令 | 说明 | 示例 |
|------|------|------|
| `agent-npm init` | 初始化 `.agents/` 目录结构和配置 | `agent-npm init` |
| `agent-npm install [pkg...]` | 安装 skill，不带参数则装 package.json 中全部 | `agent-npm install @skill/hello-world` |
| `agent-npm install <pkg>@<ver>` | 安装指定版本 | `agent-npm install @skill/hello-world@1.2.0` |
| `agent-npm uninstall <pkg...>` | 移除 skill | `agent-npm uninstall @skill/hello-world` |
| `agent-npm list` | 列出已安装 skill（版本 + 描述） | `agent-npm list` |
| `agent-npm search <query>` | 搜索 registry | `agent-npm search hello` |
| `agent-npm info <pkg>` | 查看 skill 详情（版本列表、SKILL.md、文件树） | `agent-npm info hello-world` |
| `agent-npm update [pkg]` | 更新 skill 到最新，不带参数更新全部 | `agent-npm update` |
| `agent-npm outdated` | 检查哪些 skill 有新版本 | `agent-npm outdated` |
| `agent-npm which <pkg>` | 输出 skill 的本地安装路径 | `agent-npm which hello-world` |
| `agent-npm config` | 查看/设置 registry 地址等配置 | `agent-npm config set registry http://...` |

### .agents 目录结构

```
项目根目录/
├── .agents/                    # agent-npm 管理的目录
│   ├── package.json            # workspace 清单，记录 @skill/* 依赖
│   ├── package-lock.json       # 版本锁
│   ├── .npmrc                  # registry 配置
│   └── node_modules/
│       └── @skill/
│           ├── hello-world/
│           │   ├── SKILL.md
│           │   ├── package.json
│           │   └── ...
│           └── code-review/
│               ├── SKILL.md
│               └── ...
└── ...
```

### 全局配置

配置文件位于 `~/.agent-npmrc`：

```bash
# 设置默认 registry
agent-npm config set registry http://my-hub:4873

# 查看当前配置
agent-npm config

# 获取单个配置
agent-npm config get registry
```

---

## 项目结构

```
remote-skills-hub/
├── docker-compose.yml        # Verdaccio + Server 编排
├── verdaccio/
│   └── config.yaml           # @skill scope ACL、storage、auth 配置
├── server/                   # Deno + Hono 服务
│   ├── main.ts               # 入口 — 路由、API 处理
│   ├── tarball.ts            # tarball 下载、解压、SKILL.md 提取
│   ├── cache.ts              # 本地文件缓存逻辑
│   ├── deps.ts               # 集中依赖管理
│   ├── deno.json             # Deno 配置
│   ├── deno.lock             # 依赖锁
│   ├── Dockerfile
│   ├── cache/                # 运行时缓存目录（tarball + 解压内容）
│   └── public/               # Portal 静态文件
│       ├── index.html
│       ├── css/
│       │   └── style.css
│       └── js/
│           ├── api.js        # API 调用封装
│           ├── tree.js       # 左侧树状目录
│           ├── list.js       # 中间卡片列表
│           ├── detail.js     # 右侧详情面板
│           └── app.js        # 应用入口 — 事件绑定与编排
├── skills/                   # 示例 skill 包（可内置于 hub）
│   └── hello-world/
│       ├── package.json
│       └── SKILL.md
├── packages/                  # 辅助工具包
│   └── agent-npm/             # agent-npm CLI 工具
│       ├── bin/agent-npm.js
│       ├── src/
│       │   ├── cli.js
│       │   ├── npm.js
│       │   ├── config.js
│       │   ├── output.js
│       │   └── commands/
│       └── package.json
├── CLAUDE.md                 # 项目 AI 上下文文档
└── README.md                 # 本文件
```

---

## 技术选型

| 层 | 技术 | 理由 |
|----|------|------|
| Registry | Verdaccio | 成熟、轻量、兼容 npm 协议 |
| Server | Deno + Hono | 轻量、原生 TS、Hono 零抽象路由 |
| Portal | Vanilla HTML+CSS+JS | 无框架依赖、简单可维护 |
| CLI | Node.js + child_process | 驱动 npm，跨平台、零外部依赖 |
| Markdown 渲染 | marked | 轻量 Markdown → HTML |
| 缓存 | 本地文件系统 | tarball 缓存，避免重复解压 |

---

## 开发指南

```bash
# 启动全部服务
docker compose up -d

# 单独开发 server（支持热重载）
cd server && deno task dev

# 查看日志
docker compose logs -f server
docker compose logs -f verdaccio
```

### 环境变量

| 变量 | Server | Docker | 说明 |
|------|:------:|:------:|------|
| `REGISTRY_URL` | ✓ | ✓ | Verdaccio 地址，默认 `http://localhost:4873` |
| `REGISTRY_TOKEN` | ✓ | ✓ | Verdaccio 只读 token（Docker 中通过 `REGISTRY_READ_TOKEN` 传入） |
| `CACHE_DIR` | — | ✓ | tarball 缓存目录，默认 `/app/cache` |
| `PORT` | ✓ | ✓ | Server 监听端口，Docker 中固定为 `3000` |

---

## 鉴权说明

| Token 类型 | 用途 | 权限范围 |
|-----------|------|------|
| **Read Token** | Server 内部访问 Verdaccio API | 读取所有包（`@skill/*` 及其他公开包） |
| **Write Token** | 开发者本地发布 skill | 对 `@skill/*` scope 有 publish 权限 |

- Server 对 Verdaccio 的所有请求使用 read token，对 Portal 用户不可见
- Write token 由开发者在 Verdaccio Web UI 自行注册获取
- **Scope 控制**：`@skill/*` 包要求认证后访问（见 `verdaccio/config.yaml`），其他公开包对所有人可读

### 配置 Read Token（Docker 环境）

```bash
# 创建 .env 文件
echo "REGISTRY_READ_TOKEN=<your-verdaccio-read-token>" > .env

# 启动
docker compose up -d
```
