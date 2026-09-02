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
export declare function getGitBranch(cwd?: string): Promise<string | null>;
export declare function getGitStatus(cwd?: string, sessionId?: string): Promise<GitStatus | null>;
//# sourceMappingURL=git.d.ts.map