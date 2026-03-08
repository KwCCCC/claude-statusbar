import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { createDebug } from './debug.js';
const debug = createDebug('usage');
// Cache configuration
const CACHE_TTL_MS = 90_000; // 90 seconds (match OMC)
const CACHE_FAILURE_TTL_MS = 15_000; // 15 seconds for failed requests
const CACHE_RATE_LIMITED_BASE_MS = 120_000; // 2 minutes base for 429
const CACHE_RATE_LIMITED_MAX_MS = 600_000; // 10 minutes max backoff
const API_TIMEOUT_MS = 10_000;
const KEYCHAIN_TIMEOUT_MS = 5000;
const KEYCHAIN_BACKOFF_MS = 60_000;
// Token refresh
const TOKEN_REFRESH_HOSTNAME = 'platform.claude.com';
const TOKEN_REFRESH_PATH = '/v1/oauth/token';
const DEFAULT_OAUTH_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
function getCachePath(homeDir) {
    return path.join(homeDir, '.claude', 'plugins', 'claude-statusbar', '.usage-cache.json');
}
function hydrateDates(data) {
    if (data.fiveHourResetAt) {
        data.fiveHourResetAt = new Date(data.fiveHourResetAt);
    }
    if (data.sevenDayResetAt) {
        data.sevenDayResetAt = new Date(data.sevenDayResetAt);
    }
    return data;
}
function readCache(homeDir) {
    try {
        const cachePath = getCachePath(homeDir);
        if (!fs.existsSync(cachePath))
            return null;
        const content = fs.readFileSync(cachePath, 'utf8');
        const cache = JSON.parse(content);
        if (cache.data)
            hydrateDates(cache.data);
        return cache;
    }
    catch {
        return null;
    }
}
function isCacheValid(cache) {
    const now = Date.now();
    if (cache.rateLimited) {
        const count = cache.rateLimitedCount || 1;
        const backoffMs = Math.min(CACHE_RATE_LIMITED_BASE_MS * Math.pow(2, count - 1), CACHE_RATE_LIMITED_MAX_MS);
        return now - cache.timestamp < backoffMs;
    }
    const ttl = cache.error ? CACHE_FAILURE_TTL_MS : CACHE_TTL_MS;
    return now - cache.timestamp < ttl;
}
function writeCache(homeDir, data, options = {}) {
    try {
        const cachePath = getCachePath(homeDir);
        const cacheDir = path.dirname(cachePath);
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        const cache = {
            data,
            timestamp: Date.now(),
            error: options.error || undefined,
            rateLimited: options.rateLimited || undefined,
            rateLimitedCount: options.rateLimitedCount && options.rateLimitedCount > 0
                ? options.rateLimitedCount : undefined,
        };
        fs.writeFileSync(cachePath, JSON.stringify(cache), 'utf8');
    }
    catch {
        // Ignore cache write failures
    }
}
const defaultDeps = {
    homeDir: () => os.homedir(),
    fetchApi: fetchUsageApi,
    now: () => Date.now(),
    readKeychain: readKeychainCredentials,
};
/**
 * Get OAuth usage data from Anthropic API.
 *
 * On 429: serves stale cached data if available, with exponential backoff.
 * On token expiry: attempts refresh via platform.claude.com.
 */
