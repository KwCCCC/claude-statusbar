import type { UsageData } from './types.js';
export type { UsageData } from './types.js';
interface UsageApiResponse {
    five_hour?: {
        utilization?: number;
        resets_at?: string;
    };
    seven_day?: {
        utilization?: number;
        resets_at?: string;
    };
}
interface UsageApiResult {
    data: UsageApiResponse | null;
    rateLimited?: boolean;
    error?: string;
}
export type UsageApiDeps = {
    homeDir: () => string;
    fetchApi: (accessToken: string) => Promise<UsageApiResult>;
    now: () => number;
    readKeychain: (now: number, homeDir: string) => OAuthCredentials | null;
};
interface OAuthCredentials {
    accessToken: string;
    subscriptionType: string;
    refreshToken?: string;
    expiresAt?: number;
    source?: 'keychain' | 'file';
}
/**
 * Get OAuth usage data from Anthropic API.
 *
 * On 429: serves stale cached data if available, with exponential backoff.
 * On token expiry: attempts refresh via platform.claude.com.
 */
export declare function getUsage(overrides?: Partial<UsageApiDeps>): Promise<UsageData | null>;
export declare function clearCache(homeDir?: string): void;
//# sourceMappingURL=usage-api.d.ts.map