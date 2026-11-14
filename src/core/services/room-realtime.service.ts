import type { BagScope, BagSnapshot, BagPresenceFrame } from 'netlify/core/types/bag.types';
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
  constructor(private readonly devBagUserId?: string) {}
  private socket: WebSocket | null = null;
  private roomId: string | null = null;
  private callbacks: RoomRealtimeCallbacks | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private hasConnected = false;
  private generation = 0;
  private authenticated = false;
  private bagTargetUserId: string | undefined;
  private bagScope: BagScope | null = null;
  private bagPresence: Omit<BagPresenceFrame, 'type'> | null = null;
  private bagRead: { scope: BagScope; requestId: string; promise: Promise<BagSnapshot>; resolve: (snapshot: BagSnapshot) => void; reject: (error: Error) => void; timer: number } | null = null;
  private bagRequestSequence = 0;

  connect(roomId: string, callbacks: RoomRealtimeCallbacks): void {
    this.disconnect();
    this.roomId = roomId;
    this.callbacks = callbacks;
    this.hasConnected = false;
    this.reconnectAttempt = 0;
    this.open(false, ++this.generation);
  }

  subscribeBag(scope: BagScope, targetUserId?: string): Promise<BagSnapshot> {
    if (this.bagRead?.scope === scope && this.bagTargetUserId === targetUserId) return this.bagRead.promise;
    this.rejectBagRead(new Error('Bag scope changed'));
    if (this.bagTargetUserId !== targetUserId || targetUserId) this.bagPresence = null;
    this.bagTargetUserId = targetUserId;
    this.bagScope = scope;
    if (this.bagPresence?.scope !== scope) this.bagPresence = null;
    const requestId = `${this.generation}-${++this.bagRequestSequence}`;
    let resolve!: (snapshot: BagSnapshot) => void, reject!: (error: Error) => void;
    const promise = new Promise<BagSnapshot>((accept, fail) => { resolve = accept; reject = fail; });
    const timer = window.setTimeout(() => this.rejectBagRead(new Error('Bag connection timed out. It will synchronize when the connection recovers.')), 15_000);
    this.bagRead = { scope, requestId, promise, resolve, reject, timer };
    this.sendBagFrame({ type: 'bag.subscribe', scope, targetUserId, requestId });
    return promise;
  }
  unsubscribeBag(): void {
    this.bagTargetUserId = undefined;
    this.bagScope = null;
    this.bagPresence = null;
    this.rejectBagRead(new Error('Bag closed'));
    this.sendBagFrame({ type: 'bag.unsubscribe' });
  }
  sendBagPresence(frame: Omit<BagPresenceFrame, 'type'>): void {
    if (this.bagTargetUserId) return;
    this.bagPresence = frame.state === 'closed' ? null : frame;
    this.sendBagFrame({ ...frame, type: 'bag.presence' });
  }
  private sendBagFrame(frame: object): void {
    if (this.authenticated && this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(frame));
  }
  private rejectBagRead(error: Error): void {
    const pending = this.bagRead;
    this.bagRead = null;
    if (pending) { window.clearTimeout(pending.timer); pending.reject(error); }
  }
  disconnect(): void {
    this.authenticated = false;
    this.bagTargetUserId = undefined;
    this.bagScope = null;
    this.bagPresence = null;
    this.rejectBagRead(new Error('Room connection changed'));
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

    this.authenticated = false;
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
        accessToken: authentication.accessToken,
        ...(import.meta.env?.DEV && this.devBagUserId ? { devBagUserId: this.devBagUserId } : {})
      }));
    });

    socket.addEventListener('message', (message) => {
      if (socket !== this.socket || generation !== this.generation) return;
      const event = parseRoomEvent(message.data);
      if (!event || event.roomId !== this.roomId) return;
      if (event.type === 'connection.ready') {
        this.authenticated = true;
        if (this.bagScope) {
          this.sendBagFrame({ type: 'bag.subscribe', scope: this.bagScope, targetUserId: this.bagTargetUserId, requestId: this.bagRead?.requestId });
          if (this.bagPresence?.scope === this.bagScope) this.sendBagFrame({ ...this.bagPresence, type: 'bag.presence' });
        }
        const reconnectedConnection = this.hasConnected;
        this.hasConnected = true;
        this.reconnectAttempt = 0;
        this.callbacks?.onStatus('connected');
        this.callbacks?.onReady(reconnectedConnection);
        return;
      }
      if (event.type === 'bag.snapshot' && this.bagRead && event.requestId === this.bagRead.requestId && event.snapshot.scope === this.bagRead.scope && event.snapshot.targetUserId === this.bagTargetUserId) {
        const pending = this.bagRead;
        this.bagRead = null;
        window.clearTimeout(pending.timer);
        pending.resolve(event.snapshot);
      } else if (event.type === 'bag.error' && event.requestId === this.bagRead?.requestId) {
        this.rejectBagRead(new Error(event.message));
      }
      this.callbacks?.onEvent(event);
    });

    socket.addEventListener('close', (event) => {
      if (socket !== this.socket || generation !== this.generation) return;
      this.socket = null;
      this.authenticated = false;
      if (event.code === 4003 || event.code === 4004) {
        this.rejectBagRead(new Error('Room access ended'));
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
