import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, ImagePlus, X, AlertCircle, ScanLine } from 'lucide-react';
import {
  extractAdminUsernameFromQrPayload,
  extractRoomCodeFromQrPayload,
  extractTvCodeFromQrPayload,
} from '../utils/qrHelper';
import { SoundFX } from '../utils/soundFx';

interface QrScannerModalProps {
  onScannedRoomCode: (roomCode: string) => void;
  onScannedAdminUsername?: (username: string) => void;
  onScannedTvCode?: (tvCode: string) => void;
  onClose: () => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  onScannedRoomCode,
  onScannedAdminUsername,
  onScannedTvCode,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState('');

  const stopCamera = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('متصفحك لا يدعم فتح الكاميرا مباشرة. يمكنك اختيار صورة الكود من الجهاز بالأسفل.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraActive(true);
          scanLoop();
        }
      } catch {
        setError('تعذّر الوصول إلى الكاميرا. اسمح بإذن الكاميرا أو ارفع صورة كود QR من الاستوديو.');
      }
    };

    const scanLoop = () => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2) {
        const w = video.videoWidth || 480;
        const h = video.videoHeight || 480;
        if (w > 0 && h > 0) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const imgData = ctx.getImageData(0, 0, w, h);
            const decoded = jsQR(imgData.data, w, h, { inversionAttempts: 'dontInvert' });
            if (decoded?.data) {
              const tvCode = extractTvCodeFromQrPayload(decoded.data);
              if (tvCode && onScannedTvCode) {
                SoundFX.playCorrect();
                stopCamera();
                onScannedTvCode(tvCode);
                return;
              }
              const adminUser = extractAdminUsernameFromQrPayload(decoded.data);
              if (adminUser && onScannedAdminUsername) {
                SoundFX.playCorrect();
                stopCamera();
                onScannedAdminUsername(adminUser);
                return;
              }
              const roomCode = extractRoomCodeFromQrPayload(decoded.data);
              if (roomCode) {
                SoundFX.playCorrect();
                stopCamera();
                onScannedRoomCode(roomCode);
                return;
              }
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(scanLoop);
    };

    void startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [onScannedRoomCode, onScannedAdminUsername, onScannedTvCode]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height);
        const decoded = jsQR(data.data, img.width, img.height);
        if (decoded?.data) {
          const tvCode = extractTvCodeFromQrPayload(decoded.data);
          if (tvCode && onScannedTvCode) {
            SoundFX.playCorrect();
            stopCamera();
            onScannedTvCode(tvCode);
            return;
          }
          const adminUser = extractAdminUsernameFromQrPayload(decoded.data);
          if (adminUser && onScannedAdminUsername) {
            SoundFX.playCorrect();
            stopCamera();
            onScannedAdminUsername(adminUser);
            return;
          }
          const roomCode = extractRoomCodeFromQrPayload(decoded.data);
          if (roomCode) {
            SoundFX.playCorrect();
            stopCamera();
            onScannedRoomCode(roomCode);
            return;
          }
        }
        SoundFX.playWrong();
        setError('لم يتم العثور على كود غرفة أو شاشة صالح داخل هذه الصورة.');
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[#23140E]/65 backdrop-blur-md p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopCamera();
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md rounded-3xl bg-white border-2 border-amber-300 shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-200 bg-[#FFF8EE]">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-black text-[#23140E]">مسح كود QR للدخول السريع 📷</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 rounded-xl bg-white hover:bg-amber-100 border border-amber-200 text-[#5A3E32] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative aspect-square max-w-[300px] mx-auto rounded-2xl overflow-hidden bg-[#1A100B] border-2 border-amber-300 flex items-center justify-center">
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {cameraActive && (
              <div className="pointer-events-none absolute inset-6 border-2 border-dashed border-orange-400/90 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]" />
            )}
            {!cameraActive && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2 text-xs font-bold">
                <Camera className="w-8 h-8 text-amber-400 animate-pulse" />
                <span>جاري تشغيل الكاميرا...</span>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-bold text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-1 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 rounded-xl bg-[#FFF8EE] hover:bg-amber-100 border border-amber-300 text-[#23140E] font-black text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <ImagePlus className="w-4 h-4 text-orange-500" />
              <span>أو اختر صورة كود QR من الاستوديو 🖼️</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
