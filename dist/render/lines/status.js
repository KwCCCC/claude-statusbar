import { isLimitReached } from '../../types.js';
import { getContextPercent, getBufferedPercent, getProviderLabel } from '../../stdin.js';
import { dim, red, yellow, getContextColor, RESET } from '../colors.js';
import { renderGitPart } from './project.js';
const SEP = dim('|');
/**
 * Status line:
 * genlab-tools git:(main) ↑2 ↓1 | ctx:25% | 5h:41%(3h14m) wk:11%(5d17h)
 */
export function renderStatusLine(ctx) {
    const parts = [];
    // 0) path + git
    const gitPart = renderGitPart(ctx);
    if (gitPart)
        parts.push(gitPart);
    // 1) ctx:XX%
    const rawPercent = getContextPercent(ctx.stdin);
    const bufferedPercent = getBufferedPercent(ctx.stdin);
    const autocompactMode = ctx.config?.display?.autocompactBuffer ?? 'enabled';
    const percent = autocompactMode === 'disabled' ? rawPercent : bufferedPercent;
    parts.push(renderCompactContext(percent));
    // 2) 5h:XX%(XhXm) wk:XX%(XdXh)
    const display = ctx.config?.display;
    if (display?.showUsage !== false && ctx.usageData?.planName && !getProviderLabel(ctx.stdin)) {
        const usagePart = renderCompactUsage(ctx.usageData);
        if (usagePart)
            parts.push(usagePart);
    }
    if (parts.length === 0)
        return null;
    return parts.join(` ${SEP} `);
}
function renderCompactContext(percent) {
    const color = getContextColor(percent);
    const pct = `${color}${percent}%${RESET}`;
    if (percent >= 85) {
        return `${dim('ctx:')}${color}${percent}% CRITICAL${RESET}`;
    }
    if (percent >= 80) {
        return `${dim('ctx:')}${color}${percent}% COMPRESS?${RESET}`;
    }
    return `${dim('ctx:')}${pct}`;
}
function renderCompactUsage(data) {
    if (data.apiUnavailable) {
        return yellow('usage:??');
    }
    if (isLimitReached(data)) {
        const resetTime = data.fiveHour === 100
            ? formatResetTime(data.fiveHourResetAt)
            : formatResetTime(data.sevenDayResetAt);
        return red(`LIMIT${resetTime ? `(${resetTime})` : ''}`);
    }
    const parts = [];
    if (data.fiveHour !== null) {
        const color = getContextColor(data.fiveHour);
        const reset = formatResetTime(data.fiveHourResetAt);
        const resetPart = reset ? dim(`(${reset})`) : '';
        parts.push(`${dim('5h:')}${color}${data.fiveHour}%${RESET}${resetPart}`);
    }
    if (data.sevenDay !== null) {
        const color = getContextColor(data.sevenDay);
        const reset = formatResetTime(data.sevenDayResetAt);
        const resetPart = reset ? dim(`(${reset})`) : '';
        parts.push(`${dim('wk:')}${color}${data.sevenDay}%${RESET}${resetPart}`);
    }
    return parts.length > 0 ? parts.join(' ') : null;
}
function formatResetTime(resetAt) {
    if (!resetAt)
        return '';
    const now = new Date();
    const diffMs = resetAt.getTime() - now.getTime();
    if (diffMs <= 0)
        return '';
    const diffMins = Math.ceil(diffMs / 60000);
    if (diffMins < 60)
        return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        if (remHours > 0)
            return `${days}d${remHours}h`;
        return `${days}d`;
    }
    return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
}
//# sourceMappingURL=status.js.map