#!/usr/bin/env bash
# Bump version in both package.json and .claude-plugin/plugin.json
# Usage: ./scripts/bump-version.sh [major|minor|patch]
#   default: patch

set -euo pipefail

TYPE="${1:-patch}"
PACKAGE_JSON="package.json"
PLUGIN_JSON=".claude-plugin/plugin.json"

# Get current version from package.json
CURRENT=$(grep -o '"version": "[^"]*"' "$PACKAGE_JSON" | head -1 | cut -d'"' -f4)

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$TYPE" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *) echo "Usage: $0 [major|minor|patch]"; exit 1 ;;
esac

NEW="${MAJOR}.${MINOR}.${PATCH}"

# Update both files (cross-platform sed -i)
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/\"version\": \"${CURRENT}\"/\"version\": \"${NEW}\"/" "$PACKAGE_JSON"
  sed -i '' "s/\"version\": \"${CURRENT}\"/\"version\": \"${NEW}\"/" "$PLUGIN_JSON"
else
  sed -i "s/\"version\": \"${CURRENT}\"/\"version\": \"${NEW}\"/" "$PACKAGE_JSON"
  sed -i "s/\"version\": \"${CURRENT}\"/\"version\": \"${NEW}\"/" "$PLUGIN_JSON"
fi

echo "${CURRENT} → ${NEW}"
