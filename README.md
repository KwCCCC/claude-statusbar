# claude-statusbar

Compact statusline plugin for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Inspired by [OMC HUD](https://github.com/nicobailey/claude-code-hud).

```
[Opus 4.6 | Max] ⟫ user@email.com ⟫ @my-session
genlab-tools git:(main) ↑2 ↓1 | ctx:25% | 5h:41%(3h14m) wk:11%(5d17h)
1 CLAUDE.md | v2.1.50 | +15 -3 | skill:write-spec
agents:3
├─ A architect       2m  analyzing architecture patterns...
├─ e explore        45s  searching for test files
└─ x exec            1m  implementing validation logic
```

## Features

**Line 1 — Identity**
- Model name + billing plan (Max, Pro, or `API` for API key users)
- Account email (fetched from Anthropic OAuth profile, cached 1 hour)
- Session name (set via `/rename`)

**Line 2 — Context & Usage**
- Project path + git branch with `↑↓` ahead/behind counts
- `ctx:XX%` — context window usage with color thresholds (green < 70%, yellow 70-84%, red >= 85%)
- `5h:XX%(reset) wk:XX%(reset)` — 5-hour and 7-day rate limit usage with reset countdown
- `COMPRESS?` warning at 80%+, `CRITICAL` at 85%+

**Line 3 — Environment**
- CLAUDE.md / rules / MCPs / hooks counts
- CLI version
- `+N -N` line diff (green/red)
- Active skill label (auto-detected from transcript)

**Agent Tree**
- OMC-style multiline tree with box-drawing characters (`├─` / `└─`)
- Model tier colors: opus = magenta, sonnet = yellow, haiku = green
- 1-2 char agent code with uppercase = opus tier
- Right-aligned duration with color thresholds (green < 2m, yellow 2-5m, red >= 5m)
- CJK-aware description truncation

## Installation

### 1. Install the plugin

In Claude Code:

```
/install-plugin @kwcccc/claude-statusbar
```

### 2. Activate the statusline

```
/claude-statusbar:setup
```

That's it. No additional scripts or config needed.

## Configuration

Optional. Create `~/.claude/plugins/claude-statusbar/config.json` to customize:

```json
{
  "pathLevels": 1,
  "gitStatus": {
    "enabled": true,
    "showDirty": true,
    "showAheadBehind": true,
    "showFileStats": false
  },
  "display": {
    "showModel": true,
    "showConfigCounts": true,
    "showUsage": true,
    "usageBarEnabled": false,
    "showTools": false,
    "showAgents": true,
    "showTodos": false,
    "showDuration": true,
    "autocompactBuffer": "enabled"
  }
}
```

All fields are optional. Unset fields use defaults.

### Display options

| Option | Default | Description |
|--------|---------|-------------|
| `showModel` | `true` | Model name + plan bracket |
| `showConfigCounts` | `true` | CLAUDE.md, rules, MCPs, hooks counts |
| `showUsage` | `true` | 5h/weekly rate limit usage |
| `usageBarEnabled` | `false` | Show usage as progress bar |
| `showTools` | `false` | Tool call summary line |
| `showAgents` | `true` | Agent tree |
| `showTodos` | `false` | Todo progress line |
| `showDuration` | `true` | Session duration |
| `autocompactBuffer` | `enabled` | Show buffered context % |

### Git options

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `true` | Show git info |
| `showDirty` | `true` | `*` indicator for uncommitted changes |
| `showAheadBehind` | `true` | `↑N ↓N` ahead/behind remote |
| `showFileStats` | `false` | File-level change counts |

### Other options

| Option | Default | Description |
|--------|---------|-------------|
| `pathLevels` | `1` | Directory depth to show (1-3) |
| `lineLayout` | `expanded` | `expanded` or `compact` |
| `showSeparators` | `false` | Separator line between sections |
| `extraCmd` | auto | External command for extra label (auto-resolves bundled `skill-label.sh`) |

## Color Thresholds

### Context window (`ctx:`)
| Range | Color |
|-------|-------|
| 0-69% | Green |
| 70-84% | Yellow |
| 85-100% | Red |

### Rate limit usage (`5h:` / `wk:`)
Same thresholds as context window.

### Agent duration
| Range | Color |
|-------|-------|
| < 2 min | Green |
| 2-5 min | Yellow |
| >= 5 min | Red |

### Model tier (agent tree)
| Model | Color | Code case |
|-------|-------|-----------|
| Opus | Magenta | UPPERCASE |
| Sonnet | Yellow | lowercase |
| Haiku | Green | lowercase |

## Requirements

- Claude Code with statusline plugin support
- Node.js >= 18.0.0

## License

MIT
