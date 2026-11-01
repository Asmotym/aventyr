/**
 * Utility functions for dynamic URL generation
 */

export const getBackendUrl = (): string => {
  // Use environment variable if available
  if (import.meta.env?.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL
  }

  const protocol = window.location.protocol
  const hostname = window.location.hostname
  const port = import.meta.env?.VITE_BACKEND_PORT || window.location.port
  return `${protocol}//${hostname}${port ? `:${port}` : ''}`
}

export const getRedirectUri = (): string => {
  // Use environment variable if available
  if (import.meta.env?.VITE_DISCORD_REDIRECT_URI) {
    return import.meta.env.VITE_DISCORD_REDIRECT_URI;
  }
  
  // Dynamic redirect URI
  return window.location.origin
}

export const getApiUrl = (endpoint: string): string => {
  return `${getBackendUrl()}/api${endpoint}`
}

export const getRealtimeUrl = (roomId: string): string => {
  const configuredUrl = import.meta.env?.VITE_REALTIME_URL as string | undefined;
  const baseUrl = configuredUrl || getBackendUrl();
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `/ws/rooms/${encodeURIComponent(roomId)}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}
