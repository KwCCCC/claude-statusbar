import { dim, cyan, green, red } from '../colors.js';
export function renderEnvironmentLine(ctx) {
    const display = ctx.config?.display;
    const parts = [];
    if (display?.showConfigCounts !== false) {
        const totalCounts = ctx.claudeMdCount + ctx.rulesCount + ctx.mcpCount + ctx.hooksCount;
        const threshold = display?.environmentThreshold ?? 0;
        if (totalCounts > 0 && totalCounts >= threshold) {
            if (ctx.claudeMdCount > 0) {
                parts.push(dim(`${ctx.claudeMdCount} CLAUDE.md`));
            }
            if (ctx.rulesCount > 0) {
                parts.push(dim(`${ctx.rulesCount} rules`));
            }
            if (ctx.mcpCount > 0) {
                parts.push(dim(`${ctx.mcpCount} MCPs`));
            }
            if (ctx.hooksCount > 0) {
                parts.push(dim(`${ctx.hooksCount} hooks`));
            }
        }
    }
    if (ctx.gitStatus?.lineDiff) {
        const { additions, deletions } = ctx.gitStatus.lineDiff;
        const diffParts = [];
        if (additions > 0)
            diffParts.push(green(`+${additions}`));
        if (deletions > 0)
            diffParts.push(red(`-${deletions}`));
        if (diffParts.length > 0)
            parts.push(diffParts.join(' '));
    }
    if (ctx.extraLabel) {
        parts.push(cyan(ctx.extraLabel));
    }
    if (parts.length === 0) {
        return null;
    }
    return parts.join(' | ');
}
//# sourceMappingURL=environment.js.map