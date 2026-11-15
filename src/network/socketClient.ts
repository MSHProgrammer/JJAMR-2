import { BarrahCategory, RoomState } from '../types/jamr';
import { LocalRoomCoordinator } from './LocalRoomCoordinator';

export type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'p2p';

export interface SocketCallbacks {
  onRoomState: (room: RoomState) => void;
  onStatusChange: (status: SocketStatus, isP2P: boolean) => void;
  onError: (msg: string) => void;
  onKicked: () => void;
  onVoiceSignal?: (payload: Record<string, unknown>) => void;
}

const STATIC_HOST_SUFFIXES = ['pages.dev', 'netlify.app', 'github.io'];

export function getOrCreateSessionPlayerId(): string {
  try {
    const existing = window.sessionStorage.getItem('jamr_player_id');
    if (existing) return existing;
    const fresh = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    window.sessionStorage.setItem('jamr_player_id', fresh);
    return fresh;
  } catch {
    return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }
}

export class JamrSocketClient {
  private ws: WebSocket | null = null;
  private p2p: LocalRoomCoordinator | null = null;
  private callbacks: SocketCallbacks;
  private isP2PMode = false;
  private backendAvailable = true;
  private heartbeatTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private pollTimer: number | null = null;
  private connectPromise: Promise<boolean> | null = null;
  private manualClose = false;
  private currentRoomCode: string | null = null;
  private lastKnownName = '';
  private lastKnownAvatar = 'char_01';
  private playerId: string;
  private categories: BarrahCategory[] = [];

  constructor(callbacks: SocketCallbacks) {
    this.callbacks = callbacks;
    this.playerId = getOrCreateSessionPlayerId();
  }

  public getPlayerId(): string {
    return this.playerId;
  }

  public isP2P(): boolean {
    return this.isP2PMode;
  }

  public setCategories(cats: BarrahCategory[]) {
    this.categories = cats;
    this.p2p?.setCategories(cats);
  }

  private shouldForceP2P(): boolean {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname.toLowerCase();
    return STATIC_HOST_SUFFIXES.some((s) => host.endsWith(s));
  }

  private getWsUrl(): string {
    const envUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_WS_URL;
    if (envUrl) return envUrl;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }

  public async connect(): Promise<boolean> {
    this.manualClose = false;

    if (this.shouldForceP2P()) {
      this.activateP2P();
      return true;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.callbacks.onStatusChange('connected', false);
      return true;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.callbacks.onStatusChange('connecting', false);

    this.connectPromise = new Promise<boolean>((resolve) => {
      let settled = false;
      let handshakeTimer: number | null = null;

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (handshakeTimer) {
          clearTimeout(handshakeTimer);
          handshakeTimer = null;
        }
        this.connectPromise = null;
        resolve(ok);
      };

      const url = this.getWsUrl();
      try {
        const ws = new WebSocket(url);
        this.ws = ws;

        // Give Cloud Run / reverse proxies up to 4.5s without killing HTTP fallback
        handshakeTimer = window.setTimeout(() => {
          if (!settled) {
            if (!this.backendAvailable) {
              this.activateP2P();
            } else if (this.currentRoomCode) {
              this.startFallbackPoll();
            }
            finish(false);
          }
        }, 4500);

        ws.onopen = () => {
          this.isP2PMode = false;
          this.backendAvailable = true;
          this.callbacks.onStatusChange('connected', false);
          this.startHeartbeat();
          this.stopFallbackPoll();

          // Bind WebSocket socket meta to current room if user already created/joined via REST
          if (this.currentRoomCode) {
            this.sendWsRaw({
              type: 'join_room',
              roomCode: this.currentRoomCode,
              existingPlayerId: this.playerId,
              playerName: this.lastKnownName || 'لاعب',
              avatar: this.lastKnownAvatar || 'char_01',
            });
          } else {
            // Silently check if there was a saved room in sessionStorage
            try {
              const savedRoom = window.sessionStorage.getItem('jamr_active_room');
              const savedName = window.localStorage.getItem('jamr_player_name');
              const savedAvatar = window.localStorage.getItem('jamr_player_avatar') || 'char_01';
              if (savedRoom && savedName) {
                void this.trySilentRestoreRoom(savedRoom, savedName, savedAvatar);
              }
            } catch {
              // ignore
            }
          }

          finish(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(String(event.data));
            this.handleIncoming(data);
          } catch {
            // ignore malformed JSON
          }
        };

        ws.onclose = () => {
          this.stopHeartbeat();
          if (this.ws === ws) this.ws = null;
          if (!settled) {
            finish(false);
          }
          if (!this.manualClose && !this.isP2PMode) {
            if (this.currentRoomCode) {
              this.callbacks.onStatusChange('connecting', false);
              this.startFallbackPoll();
              this.scheduleReconnect();
            } else {
              this.callbacks.onStatusChange('disconnected', false);
            }
          }
        };

        ws.onerror = () => {
          // Handled via onclose / REST fallback
        };
      } catch {
        finish(false);
      }
    });

    return this.connectPromise;
  }

