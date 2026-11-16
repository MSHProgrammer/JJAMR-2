import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { SoundFX } from '../utils/soundFx';

interface AvatarCropperModalProps {
  onSave: (croppedDataUrl: string) => void;
  onClose: () => void;
}

const CROP_VIEW_SIZE = 280;
const EXPORT_SIZE = 256;

export const AvatarCropperModal: React.FC<AvatarCropperModalProps> = ({ onSave, onClose }) => {
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1.1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setImageEl(img);
        setZoom(1.15);
        setOffset({ x: 0, y: 0 });
      };
      img.onerror = () => setError('تعذّر قراءة هذه الصورة، جرب صورة أخرى.');
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageEl) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CROP_VIEW_SIZE, CROP_VIEW_SIZE);
    ctx.fillStyle = '#1E1410';
    ctx.fillRect(0, 0, CROP_VIEW_SIZE, CROP_VIEW_SIZE);

    const baseScale = Math.max(
      CROP_VIEW_SIZE / imageEl.width,
      CROP_VIEW_SIZE / imageEl.height
    );
    const drawW = imageEl.width * baseScale * zoom;
    const drawH = imageEl.height * baseScale * zoom;
    const dx = (CROP_VIEW_SIZE - drawW) / 2 + offset.x;
    const dy = (CROP_VIEW_SIZE - drawH) / 2 + offset.y;

    ctx.drawImage(imageEl, dx, dy, drawW, drawH);

    // Darken outside circular crop mask
    ctx.save();
    ctx.fillStyle = 'rgba(18, 12, 10, 0.58)';
    ctx.beginPath();
    ctx.rect(0, 0, CROP_VIEW_SIZE, CROP_VIEW_SIZE);
    ctx.arc(CROP_VIEW_SIZE / 2, CROP_VIEW_SIZE / 2, CROP_VIEW_SIZE * 0.44, 0, Math.PI * 2, true);
    ctx.fill();

    // Dashed highlight ring
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CROP_VIEW_SIZE / 2, CROP_VIEW_SIZE / 2, CROP_VIEW_SIZE * 0.44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, [imageEl, zoom, offset]);

  const handleConfirmCrop = () => {
    if (!imageEl) {
      setError('اختر صورة من الاستوديو أولاً!');
      return;
    }
    const outCanvas = document.createElement('canvas');
    outCanvas.width = EXPORT_SIZE;
    outCanvas.height = EXPORT_SIZE;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return;

    // Clip to a clean circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(EXPORT_SIZE / 2, EXPORT_SIZE / 2, EXPORT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    const cropDiameter = CROP_VIEW_SIZE * 0.88;
    const ratio = EXPORT_SIZE / cropDiameter;
    const baseScale = Math.max(
      CROP_VIEW_SIZE / imageEl.width,
      CROP_VIEW_SIZE / imageEl.height
    );
    const drawW = imageEl.width * baseScale * zoom * ratio;
    const drawH = imageEl.height * baseScale * zoom * ratio;
    const cropLeft = CROP_VIEW_SIZE / 2 - cropDiameter / 2;
    const dxInView = (CROP_VIEW_SIZE - imageEl.width * baseScale * zoom) / 2 + offset.x;
    const dyInView = (CROP_VIEW_SIZE - imageEl.height * baseScale * zoom) / 2 + offset.y;

    const finalX = (dxInView - cropLeft) * ratio;
    const finalY = (dyInView - cropLeft) * ratio;

    ctx.drawImage(imageEl, finalX, finalY, drawW, drawH);
    ctx.restore();

    const dataUrl = outCanvas.toDataURL('image/png');
    SoundFX.playCorrect();
    onSave(dataUrl);
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[#23140E]/60 backdrop-blur-md p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-3xl bg-white border-2 border-amber-300 shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-amber-200 bg-[#FFF8EE]">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-orange-500" />
            <h2 className="text-base sm:text-lg font-black text-[#23140E]">صورة من الاستوديو (قص دائري)</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white hover:bg-amber-100 border border-amber-200 text-[#5A3E32] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <label className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 border-dashed border-orange-300 bg-[#FFF8EE] hover:bg-amber-50 text-orange-700 font-black text-xs sm:text-sm cursor-pointer">
            <ImagePlus className="w-5 h-5" />
            <span>{imageEl ? 'اختيار صورة أخرى من الاستوديو' : 'اضغط لاختيار صورة من الاستوديو 📱'}</span>
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </label>

          {imageEl ? (
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-[#6B4E40] text-center">
                اسحب الصورة بالإصبع أو الفأرة لتحديد مكان القص داخل الدائرة
              </p>
              <div className="flex justify-center">
                <canvas
                  ref={canvasRef}
                  width={CROP_VIEW_SIZE}
                  height={CROP_VIEW_SIZE}
                  onPointerDown={(e) => {
                    setDragging(true);
                    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
                    (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (!dragging) return;
                    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
                  }}
                  onPointerUp={() => setDragging(false)}
                  onPointerCancel={() => setDragging(false)}
                  className="rounded-2xl border-2 border-amber-300 shadow-inner cursor-grab active:cursor-grabbing touch-none"
                />
              </div>

              <div className="flex items-center gap-3 px-2">
                <ZoomOut className="w-4 h-4 text-[#7C5D4F]" />
                <input
                  type="range"
                  min={0.7}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-orange-500"
                />
                <ZoomIn className="w-4 h-4 text-[#7C5D4F]" />
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1.15);
                    setOffset({ x: 0, y: 0 });
                  }}
                  className="p-1.5 rounded-lg bg-[#FFF8EE] border border-amber-200 text-[#5A3E32] cursor-pointer"
                  title="إعادة التمركز"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="py-10 rounded-2xl bg-[#FFFDF9] border border-amber-100 text-center text-xs text-[#7C5D4F]">
              ستُقص صورتك بشكل دائري متناسق وتظهر لجميع اللاعبين في الغرف والدردشة.
            </div>
          )}

          {error && (
            <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-center">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#FFF8EE] border border-amber-200 text-xs font-black text-[#5A3E32] cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleConfirmCrop}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-orange-500 to-amber-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>اعتماد الصورة المدورة</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
