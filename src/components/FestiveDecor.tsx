import React from 'react';
import { motion } from 'motion/react';

export const JamrFlameLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 44,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 96 96"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="jamrBadgeBase" x1="12" y1="8" x2="84" y2="88" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#261332" />
        <stop offset="100%" stopColor="#14091D" />
      </linearGradient>
      <linearGradient id="jamrBadgeRim" x1="8" y1="8" x2="88" y2="88" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFB703" />
        <stop offset="55%" stopColor="#FF6B00" />
        <stop offset="100%" stopColor="#E62E1B" />
      </linearGradient>
      <linearGradient id="jamrMainFlame" x1="48" y1="12" x2="48" y2="54" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FF3B1F" />
        <stop offset="48%" stopColor="#FF6B00" />
        <stop offset="100%" stopColor="#FFB703" />
      </linearGradient>
      <linearGradient id="jamrInnerFlame" x1="48" y1="22" x2="48" y2="50" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FF7A00" />
        <stop offset="100%" stopColor="#FFD147" />
      </linearGradient>
      <linearGradient id="jamrWordGrad" x1="20" y1="54" x2="76" y2="74" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FF3B1F" />
        <stop offset="50%" stopColor="#FF7300" />
        <stop offset="100%" stopColor="#FFB703" />
      </linearGradient>
    </defs>

    {/* Crest Background matching the official Jamr charcoal-plum & flame emblem */}
    <rect x="4" y="4" width="88" height="88" rx="24" fill="url(#jamrBadgeBase)" />
    <rect x="5.5" y="5.5" width="85" height="85" rx="22.5" stroke="url(#jamrBadgeRim)" strokeWidth="2.5" />

    {/* Flying Sparks around the flame */}
    <ellipse cx="32" cy="21" rx="1.6" ry="3.2" transform="rotate(-24 32 21)" fill="#FF9E1A" />
    <ellipse cx="64" cy="22" rx="1.6" ry="3.2" transform="rotate(26 64 22)" fill="#FFB703" />
    <ellipse cx="26" cy="31" rx="1.4" ry="2.6" transform="rotate(-38 26 31)" fill="#FF6B00" />
    <ellipse cx="70" cy="33" rx="1.4" ry="2.6" transform="rotate(34 70 33)" fill="#FF5500" />
    <circle cx="38" cy="14" r="1.5" fill="#FFD147" />
    <circle cx="60" cy="15" r="1.4" fill="#FF8C1A" />

    {/* 3-Tongue Flame matching IMG_3936 */}
    <path
      d="M47 12C53 20 55 27 52.5 34C56 30 60 26 60.5 22C64 27 65 34 62 39C65.5 36.5 68 33 68 33C69 40 65 48 56 51H40C31 48 28 38 32 28C34 24 36 22 36 22C36 26 37.5 29 40 31C39.5 23 42.5 16 47 12Z"
      fill="url(#jamrMainFlame)"
    />
    <path
      d="M47.5 23C50.5 29 51 34 49.5 39C52 37 54 34 55 31C57 36 56 44 51 48H44C39 44 38 37 41 31C42.5 34 44.5 35.5 45.5 36.5C45 31 46 27 47.5 23Z"
      fill="url(#jamrInnerFlame)"
    />

    {/* Faceted Dark Charcoal Embers at base of flame */}
    <polygon points="34,51 41,42 48,47 45,53" fill="#2A1A36" stroke="#FF5500" strokeOpacity="0.65" strokeWidth="1" />
    <polygon points="45,53 50,41 59,46 55,53" fill="#1E1128" stroke="#FF6B00" strokeOpacity="0.7" strokeWidth="1" />
    <polygon points="55,53 60,46 66,49 61,53" fill="#321A2A" stroke="#E62E1B" strokeOpacity="0.8" strokeWidth="1" />
    <polygon points="40,52 46,48 52,52" fill="#FF4D1C" fillOpacity="0.85" />

    {/* Stylized "جمر" Wordmark */}
    <text
      x="48"
      y="72"
      textAnchor="middle"
      fill="url(#jamrWordGrad)"
      fontSize="24"
      fontWeight="900"
      fontFamily="Alexandria, sans-serif"
    >
      جمر
    </text>

    {/* Curved Flame Swoosh underneath */}
    <path d="M24 79 Q48 72 72 79" stroke="url(#jamrBadgeRim)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
  </svg>
);

