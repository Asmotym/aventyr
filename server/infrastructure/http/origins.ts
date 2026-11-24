const DEFAULT_HOSTS = ['aventyr.io', 'localhost:5173'] as const;
const envHosts = (process.env.TRUSTED_FRONTEND_HOSTS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
const trustedHosts = new Set<string>((envHosts.length > 0 ? envHosts : DEFAULT_HOSTS).map((host) => host.toLowerCase()));
function extractHost(value?: string | null): string | null {
    if (!value)
        return null;
    try {
        const url = new URL(value);
        return url.host.toLowerCase();
    }
    catch {
        const sanitized = value.replace(/^[a-z]+:\/\//i, '');
        const host = sanitized.split('/')[0];
        return host ? host.toLowerCase() : null;
    }
}
export function isTrustedFrontendHost(value?: string | null): boolean {
    const host = extractHost(value);
    if (!host)
        return false;
    return trustedHosts.has(host);
}
export { trustedHosts as TRUSTED_FRONTEND_HOSTS, extractHost as extractHostFromHeader };
