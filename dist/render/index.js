import { renderSessionLine } from './session-line.js';
import { renderToolsLine } from './tools-line.js';
import { renderAgentsLine } from './agents-line.js';
import { renderTodosLine } from './todos-line.js';
import { renderProjectLine, renderEnvironmentLine } from './lines/index.js';
import { renderStatusLine } from './lines/status.js';
import { dim, RESET } from './colors.js';
function stripAnsi(str) {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
}
function visualLength(str) {
    return stripAnsi(str).length;
}
function makeSeparator(length) {
    return dim('─'.repeat(Math.max(length, 20)));
}
function collectActivityLines(ctx) {
    const activityLines = [];
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
function renderCompact(ctx) {
    const lines = [];
    const sessionLine = renderSessionLine(ctx);
    if (sessionLine) {
        lines.push(sessionLine);
    }
    return lines;
}
function renderExpanded(ctx) {
    const lines = [];
    const statusLine = renderStatusLine(ctx);
    if (statusLine) {
        lines.push(statusLine);
    }
    const projectLine = renderProjectLine(ctx);
    const environmentLine = renderEnvironmentLine(ctx);
    if (projectLine && environmentLine) {
        lines.push(`${projectLine} ${dim('|')} ${environmentLine}`);
    }
    else if (projectLine) {
        lines.push(projectLine);
    }
    else if (environmentLine) {
        lines.push(environmentLine);
    }
    return lines;
}
export function render(ctx) {
    const lineLayout = ctx.config?.lineLayout ?? 'expanded';
    const showSeparators = ctx.config?.showSeparators ?? false;
    const headerLines = lineLayout === 'expanded'
        ? renderExpanded(ctx)
        : renderCompact(ctx);
    const activityLines = collectActivityLines(ctx);
    const lines = [...headerLines];
    if (showSeparators && activityLines.length > 0) {
        const maxWidth = Math.max(...headerLines.map(visualLength), 20);
        lines.push(makeSeparator(maxWidth));
    }
    lines.push(...activityLines);
    for (const line of lines) {
        const outputLine = `${RESET}${line.replace(/ /g, '\u00A0')}`;
        console.log(outputLine);
    }
}
//# sourceMappingURL=index.js.map