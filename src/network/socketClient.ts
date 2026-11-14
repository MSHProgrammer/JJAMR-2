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

export class JamrSocketClient {
  private ws: WebSocket | null = null;
  private p2p: LocalRoomCoordinator | null = null;
  private callbacks: SocketCallbacks;
  private isP2PMode = false;
  private heartbeatTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private handshakeTimer: number | null = null;
  private manualClose = false;
  private currentRoomCode: string | null = null;
  private playerId: string;
  private categories: BarrahCategory[] = [];

  constructor(callbacks: SocketCallbacks) {
    this.callbacks = callbacks;
    this.playerId = this.getOrCreatePlayerId();
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

  private getOrCreatePlayerId(): string {
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

  private shouldForceP2P(): boolean {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname.toLowerCase();
    return STATIC_HOST_SUFFIXES.some((s) => host.endsWith(s));
  }

  private getWsUrl(): string {
    const envUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_WS_URL;
    if (envUrl) return envUrl;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }

  public async connect(): Promise<boolean> {
    this.manualClose = false;
    if (this.isP2PMode) {
      this.callbacks.onStatusChange('p2p', true);
      return true;
    }
    if (this.shouldForceP2P()) {
      this.activateP2P();
      return true;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.callbacks.onStatusChange('connected', false);
      return true;
    }

    this.callbacks.onStatusChange('connecting', false);

    return new Promise((resolve) => {
      let settled = false;
      const url = this.getWsUrl();
      try {
        const ws = new WebSocket(url);
        this.ws = ws;

        this.handshakeTimer = window.setTimeout(() => {
          if (!settled) {
            settled = true;
            try {
              ws.close();
            } catch {
              // ignore
            }
            this.activateP2P();
            resolve(true);
          }
        }, 1500);

        ws.onopen = () => {
          if (this.handshakeTimer) {
            clearTimeout(this.handshakeTimer);
            this.handshakeTimer = null;
          }
          settled = true;
          this.isP2PMode = false;
          this.callbacks.onStatusChange('connected', false);
          this.startHeartbeat();

          // Reconnect to active room if stored in sessionStorage
          try {
            const savedRoom = window.sessionStorage.getItem('jamr_active_room');
            const savedName = window.localStorage.getItem('jamr_player_name');
            const savedAvatar = window.localStorage.getItem('jamr_player_avatar') || '🔥';
            if (savedRoom && savedName) {
              this.currentRoomCode = savedRoom;
              this.send({
                type: 'join_room',
                roomCode: savedRoom,
                existingPlayerId: this.playerId,
                playerName: savedName,
                avatar: savedAvatar,
              });
            }
          } catch {
            // ignore
          }
          resolve(true);
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
          if (!settled) {
            settled = true;
            if (this.handshakeTimer) {
              clearTimeout(this.handshakeTimer);
              this.handshakeTimer = null;
            }
            this.activateP2P();
            resolve(true);
            return;
          }
          if (!this.manualClose && !this.isP2PMode) {
            this.callbacks.onStatusChange('disconnected', false);
            if (this.currentRoomCode) {
              this.scheduleReconnect();
            }
          }
        };

        ws.onerror = () => {
          // Handled cleanly by onclose / handshake timeout
        };
      } catch {
        if (!settled) {
          settled = true;
          this.activateP2P();
          resolve(true);
        }
      }
    });
  }

  private activateP2P() {
    this.isP2PMode = true;
    if (!this.p2p) {
      this.p2p = new LocalRoomCoordinator((payload) => this.handleIncoming(payload));
      this.p2p.setCategories(this.categories);
    }
    this.callbacks.onStatusChange('p2p', true);
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

  private scheduleReconnect() {
    if (this.reconnectTimer || this.manualClose) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, 2500);
  }

  public clearSavedRoom() {
    this.currentRoomCode = null;
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
    await this.connect();
    if (this.isP2PMode && this.p2p) {
      this.p2p.createRoom({ ...params, playerId: this.playerId });
      return;
    }
    this.send({
      type: 'create_room',
      playerId: this.playerId,
      ...params,
    });
  }

  public async joinRoom(params: {
    roomCode: string;
    playerName: string;
    avatar: string;
  }) {
    await this.connect();
    if (this.isP2PMode && this.p2p) {
      this.p2p.joinRoom({ ...params, playerId: this.playerId });
      return;
    }
    this.send({
      type: 'join_room',
      existingPlayerId: this.playerId,
      ...params,
    });
  }

  public send(payload: Record<string, unknown>) {
    if (this.isP2PMode && this.p2p) {
      this.p2p.sendAction({ ...payload, playerId: this.playerId });
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ...payload, playerId: this.playerId }));
    }
  }

  public leaveRoom() {
    this.clearSavedRoom();
    if (this.isP2PMode && this.p2p) {
      this.p2p.cleanup();
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'leave_room', playerId: this.playerId }));
    }
  }

  public destroy() {
    this.manualClose = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.handshakeTimer) clearTimeout(this.handshakeTimer);
    this.p2p?.cleanup();
    try {
      this.ws?.close();
    } catch {
      // ignore
    }
    this.ws = null;
  }
}
