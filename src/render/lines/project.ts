import type { RenderContext } from '../../types.js';
import { getModelName, getProviderLabel } from '../../stdin.js';
import { cyan, dim, green, magenta, red, yellow } from '../colors.js';

export function renderProjectLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;

  if (display?.showModel === false) return null;

  const model = getModelName(ctx.stdin);
  const providerLabel = getProviderLabel(ctx.stdin);
  const planName = display?.showUsage !== false ? ctx.usageData?.planName : undefined;
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  const billingLabel = hasApiKey ? red('API') : planName;
  const planDisplay = providerLabel ?? billingLabel;
  const header = planDisplay
    ? `${dim(model)} ${dim('(')}${dim(String(planDisplay))}${dim(')')}`
    : dim(model);
  const version = ctx.cliVersion ? ` ${dim(`v${ctx.cliVersion}`)}` : '';
  const parts: string[] = [];
  if (ctx.accountEmail) {
    parts.push(ctx.accountEmail);
  }
  parts.push(`${header}${version}`);
  const line = parts.join(` ${dim('|')} `);

  return line;
}

/** Render path + git info as a standalone string (used by status line) */
export function renderGitPart(ctx: RenderContext): string | null {
  if (!ctx.stdin.cwd) return null;

  const segments = ctx.stdin.cwd.split(/[/\\]/).filter(Boolean);
  const pathLevels = ctx.config?.pathLevels ?? 1;
  const projectPath = segments.length > 0 ? segments.slice(-pathLevels).join('/') : '/';

  let gitPart = '';
  const gitConfig = ctx.config?.gitStatus;
  const showGit = gitConfig?.enabled ?? true;

  if (showGit && ctx.gitStatus) {
    const branchParts: string[] = [ctx.gitStatus.branch];

    if ((gitConfig?.showDirty ?? true) && ctx.gitStatus.isDirty) {
      branchParts.push('*');
    }

    gitPart = ` git:(${cyan(branchParts.join(''))})`;

    if (gitConfig?.showAheadBehind) {
      const abParts: string[] = [];
      if (ctx.gitStatus.behind > 0) abParts.push(cyan(`\u2193${ctx.gitStatus.behind}`));
      if (ctx.gitStatus.ahead > 0) abParts.push(green(`\u2191${ctx.gitStatus.ahead}`));
      if (abParts.length > 0) gitPart += ` ${abParts.join(' ')}`;
    }

    if (gitConfig?.showFileStats && ctx.gitStatus.fileStats) {
      const { modified, added, deleted, untracked } = ctx.gitStatus.fileStats;
      const statParts: string[] = [];
      if (modified > 0) statParts.push(`!${modified}`);
      if (added > 0) statParts.push(`+${added}`);
      if (deleted > 0) statParts.push(`\u2718${deleted}`);
      if (untracked > 0) statParts.push(`?${untracked}`);
      if (statParts.length > 0) gitPart += ` ${statParts.join(' ')}`;
    }
  }

  return `repo:(${yellow(projectPath)})${gitPart}`;
}