  private async trySilentRestoreRoom(roomCode: string, playerName: string, avatar: string) {
    try {
      const checkRes = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`, { cache: 'no-store' });
      if (!checkRes.ok) {
        this.clearSavedRoom();
        return;
      }
      const data = await checkRes.json();
      if (data?.ok && data.room) {
        await this.joinRoom({ roomCode, playerName, avatar, silentNotFound: true });
      } else {
        this.clearSavedRoom();
      }
    } catch {
      // ignore silent restore failures
    }
  }

  private activateP2P() {
    this.isP2PMode = true;
    this.stopFallbackPoll();
    if (!this.p2p) {
      this.p2p = new LocalRoomCoordinator((payload) => this.handleIncoming(payload));
      this.p2p.setCategories(this.categories);
    }
    this.callbacks.onStatusChange('p2p', true);
  }

  private sendWsRaw(payload: Record<string, unknown>): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ...payload, playerId: this.playerId }));
      return true;
    }
    return false;
  }

  private bindRoomState(room: RoomState) {
    this.isP2PMode = false;
    this.backendAvailable = true;
    this.currentRoomCode = room.code;
    try {
      window.sessionStorage.setItem('jamr_active_room', room.code);
    } catch {
      // ignore
    }
    this.callbacks.onRoomState(room);

    // Ensure live WebSocket is connected and subscribed to this room for instant push updates
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.callbacks.onStatusChange('connected', false);
      this.stopFallbackPoll();
      this.sendWsRaw({
        type: 'join_room',
        roomCode: room.code,
        existingPlayerId: this.playerId,
        playerName: this.lastKnownName || 'لاعب',
        avatar: this.lastKnownAvatar || 'char_01',
      });
    } else {
      this.startFallbackPoll();
      void this.connect();
    }
  }

  private handleIncoming(data: Record<string, unknown>) {
    const type = String(data.type || '');
    if (type === 'pong') return;
    if (type === 'room_state' && data.room) {
      const room = data.room as RoomState;
      this.currentRoomCode = room.code;
      try {
        window.sessionStorage.setItem('jamr_active_room', room.code);
      } catch {
        // ignore
      }
      this.callbacks.onRoomState(room);
    } else if (type === 'error') {
      this.callbacks.onError(String(data.message || 'حدث خطأ في الغرفة'));
    } else if (type === 'kicked') {
      this.clearSavedRoom();
      this.stopFallbackPoll();
      this.callbacks.onKicked();
    } else if (type === 'voice_signal') {
      this.callbacks.onVoiceSignal?.(data);
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startFallbackPoll() {
    if (this.pollTimer || this.manualClose || this.isP2PMode || !this.currentRoomCode) return;
    this.pollTimer = window.setInterval(async () => {
      if (!this.currentRoomCode || this.manualClose || this.isP2PMode) {
        this.stopFallbackPoll();
        return;
      }
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.stopFallbackPoll();
        return;
      }
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(this.currentRoomCode)}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data?.ok && data.room) {
            this.callbacks.onRoomState(data.room as RoomState);
          }
        }
      } catch {
        // keep polling quietly
      }
    }, 1200);
  }

  private stopFallbackPoll() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.manualClose) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, 2000);
  }

  public clearSavedRoom() {
    this.currentRoomCode = null;
    this.stopFallbackPoll();
    try {
      window.sessionStorage.removeItem('jamr_active_room');
    } catch {
      // ignore
    }
  }

  public async createRoom(params: {
    playerName: string;
    avatar: string;
    gameId: string;
    totalRounds?: number;
    isJudgeRoom?: boolean;
  }) {
    this.lastKnownName = params.playerName;
    this.lastKnownAvatar = params.avatar;

    if (this.shouldForceP2P()) {
      this.activateP2P();
      this.p2p?.createRoom({ ...params, playerId: this.playerId });
      return;
    }

    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: this.playerId,
          ...params,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data?.ok && data.room) {
          this.bindRoomState(data.room as RoomState);
          return;
        }
        this.callbacks.onError(String(data?.error || 'تعذر إنشاء الغرفة.'));
        return;
      }
    } catch {
      // Fall through to WS / P2P if HTTP endpoint is unreachable
    }

    // Secondary attempt over WebSocket if already open
    if (this.sendWsRaw({ type: 'create_room', ...params })) {
      return;
    }

    // Final fallback on static hosts without backend server
    this.backendAvailable = false;
    this.activateP2P();
    this.p2p?.createRoom({ ...params, playerId: this.playerId });
  }

  public async joinRoom(params: {
    roomCode: string;
    playerName: string;
    avatar: string;
    silentNotFound?: boolean;
  }) {
    const cleanCode = params.roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.lastKnownName = params.playerName;
    this.lastKnownAvatar = params.avatar;

    if (this.shouldForceP2P()) {
      this.activateP2P();
      this.p2p?.joinRoom({ roomCode: cleanCode, playerName: params.playerName, avatar: params.avatar, playerId: this.playerId });
      return;
    }

    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: cleanCode,
          existingPlayerId: this.playerId,
          playerName: params.playerName,
          avatar: params.avatar,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data?.ok && data.room) {
          this.bindRoomState(data.room as RoomState);
          return;
        }
        this.clearSavedRoom();
        if (!params.silentNotFound) {
          this.callbacks.onError(String(data?.error || 'رمز الغرفة غير صحيح أو انتهت الجلسة.'));
        }
        return;
      }
    } catch {
      // Fall through if backend unreachable
    }

    if (
      this.sendWsRaw({
        type: 'join_room',
        roomCode: cleanCode,
        existingPlayerId: this.playerId,
        playerName: params.playerName,
        avatar: params.avatar,
      })
    ) {
      return;
    }

    this.backendAvailable = false;
    this.activateP2P();
    this.p2p?.joinRoom({
      roomCode: cleanCode,
      playerName: params.playerName,
      avatar: params.avatar,
      playerId: this.playerId,
    });
  }

  public send(payload: Record<string, unknown>) {
    if (this.isP2PMode && this.p2p) {
      this.p2p.sendAction({ ...payload, playerId: this.playerId });
      return;
    }

    const enriched = {
      ...payload,
      playerId: this.playerId,
      roomCode: payload.roomCode || this.currentRoomCode,
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(enriched));
      return;
    }

    // Reliable REST action fallback if WebSocket is reconnecting or blocked by proxy
    if (enriched.roomCode) {
      void this.sendActionViaHttp(enriched);
    }
  }

  private async sendActionViaHttp(payload: Record<string, unknown>) {
    try {
      const res = await fetch('/api/rooms/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const data = await res.json();
      if (res.ok && data?.ok && data.room) {
        this.callbacks.onRoomState(data.room as RoomState);
      } else if (data?.error) {
        this.callbacks.onError(String(data.error));
      }
    } catch {
      // ignore transient network error
    }
  }

  public leaveRoom() {
    const code = this.currentRoomCode;
    this.clearSavedRoom();
    if (this.isP2PMode && this.p2p) {
      this.p2p.cleanup();
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'leave_room', playerId: this.playerId, roomCode: code }));
    } else if (code) {
      void this.sendActionViaHttp({ type: 'leave_room', playerId: this.playerId, roomCode: code });
    }
  }

  public destroy() {
    this.manualClose = true;
    this.stopHeartbeat();
    this.stopFallbackPoll();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.p2p?.cleanup();
    try {
      this.ws?.close();
    } catch {
      // ignore
    }
    this.ws = null;
  }
}
