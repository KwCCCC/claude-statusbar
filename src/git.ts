import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const FETCH_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function getFetchStampPath(): string {
  return path.join(os.homedir(), '.claude', 'plugins', 'claude-statusbar', '.git-fetch-stamp');
}

async function periodicFetch(cwd: string): Promise<void> {
  const stampPath = getFetchStampPath();
  const now = Date.now();

  try {
    if (fs.existsSync(stampPath)) {
      const stamp = parseInt(fs.readFileSync(stampPath, 'utf8'), 10);
      if (now - stamp < FETCH_COOLDOWN_MS) return;
    }
  } catch { /* proceed with fetch */ }

  try {
    const dir = path.dirname(stampPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(stampPath, String(now), 'utf8');
    await execFileAsync('git', ['fetch', '--quiet'], { cwd, timeout: 5000, encoding: 'utf8' });
  } catch { /* ignore fetch failures */ }
}

export interface FileStats {
  modified: number;
  added: number;
  deleted: number;
  untracked: number;
}

export interface LineDiffStats {
  additions: number;
  deletions: number;
}

export interface GitStatus {
  branch: string;
  isDirty: boolean;
  ahead: number;
  behind: number;
  fileStats?: FileStats;
  lineDiff?: LineDiffStats;
}

export async function getGitBranch(cwd?: string): Promise<string | null> {
  if (!cwd) return null;

  try {
    const { stdout } = await execFileAsync(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd, timeout: 1000, encoding: 'utf8' }
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function getGitStatus(cwd?: string): Promise<GitStatus | null> {
  if (!cwd) return null;

  try {
    // Get branch name
    const { stdout: branchOut } = await execFileAsync(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd, timeout: 1000, encoding: 'utf8' }
    );
    const branch = branchOut.trim();
    if (!branch) return null;

    // Check for dirty state and parse file stats
    let isDirty = false;
    let fileStats: FileStats | undefined;
    try {
      const { stdout: statusOut } = await execFileAsync(
        'git',
        ['--no-optional-locks', 'status', '--porcelain'],
        { cwd, timeout: 1000, encoding: 'utf8' }
      );
      const trimmed = statusOut.trim();
      isDirty = trimmed.length > 0;
      if (isDirty) {
        fileStats = parseFileStats(trimmed);
      }
    } catch {
      // Ignore errors, assume clean
    }

    // Periodic fetch to keep tracking refs up to date (every 5 min)
    await periodicFetch(cwd);

    // Get ahead/behind counts
    let ahead = 0;
    let behind = 0;
    try {
      const { stdout: revOut } = await execFileAsync(
        'git',
        ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'],
        { cwd, timeout: 1000, encoding: 'utf8' }
      );
      const parts = revOut.trim().split(/\s+/);
      if (parts.length === 2) {
        behind = parseInt(parts[0], 10) || 0;
        ahead = parseInt(parts[1], 10) || 0;
      }
    } catch {
      // No upstream or error, keep 0/0
    }

    // Get line-level diff stats (staged + unstaged vs HEAD)
    let lineDiff: LineDiffStats | undefined;
    try {
      const { stdout: diffOut } = await execFileAsync(
        'git',
        ['diff', 'HEAD', '--numstat'],
        { cwd, timeout: 1000, encoding: 'utf8' }
      );
      if (diffOut.trim()) {
        lineDiff = parseLineDiff(diffOut.trim());
      }
    } catch {
      // Ignore errors (e.g. no commits yet)
    }

    return { branch, isDirty, ahead, behind, fileStats, lineDiff };
  } catch {
    return null;
  }
}

/**
 * Parse git diff --numstat output and sum additions/deletions
 */
function parseLineDiff(numstatOutput: string): LineDiffStats {
  let additions = 0;
  let deletions = 0;
  for (const line of numstatOutput.split('\n').filter(Boolean)) {
    const [add, del] = line.split('\t');
    if (add !== '-') additions += parseInt(add, 10) || 0;
    if (del !== '-') deletions += parseInt(del, 10) || 0;
  }
  return { additions, deletions };
}

/**
 * Parse git status --porcelain output and count file stats (Starship-compatible format)
 * Status codes: M=modified, A=added, D=deleted, ??=untracked
 */
function parseFileStats(porcelainOutput: string): FileStats {
  const stats: FileStats = { modified: 0, added: 0, deleted: 0, untracked: 0 };
  const lines = porcelainOutput.split('\n').filter(Boolean);

  for (const line of lines) {
    if (line.length < 2) continue;

    const index = line[0];    // staged status
    const worktree = line[1]; // unstaged status

    if (line.startsWith('??')) {
      stats.untracked++;
    } else if (index === 'A') {
      stats.added++;
    } else if (index === 'D' || worktree === 'D') {
      stats.deleted++;
    } else if (index === 'M' || worktree === 'M' || index === 'R' || index === 'C') {
      // M=modified, R=renamed (counts as modified), C=copied (counts as modified)
      stats.modified++;
    }
  }

  return stats;
}