export const FestiveHeroArtwork: React.FC = () => (
  <div className="relative w-full max-w-[350px] mx-auto select-none pointer-events-none" aria-hidden="true">
    <motion.svg
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      viewBox="0 0 360 260"
      fill="none"
      className="w-full h-auto drop-shadow-[0_16px_30px_rgba(255,107,0,0.22)]"
    >
      <defs>
        <radialGradient id="sunCelebrationGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFE082" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#FFD2A6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#FFFBF5" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="crestOuterFrame" x1="70" y1="30" x2="290" y2="230" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFB703" />
          <stop offset="50%" stopColor="#FF6B00" />
          <stop offset="100%" stopColor="#E62E1B" />
        </linearGradient>
        <linearGradient id="crestDarkBg" x1="180" y1="34" x2="180" y2="224" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#261332" />
          <stop offset="100%" stopColor="#13081C" />
        </linearGradient>
        <linearGradient id="heroFlameGrad" x1="180" y1="44" x2="180" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF3B1F" />
          <stop offset="48%" stopColor="#FF6B00" />
          <stop offset="100%" stopColor="#FFB703" />
        </linearGradient>
        <linearGradient id="heroInnerFlameGrad" x1="180" y1="68" x2="180" y2="122" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF8800" />
          <stop offset="100%" stopColor="#FFE169" />
        </linearGradient>
        <linearGradient id="heroWordmarkGrad" x1="115" y1="135" x2="245" y2="178" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E62E1B" />
          <stop offset="45%" stopColor="#FF6B00" />
          <stop offset="100%" stopColor="#FFB703" />
        </linearGradient>
      </defs>

      {/* Joyful Sunlight Halo & Festive Bunting */}
      <circle cx="180" cy="130" r="122" fill="url(#sunCelebrationGlow)" />
      <circle cx="180" cy="130" r="108" stroke="#FF8C1A" strokeOpacity="0.28" strokeWidth="2" strokeDasharray="7 7" />

      {/* Festive Side Game Cards */}
      <rect x="28" y="84" width="66" height="86" rx="16" transform="rotate(-14 28 84)" fill="#FFFFFF" stroke="#FFB703" strokeWidth="3" />
      <text x="55" y="135" fontSize="28" textAnchor="middle" transform="rotate(-14 55 135)">📺</text>

      <rect x="266" y="72" width="66" height="86" rx="16" transform="rotate(14 266 72)" fill="#FFFFFF" stroke="#FF6B00" strokeWidth="3" />
      <text x="293" y="128" fontSize="28" textAnchor="middle" transform="rotate(14 293 128)">🕵️</text>

      {/* Celebratory Confetti Sparks */}
      <motion.g
        animate={{ y: [0, -5, 0] }}
        transition={{ repeat: Infinity, duration: 3.4, ease: 'easeInOut' }}
      >
        <path d="M52 46 L56 54 L64 56 L56 58 L52 66 L48 58 L40 56 L48 54Z" fill="#FFB703" />
        <path d="M308 42 L311 49 L318 51 L311 53 L308 60 L305 53 L298 51 L305 49Z" fill="#E62E1B" />
        <rect x="44" y="198" width="14" height="6" rx="3" transform="rotate(-24 44 198)" fill="#0D9488" />
        <rect x="298" y="192" width="14" height="6" rx="3" transform="rotate(24 298 192)" fill="#FFB703" />
        <circle cx="72" cy="224" r="5" fill="#FF6B00" />
        <circle cx="288" cy="222" r="5" fill="#10B981" />
      </motion.g>

      {/* Main Official Jamr Logo Crest Badge (Matching IMG_3936) */}
      <rect x="82" y="28" width="196" height="202" rx="34" fill="url(#crestDarkBg)" stroke="url(#crestOuterFrame)" strokeWidth="4.5" />

      {/* Flame Sparks */}
      <ellipse cx="144" cy="64" rx="2.2" ry="5" transform="rotate(-24 144 64)" fill="#FFB703" />
      <ellipse cx="218" cy="66" rx="2.2" ry="5" transform="rotate(26 218 66)" fill="#FF9E1A" />
      <ellipse cx="132" cy="84" rx="1.8" ry="4" transform="rotate(-40 132 84)" fill="#FF6B00" />
      <ellipse cx="228" cy="86" rx="1.8" ry="4" transform="rotate(36 228 86)" fill="#E62E1B" />
      <circle cx="158" cy="49" r="2.2" fill="#FFD147" />
      <circle cx="206" cy="52" r="2" fill="#FF8C1A" />

      {/* 3-Tongue Flame */}
      <path
        d="M177 45C187 58 190 71 185 83C191 77 198 70 199 63C205 71 206 83 201 92C207 88 212 82 212 82C213 96 205 110 191 114H166C151 110 144 92 152 74C155 67 160 63 160 63C159 71 162 76 167 80C165 66 170 54 177 45Z"
        fill="url(#heroFlameGrad)"
      />
      <path
        d="M178 65C183 75 184 84 181 93C185 89 189 84 191 78C194 87 192 101 184 109H173C164 101 162 88 167 78C170 83 173 86 175 88C174 79 175 71 178 65Z"
        fill="url(#heroInnerFlameGrad)"
      />

      {/* Faceted Glowing Charcoal Embers */}
      <polygon points="154,115 166,99 178,108 173,118" fill="#2A1A36" stroke="#FF5500" strokeOpacity="0.7" strokeWidth="1.2" />
      <polygon points="172,118 182,97 197,107 190,118" fill="#1B1024" stroke="#FF6B00" strokeOpacity="0.75" strokeWidth="1.2" />
      <polygon points="190,118 199,106 209,112 200,118" fill="#321A2A" stroke="#E62E1B" strokeOpacity="0.85" strokeWidth="1.2" />
      <polygon points="165,117 176,110 186,117" fill="#FF5500" fillOpacity="0.9" />

      {/* Calligraphic "جمر" Wordmark */}
      <text
        x="180"
        y="167"
        textAnchor="middle"
        fill="url(#heroWordmarkGrad)"
        fontSize="54"
        fontWeight="900"
        fontFamily="Alexandria, sans-serif"
      >
        جمر
      </text>

      {/* Curved Swoosh & Subtitle matching IMG_3936 */}
      <path d="M116 179 Q180 165 244 179" stroke="url(#crestOuterFrame)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <text
        x="180"
        y="196"
        textAnchor="middle"
        fill="#FFFBF5"
        fontSize="13.5"
        fontWeight="800"
        fontFamily="Alexandria, sans-serif"
      >
        — ولّع جمعتكم —
      </text>

      {/* Bottom Three Gaming Icons (👥 | 🎮 | 🃏) */}
      <g fill="#E62E1B" fontSize="13" textAnchor="middle">
        <text x="150" y="216">👥</text>
        <line x1="164" y1="206" x2="164" y2="217" stroke="#FF6B00" strokeOpacity="0.45" strokeWidth="1.2" />
        <text x="180" y="216">🎮</text>
        <line x1="196" y1="206" x2="196" y2="217" stroke="#FF6B00" strokeOpacity="0.45" strokeWidth="1.2" />
        <text x="210" y="216">🃏</text>
      </g>
    </motion.svg>
  </div>
);

