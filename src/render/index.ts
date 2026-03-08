import type { RenderContext } from '../types.js';
import { renderSessionLine } from './session-line.js';
import { renderToolsLine } from './tools-line.js';
import { renderAgentsLine } from './agents-line.js';
import { renderTodosLine } from './todos-line.js';
import { renderProjectLine, renderEnvironmentLine } from './lines/index.js';
import { renderStatusLine } from './lines/status.js';
import { dim, RESET } from './colors.js';

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;

function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, '');
}

function visualLength(str: string): number {
  return stripAnsi(str).length;
}

function makeSeparator(length: number): string {
  return dim('─'.repeat(Math.max(length, 20)));
}

const PLAIN_SEPARATOR = ' | ';
const DIM_SEPARATOR = dim(PLAIN_SEPARATOR);

/**
 * Truncate a single line to maxWidth, preserving ANSI codes.
 */
function truncateLineToMaxWidth(line: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  if (visualLength(line) <= maxWidth) return line;

  const ELLIPSIS = '...';
  const targetWidth = Math.max(0, maxWidth - 3);

  let visibleWidth = 0;
  let result = '';
  let i = 0;

  // eslint-disable-next-line no-control-regex
  const ansiPattern = /\x1b\[[0-9;]*[a-zA-Z]/;

  while (i < line.length) {
    const remaining = line.slice(i);
    const ansiMatch = remaining.match(ansiPattern);

    if (ansiMatch && ansiMatch.index === 0) {
      result += ansiMatch[0];
      i += ansiMatch[0].length;
      continue;
    }

    if (visibleWidth >= targetWidth) break;

    result += line[i];
    visibleWidth++;
    i++;
  }

  return result + RESET + ELLIPSIS;
}

/**
 * Wrap a single line at separator boundaries to fit within maxWidth.
 * Falls back to truncation when no separator found or single segment exceeds maxWidth.
 */
function wrapLineToMaxWidth(line: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [''];
  if (visualLength(line) <= maxWidth) return [line];

  const separator = line.includes(DIM_SEPARATOR)
    ? DIM_SEPARATOR
    : line.includes(PLAIN_SEPARATOR)
      ? PLAIN_SEPARATOR
      : null;

  if (!separator) {
    return [truncateLineToMaxWidth(line, maxWidth)];
  }

  const segments = line.split(separator);
  if (segments.length <= 1) {
    return [truncateLineToMaxWidth(line, maxWidth)];
  }

  const wrapped: string[] = [];
  let current = segments[0] ?? '';

  for (let i = 1; i < segments.length; i++) {
    const nextSegment = segments[i] ?? '';
    const candidate = `${current}${separator}${nextSegment}`;

    if (visualLength(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (visualLength(current) > maxWidth) {
      wrapped.push(truncateLineToMaxWidth(current, maxWidth));
    } else {
      wrapped.push(current);
    }

    current = nextSegment;
  }

  if (visualLength(current) > maxWidth) {
    wrapped.push(truncateLineToMaxWidth(current, maxWidth));
  } else {
    wrapped.push(current);
  }

  return wrapped;
}

/**
 * Apply maxWidth behavior by mode.
 */
function applyMaxWidth(
  lines: string[],
  maxWidth: number | undefined,
  wrapMode: 'truncate' | 'wrap',
): string[] {
  if (!maxWidth || maxWidth <= 0) return lines;

  if (wrapMode === 'wrap') {
    return lines.flatMap(line => wrapLineToMaxWidth(line, maxWidth));
  }

  return lines.map(line => truncateLineToMaxWidth(line, maxWidth));
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
    const maxW = Math.max(...headerLines.map(visualLength), 20);
    lines.push(makeSeparator(maxW));
  }

  lines.push(...activityLines);

  const finalLines = applyMaxWidth(lines, ctx.config?.maxWidth, ctx.config?.wrapMode ?? 'wrap');

  for (const line of finalLines) {
    const outputLine = `${RESET}${line.replace(/ /g, '\u00A0')}`;
    console.log(outputLine);
  }
}
