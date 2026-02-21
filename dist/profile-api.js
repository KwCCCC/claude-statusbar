import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import { execFileSync } from 'child_process';
import { createDebug } from './debug.js';
import { VERSION } from './constants.js';
const debug = createDebug('profile');
const KEYCHAIN_TIMEOUT_MS = 5000;
// Profile changes rarely — cache for 1 hour
const CACHE_TTL_MS = 3_600_000;
function getCachePath() {
    return path.join(os.homedir(), '.claude', 'plugins', 'claude-statusbar', '.profile-cache.json');
}
function readCache(now) {
    try {
        const cachePath = getCachePath();
        if (!fs.existsSync(cachePath))
            return null;
        const content = fs.readFileSync(cachePath, 'utf8');
        const cache = JSON.parse(content);
        if (cache.version !== VERSION)
            return null;
        if (now - cache.timestamp >= CACHE_TTL_MS)
            return null;
        return cache.data;
    }
    catch {
        return null;
    }
}
function writeCache(data, now) {
    try {
        const cachePath = getCachePath();
        const dir = path.dirname(cachePath);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(cachePath, JSON.stringify({ data, timestamp: now, version: VERSION }), 'utf8');
    }
    catch { /* ignore */ }
}
function getAccessToken() {
    const now = Date.now();
    // Try macOS Keychain first (Claude Code 2.x)
    if (process.platform === 'darwin') {
        try {
            const keychainData = execFileSync('/usr/bin/security', ['find-generic-password', '-s', 'Claude Code-credentials', '-w'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: KEYCHAIN_TIMEOUT_MS }).trim();
            if (keychainData) {
                const data = JSON.parse(keychainData);
                const token = data?.claudeAiOauth?.accessToken;
                if (token) {
                    const expiresAt = data?.claudeAiOauth?.expiresAt;
                    if (expiresAt == null || expiresAt > now) {
                        debug('Using access token from macOS Keychain');
                        return token;
                    }
                }
            }
        }
        catch {
            debug('Failed to read from macOS Keychain');
        }
    }
    // Fall back to file-based credentials
    try {
        const credPath = path.join(os.homedir(), '.claude', '.credentials.json');
        if (!fs.existsSync(credPath))
            return null;
        const content = fs.readFileSync(credPath, 'utf8');
        const data = JSON.parse(content);
        const token = data?.claudeAiOauth?.accessToken;
        if (!token)
            return null;
        const expiresAt = data?.claudeAiOauth?.expiresAt;
        if (expiresAt != null && expiresAt <= now)
            return null;
        return token;
    }
    catch {
        return null;
    }
}
function fetchProfile(accessToken) {
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'api.anthropic.com',
            path: '/api/oauth/profile',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'User-Agent': 'claude-statusbar/1.0',
            },
            timeout: 5000,
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk.toString(); });
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    debug('Profile API returned:', res.statusCode);
                    resolve(null);
                    return;
                }
                try {
                    const parsed = JSON.parse(data);
                    resolve({
                        email: parsed.account?.email ?? null,
                        displayName: parsed.account?.display_name ?? null,
                    });
                }
                catch {
                    resolve(null);
                }
            });
        });
        req.on('error', (e) => { debug('Profile API error:', e); resolve(null); });
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.end();
    });
}
export async function getProfile() {
    const now = Date.now();
    const cached = readCache(now);
    if (cached)
        return cached;
    const token = getAccessToken();
    if (!token)
        return null;
    const profile = await fetchProfile(token);
    if (profile)
        writeCache(profile, now);
    return profile;
}
//# sourceMappingURL=profile-api.js.map