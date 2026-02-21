// Shared debug logging utility
// Enable via: DEBUG=claude-statusbar or DEBUG=*

const DEBUG = process.env.DEBUG?.includes('claude-statusbar') || process.env.DEBUG === '*';

/**
 * Create a namespaced debug logger
 * @param namespace - Tag for log messages (e.g., 'config', 'usage')
 */
export function createDebug(namespace: string) {
  return function debug(msg: string, ...args: unknown[]): void {
    if (DEBUG) {
      console.error(`[claude-statusbar:${namespace}] ${msg}`, ...args);
    }
  };
}
