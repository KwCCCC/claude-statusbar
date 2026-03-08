import { execFileSync } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import type { RenderContext } from '../types.js';
import { renderSessionLine } from './session-line.js';
import { renderToolsLine } from './tools-line.js';
import { renderAgentsLine } from './agents-line.js';
import { renderTodosLine } from './todos-line.js';
import { renderProjectLine, renderEnvironmentLine } from './lines/index.js';
import { renderStatusLine } from './lines/status.js';
import { dim, RESET } from './colors.js';

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function visualLength(str: string): number {
  return stripAnsi(str).length;
}

function makeSeparator(length: number): string {
  return dim('─'.repeat(Math.max(length, 20)));
}

function getTerminalWidth(): number {
  // Try /dev/tty for actual terminal dimensions (works even when stdout/stderr are piped)
  try {
    const fd = openSync('/dev/tty', 'r');
    try {
      const output = execFileSync('/bin/stty', ['size'], {
        stdio: [fd, 'pipe', 'pipe'],
        encoding: 'utf8',
        timeout: 500,
      }).trim();
      const cols = parseInt(output.split(' ')[1], 10);
      if (cols > 0) return cols;
    } finally {
      closeSync(fd);
    }
  } catch {
    // /dev/tty unavailable
  }
  if (process.stderr.columns) return process.stderr.columns;
  if (process.stdout.columns) return process.stdout.columns;
  const envCols = parseInt(process.env.COLUMNS || '', 10);
  if (envCols > 0) return envCols;
  return 120;
}

/** Split a long line at ' | ' separators to fit within maxWidth. */
function wrapLine(line: string, maxWidth: number): string[] {
  if (visualLength(line) <= maxWidth) return [line];

  // Split at pipe separators (handles both plain ' | ' and ANSI-dimmed variants)
  // eslint-disable-next-line no-control-regex
  const parts = line.split(/ (?:\x1b\[[0-9;]*m)*\|(?:\x1b\[[0-9;]*m)* /);
  if (parts.length <= 1) return [line];

  const sep = ' | ';
  const indent = '  ';
  const result: string[] = [];
  let current = parts[0];

  for (let i = 1; i < parts.length; i++) {
    const candidate = current + sep + parts[i];
    if (visualLength(candidate) <= maxWidth) {
      current = candidate;
    } else {
      result.push(current);
      current = indent + parts[i];
    }
  }
  result.push(current);

  return result;
}

function collectActivityLines(ctx: RenderContext): string[] {
  const activityLines: string[] = [];
  const display = ctx.config?.display;

  if (display?.showTools !== false) {
    const toolsLine = renderToolsLine(ctx);
    if (toolsLine) {
      activityLines.push(toolsLine);
    }
  }

  if (display?.showAgents !== false) {
    const agentsLine = renderAgentsLine(ctx);
    if (agentsLine) {
      activityLines.push(agentsLine);
    }
  }

  if (display?.showTodos !== false) {
    const todosLine = renderTodosLine(ctx);
    if (todosLine) {
      activityLines.push(todosLine);
    }
  }

  return activityLines;
}

function renderCompact(ctx: RenderContext): string[] {
  const lines: string[] = [];

  const sessionLine = renderSessionLine(ctx);
  if (sessionLine) {
    lines.push(sessionLine);
  }

  return lines;
}

function renderExpanded(ctx: RenderContext): string[] {
  const lines: string[] = [];

  const statusLine = renderStatusLine(ctx);
  if (statusLine) {
    lines.push(statusLine);
  }

  const projectLine = renderProjectLine(ctx);
  const environmentLine = renderEnvironmentLine(ctx);
  if (projectLine && environmentLine) {
    lines.push(`${projectLine} ${dim('|')} ${environmentLine}`);
  } else if (projectLine) {
    lines.push(projectLine);
  } else if (environmentLine) {
    lines.push(environmentLine);
  }

  return lines;
}

export function render(ctx: RenderContext): void {
  const lineLayout = ctx.config?.lineLayout ?? 'expanded';
  const showSeparators = ctx.config?.showSeparators ?? false;

  const headerLines = lineLayout === 'expanded'
    ? renderExpanded(ctx)
    : renderCompact(ctx);

  const activityLines = collectActivityLines(ctx);

  const lines: string[] = [...headerLines];

  if (showSeparators && activityLines.length > 0) {
    const maxWidth = Math.max(...headerLines.map(visualLength), 20);
    lines.push(makeSeparator(maxWidth));
  }

  lines.push(...activityLines);

  const maxWidth = getTerminalWidth();
  for (const line of lines) {
    for (const wrapped of wrapLine(line, maxWidth)) {
      const outputLine = `${RESET}${wrapped.replace(/ /g, '\u00A0')}`;
      console.log(outputLine);
    }
  }
}
