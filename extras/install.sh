#!/bin/bash
set -e

# claude-statusbar — optional post-install config setup
# Only needed if you want to customize display options.
# The plugin works out of the box without this script.
#
# Usage: curl -fsSL https://raw.githubusercontent.com/KwCCCC/claude-statusbar/main/extras/install.sh | bash

CONFIG_DIR=~/.claude/plugins/claude-statusbar
CONFIG="$CONFIG_DIR/config.json"

echo "[claude-statusbar] Setting up config..."
mkdir -p "$CONFIG_DIR"

if [ -f "$CONFIG" ]; then
  echo "[claude-statusbar] config.json already exists, skipping."
  echo "  Edit manually: $CONFIG"
else
  echo "[claude-statusbar] Creating default config.json..."
  cat > "$CONFIG" << 'CONF'
{
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

echo "[claude-statusbar] Done!"
echo ""
echo "  Installation:"
echo "    1. /install-plugin claude-statusbar"
echo "    2. /claude-statusbar:setup"
echo ""
echo "  Features:"
echo "    - OMC-style compact ctx/usage: ctx:25% | 5h:41%(3h14m) wk:11%(5d17h)"
echo "    - OMC-style agent tree with model tier colors"
echo "    - skill:name label, session name, account email"
echo "    - git ↑↓ ahead/behind enabled by default"
