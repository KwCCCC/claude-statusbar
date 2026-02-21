---
description: Configure claude-statusbar as your statusline
allowed-tools: Bash, Read, Edit, AskUserQuestion
---

## Step 1: Detect Platform & Runtime

**IMPORTANT**: Determine the platform from your environment context (`Platform:` value).

| Platform | Command Format |
|----------|---------------|
| `darwin` | bash (macOS) |
| `linux` | bash (all Linux distros) |
| `win32` | PowerShell |

---

**macOS/Linux** (Platform: `darwin` or `linux`):

1. Get plugin path:
   ```bash
   ls -td ~/.claude/plugins/cache/claude-statusbar/claude-statusbar/*/ 2>/dev/null | head -1
   ```
   If empty, tell user to install the plugin first:
   ```
   /plugin marketplace add KwCCCC/claude-statusbar
   /plugin install claude-statusbar@claude-statusbar
   ```

2. Get runtime absolute path (prefer bun for performance, fallback to node):
   ```bash
   command -v bun 2>/dev/null || command -v node 2>/dev/null
   ```
   If empty, stop and tell user to install Node.js or Bun.

3. Determine source file based on runtime:
   If runtime is "bun", use `src/index.ts` (native TypeScript support). Otherwise use `dist/index.js`.

4. Generate command:
   ```
   bash -c '"{RUNTIME_PATH}" "$(ls -td ~/.claude/plugins/cache/claude-statusbar/claude-statusbar/*/ 2>/dev/null | head -1){SOURCE}"'
   ```

**Windows** (Platform: `win32`):

1. Get plugin path:
   ```powershell
   (Get-ChildItem "$env:USERPROFILE\.claude\plugins\cache\claude-statusbar\claude-statusbar" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
   ```

2. Get runtime:
   ```powershell
   if (Get-Command bun -ErrorAction SilentlyContinue) { (Get-Command bun).Source } elseif (Get-Command node -ErrorAction SilentlyContinue) { (Get-Command node).Source } else { Write-Error "Neither bun nor node found" }
   ```

3. If bun, use `src\index.ts`. Otherwise use `dist\index.js`.

4. Generate command:
   ```
   powershell -Command "& {$p=(Get-ChildItem $env:USERPROFILE\.claude\plugins\cache\claude-statusbar\claude-statusbar | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName; & '{RUNTIME_PATH}' (Join-Path $p '{SOURCE}')}"
   ```

## Step 2: Test Command

Run the generated command. It should produce output within a few seconds.
If it errors, do not proceed to Step 3.

## Step 3: Apply Configuration

Read `~/.claude/settings.json` (or `$env:USERPROFILE\.claude\settings.json` on Windows).
Merge in the statusLine config, preserving all existing settings:

```json
{
  "statusLine": {
    "type": "command",
    "command": "{GENERATED_COMMAND}"
  }
}
```

## Step 4: Verify

Say: "Setup complete! The statusbar should appear below your input field."

If it doesn't work, debug:
1. Verify settings.json was written correctly
2. Test the command manually: `{GENERATED_COMMAND} 2>&1`
3. Check plugin path exists
4. Check runtime path is valid
