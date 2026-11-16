import React, { useState } from 'react';
import { Palette, RotateCcw, X, Check } from 'lucide-react';
import {
  applyThemeConfig,
  JamrThemeConfig,
  loadThemeConfig,
  resetThemeConfig,
  saveThemeConfig,
  THEME_PRESETS,
} from '../utils/themeManager';
import { SoundFX } from '../utils/soundFx';

interface ThemeCustomizerModalProps {
  onClose: () => void;
}

export const ThemeCustomizerModal: React.FC<ThemeCustomizerModalProps> = ({ onClose }) => {
  const [theme, setTheme] = useState<JamrThemeConfig>(() => loadThemeConfig());

  const updateColor = (key: keyof JamrThemeConfig, value: string) => {
    const next = { ...theme, [key]: value };
    setTheme(next);
    saveThemeConfig(next);
  };

  const applyPreset = (presetTheme: JamrThemeConfig) => {
    SoundFX.playTileSelect();
    setTheme(presetTheme);
    saveThemeConfig(presetTheme);
  };

  const handleReset = () => {
    SoundFX.playClick();
    const fresh = resetThemeConfig();
    setTheme(fresh);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#23140E]/55 backdrop-blur-md p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-3xl bg-white border-2 border-amber-300 shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-200 bg-[#FFF8EE]">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-black text-[#23140E]">تعديل ألوان الموقع 🎨</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              SoundFX.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-white hover:bg-amber-100 border border-amber-200 text-[#5A3E32] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Quick Presets */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-[#5A3E32]">قوالب ألوان جاهزة:</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.theme)}
                  className="p-2.5 rounded-2xl border border-amber-200 hover:border-orange-400 bg-[#FFFDF9] text-right space-y-1.5 cursor-pointer transition"
                >
                  <div className="flex items-center gap-1">
                    <span
                      className="w-4 h-4 rounded-full border border-black/10"
                      style={{ backgroundColor: preset.theme.bg }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-black/10"
                      style={{ backgroundColor: preset.theme.primary }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-black/10"
                      style={{ backgroundColor: preset.theme.accent }}
                    />
                  </div>
                  <div className="text-xs font-black text-[#23140E]">{preset.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Individual Color Pickers */}
          <div className="space-y-2.5">
            <label className="block text-xs font-black text-[#5A3E32]">تخصيص يدوي حر:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'bg' as const, label: 'لون الخلفية العام' },
                { key: 'surface' as const, label: 'لون البطاقات والأسطح' },
                { key: 'primary' as const, label: 'اللون الرئيسي (الأزرار)' },
                { key: 'accent' as const, label: 'اللون التكميلي والوهج' },
                { key: 'text' as const, label: 'لون النصوص الأساسية' },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#FFF8EE] border border-amber-200 cursor-pointer"
                >
                  <span className="text-xs font-bold text-[#23140E]">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-[#6B4E40] uppercase">
                      {theme[item.key]}
                    </span>
                    <input
                      type="color"
                      value={theme[item.key]}
                      onChange={(e) => {
                        updateColor(item.key, e.target.value);
                        applyThemeConfig({ ...theme, [item.key]: e.target.value });
                      }}
                      className="w-8 h-8 rounded-lg border border-amber-300 cursor-pointer bg-transparent"
                    />
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Live Mini Preview */}
          <div
            className="rounded-2xl p-4 border-2 border-amber-200 flex items-center justify-between gap-3"
            style={{ backgroundColor: theme.surface, color: theme.text }}
          >
            <div>
              <div className="text-sm font-black">معاينة فورية لشكل المنصة ✨</div>
              <div className="text-xs opacity-75">التعديلات تُحفظ تلقائياً في متصفحك</div>
            </div>
            <span
              className="px-4 py-2 rounded-xl text-white text-xs font-black shadow-sm"
              style={{
                background: `linear-gradient(to left, ${theme.primary}, ${theme.accent})`,
              }}
            >
              زر تجريبي
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>استعادة ألوان جَمْر الأصلية</span>
            </button>

            <button
              type="button"
              onClick={() => {
                SoundFX.playCorrect();
                onClose();
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-orange-500 to-amber-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>اعتماد وإغلاق</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
