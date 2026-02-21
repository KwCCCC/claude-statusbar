#!/bin/bash
# Show skill label only while active
# String content = user-typed or skill trigger
# Array content = expanded prompt / tool result (ignored)

TRANSCRIPT=$(ls -t ~/.claude/projects/*/*.jsonl 2>/dev/null | grep -v subagents | head -1)
[ -z "$TRANSCRIPT" ] && exit 0

TAG="command-mess"
TAG="${TAG}age"
OPEN="<${TAG}>"
CLOSE="</${TAG}>"

# Only string-content user messages (real user input + skill triggers)
# Filters out: expanded prompts (array), tool results
LAST=$(grep '"type":"user"' "$TRANSCRIPT" 2>/dev/null \
  | grep -v 'tool_result' \
  | grep '"content":"' \
  | tail -1)

[ -z "$LAST" ] && exit 0

# Active only if last string-content user message IS a skill trigger
echo "$LAST" | grep -q "${OPEN}" || exit 0

SKILL=$(echo "$LAST" | grep -o "${OPEN}[^<]*${CLOSE}" | tail -1 | sed "s|${OPEN}||;s|${CLOSE}||")
[ -z "$SKILL" ] && exit 0

printf '{"label":"skill:%s"}' "$SKILL"
