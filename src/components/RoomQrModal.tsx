import React, { useEffect, useState } from 'react';
import { QrCode, X, Copy, Check, Download, Sparkles, ArrowLeft, Palette } from 'lucide-react';
import { SoundFX } from '../utils/soundFx';
import {
  buildRoomInviteUrl,
  generateDownloadableQrCardPng,
  generateRoomQrDataUrl,
  QR_COLOR_PRESETS,
  QrColorPresetId,
  sanitizeRoomCode,
} from '../utils/qrHelper';

interface RoomQrModalProps {
  initialRoomCode?: string;
  gameTitle?: string;
  gameIcon?: string;
  onQuickJoinCode?: (code: string) => void;
  onClose: () => void;
}

export const RoomQrModal: React.FC<RoomQrModalProps> = ({
  initialRoomCode = '',
  gameTitle,
  gameIcon,
  onQuickJoinCode,
  onClose,
}) => {
  const [roomCode, setRoomCode] = useState<string>(() => sanitizeRoomCode(initialRoomCode));
  const [presetId, setPresetId] = useState<QrColorPresetId>('classic');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const cleanCode = sanitizeRoomCode(roomCode);
  const activePreset = QR_COLOR_PRESETS.find((p) => p.id === presetId) || QR_COLOR_PRESETS[0];
  const inviteUrl = cleanCode.length >= 4 ? buildRoomInviteUrl(cleanCode) : '';

  useEffect(() => {
    if (initialRoomCode) {
      setRoomCode(sanitizeRoomCode(initialRoomCode));
    }
  }, [initialRoomCode]);

  useEffect(() => {
    let cancelled = false;
    if (cleanCode.length < 4) {
      setQrDataUrl('');
      return;
    }
    void generateRoomQrDataUrl(cleanCode, {
      dark: activePreset.dark,
      light: activePreset.light,
      width: 380,
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [cleanCode, activePreset.dark, activePreset.light]);

  const handleCopyLink = () => {
    if (!inviteUrl) return;
    SoundFX.playClick();
    void navigator.clipboard?.writeText(inviteUrl);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1800);
  };

  const handleCopyCode = () => {
    if (!cleanCode) return;
    SoundFX.playClick();
    void navigator.clipboard?.writeText(cleanCode);
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleDownloadCard = async () => {
    if (cleanCode.length < 4 || downloading) return;
    setDownloading(true);
    SoundFX.playCorrect();
    try {
      const pngUrl = await generateDownloadableQrCardPng({
        roomCode: cleanCode,
        gameTitle: gameTitle ? `${gameIcon || '🔥'} ${gameTitle}` : undefined,
        darkColor: activePreset.dark,
      });
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `jamr-room-${cleanCode}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[#23140E]/60 backdrop-blur-md p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-3xl bg-white border-2 border-amber-300 shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-200 bg-[#FFF8EE]">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="text-lg font-black text-[#23140E]">منشئ QR للدخول السريع 📱</h2>
              {gameTitle && (
                <p className="text-[11px] font-bold text-[#6B4E40]">
                  {gameIcon || '🔥'} {gameTitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white hover:bg-amber-100 border border-amber-200 text-[#5A3E32] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Room Code Input / Display */}
          <div>
            <label className="block text-xs font-black text-[#5A3E32] mb-1.5">
              رمز الغرفة (يتولد الـ QR تلقائياً):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={10}
                value={roomCode}
                onChange={(e) => setRoomCode(sanitizeRoomCode(e.target.value))}
                placeholder="مثال: K7M9P2"
                className="flex-1 rounded-xl bg-[#FFF8EE] border-2 border-amber-200 px-4 py-2.5 text-center text-xl font-black tracking-widest text-orange-600 uppercase focus:outline-none focus:border-orange-500"
              />
              {cleanCode.length >= 4 && (
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-xs font-black text-[#23140E] flex items-center gap-1 cursor-pointer shrink-0"
                  title="نسخ رمز الغرفة"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-orange-500" />}
                  <span>{copiedCode ? 'تم' : 'نسخ'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Color Preset Switcher */}
          <div className="flex items-center justify-between gap-2 flex-wrap bg-[#FFFDF9] border border-amber-200 rounded-2xl px-3.5 py-2.5">
            <span className="text-xs font-black text-[#5A3E32] flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-orange-500" />
              <span>لون الكود:</span>
            </span>
            <div className="flex items-center gap-2">
              {QR_COLOR_PRESETS.map((preset) => {
                const active = preset.id === presetId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      SoundFX.playClick();
                      setPresetId(preset.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black border flex items-center gap-1.5 cursor-pointer transition ${
                      active
                        ? 'border-orange-500 bg-amber-50 text-[#23140E] shadow-xs'
                        : 'border-amber-200 bg-white text-[#6B4E40] hover:bg-amber-50'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                      style={{ backgroundColor: preset.accentHex }}
                    />
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live QR Display */}
          {cleanCode.length >= 4 && qrDataUrl ? (
            <div className="rounded-3xl bg-gradient-to-b from-[#FFF8EE] to-amber-50 border-2 border-amber-300 p-5 text-center space-y-3">
              <div className="relative inline-block bg-white p-3.5 rounded-2xl border-2 border-amber-200 shadow-md">
                <img
                  src={qrDataUrl}
                  alt={`QR للغرفة ${cleanCode}`}
                  className="w-56 h-56 mx-auto rounded-lg"
                />
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF8EE] border border-amber-200 text-xs font-black text-[#23140E] tabular-nums">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                  <span>غرفة: {cleanCode}</span>
                </div>
              </div>
              <p className="text-xs font-bold text-[#5A3E32] leading-relaxed">
                وجّه كاميرا الجوال أو استخدم ماسح الكود في شاشة الانضمام للدخول الفوري بدون كتابة الرمز!
              </p>
            </div>
          ) : (
            <div className="rounded-3xl bg-[#FFF8EE] border-2 border-dashed border-amber-300 py-12 px-6 text-center space-y-2">
              <QrCode className="w-12 h-12 text-amber-400 mx-auto" />
              <div className="text-sm font-black text-[#23140E]">أدخل رمز الغرفة (4 أحرف/أرقام فأكثر)</div>
              <p className="text-xs font-readex text-[#6B4E40]">
                سيتم توليد كود QR جاهز للمسح الفوري ومشاركته مع ربعك فوراً.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          {cleanCode.length >= 4 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCopyLink}
                className="py-3 px-4 rounded-xl bg-[#FFF8EE] hover:bg-amber-100 border border-amber-300 text-[#23140E] font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-orange-500" />}
                <span>{copiedLink ? 'تم نسخ الرابط!' : 'نسخ رابط الدخول'}</span>
              </button>
              <button
                type="button"
                disabled={downloading}
                onClick={() => void handleDownloadCard()}
                className="py-3 px-4 rounded-xl bg-gradient-to-l from-orange-500 to-amber-500 hover:brightness-105 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{downloading ? 'جاري التحميل...' : 'تحميل بطاقة QR ⬇️'}</span>
              </button>
            </div>
          )}

          {onQuickJoinCode && cleanCode.length >= 4 && !initialRoomCode && (
            <button
              type="button"
              onClick={() => {
                SoundFX.playTileSelect();
                onQuickJoinCode(cleanCode);
                onClose();
              }}
              className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>دخول مباشر لهذه الغرفة ({cleanCode})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