export async function getUsage(overrides = {}) {
    const deps = { ...defaultDeps, ...overrides };
    const now = deps.now();
    const homeDir = deps.homeDir();
    // Check cache first
    const cache = readCache(homeDir);
    if (cache && isCacheValid(cache)) {
        // For rate-limited cache with stale data, return data (not apiUnavailable)
        if (cache.data && !cache.data.apiUnavailable) {
            return cache.data;
        }
        if (cache.data?.apiUnavailable) {
            return cache.data;
        }
        if (cache.error) {
            return null;
        }
    }
    try {
        let credentials = getCredentials(homeDir, now, deps.readKeychain);
        if (!credentials) {
            return null;
        }
        // Try token refresh if expired
        if (credentials.expiresAt != null && credentials.expiresAt <= now) {
            if (credentials.refreshToken) {
                const refreshed = await refreshAccessToken(credentials.refreshToken);
                if (refreshed) {
                    credentials = { ...credentials, ...refreshed };
                    writeBackCredentials(homeDir, credentials);
                    debug('Token refreshed successfully');
                }
                else {
                    debug('Token refresh failed');
                    writeCache(homeDir, null, { error: true });
                    return null;
                }
            }
            else {
                debug('Token expired, no refresh token');
                return null;
            }
        }
        const planName = getPlanName(credentials.subscriptionType);
        if (!planName) {
            return null;
        }
        // Fetch usage from API
        const apiResult = await deps.fetchApi(credentials.accessToken);
        if (apiResult.rateLimited) {
            // 429 — serve stale data if available, with exponential backoff
            const prevCount = cache?.rateLimitedCount || 0;
            const newCount = prevCount + 1;
            const staleData = cache?.data && !cache.data.apiUnavailable ? cache.data : null;
            writeCache(homeDir, staleData, { rateLimited: true, rateLimitedCount: newCount });
            if (staleData) {
                return staleData;
            }
            return {
                planName,
                fiveHour: null,
                sevenDay: null,
                fiveHourResetAt: null,
                sevenDayResetAt: null,
                apiUnavailable: true,
                apiError: 'rate_limited',
            };
        }
        if (!apiResult.data) {
            // Network/other error — try to serve stale data
            const staleData = cache?.data && !cache.data.apiUnavailable ? cache.data : null;
            if (staleData) {
                writeCache(homeDir, staleData, { error: true });
                return staleData;
            }
            const failureResult = {
                planName,
                fiveHour: null,
                sevenDay: null,
                fiveHourResetAt: null,
                sevenDayResetAt: null,
                apiUnavailable: true,
                apiError: apiResult.error,
            };
            writeCache(homeDir, failureResult, { error: true });
            return failureResult;
        }
        const fiveHour = parseUtilization(apiResult.data.five_hour?.utilization);
        const sevenDay = parseUtilization(apiResult.data.seven_day?.utilization);
        const fiveHourResetAt = parseDate(apiResult.data.five_hour?.resets_at);
        const sevenDayResetAt = parseDate(apiResult.data.seven_day?.resets_at);
        const result = {
            planName,
            fiveHour,
            sevenDay,
            fiveHourResetAt,
            sevenDayResetAt,
        };
        writeCache(homeDir, result);
        return result;
    }
    catch (error) {
        debug('getUsage failed:', error);
        return null;
    }
}
// ── Token Refresh ──
function refreshAccessToken(refreshToken) {
    return new Promise((resolve) => {
        const clientId = process.env.CLAUDE_CODE_OAUTH_CLIENT_ID || DEFAULT_OAUTH_CLIENT_ID;
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
        }).toString();
        const req = https.request({
            hostname: TOKEN_REFRESH_HOSTNAME,
            path: TOKEN_REFRESH_PATH,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body),
            },
            timeout: API_TIMEOUT_MS,
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk.toString(); });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.access_token) {
                            resolve({
                                accessToken: parsed.access_token,
                                subscriptionType: '',
                                refreshToken: parsed.refresh_token || refreshToken,
                                expiresAt: parsed.expires_in
                                    ? Date.now() + parsed.expires_in * 1000
                                    : parsed.expires_at,
                            });
                            return;
                        }
                    }
                    catch {
                        // JSON parse failed
                    }
                }
                debug('Token refresh failed: HTTP', res.statusCode);
                resolve(null);
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.end(body);
    });
}
function writeBackCredentials(homeDir, creds) {
    try {
        const credPath = path.join(homeDir, '.claude', '.credentials.json');
        if (!fs.existsSync(credPath))
            return;
        const content = fs.readFileSync(credPath, 'utf8');
        const parsed = JSON.parse(content);
        if (parsed.claudeAiOauth) {
            parsed.claudeAiOauth.accessToken = creds.accessToken;
            if (creds.expiresAt != null)
                parsed.claudeAiOauth.expiresAt = creds.expiresAt;
            if (creds.refreshToken)
                parsed.claudeAiOauth.refreshToken = creds.refreshToken;
        }
        else {
            parsed.accessToken = creds.accessToken;
            if (creds.expiresAt != null)
                parsed.expiresAt = creds.expiresAt;
            if (creds.refreshToken)
                parsed.refreshToken = creds.refreshToken;
        }
        fs.writeFileSync(credPath, JSON.stringify(parsed, null, 2), { mode: 0o600 });
    }
    catch {
        debug('Failed to write back refreshed credentials');
    }
}
// ── Credentials ──
function getKeychainServiceName() {
    const configDir = process.env.CLAUDE_CONFIG_DIR;
    if (configDir) {
        const hash = createHash('sha256').update(configDir).digest('hex').slice(0, 8);
        return `Claude Code-credentials-${hash}`;
    }
    return 'Claude Code-credentials';
}
function getKeychainBackoffPath(homeDir) {
    return path.join(homeDir, '.claude', 'plugins', 'claude-statusbar', '.keychain-backoff');
}
function isKeychainBackoff(homeDir, now) {
    try {
        const backoffPath = getKeychainBackoffPath(homeDir);
        if (!fs.existsSync(backoffPath))
            return false;
        const timestamp = parseInt(fs.readFileSync(backoffPath, 'utf8'), 10);
        return now - timestamp < KEYCHAIN_BACKOFF_MS;
    }
    catch {
        return false;
    }
}
function recordKeychainFailure(homeDir, now) {
    try {
        const backoffPath = getKeychainBackoffPath(homeDir);
        const dir = path.dirname(backoffPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(backoffPath, String(now), 'utf8');
    }
    catch {
        // Ignore
    }
}
function readKeychainCredentials(now, homeDir) {
    if (process.platform !== 'darwin')
        return null;
    if (isKeychainBackoff(homeDir, now)) {
        debug('Keychain in backoff period, skipping');
        return null;
    }
    try {
        const serviceName = getKeychainServiceName();
        const keychainData = execFileSync('/usr/bin/security', ['find-generic-password', '-s', serviceName, '-w'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: KEYCHAIN_TIMEOUT_MS }).trim();
        if (!keychainData)
            return null;
        const data = JSON.parse(keychainData);
        const creds = data.claudeAiOauth;
        if (!creds?.accessToken)
            return null;
        return {
            accessToken: creds.accessToken,
            subscriptionType: creds.subscriptionType ?? '',
            refreshToken: creds.refreshToken,
            expiresAt: creds.expiresAt,
            source: 'keychain',
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        debug('Failed to read from macOS Keychain:', message);
        recordKeychainFailure(homeDir, now);
        return null;
    }
}
function readFileCredentials(homeDir) {
    try {
        const credentialsPath = path.join(homeDir, '.claude', '.credentials.json');
        if (!fs.existsSync(credentialsPath))
            return null;
        const content = fs.readFileSync(credentialsPath, 'utf8');
        const data = JSON.parse(content);
        const creds = data.claudeAiOauth;
        if (!creds?.accessToken)
            return null;
        return {
            accessToken: creds.accessToken,
            subscriptionType: creds.subscriptionType ?? '',
            refreshToken: creds.refreshToken,
            expiresAt: creds.expiresAt,
            source: 'file',
        };
    }
    catch {
        return null;
    }
}
function getCredentials(homeDir, now, readKeychain) {
    const keychainCreds = readKeychain(now, homeDir);
    if (keychainCreds) {
        if (keychainCreds.subscriptionType)
            return keychainCreds;
        // Supplement subscriptionType from file if keychain lacks it
        const fileCreds = readFileCredentials(homeDir);
        if (fileCreds?.subscriptionType) {
            return { ...keychainCreds, subscriptionType: fileCreds.subscriptionType };
        }
        return keychainCreds;
    }
    return readFileCredentials(homeDir);
}
function getPlanName(subscriptionType) {
    const lower = subscriptionType.toLowerCase();
    if (lower.includes('max'))
        return 'Max';
    if (lower.includes('pro'))
        return 'Pro';
    if (lower.includes('team'))
        return 'Team';
    if (!subscriptionType || lower.includes('api'))
        return null;
    return subscriptionType.charAt(0).toUpperCase() + subscriptionType.slice(1);
}
function parseUtilization(value) {
    if (value == null)
        return null;
    if (!Number.isFinite(value))
        return null;
    return Math.round(Math.max(0, Math.min(100, value)));
}
function parseDate(dateStr) {
    if (!dateStr)
        return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        debug('Invalid date string:', dateStr);
        return null;
    }
    return date;
}
function fetchUsageApi(accessToken) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'api.anthropic.com',
            path: '/api/oauth/usage',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'anthropic-beta': 'oauth-2025-04-20',
                'Content-Type': 'application/json',
            },
            timeout: API_TIMEOUT_MS,
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk.toString();
            });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(data);
                        resolve({ data: parsed });
                    }
                    catch {
                        resolve({ data: null, error: 'parse' });
                    }
                }
                else if (res.statusCode === 429) {
                    resolve({ data: null, rateLimited: true, error: 'rate_limited' });
                }
                else {
                    resolve({ data: null, error: res.statusCode ? `http-${res.statusCode}` : 'http-error' });
                }
            });
        });
        req.on('error', () => resolve({ data: null, error: 'network' }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ data: null, error: 'timeout' });
        });
        req.end();
    });
}
export function clearCache(homeDir) {
    if (homeDir) {
        try {
            const cachePath = getCachePath(homeDir);
            if (fs.existsSync(cachePath))
                fs.unlinkSync(cachePath);
        }
        catch {
            // Ignore
        }
    }
}
//# sourceMappingURL=usage-api.js.map