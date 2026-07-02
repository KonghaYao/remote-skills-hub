# agent-npm

AI Agent Skill package manager. Installs `@skill/*` packages from an npm registry into a local `.agents/` workspace and automatically links them to agent framework discovery directories.

## Install

```bash
npm install -g agent-npm
```

## Quick Start

```bash
# Navigate to your project
cd my-project

# Initialize the skill workspace
agent-npm init

# Install a skill
agent-npm install @skill/hello-world

# List installed skills
agent-npm list
```

Directory structure after install:

```
my-project/
├── .agents/
│   ├── package.json          # dependency manifest
│   ├── package-lock.json     # version lock
│   ├── .npmrc                # registry config
│   ├── skills/               # agent discovery dir (symlinks)
│   │   └── hello-world → ../node_modules/@skill/hello-world
│   └── node_modules/
│       └── @skill/
│           └── hello-world/
│               ├── SKILL.md  # AI agent instructions
│               └── package.json
└── ...
```

## Commands

### init — Initialize workspace

```bash
agent-npm init
```

Creates `.agents/` directory with `package.json` and `.npmrc`.

### install — Install skills

```bash
# Latest version
agent-npm install @skill/hello-world

# Specific version
agent-npm install @skill/hello-world@1.2.0

# Multiple packages
agent-npm install @skill/hello-world @skill/code-review

# No args = install all from .agents/package.json
agent-npm install
```

Auto-links to `.agents/skills/` on success.

### uninstall — Remove skills

```bash
agent-npm uninstall @skill/hello-world
```

### list — List installed skills

```bash
agent-npm list

# Output:
# .agents/node_modules/@skill/
# └── hello-world @1.0.0
```

### search — Search registry

```bash
agent-npm search hello
```

### info — Show skill details

```bash
agent-npm info hello-world

# Outputs metadata, version history, SKILL.md info, file tree
```

### which — Show install path

```bash
agent-npm which hello-world

# Output:
# /path/to/project/.agents/node_modules/@skill/hello-world
```

### update — Update to latest

```bash
# Update all
agent-npm update

# Update specific
agent-npm update hello-world
```

### outdated — Check for newer versions

```bash
agent-npm outdated
```

### link / unlink — Manage symlinks

```bash
# Link all installed → .agents/skills/ (default)
agent-npm link

# Link to .claude/skills/ (Claude Code format)
agent-npm link --agent claude

# Link to global ~/.agents/skills/
agent-npm link --global

# Check link status
agent-npm link --status

# Remove all links
agent-npm unlink

# Remove specific link
agent-npm unlink hello-world
```

### config — Manage configuration

```bash
# Show current config
agent-npm config

# Set registry
agent-npm config set registry http://my-hub:4873

# Get a value
agent-npm config get registry

# Delete a value
agent-npm config delete registry
```

Config file: `~/.agent-npmrc`.

## How It Works

1. **Install** → npm install to `.agents/node_modules/@skill/`
2. **Auto-link** → symlink `.agents/skills/<name>` → `node_modules/@skill/<name>`
3. **Agent discovery** → frameworks read `.agents/skills/<name>/SKILL.md`

## --agent Flags

| Command | Effect |
|------|------|
| `agent-npm link` | → `.agents/skills/` (default) |
| `agent-npm link --agent claude` | → `.claude/skills/` |
| `agent-npm link --global` | → `~/.agents/skills/` |

`unlink` and `--status` support the same flags.
