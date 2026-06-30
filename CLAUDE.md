# Remote Skills Hub

## 概述

中心化 Skill 分发平台。底层基于 [Verdaccio](https://github.com/verdaccio/verdaccio) 私有 npm registry，上层自建 Deno + Hono server + 静态门户。所有 skill 以 `@skill/*` scope 的 npm 包形式版本化存储和分发。

## 架构

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

- **Verdaccio**（:4873）：npm registry，负责包的存储、鉴权、分发
- **Server**（:3000）：Deno + Hono，负责 API 透传 + SKILL.md 提取渲染 + 静态文件 serve
- **Portal**：`server/public/` 下的 vanilla HTML+CSS+JS SPA，树状展示 skill 目录

## Skill 包格式

遵循 skill-creator 标准，每个 `@skill/*` 包必须包含：

```
@skill/example/
├── SKILL.md          # 必需 - YAML frontmatter + Markdown 指令
├── package.json      # npm 标准包元数据
└── ...               # 可选 - scripts/, references/, assets/
```

- `SKILL.md` frontmatter 必须包含 `name` 和 `description` 字段
- `package.json` 中使用 `skill` 字段存放平台特有元数据（分类、标签等）
- Agent 框架无关：任何人 `npm install` 后读取 `node_modules/@skill/xxx/SKILL.md` 即可使用

## Server API 设计

### 透传 npm registry 标准接口

所有 `/npm/*` 请求代理到 Verdaccio，Sample：
- `GET /npm/@skill/package-name` → 包元数据（版本、dist-tags、author 等）
- `GET /npm/-/v1/search?text=@skill` → 搜索

### 扩展接口

| 端点 | 说明 |
|------|------|
| `GET /api/skills` | 聚合所有 @skill 包摘要（名称、版本、描述、分类），支持分页、筛选 |
| `GET /api/skills/:name` | 单个 skill 详情（README、版本列表、元数据） |
| `GET /api/skills/:name/SKILL.md` | 下载 tarball → 解压 → 读 SKILL.md → 缓存 → 返回渲染后 HTML |
| `GET /api/search?q=` | 全文搜索 skill 名称和描述 |

- SKILL.md 提取：从 registry 获取 tarball URL → 本地下载 → 解压 → 读 SKILL.md → marked 渲染 → 缓存到本地 filesystem
- Portal 树状结构：数据从 `/api/skills` 获取，前端用递归组件构建

## 鉴权

| Token 类型 | 用途 | 权限 |
|-----------|------|------|
| Read Token | Server 内部访问 Verdaccio API | 读取所有包（`@skill/*` 及其他公开包） |
| Write Token | 开发者本地发布 skill | 对 `@skill/*` scope 有 publish 权限 |

- Server 对 Verdaccio 的请求使用 read token，用户不可见
- Portal 有自己的登录体系（独立于 npm 登录），发布页展示 write token

## 发布流程

1. 开发者在 Portal 注册/登录
2. Portal 提供 npm write token（仅 `@skill/*` scope 写权限）
3. 开发者本地配置：`npm config set //registry:4873/:_authToken=<write-token>`
4. `npm publish` 推送
5. Portal 支持生成脚手架：填 skill name + description → 生成 `package.json` + `SKILL.md` 模板

## 项目结构

```
remote-skills-hub/
├── docker-compose.yml        # Verdaccio + Server
├── verdaccio/
│   └── config.yaml           # @skill scope ACL, storage, auth 配置
├── server/                   # Deno + Hono
│   ├── main.ts               # 入口
│   ├── deno.json             # Deno 配置
│   ├── deno.lock             # 依赖锁
│   ├── Dockerfile
│   └── public/               # Portal 静态文件
│       ├── index.html
│       ├── css/
│       └── js/
├── skills/                   # 示例 skill 包（内置于 hub）
├── CLAUDE.md
└── README.md
```

## 技术选型

| 层 | 技术 | 理由 |
|----|------|------|
| Registry | Verdaccio | 成熟、轻量、兼容 npm 协议 |
| Server | Deno + Hono | 轻量、原生 TS、Hono 零抽象路由 |
| Portal | Vanilla HTML+CSS+JS | 无框架依赖、简单可维护 |
| 渲染 | marked | 轻量 Markdown → HTML |
| 缓存 | 本地文件系统 | tarball 缓存，避免重复解压 |

## 关键设计决策

1. **npm registry 标准协议优先**：Server 通过 npm registry 协议访问 Verdaccio，不直接读存储层，保证 Verdaccio 升级兼容
2. **透传优于重写**：npm 已有能力（包元数据、搜索、下载）全透传，只扩展 npm 没有的能力（SKILL.md 渲染）
3. **Scope 约定**：`@skill/*` 自动被视为 skill，无需额外注册或标记
4. **框架无关**：Skill 消费端不绑定任何 agent 框架，标准 npm 包即用即可
5. **双 token**：读写分离，Server 用只读 token 门户用只写 token

## 开发

```bash
# 启动全部服务
docker compose up -d

# 单独启动/开发 server
cd server && deno task dev
```

## 关联仓库

- Deno Server + Portal：本仓库 `server/`
- Verdaccio 配置：本仓库 `verdaccio/`
- 技能示例：本仓库 `skills/`
