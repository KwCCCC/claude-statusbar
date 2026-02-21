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
export declare function getGitBranch(cwd?: string): Promise<string | null>;
export declare function getGitStatus(cwd?: string): Promise<GitStatus | null>;
//# sourceMappingURL=git.d.ts.map