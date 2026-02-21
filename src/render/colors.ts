export const RESET = '\x1b[0m';

const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const MID_GREEN = '\x1b[38;5;115m';
const MID_YELLOW = '\x1b[38;5;179m';
const MID_RED = '\x1b[38;5;167m';
const BRIGHT_BLUE = '\x1b[94m';
const BRIGHT_MAGENTA = '\x1b[95m';
export function brightBlue(text: string): string {
  return `${BRIGHT_BLUE}${text}${RESET}`;
}

export function green(text: string): string {
  return `${GREEN}${text}${RESET}`;
}

export function yellow(text: string): string {
  return `${YELLOW}${text}${RESET}`;
}

export function red(text: string): string {
  return `${RED}${text}${RESET}`;
}

export function cyan(text: string): string {
  return `${CYAN}${text}${RESET}`;
}

export function magenta(text: string): string {
  return `${MAGENTA}${text}${RESET}`;
}

export function dim(text: string): string {
  return `${DIM}${text}${RESET}`;
}

export function getContextColor(percent: number): string {
  if (percent >= 85) return MID_RED;
  if (percent >= 70) return MID_YELLOW;
  return MID_GREEN;
}

export function getQuotaColor(percent: number): string {
  if (percent >= 90) return RED;
  if (percent >= 75) return BRIGHT_MAGENTA;
  return BRIGHT_BLUE;
}

export function quotaBar(percent: number, width: number = 10): string {
  const safeWidth = Number.isFinite(width) ? Math.max(0, Math.round(width)) : 0;
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const filled = Math.round((safePercent / 100) * safeWidth);
  const empty = safeWidth - filled;
  const color = getQuotaColor(safePercent);
  return `${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET}`;
}

const SESSION_COLORS = [CYAN, MAGENTA, BRIGHT_BLUE, YELLOW, GREEN, BRIGHT_MAGENTA];

export function getSessionColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return SESSION_COLORS[Math.abs(hash) % SESSION_COLORS.length];
}

export function getModelTierColor(model?: string): string {
  if (!model) return CYAN;
  const m = model.toLowerCase();
  if (m.includes('opus')) return MAGENTA;
  if (m.includes('sonnet')) return YELLOW;
  if (m.includes('haiku')) return GREEN;
  return CYAN;
}

export function getDurationColor(ms: number): string {
  if (ms >= 300000) return RED;     // >=5m
  if (ms >= 120000) return YELLOW;  // >=2m
  return GREEN;
}

export function getUsageColor(percent: number): string {
  if (percent >= 90) return RED;
  if (percent >= 70) return YELLOW;
  return GREEN;
}

export function coloredBar(percent: number, width: number = 10): string {
  const safeWidth = Number.isFinite(width) ? Math.max(0, Math.round(width)) : 0;
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const filled = Math.round((safePercent / 100) * safeWidth);
  const empty = safeWidth - filled;
  const color = getContextColor(safePercent);
  return `${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET}`;
}