export const FestiveGarlandStrip: React.FC = () => (
  <div className="w-full overflow-hidden pointer-events-none select-none opacity-85" aria-hidden="true">
    <svg viewBox="0 0 1200 36" className="w-full h-7 sm:h-8" preserveAspectRatio="none">
      <path d="M0 4 Q150 28 300 6 T600 6 T900 6 T1200 6" stroke="#FF8C1A" strokeOpacity="0.38" strokeWidth="2" fill="none" />
      {[
        { x: 60, c: '#FF6B00' },
        { x: 140, c: '#FFB703' },
        { x: 220, c: '#E62E1B' },
        { x: 360, c: '#0D9488' },
        { x: 440, c: '#FFB703' },
        { x: 520, c: '#FF6B00' },
        { x: 660, c: '#E62E1B' },
        { x: 740, c: '#FFB703' },
        { x: 820, c: '#10B981' },
        { x: 960, c: '#FF6B00' },
        { x: 1040, c: '#E62E1B' },
        { x: 1120, c: '#FFB703' },
      ].map((p, idx) => (
        <polygon
          key={idx}
          points={`${p.x - 10},12 ${p.x + 10},12 ${p.x},29`}
          fill={p.c}
          fillOpacity="0.82"
        />
      ))}
    </svg>
  </div>
);
