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

export interface ProfileData {
  email: string | null;
  displayName: string | null;
}

interface ProfileApiResponse {
  account?: {
    uuid?: string;
    email?: string;
    display_name?: string;
  };
  organization?: {
    rate_limit_tier?: string;
  };
}

interface CacheFile {
  data: ProfileData;
  timestamp: number;
  version?: string;
}

function getCachePath(): string {
  return path.join(os.homedir(), '.claude', 'plugins', 'claude-statusbar', '.profile-cache.json');
}

function readCache(now: number): ProfileData | null {
  try {
    const cachePath = getCachePath();
    if (!fs.existsSync(cachePath)) return null;
    const content = fs.readFileSync(cachePath, 'utf8');
    const cache: CacheFile = JSON.parse(content);
    if (cache.version !== VERSION) return null;
    if (now - cache.timestamp >= CACHE_TTL_MS) return null;
    return cache.data;
  } catch {
    return null;
  }
}

function writeCache(data: ProfileData, now: number): void {
  try {
    const cachePath = getCachePath();
    const dir = path.dirname(cachePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify({ data, timestamp: now, version: VERSION }), 'utf8');
  } catch { /* ignore */ }
}

function getAccessToken(): string | null {
  const now = Date.now();

  // Try macOS Keychain first (Claude Code 2.x)
  if (process.platform === 'darwin') {
    try {
      const keychainData = execFileSync(
        '/usr/bin/security',
        ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: KEYCHAIN_TIMEOUT_MS }
      ).trim();
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
    } catch {
      debug('Failed to read from macOS Keychain');
    }
  }

  // Fall back to file-based credentials
  try {
    const credPath = path.join(os.homedir(), '.claude', '.credentials.json');
    if (!fs.existsSync(credPath)) return null;
    const content = fs.readFileSync(credPath, 'utf8');
    const data = JSON.parse(content);
    const token = data?.claudeAiOauth?.accessToken;
    if (!token) return null;
    const expiresAt = data?.claudeAiOauth?.expiresAt;
    if (expiresAt != null && expiresAt <= now) return null;
    return token;
  } catch {
    return null;
  }
}

function fetchProfile(accessToken: string): Promise<ProfileData | null> {
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
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          debug('Profile API returned:', res.statusCode);
          resolve(null);
          return;
        }
        try {
          const parsed: ProfileApiResponse = JSON.parse(data);
          resolve({
            email: parsed.account?.email ?? null,
            displayName: parsed.account?.display_name ?? null,
          });
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', (e) => { debug('Profile API error:', e); resolve(null); });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

export async function getProfile(): Promise<ProfileData | null> {
  const now = Date.now();

  const cached = readCache(now);
  if (cached) return cached;

  const token = getAccessToken();
  if (!token) return null;

  const profile = await fetchProfile(token);
  if (profile) writeCache(profile, now);

  return profile;
}
