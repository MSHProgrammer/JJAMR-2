import React, { useRef, useState } from 'react';
import {
  LayoutGrid,
  Link2,
  Plus,
  StickyNote,
  Trash2,
  Unlink2,
} from 'lucide-react';
import type {
  DetectiveBoardLink,
  DetectiveBoardNode,
  DetectiveCasePublic,
  DetectivePlayerCaseProgress,
} from '../../../types/detective.ts';

interface DetectiveCorkboardProps {
  caseData: DetectiveCasePublic;
  progress: DetectivePlayerCaseProgress;
  onUpdateBoard: (nodes: DetectiveBoardNode[], links: DetectiveBoardLink[]) => void;
  onUpdateNotes: (notes: string) => void;
}

export const DetectiveCorkboard: React.FC<DetectiveCorkboardProps> = ({
  caseData,
  progress,
  onUpdateBoard,
  onUpdateNotes,
}) => {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [linkLabel, setLinkLabel] = useState('رابط حاسم');
  const [noteInput, setNoteInput] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);

  const nodes = progress.boardNodes || [];
  const links = progress.boardLinks || [];

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingNodeId || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const xPct = Math.max(8, Math.min(90, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(10, Math.min(88, ((e.clientY - rect.top) / rect.height) * 100));

    const updated = nodes.map((n) =>
      n.id === draggingNodeId ? { ...n, x: Math.round(xPct), y: Math.round(yPct) } : n
    );
    onUpdateBoard(updated, links);
  };

  const handlePointerUp = () => {
    setDraggingNodeId(null);
  };

  const handleNodeClickForLink = (nodeId: string) => {
    if (!linkSourceId) {
      setLinkSourceId(nodeId);
      return;
    }
    if (linkSourceId === nodeId) {
      setLinkSourceId(null);
      return;
    }
    const alreadyExists = links.some(
      (l) =>
        (l.fromNodeId === linkSourceId && l.toNodeId === nodeId) ||
        (l.fromNodeId === nodeId && l.toNodeId === linkSourceId)
    );
    if (!alreadyExists) {
      const newLink: DetectiveBoardLink = {
        id: `lnk_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        fromNodeId: linkSourceId,
        toNodeId: nodeId,
        label: linkLabel.trim() || 'رابط',
      };
      onUpdateBoard(nodes, [...links, newLink]);
    }
    setLinkSourceId(null);
  };

  const addCustomNoteNode = () => {
    const clean = noteInput.trim();
    if (!clean) return;
    const newNode: DetectiveBoardNode = {
      id: `note_${Date.now()}`,
      kind: 'note',
      refId: `note_${Date.now()}`,
      title: clean.slice(0, 80),
      subtitle: 'ملاحظة محقق',
      x: 20 + ((nodes.length * 17) % 60),
      y: 22 + ((nodes.length * 19) % 55),
    };
    onUpdateBoard([...nodes, newNode], links);
    setNoteInput('');
  };

  const addCaseItemNode = (
    kind: DetectiveBoardNode['kind'],
    refId: string,
    title: string,
    subtitle: string
  ) => {
    if (nodes.some((n) => n.kind === kind && n.refId === refId)) return;
    const newNode: DetectiveBoardNode = {
      id: `node_${kind}_${refId}`,
      kind,
      refId,
      title,
      subtitle,
      x: 15 + ((nodes.length * 21) % 68),
      y: 18 + ((nodes.length * 18) % 60),
    };
    onUpdateBoard([...nodes, newNode], links);
  };

  const removeNode = (nodeId: string) => {
    onUpdateBoard(
      nodes.filter((n) => n.id !== nodeId),
      links.filter((l) => l.fromNodeId !== nodeId && l.toNodeId !== nodeId)
    );
    if (linkSourceId === nodeId) setLinkSourceId(null);
  };

  const removeLink = (linkId: string) => {
    onUpdateBoard(
      nodes,
      links.filter((l) => l.id !== linkId)
    );
  };

  const autoArrangeNodes = () => {
    const cols = Math.max(2, Math.min(4, Math.ceil(Math.sqrt(nodes.length))));
    const arranged = nodes.map((n, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = 16 + col * Math.floor(72 / Math.max(1, cols - 1));
      const y = 20 + row * 28;
      return {
        ...n,
        x: Math.max(10, Math.min(88, x)),
        y: Math.max(14, Math.min(84, y)),
      };
    });
    onUpdateBoard(arranged, links);
  };

  const discoveredEvidence = caseData.evidence.filter((e) =>
    progress.savedEvidenceIds.includes(e.id)
  );

  const kindStyle = (kind: DetectiveBoardNode['kind']) => {
    switch (kind) {
      case 'suspect':
        return {
          badge: 'مشتبه به',
          card: 'bg-[#261417] border-[#B8333C]/70 text-[#F3EFE6]',
          pin: 'bg-[#B8333C]',
        };
      case 'evidence':
        return {
          badge: 'دليل',
          card: 'bg-[#E8DEC8] border-[#9C7932] text-[#251B12]',
          pin: 'bg-[#C89B3C]',
        };
      case 'timeline':
        return {
          badge: 'توقيت',
          card: 'bg-[#191B24] border-[#5B6C8F] text-[#F3EFE6]',
          pin: 'bg-[#5B6C8F]',
        };
      default:
        return {
          badge: 'ملاحظة',
          card: 'bg-[#2B2414] border-[#C89B3C]/60 text-[#F5E7C3]',
          pin: 'bg-[#E5C16C]',
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-[#131217] border border-[#C89B3C]/30 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-base text-[#F3EFE6] flex items-center gap-2">
            <Link2 size={18} className="text-[#B8333C]" />
            لوحة التحقيق والخيوط الحمراء
          </h3>
          <p className="text-[11px] text-[#9FA3AE]">
            اسحب البطاقات لترتيبها، واضغط «ربط خيط» بين بطاقتين لمد الخيط الأحمر بينهما
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddMenu((v) => !v)}
            className="bg-[#7A1219] hover:bg-[#961820] text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5"
          >
            <Plus size={14} />
            إضافة للوحة
          </button>
          <button
            type="button"
            onClick={autoArrangeNodes}
            className="bg-[#1E1714] hover:bg-[#2B201C] text-[#E5C16C] border border-[#C89B3C]/35 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <LayoutGrid size={14} />
            ترتيب تلقائي
          </button>
        </div>
      </div>

      {/* Quick Pinning Drawer */}
      {showAddMenu && (
        <div className="bg-[#131217] border border-[#C89B3C]/35 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="اكتب ملاحظة جديدة لتثبيتها على اللوحة..."
              className="flex-1 min-w-[200px] bg-[#0D0C10] border border-white/10 focus:border-[#C89B3C] rounded-xl px-3 py-2 text-xs text-[#F3EFE6] outline-none"
            />
            <button
              type="button"
              onClick={addCustomNoteNode}
              className="bg-[#C89B3C] text-[#09080A] px-4 py-2 rounded-xl text-xs font-black"
            >
              تثبيت الملاحظة
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#0D0C10] border border-white/10 rounded-xl p-3 space-y-1.5">
              <p className="font-bold text-[#F08088]">تثبيت مشتبه بهم:</p>
              <div className="flex flex-wrap gap-1.5">
                {caseData.suspects.map((s) => {
                  const pinned = nodes.some((n) => n.kind === 'suspect' && n.refId === s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={pinned}
                      onClick={() => addCaseItemNode('suspect', s.id, s.name, s.role)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
                        pinned
                          ? 'bg-[#1D1B22] border-white/5 text-[#6F737D]'
                          : 'bg-[#241316] hover:bg-[#341A1E] border-[#7A1219] text-[#F3EFE6]'
                      }`}
                    >
                      {pinned ? `✓ ${s.name}` : `+ ${s.name}`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#0D0C10] border border-white/10 rounded-xl p-3 space-y-1.5">
              <p className="font-bold text-[#E5C16C]">تثبيت أدلة مكتشفة:</p>
              <div className="flex flex-wrap gap-1.5">
                {discoveredEvidence.map((ev) => {
                  const pinned = nodes.some((n) => n.kind === 'evidence' && n.refId === ev.id);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      disabled={pinned}
                      onClick={() => addCaseItemNode('evidence', ev.id, ev.title, ev.typeLabel)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
                        pinned
                          ? 'bg-[#1D1B22] border-white/5 text-[#6F737D]'
                          : 'bg-[#1E1714] hover:bg-[#2B201C] border-[#C89B3C]/40 text-[#E5C16C]'
                      }`}
                    >
                      {pinned ? `✓ ${ev.title}` : `+ ${ev.title}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link mode status bar */}
      <div className="bg-[#1A1412] border border-[#7A1219]/45 rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[#F08088] font-bold">
            {linkSourceId
              ? '🔴 وضع مدّ الخيط نشط: اضغط على زر «وصل هنا» في البطاقة الثانية'
              : 'للربط بالخيط الأحمر: اضغط أيقونة السلسلة على البطاقة الأولى ثم الثانية'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            placeholder="تسمية الخيط"
            className="bg-[#0D0C10] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-[#F3EFE6] w-28 outline-none"
          />
          {linkSourceId && (
            <button
              type="button"
              onClick={() => setLinkSourceId(null)}
              className="bg-[#7A1219] text-white px-2.5 py-1 rounded-lg text-[11px] font-bold"
            >
              إلغاء الربط
            </button>
          )}
        </div>
      </div>

      {/* Interactive Corkboard Canvas */}
      <div
        ref={boardRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="relative w-full h-[460px] sm:h-[520px] rounded-3xl border-4 border-[#3D2B1F] overflow-hidden shadow-2xl select-none touch-none"
        style={{
          backgroundColor: '#1E1612',
          backgroundImage:
            'radial-gradient(rgba(200,155,60,0.09) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.55) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      >
        {/* Red SVG Strings Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {links.map((lnk) => {
            const a = nodes.find((n) => n.id === lnk.fromNodeId);
            const b = nodes.find((n) => n.id === lnk.toNodeId);
            if (!a || !b) return null;
            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2;
            return (
              <g key={lnk.id}>
                <line
                  x1={`${a.x}%`}
                  y1={`${a.y}%`}
                  x2={`${b.x}%`}
                  y2={`${b.y}%`}
                  stroke="#B8232E"
                  strokeWidth="2.5"
                  strokeDasharray="0"
                />
                {lnk.label && (
                  <g>
                    <rect
                      x={`${Math.max(5, Math.min(82, midX - 6))}%`}
                      y={`${Math.max(4, Math.min(90, midY - 3))}%`}
                      width="12%"
                      height="22"
                      rx="6"
                      fill="#09080A"
                      stroke="#7A1219"
                      strokeWidth="1"
                    />
                    <text
                      x={`${midX}%`}
                      y={`${midY}%`}
                      dy="4"
                      textAnchor="middle"
                      fill="#F3EFE6"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      {lnk.label.slice(0, 12)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
            <p className="text-sm font-black text-[#E5C16C]">لوحة التحقيق فارغة حالياً</p>
            <p className="text-xs text-[#9FA3AE] mt-1">
              اضغط «إضافة للوحة» أو ثبّت المشتبه بهم والأدلة من ملفاتهم لبناء خيوط القضية
            </p>
          </div>
        )}

        {/* Pinned Cards */}
        {nodes.map((node) => {
          const st = kindStyle(node.kind);
          const isLinkSource = linkSourceId === node.id;
          return (
            <div
              key={node.id}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                setDraggingNodeId(node.id);
              }}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 w-40 sm:w-44 rounded-xl border-2 p-2.5 shadow-2xl cursor-grab active:cursor-grabbing transition-shadow ${st.card} ${
                isLinkSource ? 'ring-2 ring-[#E5C16C] shadow-[#E5C16C]/30' : ''
              }`}
            >
              {/* Top Pin */}
              <span
                className={`absolute -top-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border border-black shadow ${st.pin}`}
              />

              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[9px] font-black opacity-80 uppercase">{st.badge}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleNodeClickForLink(node.id)}
                    title={linkSourceId ? 'ربط بهذه البطاقة' : 'بدء خيط أحمر'}
                    className={`p-1 rounded ${
                      isLinkSource
                        ? 'bg-[#C89B3C] text-black'
                        : linkSourceId
                        ? 'bg-[#7A1219] text-white animate-pulse'
                        : 'bg-black/25 hover:bg-black/45'
                    }`}
                  >
                    <Link2 size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeNode(node.id)}
                    title="إزالة من اللوحة"
                    className="p-1 rounded bg-black/25 hover:bg-red-800/80"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>

              <p className="text-xs font-black leading-snug line-clamp-2">{node.title}</p>
              {node.subtitle && (
                <p className="text-[10px] opacity-75 mt-0.5 truncate">{node.subtitle}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Connected Strings Summary & Personal Investigation Notepad */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 bg-[#131217] border border-white/10 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-black text-[#E5C16C]">الخيوط المربوطة ({links.length})</p>
          {links.length === 0 ? (
            <p className="text-[11px] text-[#9FA3AE]">لم تربط أي خيوط حمراء بعد.</p>
          ) : (
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {links.map((l) => {
                const a = nodes.find((n) => n.id === l.fromNodeId);
                const b = nodes.find((n) => n.id === l.toNodeId);
                return (
                  <div
                    key={l.id}
                    className="bg-[#0D0C10] border border-white/10 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="truncate text-[#F3EFE6]">
                      {a?.title || '?'} ↔ {b?.title || '?'}{' '}
                      <span className="text-[#F08088]">({l.label})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLink(l.id)}
                      className="text-[#9FA3AE] hover:text-red-400 shrink-0"
                    >
                      <Unlink2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-[#131217] border border-[#C89B3C]/25 rounded-2xl p-4 space-y-2">
          <label className="text-xs font-black text-[#E5C16C] flex items-center gap-1.5">
            <StickyNote size={14} />
            دفتر استنتاجات المحقق الحرّ
          </label>
          <textarea
            value={progress.personalNotes || ''}
            onChange={(e) => onUpdateNotes(e.target.value)}
            rows={4}
            placeholder="دوّن نظريتك حول الجاني، الدافع، وكيف تناقض الدليل مع عذره..."
            className="w-full bg-[#0D0C10] border border-white/10 focus:border-[#C89B3C] rounded-xl p-3 text-xs text-[#F3EFE6] outline-none resize-none leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
};
