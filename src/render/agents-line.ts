import type { RenderContext, AgentEntry } from '../types.js';
import { cyan, dim, getModelTierColor, getDurationColor, RESET } from './colors.js';

/**
 * OMC-style multiline agent tree:
 * agents:3
 * ├─ A architect     2m   analyzing architecture patterns...
 * ├─ e explore      45s   searching for test files
 * └─ x exec          1m   implementing validation logic
 */
export function renderAgentsLine(ctx: RenderContext): string | null {
  const { agents } = ctx.transcript;
  const running = agents.filter((a) => a.status === 'running');

  if (running.length === 0) return null;

  const lines: string[] = [];

  // Header
  lines.push(`agents:${cyan(String(running.length))}`);

  // Tree
  running.forEach((agent, i) => {
    const isLast = i === running.length - 1;
    const prefix = isLast ? '\u2514\u2500' : '\u251C\u2500';
    const code = getAgentCode(agent.type, agent.model);
    const modelColor = getModelTierColor(agent.model);
    const name = agent.type.padEnd(14);
    const durationMs = getElapsedMs(agent);
    const duration = formatDurationPadded(durationMs);
    const durColor = getDurationColor(durationMs);
    const desc = truncateToWidth(agent.description || '...', 45);

    lines.push(`${dim(prefix)} ${modelColor}${code}${RESET} ${dim(name)}${durColor}${duration}${RESET}  ${desc}`);
  });

  return lines.join('\n');
}

/**
 * Agent type → 1-2 char code.
 * Uppercase = opus, lowercase = sonnet/haiku/unknown
 */
function getAgentCode(type: string, model?: string): string {
  const codeMap: Record<string, string> = {
    'architect': 'a',
    'explore': 'e',
    'Explore': 'e',
    'general-purpose': 'g',
    'Bash': 'b',
    'bash': 'b',
    'plan': 'p',
    'Plan': 'p',
    'tool-builder': 'tb',
    'test-builder': 'ts',
    'test-validator': 'tv',
    'spec-writer': 'sw',
    'spec-validator': 'sv',
    'tool-validator': 'vl',
    'notion-reader': 'nr',
    'statusline-setup': 'sl',
    'claude-code-guide': 'cg',
  };

  let code = codeMap[type] ?? type.charAt(0);

  // Uppercase for opus-tier models
  if (model && model.toLowerCase().includes('opus')) {
    code = code.toUpperCase();
  }

  return code;
}

function getElapsedMs(agent: AgentEntry): number {
  const now = Date.now();
  const start = agent.startTime.getTime();
  const end = agent.endTime?.getTime() ?? now;
  return end - start;
}

/**
 * Right-aligned duration in 5-char field: "   2m", "  45s", " 1m2s"
 */
function formatDurationPadded(ms: number): string {
  if (ms < 1000) return '  <1s';

  const totalSecs = Math.round(ms / 1000);
  if (totalSecs < 60) {
    return `${String(totalSecs) + 's'}`.padStart(5);
  }

  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;

  if (secs === 0) {
    return `${String(mins) + 'm'}`.padStart(5);
  }

  // e.g. "1m2s" or "12m5s"
  const str = `${mins}m${secs}s`;
  return str.padStart(5);
}

/**
 * Truncate string to max visual width.
 * Handles CJK characters as double-width.
 */
function truncateToWidth(str: string, maxWidth: number): string {
  let width = 0;
  let result = '';

  for (const char of str) {
    const cw = isCJK(char) ? 2 : 1;
    if (width + cw > maxWidth - 3 && width + cw + 3 <= str.length) {
      // Need truncation
      if (width + 3 <= maxWidth) {
        return result + '...';
      }
      return result;
    }
    width += cw;
    result += char;
    if (width >= maxWidth) break;
  }

  return result;
}

function isCJK(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (
    (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK Unified
    (code >= 0x3400 && code <= 0x4DBF) ||   // CJK Extension A
    (code >= 0xAC00 && code <= 0xD7AF) ||   // Hangul
    (code >= 0x3000 && code <= 0x303F) ||   // CJK Symbols
    (code >= 0xFF00 && code <= 0xFFEF)      // Fullwidth
  );
}
