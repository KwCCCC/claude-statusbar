#!/bin/bash
set -e

# GenLab Custom HUD Installer
# One-command setup: OMC-style compact ctx/usage, agent multiline tree, skill label, session name
# Usage: curl -fsSL https://raw.githubusercontent.com/KwCCCC/claude-statusbar/main/extras/install.sh | bash

REPO="KwCCCC/claude-statusbar"
BRANCH="main"
BASE="https://raw.githubusercontent.com/${REPO}/${BRANCH}"

echo "[claude-statusbar] Starting installation..."

# 1. Find plugin directory
PLUGIN_DIR=$(ls -td ~/.claude/plugins/cache/claude-statusbar/claude-statusbar/*/ 2>/dev/null | head -1)
if [ -z "$PLUGIN_DIR" ]; then
  echo "[claude-statusbar] Error: plugin not found."
  echo "  Install it first: /install-plugin claude-statusbar"
  exit 1
fi
echo "[claude-statusbar] Plugin found: ${PLUGIN_DIR}"

# 2. Patch source files
echo "[claude-statusbar] Patching source files..."
curl -fsSL "${BASE}/src/index.ts" -o "${PLUGIN_DIR}src/index.ts"
curl -fsSL "${BASE}/src/config.ts" -o "${PLUGIN_DIR}src/config.ts"
curl -fsSL "${BASE}/src/render/index.ts" -o "${PLUGIN_DIR}src/render/index.ts"
curl -fsSL "${BASE}/src/render/colors.ts" -o "${PLUGIN_DIR}src/render/colors.ts"
curl -fsSL "${BASE}/src/render/agents-line.ts" -o "${PLUGIN_DIR}src/render/agents-line.ts"
curl -fsSL "${BASE}/src/render/session-line.ts" -o "${PLUGIN_DIR}src/render/session-line.ts"
curl -fsSL "${BASE}/src/render/lines/index.ts" -o "${PLUGIN_DIR}src/render/lines/index.ts"
curl -fsSL "${BASE}/src/render/lines/status.ts" -o "${PLUGIN_DIR}src/render/lines/status.ts"
curl -fsSL "${BASE}/src/render/lines/environment.ts" -o "${PLUGIN_DIR}src/render/lines/environment.ts"
curl -fsSL "${BASE}/src/render/lines/usage.ts" -o "${PLUGIN_DIR}src/render/lines/usage.ts"
curl -fsSL "${BASE}/src/render/lines/project.ts" -o "${PLUGIN_DIR}src/render/lines/project.ts"
curl -fsSL "${BASE}/src/types.ts" -o "${PLUGIN_DIR}src/types.ts"
curl -fsSL "${BASE}/src/transcript.ts" -o "${PLUGIN_DIR}src/transcript.ts"
curl -fsSL "${BASE}/src/git.ts" -o "${PLUGIN_DIR}src/git.ts"
curl -fsSL "${BASE}/src/profile-api.ts" -o "${PLUGIN_DIR}src/profile-api.ts"

# 3. Install skill-label script
echo "[claude-statusbar] Installing skill-label.sh..."
mkdir -p ~/.claude/plugins/claude-statusbar
curl -fsSL "${BASE}/extras/skill-label.sh" -o ~/.claude/plugins/claude-statusbar/skill-label.sh
chmod +x ~/.claude/plugins/claude-statusbar/skill-label.sh

# 4. Write config.json (merge if exists)
CONFIG=~/.claude/plugins/claude-statusbar/config.json
if [ -f "$CONFIG" ]; then
  echo "[claude-statusbar] Merging into existing config.json..."
  # Detect runtime for JSON merge
  if command -v bun >/dev/null 2>&1; then
    RUNTIME=bun
  elif command -v node >/dev/null 2>&1; then
    RUNTIME=node
  else
    RUNTIME=""
  fi

  if [ -n "$RUNTIME" ]; then
    $RUNTIME -e "
      const fs = require('fs');
      const cfg = JSON.parse(fs.readFileSync('$CONFIG','utf8'));
      cfg.extraCmd = cfg.extraCmd || '$HOME/.claude/plugins/claude-statusbar/skill-label.sh';
      cfg.display = cfg.display || {};
      cfg.display.showTools = cfg.display.showTools ?? false;
      cfg.display.showAgents = cfg.display.showAgents ?? true;
      cfg.display.showTodos = cfg.display.showTodos ?? false;
      cfg.display.showDuration = cfg.display.showDuration ?? true;
      cfg.display.showConfigCounts = cfg.display.showConfigCounts ?? true;
      cfg.display.showUsage = cfg.display.showUsage ?? true;
      cfg.display.usageBarEnabled = cfg.display.usageBarEnabled ?? false;
      fs.writeFileSync('$CONFIG', JSON.stringify(cfg, null, 2) + '\n');
    "
  else
    echo "[claude-statusbar] Warning: no JS runtime found, overwriting config.json"
    cat > "$CONFIG" << CONF
{
  "extraCmd": "$HOME/.claude/plugins/claude-statusbar/skill-label.sh",
  "display": {
    "showTools": false,
    "showAgents": true,
    "showTodos": false,
    "showDuration": true,
    "showConfigCounts": true,
    "showUsage": true,
    "usageBarEnabled": false
  }
}
CONF
  fi
else
  echo "[claude-statusbar] Creating config.json..."
  cat > "$CONFIG" << CONF
{
  "extraCmd": "$HOME/.claude/plugins/claude-statusbar/skill-label.sh",
  "display": {
    "showTools": false,
    "showAgents": true,
    "showTodos": false,
    "showDuration": true,
    "showConfigCounts": true,
    "showUsage": true,
    "usageBarEnabled": false
  }
}
CONF
fi

echo "[claude-statusbar] Done! Run /claude-statusbar:setup in Claude Code to activate the statusLine."
echo ""
echo "  Custom features:"
echo "    - OMC-style compact ctx/usage: ctx:25% | 5h:41%(3h14m) wk:11%(5d17h)"
echo "    - OMC-style agent tree with model tier colors and padded durations"
echo "    - Unified status line (ctx + usage + env in one line)"
echo "    - skill:name label (cyan) — shows active skill, hides when done"
echo "    - Session name — shows [name] in bright blue when /rename is used"
echo "    - git ↑↓ ahead/behind enabled by default"
