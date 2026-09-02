import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { VERSION } from './constants.js';

const execFileAsync = promisify(execFile);
const FETCH_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function getFetchStampPath(): string {
  return path.join(os.homedir(), '.claude', 'plugins', 'claude-statusbar', '.git-fetch-stamp');
}

interface FetchStamp {
  timestamp: number;
  session?: string;
  version?: string;
}

async function periodicFetch(cwd: string, sessionId?: string): Promise<void> {
  const stampPath = getFetchStampPath();
  const now = Date.now();

  try {
    if (fs.existsSync(stampPath)) {
      const raw: FetchStamp = JSON.parse(fs.readFileSync(stampPath, 'utf8'));
      if (raw.version !== VERSION) { /* version changed, proceed with fetch */ }
      else {
        const sameSession = sessionId && raw.session === sessionId;
        if (sameSession && now - raw.timestamp < FETCH_COOLDOWN_MS) return;
      }
    }
  } catch { /* proceed with fetch */ }

  try {
    const dir = path.dirname(stampPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const stamp: FetchStamp = { timestamp: now, session: sessionId, version: VERSION };
    fs.writeFileSync(stampPath, JSON.stringify(stamp), 'utf8');
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

export interface WorktreeInfo {
  /** Linked worktree directory name */
  name: string;
  /** Name of the repository root that owns this worktree */
  repoName: string;
}

export interface GitStatus {
  branch: string;
  isDirty: boolean;
  ahead: number;
  behind: number;
  fileStats?: FileStats;
  lineDiff?: LineDiffStats;
  /** Set only when cwd is a linked worktree, not the main one */
  worktree?: WorktreeInfo;
}

function repoNameFromCommonDir(commonDir: string): string {
  const base = path.basename(commonDir);
  if (base === '.git') return path.basename(path.dirname(commonDir));
  // Bare repository: the directory itself is the repo (repo.git)
  return base.endsWith('.git') ? base.slice(0, -4) : base;
}

/**
 * Resolve worktree identity from rev-parse output.
 *
 * The main worktree resolves --git-dir and --git-common-dir to the same path;
 * a linked worktree points --git-dir at .git/worktrees/<name> instead.
 * Submodules keep the two equal, so they are not mistaken for worktrees.
 */
function parseWorktreeInfo(
  cwd: string,
  gitDirRaw?: string,
  commonDirRaw?: string
): WorktreeInfo | null {
  if (!gitDirRaw || !commonDirRaw) return null;

  const gitDir = path.resolve(cwd, gitDirRaw.trim());
  const commonDir = path.resolve(cwd, commonDirRaw.trim());
  if (gitDir === commonDir) return null;

  return { name: path.basename(gitDir), repoName: repoNameFromCommonDir(commonDir) };
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

export async function getGitStatus(cwd?: string, sessionId?: string): Promise<GitStatus | null> {
  if (!cwd) return null;

  try {
    // Branch and worktree paths come from one rev-parse to avoid a second process
    const { stdout: revParseOut } = await execFileAsync(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD', '--git-dir', '--git-common-dir'],
      { cwd, timeout: 1000, encoding: 'utf8' }
    );
    const [branchRaw, gitDirRaw, commonDirRaw] = revParseOut.trim().split('\n');
    const branch = (branchRaw ?? '').trim();
    if (!branch) return null;

    const worktree = parseWorktreeInfo(cwd, gitDirRaw, commonDirRaw);

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
      if (trimmed.length > 0) {
        fileStats = parseFileStats(trimmed);
        // Only mark dirty for tracked changes (not untracked files)
        isDirty = fileStats.modified > 0 || fileStats.added > 0 || fileStats.deleted > 0;
      }
    } catch {
      // Ignore errors, assume clean
    }

    // Fetch on session start, then every 5 min
    await periodicFetch(cwd, sessionId);

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

    return { branch, isDirty, ahead, behind, fileStats, lineDiff, worktree: worktree ?? undefined };
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
