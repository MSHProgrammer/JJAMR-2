import QRCode from 'qrcode';

export type QrColorPresetId = 'classic' | 'jamr_orange' | 'teal' | 'royal';

export interface QrColorPreset {
  id: QrColorPresetId;
  label: string;
  dark: string;
  light: string;
  accentHex: string;
}

export const QR_COLOR_PRESETS: QrColorPreset[] = [
  { id: 'classic', label: 'كلاسيكي', dark: '#23140E', light: '#FFFFFF', accentHex: '#23140E' },
  { id: 'jamr_orange', label: 'نار جَمْر', dark: '#C2410C', light: '#FFFFFF', accentHex: '#EA580C' },
  { id: 'teal', label: 'فيروزي', dark: '#0F766E', light: '#FFFFFF', accentHex: '#0D9488' },
  { id: 'royal', label: 'ملكي', dark: '#6D28D9', light: '#FFFFFF', accentHex: '#7C3AED' },
];

export function sanitizeRoomCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

export function buildRoomInviteUrl(roomCode: string): string {
  const clean = sanitizeRoomCode(roomCode);
  if (typeof window === 'undefined') return `?room=${clean}`;
  return `${window.location.origin}/?room=${encodeURIComponent(clean)}`;
}

export function extractRoomCodeFromQrPayload(rawPayload: string): string | null {
  const trimmed = String(rawPayload || '').trim();
  if (!trimmed) return null;

  try {
    const parsedUrl = new URL(trimmed);
    const paramCode = parsedUrl.searchParams.get('room') || parsedUrl.searchParams.get('code');
    if (paramCode) {
      const clean = sanitizeRoomCode(paramCode);
      if (clean.length >= 4) return clean;
    }
  } catch {
    // Not a full URL; check query pattern or bare code below
  }

  const queryMatch = trimmed.match(/[?&](?:room|code)=([A-Za-z0-9]{4,12})/i);
  if (queryMatch?.[1]) {
    return sanitizeRoomCode(queryMatch[1]);
  }

  const bareCode = sanitizeRoomCode(trimmed);
  if (bareCode.length >= 4 && bareCode.length <= 10 && /^[A-Z0-9]+$/.test(trimmed.trim().toUpperCase())) {
    return bareCode;
  }

  return null;
}

export function extractAdminQrTokenFromPayload(rawPayload: string): string | null {
  const trimmed = String(rawPayload || '').trim();
  if (!trimmed) return null;
  try {
    const parsedUrl = new URL(trimmed);
    const tok = parsedUrl.searchParams.get('claim_qr') || parsedUrl.searchParams.get('qr_token');
    if (tok && tok.trim().length >= 4) return tok.trim();
  } catch {
    // ignore URL parse error
  }
  const m = trimmed.match(/[?&](?:claim_qr|qr_token)=([a-zA-Z0-9_-]{4,80})/i);
  if (m?.[1]) return m[1];
  if (/^(?:jqr_|qr_)[a-zA-Z0-9_-]{4,80}$/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export function extractAdminUsernameFromQrPayload(rawPayload: string): string | null {
  const trimmed = String(rawPayload || '').trim();
  if (!trimmed) return null;
  try {
    const parsedUrl = new URL(trimmed);
    const param =
      parsedUrl.searchParams.get('assign_username') ||
      parsedUrl.searchParams.get('claim_username') ||
      parsedUrl.searchParams.get('admin_user') ||
      parsedUrl.searchParams.get('username') ||
      parsedUrl.searchParams.get('u');
    if (param) {
      const clean = param.trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
      if (clean.length >= 1) return clean;
    }
  } catch {
    // ignore URL parse error
  }
  const m = trimmed.match(/(?:assign_username|claim_username|admin_user|jamr:\/\/user\/)=?([a-zA-Z0-9_]{1,20})/i);
  if (m?.[1]) return m[1].toLowerCase();
  if (trimmed.startsWith('@') && /^[a-zA-Z0-9_]{1,20}$/.test(trimmed.slice(1))) {
    return trimmed.slice(1).toLowerCase();
  }
  return null;
}

export function extractTvCodeFromQrPayload(rawPayload: string): string | null {
  const trimmed = String(rawPayload || '').trim();
  if (!trimmed) return null;
  try {
    const parsedUrl = new URL(trimmed);
    const param = parsedUrl.searchParams.get('tv') || parsedUrl.searchParams.get('tvCode');
    if (param) {
      const clean = param.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (clean.startsWith('TV') && clean.length >= 5) return clean;
    }
  } catch {
    // ignore
  }
  const m = trimmed.match(/[?&](?:tv|tvCode)=(TV[A-Z0-9]{3,8})/i) || trimmed.match(/^(TV[A-Z0-9]{4,8})$/i);
  return m?.[1] ? m[1].toUpperCase() : null;
}

export function buildTvPairUrl(tvCode: string): string {
  const clean = tvCode.trim().toUpperCase();
  if (typeof window === 'undefined') return `?tv=${clean}`;
  return `${window.location.origin}/?tv=${encodeURIComponent(clean)}`;
}

export async function generateLuxuryGoldQrDataUrl(payloadUrl: string, width = 420): Promise<string> {
  return QRCode.toDataURL(payloadUrl, {
    width,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#FBBF24',
      light: '#0C0906',
    },
  });
}

export async function generateRoomQrDataUrl(
  roomCode: string,
  options?: { dark?: string; light?: string; width?: number }
): Promise<string> {
  const url = buildRoomInviteUrl(roomCode);
  return QRCode.toDataURL(url, {
    width: options?.width ?? 360,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: options?.dark ?? '#23140E',
      light: options?.light ?? '#FFFFFF',
    },
  });
}

export async function generateDownloadableQrCardPng(params: {
  roomCode: string;
  gameTitle?: string;
  darkColor?: string;
}): Promise<string> {
  const cleanCode = sanitizeRoomCode(params.roomCode);
  const qrDataUrl = await generateRoomQrDataUrl(cleanCode, {
    dark: params.darkColor || '#23140E',
    light: '#FFFFFF',
    width: 440,
  });

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  if (!ctx) return qrDataUrl;

  // Warm JAMR gradient background
  const grad = ctx.createLinearGradient(0, 0, 640, 800);
  grad.addColorStop(0, '#FFF8EE');
  grad.addColorStop(1, '#FFEDD5');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 640, 800);

  // Outer card border
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FDBA74';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(36, 36, 568, 728, 36);
  ctx.fill();
  ctx.stroke();

  // Header brand
  ctx.fillStyle = '#EA580C';
  ctx.font = '900 38px Alexandria, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🔥 جَمْر | JAMR', 320, 102);

  if (params.gameTitle) {
    ctx.fillStyle = '#5A3E32';
    ctx.font = '700 24px Alexandria, sans-serif';
    ctx.fillText(params.gameTitle, 320, 144);
  }

  // Draw QR code image
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = qrDataUrl;
  });

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FED7AA';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(96, 175, 448, 448, 24);
  ctx.fill();
  ctx.stroke();

  ctx.drawImage(img, 108, 187, 424, 424);

  // Room Code badge
  ctx.fillStyle = '#23140E';
  ctx.font = '900 44px monospace';
  ctx.fillText(cleanCode, 320, 682);

  ctx.fillStyle = '#7C5D4F';
  ctx.font = '700 20px Alexandria, sans-serif';
  ctx.fillText('امسح الكود بكاميرا جوالك للدخول الفوري للغرفة', 320, 726);

  return canvas.toDataURL('image/png');
}
