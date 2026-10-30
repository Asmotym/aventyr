import type { RoomRealtimeEvent, RoomRealtimeStatus } from 'netlify/core/types/data.types';
import type { DiscordAuth } from 'netlify/core/types/discord.types';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import { getRealtimeUrl } from 'modules/discord-auth/utils/urls.utils';

interface RoomRealtimeCallbacks {
  onEvent: (event: RoomRealtimeEvent) => void;
  onStatus: (status: RoomRealtimeStatus) => void;
  onReady: (reconnected: boolean) => void;
  onTerminalClose: (code: number) => void;
}

const MAX_RECONNECT_DELAY_MS = 30_000;

export class RoomRealtimeService {
  private socket: WebSocket | null = null;
  private roomId: string | null = null;
  private callbacks: RoomRealtimeCallbacks | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private hasConnected = false;
  private generation = 0;

  connect(roomId: string, callbacks: RoomRealtimeCallbacks): void {
    this.disconnect();
    this.roomId = roomId;
    this.callbacks = callbacks;
    this.hasConnected = false;
    this.reconnectAttempt = 0;
    this.open(false, ++this.generation);
  }

  sendBagPresence(frame: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ ...frame, type: 'bag.presence' }));
  }
  disconnect(): void {
    this.generation += 1;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    this.roomId = null;
    socket?.close(1000, 'Room changed');
    this.callbacks?.onStatus('disconnected');
    this.callbacks = null;
  }

  private open(reconnecting: boolean, generation: number): void {
    if (!this.roomId || !this.callbacks || generation !== this.generation) return;
    this.callbacks.onStatus(reconnecting ? 'reconnecting' : 'connecting');

    const socket = new WebSocket(getRealtimeUrl(this.roomId));
    this.socket = socket;

    socket.addEventListener('open', async () => {
      if (socket !== this.socket || generation !== this.generation) return;
      let authentication: DiscordAuth | null;
      try {
        authentication = await DiscordService.getInstance().getValidAuth();
      } catch {
        socket.close(4001, 'Authentication refresh failed');
        return;
      }
      if (socket !== this.socket || generation !== this.generation) return;
      if (!authentication) {
        socket.close(4001, 'Authentication unavailable');
        return;
      }
      socket.send(JSON.stringify({
        type: 'authenticate',
        tokenType: authentication.tokenType,
        accessToken: authentication.accessToken
      }));
    });

    socket.addEventListener('message', (message) => {
      if (socket !== this.socket || generation !== this.generation) return;
      const event = parseRoomEvent(message.data);
      if (!event || event.roomId !== this.roomId) return;
      if (event.type === 'connection.ready') {
        const reconnectedConnection = this.hasConnected;
        this.hasConnected = true;
        this.reconnectAttempt = 0;
        this.callbacks?.onStatus('connected');
        this.callbacks?.onReady(reconnectedConnection);
        return;
      }
      this.callbacks?.onEvent(event);
    });

    socket.addEventListener('close', (event) => {
      if (socket !== this.socket || generation !== this.generation) return;
      this.socket = null;
      if (event.code === 4003 || event.code === 4004) {
        this.callbacks?.onStatus('disconnected');
        this.callbacks?.onTerminalClose(event.code);
        return;
      }
      this.scheduleReconnect(generation);
    });

    socket.addEventListener('error', () => {
      if (socket === this.socket) socket.close();
    });
  }

  private scheduleReconnect(generation: number): void {
    if (!this.roomId || !this.callbacks || generation !== this.generation) return;
    this.callbacks.onStatus('reconnecting');
    const baseDelay = Math.min(MAX_RECONNECT_DELAY_MS, 1_000 * (2 ** this.reconnectAttempt));
    const jitteredDelay = Math.round(baseDelay * (0.8 + Math.random() * 0.4));
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.open(true, generation);
    }, jitteredDelay);
  }
}

function parseRoomEvent(value: unknown): RoomRealtimeEvent | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as Partial<RoomRealtimeEvent>;
    if (
      typeof parsed.type !== 'string'
      || typeof parsed.eventId !== 'string'
      || typeof parsed.roomId !== 'string'
      || typeof parsed.occurredAt !== 'string'
    ) {
      return null;
    }
    return parsed as RoomRealtimeEvent;
  } catch {
    return null;
  }
}
