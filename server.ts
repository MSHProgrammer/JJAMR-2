import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { GoogleGenAI, Type } from '@google/genai';
import type {
  AppNotification,
  BarrahCategory,
  BrokenTvReactionType,
  BugReport,
  CheatCodeConfig,
  DataStoreSnapshot,
  DubMicMode,
  DubMicScene,
  DubSceneCharacter,
  DubTakeRecord,
  DubVoteCategory,
  GameConfig,
  IsmFieldEvaluation,
  IsmFieldKey,
  IsmPlayerAnswers,
  MimicSound,
  Player,
  Question,
  RoomState,
  Section,
  Topic,
  UserRecord,
} from './src/types/jamr.ts';
import { DEFAULT_GAMES, DEFAULT_SECTIONS } from './src/data/defaultGames.ts';
import {
  buildDefault6000Questions,
  DEFAULT_100_TOPICS,
  isLegacyFillerQuestion,
} from './src/data/jamrain100Topics.ts';
import { DEFAULT_BARRAH_CATEGORIES } from './src/data/barrahSalfaCategories.ts';
import { DEFAULT_DUB_SCENES } from './src/data/dubMicScenes.ts';
import { CHEAT_EFFECTS_CATALOG } from './src/data/cheatCodesCatalog.ts';
import { checkArabicSaudiDictionary } from './src/data/arabicSaudiDictionary.ts';
import { normalizeArabic, normalizeDigits, sanitizeText, wordStartsWithLetter } from './src/utils/arabicNormalize.ts';
import {
  appendSystemChat,
  applyBarrahCategoryVote,
  applyBrokenTvReaction,
  applyBrokenTvStepSubmission,
  areAllIsmFieldsFilled,
  computeDubMicResults,
  computeIsmScores,
  createInitialBrokenTvState,
  createInitialDetectiveState,
  createInitialDubMicState,
  createInitialIsmState,
  finalizeBarrahCategoryVote,
  generateRoomCode,
  pickUnusedArabicLetter,
  startBarrahCategoryVote,
  startBarrahOnlineRound,
  startMafiaOnlineRound,
} from './src/shared/roomEngine.ts';
import {
  DETECTIVE_CATEGORIES,
  DIFFICULTY_LEVELS,
  PUBLIC_DETECTIVE_CASES,
} from './src/data/detectivePublicCases.ts';
import { evaluateAccusationSolution } from './src/data/detectiveSolutions.server.ts';
import type {
  DetectivePlayerAccusation,
  DetectivePlayerRoundResult,
  DetectiveRoomPhase,
} from './src/types/detective.ts';

const PORT = Number(process.env.PORT) || 3000;
const STORE_PATH = path.resolve(process.cwd(), 'jamr_data_store.json');

// ---------------------------------------------------------------------------
// Data Store Persistence & Smart Startup Reconciliation
// ---------------------------------------------------------------------------
function reconcileById<T extends { id: string }>(defaults: T[], saved?: T[]): T[] {
  if (!Array.isArray(saved) || saved.length === 0) return [...defaults];
  const map = new Map<string, T>();
  for (const item of defaults) {
    map.set(item.id, item);
  }
  for (const item of saved) {
    if (item && item.id) {
      const base = map.get(item.id);
      map.set(item.id, base ? { ...base, ...item } : item);
    }
  }
  return Array.from(map.values());
}

function loadAndReconcileStore(): DataStoreSnapshot {
  const defaultQuestions = buildDefault6000Questions();
  let parsed: Partial<DataStoreSnapshot> = {};

  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      parsed = JSON.parse(raw) as Partial<DataStoreSnapshot>;
    } catch (err) {
      console.warn('[JAMR] Failed to parse jamr_data_store.json, starting fresh:', err);
    }
  }

  const games = reconcileById(DEFAULT_GAMES, parsed.games).map((g) => {
    if (g.id === 'sound_mimic') {
      return {
        ...g,
        isActive: false,
        underMaintenance: true,
        supportsOffline: false,
        supportsOnline: false,
      };
    }
    return g;
  });

  const cleanedSavedQuestions = Array.isArray(parsed.questions)
    ? parsed.questions.filter((q) => !isLegacyFillerQuestion(q))
    : undefined;

  const store: DataStoreSnapshot = {
    sections: reconcileById(DEFAULT_SECTIONS, parsed.sections),
    topics: reconcileById(DEFAULT_100_TOPICS, parsed.topics),
    questions: reconcileById(defaultQuestions, cleanedSavedQuestions),
    games,
    barrahCategories: reconcileById(DEFAULT_BARRAH_CATEGORIES, parsed.barrahCategories),
    reports: Array.isArray(parsed.reports) ? parsed.reports : [],
    mimicSounds: Array.isArray(parsed.mimicSounds) ? parsed.mimicSounds : [],
    cheatCodes: Array.isArray(parsed.cheatCodes) ? parsed.cheatCodes : [],
    dubScenes: reconcileById(DEFAULT_DUB_SCENES, parsed.dubScenes),
    users: parsed.users && typeof parsed.users === 'object' ? parsed.users : {},
  };

  persistStore(store);
  return store;
}

function persistStore(store: DataStoreSnapshot): void {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store), 'utf8');
  } catch (err) {
    console.error('[JAMR] Failed to persist jamr_data_store.json:', err);
  }
}

let dataStore: DataStoreSnapshot = loadAndReconcileStore();

// ---------------------------------------------------------------------------
// Cloudflare Real IP, Rate Limiter & Admin Brute-Force Protection
// ---------------------------------------------------------------------------
function getClientIp(req: Request): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim();
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

const apiRateMap = new Map<string, { count: number; resetAt: number }>();
function apiRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = apiRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    apiRateMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  entry.count += 1;
  if (entry.count > 300) {
    return res.status(429).json({ error: 'تم تجاوز الحد المسموح للطلبات، يرجى المحاولة بعد دقيقة.' });
  }
  return next();
}

const adminTokens = new Map<string, number>(); // token -> expiresAt
const failedLoginMap = new Map<string, { attempts: number; lockedUntil: number }>();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const exp = adminTokens.get(token);
  if (!token || !exp || Date.now() > exp) {
    if (token) adminTokens.delete(token);
    return res.status(401).json({ error: 'جلسة الإدارة غير صالحة أو منتهية.' });
  }
  return next();
}

// ---------------------------------------------------------------------------
// Express App Setup
// ---------------------------------------------------------------------------
const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Edge cache control & rate limiting for /api
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
}, apiRateLimiter);

// ---------------------------------------------------------------------------
// Public API Routes
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, games: dataStore.games.length });
});

app.get('/api/catalog', (_req, res) => {
  res.json({
    games: dataStore.games,
    sections: dataStore.sections,
    topics: dataStore.topics,
    questionsCount: dataStore.questions.length,
    barrahCategories: dataStore.barrahCategories,
    dubScenes: dataStore.dubScenes || DEFAULT_DUB_SCENES,
  });
});

app.get('/api/dub/scenes', (_req, res) => {
  res.json({ scenes: dataStore.dubScenes || DEFAULT_DUB_SCENES });
});

app.get('/api/games', (_req, res) => {
  res.json({ games: dataStore.games });
});

app.get('/api/jamrain/data', (_req, res) => {
  res.json({
    sections: dataStore.sections,
    topics: dataStore.topics,
    questions: dataStore.questions,
  });
});

const webSearchRateMap = new Map<string, { count: number; resetAt: number }>();

async function searchWebQuestionsForTopic(topic: Topic): Promise<{
  addedQuestions: Question[];
  sources: Array<{ title: string; url: string }>;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('NO_GEMINI_KEY');
  }

  const existingForTopic = dataStore.questions
    .filter((q) => q.topicId === topic.id)
    .map((q) => q.question)
    .slice(0, 20);

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const prompt = `ابحث في مواقع الويب الموثوقة (ويكيبيديا، المواقع الإخبارية والرياضية والعلمية الرسمية) عن معلومات حقيقية ودقيقة وحديثة حول موضوع: "${topic.name}" (قسم: ${topic.category}).
أنشئ 6 أسئلة مسابقات ثقافية عربية حقيقية وممتعة ومختبرة الدقة 100% مرتبطة حصرياً بهذا الموضوع فقط:
- سؤالان بقيمة 200 نقطة (معلومة مشهورة وواضحة)
- سؤالان بقيمة 400 نقطة (معلومة متوسطة العمق أو حدث/رقم محدد)
- سؤالان بقيمة 600 نقطة (سؤال احترافي دقيق وصعب لمحبي التحدي)

تجنّب تكرار هذه الأسئلة الموجودة مسبقاً:
${existingForTopic.map((q) => `- ${q}`).join('\n')}

أعد النتيجة كمصفوفة JSON صالحة فقط بدون أي نص إضافي أو علامات شرح خارج المصفوفة، بهذا التنسيق الدقيق:
[
  {
    "points": 200,
    "question": "نص السؤال الواضح والمباشر بالعربية؟",
    "answer": "الإجابة الصحيحة الدقيقة والمختصرة",
    "hint": "تلميح ذكي لا يكشف الإجابة مباشرة",
    "explanation": "شرح مختصر للمعلومة من الموقع"
  }
]`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction:
        'أنت محرر مسابقات عربية محترف تتحقق من كل معلومة عبر بحث جوجل قبل صياغة السؤال. يُمنع منعاً باتاً اختراع حقائق غير مؤكدة أو كتابة أسئلة عامة غير متعلقة بالموضوع. أعد مصفوفة JSON صالحة فقط.',
    },
  });

  const rawText = (response.text || '').trim();
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('INVALID_SEARCH_JSON');
  }

  const parsedItems = JSON.parse(jsonMatch[0]) as Array<{
    points?: number;
    question?: string;
    answer?: string;
    hint?: string;
    explanation?: string;
  }>;

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources: Array<{ title: string; url: string }> = [];
  for (const ch of chunks) {
    const uri = ch?.web?.uri;
    const title = ch?.web?.title;
    if (uri && !sources.some((s) => s.url === uri)) {
      sources.push({
        title: sanitizeText(String(title || 'مصدر ويب موثق'), 120),
        url: String(uri),
      });
    }
  }

  const primarySource = sources[0];
  const existingNormalized = new Set(
    dataStore.questions
      .filter((q) => q.topicId === topic.id)
      .map((q) => q.question.trim().toLowerCase())
  );

  const addedQuestions: Question[] = [];
  for (const item of parsedItems) {
    const qText = sanitizeText(String(item.question || ''), 280);
    const aText = sanitizeText(String(item.answer || ''), 220);
    if (!qText || !aText || existingNormalized.has(qText.toLowerCase())) continue;

    const ptsNum = Number(item.points);
    const pts: 200 | 400 | 600 = ptsNum === 600 ? 600 : ptsNum === 400 ? 400 : 200;

    const newQuestion: Question = {
      id: `web_${topic.id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      topicId: topic.id,
      points: pts,
      question: qText,
      answer: aText,
      hint: item.hint ? sanitizeText(String(item.hint), 180) : undefined,
      explanation: item.explanation ? sanitizeText(String(item.explanation), 280) : undefined,
      sourceTitle: primarySource?.title,
      sourceUrl: primarySource?.url,
      isWebResearched: true,
    };

    existingNormalized.add(qText.toLowerCase());
    dataStore.questions.unshift(newQuestion);
    addedQuestions.push(newQuestion);
  }

  return { addedQuestions, sources };
}

app.post('/api/jamrain/search-questions', async (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const rate = webSearchRateMap.get(ip);
  if (rate && rate.resetAt > now) {
    if (rate.count >= 25) {
      return res.status(429).json({ error: 'تم تجاوز الحد المؤقت لطلبات البحث. حاول بعد دقيقة.' });
    }
    rate.count += 1;
  } else {
    webSearchRateMap.set(ip, { count: 1, resetAt: now + 2 * 60_000 });
  }

  const rawIds: string[] = Array.isArray(req.body?.topicIds)
    ? req.body.topicIds.map((x: unknown) => String(x)).slice(0, 6)
    : req.body?.topicId
      ? [String(req.body.topicId)]
      : [];

  if (rawIds.length === 0) {
    return res.status(400).json({ error: 'يرجى تحديد موضوع واحد على الأقل للبحث.' });
  }

  const targetTopics = rawIds
    .map((id) => dataStore.topics.find((t) => t.id === id))
    .filter((t): t is Topic => Boolean(t));

  if (targetTopics.length === 0) {
    return res.status(404).json({ error: 'الموضوع غير موجود.' });
  }

  try {
    const allAdded: Question[] = [];
    const allSources: Array<{ title: string; url: string }> = [];

    for (const topic of targetTopics) {
      const { addedQuestions, sources } = await searchWebQuestionsForTopic(topic);
      allAdded.push(...addedQuestions);
      for (const s of sources) {
        if (!allSources.some((x) => x.url === s.url)) allSources.push(s);
      }
    }

    if (allAdded.length > 0) {
      persistStore(dataStore);
    }

    return res.json({
      ok: true,
      addedCount: allAdded.length,
      questions: allAdded,
      sources: allSources,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'NO_GEMINI_KEY') {
      return res.status(503).json({
        error: 'ميزة البحث الحي من الويب تتطلب تهيئة مفتاح GEMINI_API_KEY في إعدادات الخادم (Secrets). الأسئلة المدمجة الحقيقية الـ 1,200 متاحة دائماً للعب!',
      });
    }
    console.warn('[JAMR] Live web question search error:', err);
    return res.status(502).json({
      error: 'تعذر جلب أسئلة جديدة من الويب حالياً، ويمكنك المتابعة بالبنك الحقيقي المدمج.',
    });
  }
});

app.get('/api/barrah/categories', (_req, res) => {
  res.json({ categories: dataStore.barrahCategories });
});

app.post('/api/ism/analyze-answers', async (req, res) => {
  const letter = sanitizeText(String(req.body?.letter || 'أ'), 4) || 'أ';
  const playersInput = Array.isArray(req.body?.players) ? req.body.players : [];
  const answersByPlayer = (req.body?.answersByPlayer || {}) as Record<string, IsmPlayerAnswers>;
  const fields: IsmFieldKey[] = ['name', 'animal', 'plant', 'object', 'country'];
  const fieldLabels: Record<IsmFieldKey, string> = {
    name: 'اسم إنسان',
    animal: 'حيوان أو طائر أو كائن',
    plant: 'نبات أو فاكهة أو خضار أو عشب',
    object: 'جماد أو أداة أو غرض',
    country: 'دولة أو مدينة أو منطقة (عربية أو سعودية أو عالمية)',
  };

  const playersList: Array<{ id: string; name: string }> = playersInput
    .map((p: { id?: unknown; name?: unknown }) => ({
      id: String(p?.id || ''),
      name: String(p?.name || 'لاعب'),
    }))
    .filter((p: { id: string; name: string }) => p.id);

  const reasonsByPlayer: Record<string, Record<IsmFieldKey, IsmFieldEvaluation>> = {};
  const unknownMap = new Map<string, { field: IsmFieldKey; word: string }>();

  for (const p of playersList) {
    reasonsByPlayer[p.id] = {
      name: { valid: false, source: 'rejected', reason: 'لم تُكتب إجابة' },
      animal: { valid: false, source: 'rejected', reason: 'لم تُكتب إجابة' },
      plant: { valid: false, source: 'rejected', reason: 'لم تُكتب إجابة' },
      object: { valid: false, source: 'rejected', reason: 'لم تُكتب إجابة' },
      country: { valid: false, source: 'rejected', reason: 'لم تُكتب إجابة' },
    };

    const pAns = answersByPlayer[p.id];
    for (const field of fields) {
      const word = sanitizeText(String(pAns?.[field] || ''), 60);
      if (!word) continue;

      const check = checkArabicSaudiDictionary(word, letter, field);
      if (!check.validStart && !wordStartsWithLetter(word, letter)) {
        reasonsByPlayer[p.id][field] = {
          valid: false,
          source: 'rejected',
          reason: `لا تبدأ بحرف (${letter})`,
        };
      } else if (check.knownInIndex) {
        reasonsByPlayer[p.id][field] = {
          valid: true,
          source: check.source === 'saudi' ? 'saudi' : 'fusha',
          reason: check.source === 'saudi' ? 'مقبولة — فهرس اللهجة السعودية 🇸🇦' : 'مقبولة — الفهرس العربي 📖',
        };
      } else {
        const key = `${field}::${normalizeArabic(word)}`;
        if (!unknownMap.has(key)) {
          unknownMap.set(key, { field, word });
        }
      }
    }
  }

  let usedGemini = false;
  const aiVerdicts = new Map<string, { valid: boolean; dialect: 'fusha' | 'saudi' | 'rejected'; reason: string }>();
  const apiKey = process.env.GEMINI_API_KEY;

  if (unknownMap.size > 0 && apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
        },
      });

      const items = Array.from(unknownMap.entries()).map(([k, v]) => ({
        key: k,
        category: fieldLabels[v.field],
        word: v.word,
      }));

      const prompt = `أنت محكّم خبير في لعبة "اسم حيوان نبات جماد بلاد" باللغة العربية الفصحى وباللهجة السعودية والخليجية.
الحرف المطلوب لهذه الجولة هو: (${letter}) (مع قبول همزات الألف أ/إ/آ/ا والتاء المربوطة/الهاء).

قيّم القائمة التالية بسرعة ودقة: كل عنصر مقبول إذا كان يبدأ بحرف (${letter}) ويدل فعلاً على الفئة المحددة سواء في العربية الفصحى أو اللهجة السعودية/الخليجية الدارجة (مثل: ضب، جربوع، دلة، فنجال، مركى، عرار، سدر، الأحساء، حاشي... إلخ). وارفض الكلمات العشوائية أو غير المتعلقة بالفئة.

القائمة:
${items.map((it) => `- key="${it.key}" | الفئة: ${it.category} | الكلمة: "${it.word}"`).join('\n')}`;

      const aiPromise = ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: 'أعد مصفوفة JSON صالحة فقط بدون أي نص إضافي.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                key: { type: Type.STRING },
                valid: { type: Type.BOOLEAN },
                dialect: { type: Type.STRING },
                reason: { type: Type.STRING },
              },
              required: ['key', 'valid', 'dialect', 'reason'],
            },
          },
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GEMINI_ANALYZE_TIMEOUT')), 7000)
      );

      const response = await Promise.race([aiPromise, timeoutPromise]);

      const rawText = (response.text || '').trim();
      const parsed = JSON.parse(rawText) as Array<{
        key: string;
        valid: boolean;
        dialect: string;
        reason: string;
      }>;
      if (Array.isArray(parsed)) {
        usedGemini = true;
        for (const item of parsed) {
          if (item && item.key) {
            const d = item.dialect === 'saudi' ? 'saudi' : item.valid ? 'fusha' : 'rejected';
            aiVerdicts.set(item.key, {
              valid: Boolean(item.valid),
              dialect: d,
              reason: sanitizeText(String(item.reason || (item.valid ? 'مقبولة' : 'مرفوضة')), 90),
            });
          }
        }
      }
    } catch (err) {
      console.warn('[JAMR] Gemini AI ism batch analysis fallback to Arabic/Saudi index:', err);
    }
  }

  const fieldScoresByPlayer: Record<string, Record<IsmFieldKey, number>> = {};
  const roundTotalsByPlayer: Record<string, number> = {};

  for (const p of playersList) {
    fieldScoresByPlayer[p.id] = { name: 0, animal: 0, plant: 0, object: 0, country: 0 };
    roundTotalsByPlayer[p.id] = 0;

    const pAns = answersByPlayer[p.id];
    for (const field of fields) {
      const word = sanitizeText(String(pAns?.[field] || ''), 60);
      if (!word) continue;

      const currentEval = reasonsByPlayer[p.id][field];
      if (!currentEval.valid && currentEval.reason.includes('لا تبدأ بحرف')) {
        continue;
      }

      if (!currentEval.valid) {
        const key = `${field}::${normalizeArabic(word)}`;
        const aiVerdict = aiVerdicts.get(key);
        if (aiVerdict) {
          reasonsByPlayer[p.id][field] = {
            valid: aiVerdict.valid,
            source: aiVerdict.valid ? 'gemini_ai' : 'rejected',
            reason: aiVerdict.reason,
          };
        } else {
          // Graceful fallback heuristic if Gemini unavailable: accept genuine multi-letter Arabic words starting with letter
          const arabicCharsOnly = /^[\u0600-\u06FF\s]{2,}$/.test(word);
          reasonsByPlayer[p.id][field] = arabicCharsOnly
            ? { valid: true, source: 'fusha', reason: 'مقبولة حسب الفهرس العربي وتطابق الحرف' }
            : { valid: false, source: 'rejected', reason: 'كلمة غير صالحة' };
        }
      }
    }
  }

  for (const field of fields) {
    const counts: Record<string, number> = {};
    const validNormByPlayer: Record<string, string> = {};

    for (const p of playersList) {
      const word = sanitizeText(String(answersByPlayer[p.id]?.[field] || ''), 60);
      if (!word) continue;
      if (reasonsByPlayer[p.id][field].valid) {
        const norm = normalizeArabic(word);
        validNormByPlayer[p.id] = norm;
        counts[norm] = (counts[norm] || 0) + 1;
      }
    }

    for (const p of playersList) {
      const norm = validNormByPlayer[p.id];
      if (!norm) {
        fieldScoresByPlayer[p.id][field] = 0;
      } else {
        const pts = counts[norm] > 1 ? 5 : 10;
        fieldScoresByPlayer[p.id][field] = pts;
        roundTotalsByPlayer[p.id] += pts;
      }
    }
  }

  return res.json({
    ok: true,
    analyzedBy: usedGemini ? 'gemini_ai' : 'saudi_arabic_index',
    fieldScoresByPlayer,
    roundTotalsByPlayer,
    reasonsByPlayer,
  });
});

app.post('/api/reports', (req, res) => {
  const type = sanitizeText(String(req.body?.type || 'خلل تقني'), 80);
  const gameId = sanitizeText(String(req.body?.gameId || 'general'), 80);
  const gameTitle = sanitizeText(String(req.body?.gameTitle || 'المنصة العامة'), 120);
  const description = sanitizeText(String(req.body?.description || ''), 1500);
  const reporterName = sanitizeText(String(req.body?.reporterName || 'لاعب'), 80);
  const contact = sanitizeText(String(req.body?.contact || ''), 120);

  if (!description || description.length < 2) {
    return res.status(400).json({ error: 'يرجى كتابة وصف واضح للبلاغ (حرفان على الأقل).' });
  }

  const report: BugReport = {
    id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    gameId,
    gameTitle,
    description,
    reporterName: reporterName || 'لاعب',
    contact: contact || undefined,
    status: 'new',
    createdAt: new Date().toISOString(),
  };

  dataStore.reports.unshift(report);
  persistStore(dataStore);
  return res.status(201).json({ ok: true, report });
});

// ---------------------------------------------------------------------------
// Smart Detective Authoritative APIs (Solutions NEVER leaked before verification)
// ---------------------------------------------------------------------------
app.get('/api/detective/cases', (_req, res) => {
  res.json({
    ok: true,
    cases: PUBLIC_DETECTIVE_CASES,
    categories: DETECTIVE_CATEGORIES,
    difficulties: DIFFICULTY_LEVELS,
  });
});

app.post('/api/detective/verify', (req, res) => {
  const caseId = String(req.body?.caseId || '');
  const accusedSuspectId = String(req.body?.accusedSuspectId || '');
  const cluesFoundCount = Number(req.body?.cluesFoundCount || 0);
  const usedHintTiers = Array.isArray(req.body?.usedHintTiers)
    ? req.body.usedHintTiers.map((n: unknown) => Number(n))
    : [];
  const wrongAccusationsBefore = Number(req.body?.wrongAccusationsBefore || 0);
  const revealOnWrong = Boolean(req.body?.revealOnWrong);

  const evalRes = evaluateAccusationSolution({
    caseId,
    accusedSuspectId,
    cluesFoundCount,
    usedHintTiers,
    wrongAccusationsBefore,
  });

  if (!evalRes.validCase) {
    return res.status(400).json({ error: 'ملف القضية غير موجود.' });
  }

  return res.json({
    ok: true,
    isCorrect: evalRes.isCorrect,
    pointsEarned: evalRes.pointsEarned,
    solution: evalRes.isCorrect || revealOnWrong ? evalRes.solution : null,
  });
});

// ---------------------------------------------------------------------------
// Secret Codes / Cheat Codes Redemption & Username / Friends / Notifications
// ---------------------------------------------------------------------------
function normalizeUsername(raw: unknown): string {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

function sanitizeAvatarPayload(raw: unknown, fallback = 'char_01'): string {
  const val = typeof raw === 'string' ? raw.trim() : '';
  if (val.startsWith('data:image/') && val.length > 30 && val.length < 360_000) {
    return val;
  }
  return sanitizeText(val, 24) || fallback;
}

function pushUserNotification(username: string, notification: AppNotification) {
  const users = (dataStore.users = dataStore.users || {});
  const target = users[username];
  if (!target) return;
  target.notifications = [notification, ...(target.notifications || [])].slice(0, 40);
  // Real-time push to connected WebSocket clients matching this username or playerId
  clients.forEach((meta) => {
    if (
      meta.ws.readyState === WebSocket.OPEN &&
      (meta.username === username || meta.playerId === target.playerId)
    ) {
      sendWs(meta.ws, {
        type: 'notification',
        targetUsername: username,
        notification,
      });
    }
  });
}

app.post('/api/cheats/redeem', (req, res) => {
  const rawCode = normalizeDigits(String(req.body?.code || '').trim());
  if (!rawCode) {
    return res.status(400).json({ ok: false, error: 'أدخل الكود السري أولاً.' });
  }

  const configuredPassword = normalizeDigits((process.env.ADMIN_PASSWORD || 'jamr2026').trim());
  if (rawCode === configuredPassword) {
    const token = crypto.randomBytes(32).toString('hex');
    adminTokens.set(token, Date.now() + 12 * 60 * 60 * 1000);
    return res.json({
      ok: true,
      kind: 'admin',
      token,
      message: 'تم فتح لوحة إدارة جَمْر السرية بنجاح!',
    });
  }

  const cheats = dataStore.cheatCodes || [];
  const match = cheats.find(
    (c) => c.enabled && normalizeDigits(c.code.trim()).toUpperCase() === rawCode.toUpperCase()
  );

  if (!match) {
    return res.status(404).json({ ok: false, error: 'الكود السري غير صحيح أو معطّل.' });
  }

  match.usageCount = (match.usageCount || 0) + 1;
  persistStore(dataStore);

  const effect = CHEAT_EFFECTS_CATALOG.find((e) => e.id === match.effectId) || {
    id: match.effectId,
    title: match.effectTitle,
    category: 'ميزة سرية',
    description: match.description || 'تم تفعيل الكود السري!',
    badge: '✨',
  };

  return res.json({
    ok: true,
    kind: 'cheat',
    cheat: match,
    effect,
    message: `تم تفعيل كود «${match.code}»: ${effect.title}!`,
  });
});

app.post('/api/users/register', (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const playerId = sanitizeText(String(req.body?.playerId || ''), 80);
  const displayName = sanitizeText(String(req.body?.displayName || 'لاعب جَمْر'), 30) || 'لاعب جَمْر';
  const avatar = sanitizeAvatarPayload(req.body?.avatar, 'char_01');
  const avatarBg = sanitizeText(String(req.body?.avatarBg || ''), 32) || undefined;

  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({
      ok: false,
      error: 'يجب أن يكون اليوزر نيم بين 3 و 20 خانة (أحرف إنجليزية وأرقام و _ فقط).',
    });
  }

  const users = (dataStore.users = dataStore.users || {});
  const existing = users[username];
  if (existing && existing.playerId !== playerId) {
    return res.status(409).json({
      ok: false,
      error: `اليوزر نيم @${username} محجوز ومستخدم لشخص آخر! اختر يوزر نيم غير مكرر.`,
    });
  }

  // If this playerId previously had a different username, migrate friends/notifications or block rename conflict
  const record: UserRecord = existing
    ? {
        ...existing,
        displayName,
        avatar,
        avatarBg,
        lastSeen: Date.now(),
      }
    : {
        username,
        playerId: playerId || `u_${Date.now().toString(36)}`,
        displayName,
        avatar,
        avatarBg,
        friends: [],
        incomingRequests: [],
        outgoingRequests: [],
        notifications: [],
        dubXp: 0,
        dubTitles: [],
        dubAchievements: [],
        lastSeen: Date.now(),
      };

  users[username] = record;
  persistStore(dataStore);
  return res.json({ ok: true, user: record });
});

app.post('/api/users/sync-presence', (req, res) => {
  const username = normalizeUsername(req.body?.username);
  if (!username) return res.json({ ok: true });
  const users = (dataStore.users = dataStore.users || {});
  const u = users[username];
  if (!u) return res.json({ ok: false });

  u.lastSeen = Date.now();
  if (req.body?.displayName) u.displayName = sanitizeText(String(req.body.displayName), 30) || u.displayName;
  if (req.body?.avatar) u.avatar = sanitizeAvatarPayload(req.body.avatar, u.avatar);
  if (req.body?.avatarBg) u.avatarBg = sanitizeText(String(req.body.avatarBg), 32);
  if (req.body?.playerId) u.playerId = sanitizeText(String(req.body.playerId), 80);
  if (req.body?.roomCode !== undefined) {
    const rc = String(req.body.roomCode || '').trim().toUpperCase();
    u.currentRoomCode = rc && rooms.has(rc) ? rc : null;
    u.currentGameId = rc && rooms.has(rc) ? rooms.get(rc)!.gameId : null;
  }
  return res.json({ ok: true });
});

app.get('/api/friends/state', (req, res) => {
  const username = normalizeUsername(req.query.username);
  if (!username) {
    return res.json({ ok: true, registered: false, friends: [], incomingRequests: [], outgoingRequests: [], notifications: [] });
  }
  const users = (dataStore.users = dataStore.users || {});
  const me = users[username];
  if (!me) {
    return res.json({ ok: true, registered: false, friends: [], incomingRequests: [], outgoingRequests: [], notifications: [] });
  }

  me.lastSeen = Date.now();
  const now = Date.now();

  const enrich = (handle: string) => {
    const rec = users[handle];
    const activeRoom = rec?.currentRoomCode ? rooms.get(rec.currentRoomCode) : undefined;
    const gameTitle = activeRoom
      ? dataStore.games.find((g) => g.id === activeRoom.gameId)?.title || activeRoom.gameId
      : undefined;
    return {
      username: handle,
      displayName: rec?.displayName || handle,
      avatar: rec?.avatar || 'char_01',
      avatarBg: rec?.avatarBg,
      isOnline: Boolean(rec && now - rec.lastSeen < 120_000),
      roomCode: activeRoom ? activeRoom.code : null,
      gameId: activeRoom ? activeRoom.gameId : null,
      gameTitle,
    };
  };

  return res.json({
    ok: true,
    registered: true,
    user: {
      username: me.username,
      displayName: me.displayName,
      avatar: me.avatar,
      avatarBg: me.avatarBg,
      dubXp: me.dubXp || 0,
      dubTitles: me.dubTitles || [],
      dubAchievements: me.dubAchievements || [],
    },
    friends: (me.friends || []).map(enrich),
    incomingRequests: (me.incomingRequests || []).map(enrich),
    outgoingRequests: (me.outgoingRequests || []).map(enrich),
    notifications: me.notifications || [],
  });
});

app.post('/api/friends/request', (req, res) => {
  const fromUsername = normalizeUsername(req.body?.fromUsername);
  const targetUsername = normalizeUsername(req.body?.targetUsername);
  const users = (dataStore.users = dataStore.users || {});

  if (!fromUsername || !users[fromUsername]) {
    return res.status(400).json({ ok: false, error: 'يجب إنشاء يوزر نيم خاص بك أولاً قبل إضافة الأصدقاء!' });
  }
  if (!targetUsername || !users[targetUsername]) {
    return res.status(404).json({ ok: false, error: 'لم يتم العثور على لاعب بهذا اليوزر نيم. الإضافة تتم باليوزر نيم الفريد فقط.' });
  }
  if (fromUsername === targetUsername) {
    return res.status(400).json({ ok: false, error: 'لا يمكنك إضافة نفسك كصديق!' });
  }

  const me = users[fromUsername];
  const target = users[targetUsername];

  if (me.friends.includes(targetUsername)) {
    return res.status(400).json({ ok: false, error: `@${targetUsername} موجود بالفعل في قائمة أصدقائك.` });
  }

  if (!target.incomingRequests.includes(fromUsername)) {
    target.incomingRequests.unshift(fromUsername);
  }
  if (!me.outgoingRequests.includes(targetUsername)) {
    me.outgoingRequests.unshift(targetUsername);
  }

  pushUserNotification(targetUsername, {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'friend_request',
    title: 'طلب صداقة جديد 🤝',
    body: `أرسل لك ${me.displayName} (@${me.username}) طلب صداقة في منصة جَمْر`,
    fromUsername: me.username,
    fromDisplayName: me.displayName,
    fromAvatar: me.avatar,
    fromAvatarBg: me.avatarBg,
    read: false,
    createdAt: Date.now(),
  });

  persistStore(dataStore);
  return res.json({ ok: true, message: `تم إرسال طلب الصداقة إلى @${targetUsername}` });
});

app.post('/api/friends/respond', (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const fromUsername = normalizeUsername(req.body?.fromUsername);
  const accept = Boolean(req.body?.accept);
  const users = (dataStore.users = dataStore.users || {});

  if (!username || !users[username]) {
    return res.status(400).json({ ok: false, error: 'يجب إنشاء يوزر نيم خاص بك أولاً لقبول طلبات الصداقة!' });
  }
  const me = users[username];
  const sender = users[fromUsername];

  me.incomingRequests = me.incomingRequests.filter((u) => u !== fromUsername);
  if (sender) {
    sender.outgoingRequests = sender.outgoingRequests.filter((u) => u !== username);
  }

  if (accept && sender) {
    if (!me.friends.includes(fromUsername)) me.friends.unshift(fromUsername);
    if (!sender.friends.includes(username)) sender.friends.unshift(username);
    pushUserNotification(fromUsername, {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'friend_request',
      title: 'تم قبول طلب الصداقة 🎉',
      body: `قبل ${me.displayName} (@${me.username}) طلب صداقتك! يمكنكم الآن اللعب ودعوة بعضكم مباشرة.`,
      fromUsername: me.username,
      fromDisplayName: me.displayName,
      fromAvatar: me.avatar,
      fromAvatarBg: me.avatarBg,
      read: false,
      createdAt: Date.now(),
    });
  }

  persistStore(dataStore);
  return res.json({ ok: true });
});

app.post('/api/friends/invite-room', (req, res) => {
  const fromUsername = normalizeUsername(req.body?.fromUsername);
  const targetUsername = normalizeUsername(req.body?.targetUsername);
  const roomCode = String(req.body?.roomCode || '').trim().toUpperCase();
  const users = (dataStore.users = dataStore.users || {});
  const me = users[fromUsername];
  const target = users[targetUsername];
  const room = rooms.get(roomCode);

  if (!me || !target) {
    return res.status(404).json({ ok: false, error: 'تعذر العثور على اللاعب المستهدف.' });
  }
  if (!room) {
    return res.status(404).json({ ok: false, error: 'الغرفة غير نشطة حالياً.' });
  }
  const gameTitle = dataStore.games.find((g) => g.id === room.gameId)?.title || 'غرفة جَمْر';

  pushUserNotification(targetUsername, {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'room_invite',
    title: `دعوة للعب ${gameTitle} 🔥`,
    body: `يدعوك ${me.displayName} (@${me.username}) للانضمام إلى غرفته (${room.code}) الآن!`,
    fromUsername: me.username,
    fromDisplayName: me.displayName,
    fromAvatar: me.avatar,
    fromAvatarBg: me.avatarBg,
    roomCode: room.code,
    gameId: room.gameId,
    gameTitle,
    read: false,
    createdAt: Date.now(),
  });

  persistStore(dataStore);
  return res.json({ ok: true, message: `تم إرسال دعوة الغرفة إلى @${targetUsername}` });
});

app.post('/api/notifications/read', (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const notificationId = req.body?.notificationId ? String(req.body.notificationId) : null;
  const users = (dataStore.users = dataStore.users || {});
  const me = users[username];
  if (!me) return res.json({ ok: true });
  me.notifications = (me.notifications || []).map((n) =>
    !notificationId || n.id === notificationId ? { ...n, read: true } : n
  );
  persistStore(dataStore);
  return res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin Authentication & Protected Endpoints
// ---------------------------------------------------------------------------
app.post('/api/admin/login', (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const failRecord = failedLoginMap.get(ip);

  if (failRecord && failRecord.lockedUntil > now) {
    const remainingSec = Math.ceil((failRecord.lockedUntil - now) / 1000);
    return res.status(429).json({
      error: `تم قفل محاولات الدخول مؤقتاً بسبب كثرة الأخطاء. يرجى الانتظار ${remainingSec} ثانية.`,
    });
  }

  const configuredPassword = process.env.ADMIN_PASSWORD || 'jamr2026';

  const submitted = normalizeDigits(String(req.body?.password || '').trim());
  const expected = normalizeDigits(configuredPassword.trim());

  if (!submitted || submitted !== expected) {
    const nextAttempts = (failRecord?.attempts || 0) + 1;
    if (nextAttempts >= 10) {
      failedLoginMap.set(ip, { attempts: nextAttempts, lockedUntil: now + 5 * 60_000 });
      return res.status(429).json({
        error: 'تم تجاوز 10 محاولات خاطئة. تم إيقاف الدخول لمدة 5 دقائق.',
      });
    }
    failedLoginMap.set(ip, { attempts: nextAttempts, lockedUntil: 0 });
    return res.status(401).json({
      error: 'كلمة المرور غير صحيحة.',
      attemptsRemaining: 10 - nextAttempts,
    });
  }

  // Clear lock on valid login
  failedLoginMap.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  adminTokens.set(token, now + 12 * 60 * 60 * 1000);
  return res.json({ ok: true, token });
});

app.get('/api/admin/data', requireAdmin, (_req, res) => {
  res.json(dataStore);
});

app.get('/api/admin/stats', requireAdmin, (_req, res) => {
  const liveRooms = Array.from(rooms.values()).map((r) => ({
    code: r.code,
    gameId: r.gameId,
    status: r.status,
    playersCount: r.players.length,
    maxPlayers: r.maxPlayers,
    isJudgeRoom: Boolean(r.isJudgeRoom),
    createdAt: r.createdAt,
  }));
  res.json({
    liveRooms,
    totals: {
      rooms: liveRooms.length,
      playersOnline: liveRooms.reduce((acc, r) => acc + r.playersCount, 0),
      games: dataStore.games.length,
      topics: dataStore.topics.length,
      questions: dataStore.questions.length,
      reportsNew: dataStore.reports.filter((r) => r.status === 'new').length,
      mimicSounds: dataStore.mimicSounds.length,
    },
  });
});

// Games CRUD
app.post('/api/admin/games', requireAdmin, (req, res) => {
  const body = req.body as Partial<GameConfig>;
  const title = sanitizeText(String(body.title || ''), 100);
  if (!title) return res.status(400).json({ error: 'اسم اللعبة مطلوب.' });
  const id = sanitizeText(String(body.id || `custom_${Date.now().toString(36)}`), 60);
  const game: GameConfig = {
    id,
    title,
    subtitle: sanitizeText(String(body.subtitle || 'لعبة جماعية جديدة'), 160),
    description: sanitizeText(String(body.description || ''), 500),
    icon: sanitizeText(String(body.icon || '🎮'), 16),
    imageUrl: body.imageUrl,
    category: sanitizeText(String(body.category || 'مخصصة'), 60),
    minPlayers: Number(body.minPlayers) || 2,
    maxPlayers: Number(body.maxPlayers) || 12,
    duration: sanitizeText(String(body.duration || '15 دقيقة'), 40),
    difficulty: sanitizeText(String(body.difficulty || 'متوسطة'), 30),
    tags: Array.isArray(body.tags) ? body.tags.map((t) => sanitizeText(String(t), 40)) : ['جديد ✨'],
    supportsOffline: body.supportsOffline !== false,
    supportsOnline: Boolean(body.supportsOnline),
    isActive: body.isActive !== false,
    underMaintenance: Boolean(body.underMaintenance),
    maintenanceNote: body.maintenanceNote ? sanitizeText(String(body.maintenanceNote), 300) : undefined,
    bgGradient: String(body.bgGradient || 'from-orange-600/30 via-amber-500/20 to-rose-600/25'),
    accentColor: String(body.accentColor || '#F97316'),
    rules: Array.isArray(body.rules) ? body.rules.map((r) => sanitizeText(String(r), 260)) : [],
    specialMechanic: body.specialMechanic ? sanitizeText(String(body.specialMechanic), 200) : undefined,
    isCustom: true,
  };
  dataStore.games.push(game);
  persistStore(dataStore);
  return res.status(201).json({ game });
});

app.put('/api/admin/games/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const idx = dataStore.games.findIndex((g) => g.id === id);
  if (idx === -1) return res.status(404).json({ error: 'اللعبة غير موجودة.' });
  const prev = dataStore.games[idx];
  const body = req.body as Partial<GameConfig>;
  const updated: GameConfig = {
    ...prev,
    ...body,
    id: prev.id,
    title: body.title !== undefined ? sanitizeText(String(body.title), 100) : prev.title,
    subtitle: body.subtitle !== undefined ? sanitizeText(String(body.subtitle), 180) : prev.subtitle,
    description: body.description !== undefined ? sanitizeText(String(body.description), 600) : prev.description,
    maintenanceNote: body.maintenanceNote !== undefined ? sanitizeText(String(body.maintenanceNote), 300) : prev.maintenanceNote,
    isMostPlayed: body.isMostPlayed !== undefined ? Boolean(body.isMostPlayed) : prev.isMostPlayed,
  };
  dataStore.games[idx] = updated;
  persistStore(dataStore);
  return res.json({ game: updated });
});

app.put('/api/admin/games/:id/image', requireAdmin, (req, res) => {
  const { id } = req.params;
  const idx = dataStore.games.findIndex((g) => g.id === id);
  if (idx === -1) return res.status(404).json({ error: 'اللعبة غير موجودة.' });
  const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl : '';
  dataStore.games[idx] = { ...dataStore.games[idx], imageUrl: imageUrl || undefined };
  persistStore(dataStore);
  return res.json({ game: dataStore.games[idx] });
});

app.delete('/api/admin/games/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  dataStore.games = dataStore.games.filter((g) => g.id !== id);
  persistStore(dataStore);
  return res.json({ ok: true });
});

app.post('/api/admin/games/reset', requireAdmin, (_req, res) => {
  dataStore.games = DEFAULT_GAMES.map((g) => ({ ...g }));
  persistStore(dataStore);
  return res.json({ games: dataStore.games });
});

// Sections CRUD
app.post('/api/admin/sections', requireAdmin, (req, res) => {
  const name = sanitizeText(String(req.body?.name || ''), 80);
  if (!name) return res.status(400).json({ error: 'اسم القسم مطلوب.' });
  const section: Section = {
    id: sanitizeText(String(req.body?.id || `sec_${Date.now().toString(36)}`), 50),
    name,
    icon: sanitizeText(String(req.body?.icon || '📂'), 16),
    description: sanitizeText(String(req.body?.description || ''), 200),
  };
  dataStore.sections.push(section);
  persistStore(dataStore);
  return res.status(201).json({ section });
});

app.put('/api/admin/sections/:id', requireAdmin, (req, res) => {
  const idx = dataStore.sections.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'القسم غير موجود.' });
  dataStore.sections[idx] = {
    ...dataStore.sections[idx],
    name: req.body?.name ? sanitizeText(String(req.body.name), 80) : dataStore.sections[idx].name,
    icon: req.body?.icon ? sanitizeText(String(req.body.icon), 16) : dataStore.sections[idx].icon,
    description: req.body?.description !== undefined ? sanitizeText(String(req.body.description), 200) : dataStore.sections[idx].description,
  };
  persistStore(dataStore);
  return res.json({ section: dataStore.sections[idx] });
});

app.delete('/api/admin/sections/:id', requireAdmin, (req, res) => {
  dataStore.sections = dataStore.sections.filter((s) => s.id !== req.params.id);
  persistStore(dataStore);
  return res.json({ ok: true });
});

// Topics CRUD & Custom Image
app.post('/api/admin/topics', requireAdmin, (req, res) => {
  const name = sanitizeText(String(req.body?.name || ''), 100);
  if (!name) return res.status(400).json({ error: 'اسم الموضوع مطلوب.' });
  const topic: Topic = {
    id: sanitizeText(String(req.body?.id || `top_${Date.now().toString(36)}`), 60),
    name,
    category: sanitizeText(String(req.body?.category || 'ثقافة وعامة'), 80),
    sectionId: sanitizeText(String(req.body?.sectionId || 'sec_culture'), 60),
    icon: sanitizeText(String(req.body?.icon || '✨'), 16),
    description: sanitizeText(String(req.body?.description || ''), 250),
    customImage: typeof req.body?.customImage === 'string' ? req.body.customImage : undefined,
  };
  dataStore.topics.push(topic);
  persistStore(dataStore);
  return res.status(201).json({ topic });
});

app.put('/api/admin/topics/:id', requireAdmin, (req, res) => {
  const idx = dataStore.topics.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'الموضوع غير موجود.' });
  const prev = dataStore.topics[idx];
  dataStore.topics[idx] = {
    ...prev,
    name: req.body?.name !== undefined ? sanitizeText(String(req.body.name), 100) : prev.name,
    category: req.body?.category !== undefined ? sanitizeText(String(req.body.category), 80) : prev.category,
    icon: req.body?.icon !== undefined ? sanitizeText(String(req.body.icon), 16) : prev.icon,
    description: req.body?.description !== undefined ? sanitizeText(String(req.body.description), 250) : prev.description,
  };
  persistStore(dataStore);
  return res.json({ topic: dataStore.topics[idx] });
});

app.put('/api/admin/topics/:id/image', requireAdmin, (req, res) => {
  const idx = dataStore.topics.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'الموضوع غير موجود.' });
  const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl : '';
  dataStore.topics[idx] = {
    ...dataStore.topics[idx],
    customImage: imageUrl || undefined,
    coverImage: imageUrl || undefined,
  };
  persistStore(dataStore);
  return res.json({ topic: dataStore.topics[idx] });
});

app.delete('/api/admin/topics/:id', requireAdmin, (req, res) => {
  dataStore.topics = dataStore.topics.filter((t) => t.id !== req.params.id);
  dataStore.questions = dataStore.questions.filter((q) => q.topicId !== req.params.id);
  persistStore(dataStore);
  return res.json({ ok: true });
});

// Questions CRUD
app.post('/api/admin/questions', requireAdmin, (req, res) => {
  const questionText = sanitizeText(String(req.body?.question || ''), 400);
  const answerText = sanitizeText(String(req.body?.answer || ''), 300);
  const topicId = sanitizeText(String(req.body?.topicId || ''), 60);
  if (!questionText || !answerText || !topicId) {
    return res.status(400).json({ error: 'السؤال والإجابة والموضوع مطلوبة.' });
  }
  const q: Question = {
    id: `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    topicId,
    points: ([200, 400, 600].includes(Number(req.body?.points)) ? Number(req.body.points) : 200) as 200 | 400 | 600,
    question: questionText,
    answer: answerText,
    hint: req.body?.hint ? sanitizeText(String(req.body.hint), 200) : undefined,
    explanation: req.body?.explanation ? sanitizeText(String(req.body.explanation), 300) : undefined,
    image: typeof req.body?.image === 'string' && req.body.image.trim() ? req.body.image.trim() : undefined,
    video: typeof req.body?.video === 'string' && req.body.video.trim() ? req.body.video.trim() : undefined,
  };
  dataStore.questions.unshift(q);
  persistStore(dataStore);
  return res.status(201).json({ question: q });
});

app.put('/api/admin/questions/:id', requireAdmin, (req, res) => {
  const idx = dataStore.questions.findIndex((q) => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'السؤال غير موجود.' });
  const prev = dataStore.questions[idx];
  dataStore.questions[idx] = {
    ...prev,
    points: req.body?.points ? Number(req.body.points) : prev.points,
    question: req.body?.question !== undefined ? sanitizeText(String(req.body.question), 400) : prev.question,
    answer: req.body?.answer !== undefined ? sanitizeText(String(req.body.answer), 300) : prev.answer,
    hint: req.body?.hint !== undefined ? sanitizeText(String(req.body.hint), 200) : prev.hint,
    explanation: req.body?.explanation !== undefined ? sanitizeText(String(req.body.explanation), 300) : prev.explanation,
    image: req.body?.image !== undefined ? (String(req.body.image).trim() || undefined) : prev.image,
    video: req.body?.video !== undefined ? (String(req.body.video).trim() || undefined) : prev.video,
  };
  persistStore(dataStore);
  return res.json({ question: dataStore.questions[idx] });
});

app.delete('/api/admin/questions/:id', requireAdmin, (req, res) => {
  dataStore.questions = dataStore.questions.filter((q) => q.id !== req.params.id);
  persistStore(dataStore);
  return res.json({ ok: true });
});

// Barrah Salfa Categories CRUD
app.post('/api/admin/barrah/categories', requireAdmin, (req, res) => {
  const name = sanitizeText(String(req.body?.name || ''), 80);
  if (!name) return res.status(400).json({ error: 'اسم القسم مطلوب.' });
  const words = Array.isArray(req.body?.words)
    ? req.body.words.map((w: unknown) => sanitizeText(String(w), 60)).filter(Boolean)
    : [];
  const cat: BarrahCategory = {
    id: sanitizeText(String(req.body?.id || `cat_${Date.now().toString(36)}`), 60),
    name,
    icon: sanitizeText(String(req.body?.icon || '🕵️'), 16),
    description: sanitizeText(String(req.body?.description || ''), 200),
    words,
  };
  dataStore.barrahCategories.push(cat);
  persistStore(dataStore);
  return res.status(201).json({ category: cat });
});

app.put('/api/admin/barrah/categories/:id', requireAdmin, (req, res) => {
  const idx = dataStore.barrahCategories.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'القسم غير موجود.' });
  const prev = dataStore.barrahCategories[idx];
  const words = Array.isArray(req.body?.words)
    ? req.body.words.map((w: unknown) => sanitizeText(String(w), 60)).filter(Boolean)
    : prev.words;
  dataStore.barrahCategories[idx] = {
    ...prev,
    name: req.body?.name ? sanitizeText(String(req.body.name), 80) : prev.name,
    icon: req.body?.icon ? sanitizeText(String(req.body.icon), 16) : prev.icon,
    description: req.body?.description !== undefined ? sanitizeText(String(req.body.description), 200) : prev.description,
    words,
  };
  persistStore(dataStore);
  return res.json({ category: dataStore.barrahCategories[idx] });
});

app.delete('/api/admin/barrah/categories/:id', requireAdmin, (req, res) => {
  dataStore.barrahCategories = dataStore.barrahCategories.filter((c) => c.id !== req.params.id);
  persistStore(dataStore);
  return res.json({ ok: true });
});

// Sound Mimic Bank CRUD
app.get('/api/admin/mimic/sounds', requireAdmin, (_req, res) => {
  res.json({ sounds: dataStore.mimicSounds });
});

app.post('/api/admin/mimic/sounds', requireAdmin, (req, res) => {
  const title = sanitizeText(String(req.body?.title || ''), 100);
  if (!title) return res.status(400).json({ error: 'عنوان المقطع الصوتي مطلوب.' });
  const sound: MimicSound = {
    id: `snd_${Date.now().toString(36)}`,
    title,
    category: sanitizeText(String(req.body?.category || 'مؤثرات'), 60),
    audioDataUrl: typeof req.body?.audioDataUrl === 'string' ? req.body.audioDataUrl : undefined,
    durationSec: Number(req.body?.durationSec) || undefined,
    hint: req.body?.hint ? sanitizeText(String(req.body.hint), 180) : undefined,
  };
  dataStore.mimicSounds.unshift(sound);
  persistStore(dataStore);
  return res.status(201).json({ sound });
});

app.put('/api/admin/mimic/sounds/:id', requireAdmin, (req, res) => {
  const idx = dataStore.mimicSounds.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'المقطع غير موجود.' });
  const prev = dataStore.mimicSounds[idx];
  dataStore.mimicSounds[idx] = {
    ...prev,
    title: req.body?.title ? sanitizeText(String(req.body.title), 100) : prev.title,
    category: req.body?.category ? sanitizeText(String(req.body.category), 60) : prev.category,
    hint: req.body?.hint !== undefined ? sanitizeText(String(req.body.hint), 180) : prev.hint,
    audioDataUrl: typeof req.body?.audioDataUrl === 'string' ? req.body.audioDataUrl : prev.audioDataUrl,
  };
  persistStore(dataStore);
  return res.json({ sound: dataStore.mimicSounds[idx] });
});

app.delete('/api/admin/mimic/sounds/:id', requireAdmin, (req, res) => {
  dataStore.mimicSounds = dataStore.mimicSounds.filter((s) => s.id !== req.params.id);
  persistStore(dataStore);
  return res.json({ ok: true });
});

// Cheat Codes Admin CRUD (100 Effect Types)
app.get('/api/admin/cheats', requireAdmin, (_req, res) => {
  res.json({ cheatCodes: dataStore.cheatCodes || [] });
});

app.post('/api/admin/cheats', requireAdmin, (req, res) => {
  const code = sanitizeText(String(req.body?.code || '').trim().toUpperCase(), 32);
  const effectId = Math.max(1, Math.min(100, Number(req.body?.effectId) || 1));
  if (!code || code.length < 2) {
    return res.status(400).json({ error: 'أدخل رمز الكود (أحرف أو أرقام - خانتان على الأقل).' });
  }
  const effectDef = CHEAT_EFFECTS_CATALOG.find((e) => e.id === effectId) || CHEAT_EFFECTS_CATALOG[0];
  const cheat: CheatCodeConfig = {
    id: `cht_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    code,
    effectId,
    effectTitle: effectDef.title,
    description: sanitizeText(String(req.body?.description || effectDef.description), 200),
    enabled: req.body?.enabled !== false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  };
  dataStore.cheatCodes = [cheat, ...(dataStore.cheatCodes || [])];
  persistStore(dataStore);
  return res.status(201).json({ cheat });
});

app.put('/api/admin/cheats/:id', requireAdmin, (req, res) => {
  const cheats = dataStore.cheatCodes || [];
  const idx = cheats.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'الكود غير موجود.' });
  const prev = cheats[idx];
  const effectId = req.body?.effectId ? Math.max(1, Math.min(100, Number(req.body.effectId))) : prev.effectId;
  const effectDef = CHEAT_EFFECTS_CATALOG.find((e) => e.id === effectId);
  cheats[idx] = {
    ...prev,
    code: req.body?.code ? sanitizeText(String(req.body.code).trim().toUpperCase(), 32) : prev.code,
    effectId,
    effectTitle: effectDef ? effectDef.title : prev.effectTitle,
    enabled: req.body?.enabled !== undefined ? Boolean(req.body.enabled) : prev.enabled,
    description: req.body?.description !== undefined ? sanitizeText(String(req.body.description), 200) : prev.description,
  };
  dataStore.cheatCodes = cheats;
  persistStore(dataStore);
  return res.json({ cheat: cheats[idx] });
});

app.delete('/api/admin/cheats/:id', requireAdmin, (req, res) => {
  dataStore.cheatCodes = (dataStore.cheatCodes || []).filter((c) => c.id !== req.params.id);
  persistStore(dataStore);
  return res.json({ ok: true });
});

// Dub Mic Cartoon Scenes CRUD
app.post('/api/admin/dub-scenes', requireAdmin, (req, res) => {
  const title = sanitizeText(String(req.body?.title || ''), 120);
  const workTitle = sanitizeText(String(req.body?.workTitle || 'كرتون كلاسيكي'), 140);
  const videoUrl = String(req.body?.videoUrl || '').trim();
  if (!title || !videoUrl) {
    return res.status(400).json({ error: 'عنوان المشهد ورابط الفيديو مطلوبان.' });
  }
  const clipStartSec = Math.max(0, Number(req.body?.clipStartSec) || 0);
  const clipEndSec = Math.max(clipStartSec + 5, Number(req.body?.clipEndSec) || clipStartSec + 20);
  const durationSec = Math.max(5, clipEndSec - clipStartSec);
  const charsInput = Array.isArray(req.body?.characters) ? req.body.characters : [];
  const characters: DubSceneCharacter[] = charsInput.length > 0
    ? charsInput.map((c: Partial<DubSceneCharacter>, i: number) => ({
        id: c.id || `c${i + 1}`,
        name: sanitizeText(String(c.name || `الشخصية ${i + 1}`), 40),
        originalName: sanitizeText(String(c.originalName || `Character ${i + 1}`), 40),
        roleColor: String(c.roleColor || (i % 2 === 0 ? '#F97316' : '#0EA5E9')),
        cueStartSec: Number(c.cueStartSec ?? (i === 0 ? 0 : Math.floor(durationSec / 2))),
        cueEndSec: Number(c.cueEndSec ?? (i === 0 ? Math.floor(durationSec / 2) : durationSec)),
        englishHint: c.englishHint ? sanitizeText(String(c.englishHint), 120) : undefined,
      }))
    : [
        { id: 'c1', name: 'الشخصية الأولى', originalName: 'Lead 1', roleColor: '#F97316', cueStartSec: 0, cueEndSec: Math.floor(durationSec / 2) },
        { id: 'c2', name: 'الشخصية الثانية', originalName: 'Lead 2', roleColor: '#0EA5E9', cueStartSec: Math.floor(durationSec / 2), cueEndSec: durationSec },
      ];

  const scene: DubMicScene = {
    id: `dub_${Date.now().toString(36)}`,
    title,
    workTitle,
    category: sanitizeText(String(req.body?.category || 'كوميديا'), 50),
    durationSec,
    clipStartSec,
    clipEndSec,
    videoUrl,
    thumbnailUrl: req.body?.thumbnailUrl ? String(req.body.thumbnailUrl).trim() : undefined,
    description: sanitizeText(String(req.body?.description || 'مشهد كرتوني مضحك جاهز للدوبلاج العربي'), 280),
    characters,
    isCustom: true,
  };
  dataStore.dubScenes = [scene, ...(dataStore.dubScenes || [])];
  persistStore(dataStore);
  return res.status(201).json({ scene });
});

app.put('/api/admin/dub-scenes/:id', requireAdmin, (req, res) => {
  const scenes = dataStore.dubScenes || [];
  const idx = scenes.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'المشهد غير موجود.' });
  const prev = scenes[idx];
  const clipStartSec = req.body?.clipStartSec !== undefined ? Math.max(0, Number(req.body.clipStartSec)) : prev.clipStartSec;
  const clipEndSec = req.body?.clipEndSec !== undefined ? Math.max(clipStartSec + 5, Number(req.body.clipEndSec)) : prev.clipEndSec;
  scenes[idx] = {
    ...prev,
    title: req.body?.title ? sanitizeText(String(req.body.title), 120) : prev.title,
    workTitle: req.body?.workTitle ? sanitizeText(String(req.body.workTitle), 140) : prev.workTitle,
    category: req.body?.category ? sanitizeText(String(req.body.category), 50) : prev.category,
    videoUrl: req.body?.videoUrl ? String(req.body.videoUrl).trim() : prev.videoUrl,
    thumbnailUrl: req.body?.thumbnailUrl !== undefined ? (String(req.body.thumbnailUrl).trim() || undefined) : prev.thumbnailUrl,
    description: req.body?.description !== undefined ? sanitizeText(String(req.body.description), 280) : prev.description,
    clipStartSec,
    clipEndSec,
    durationSec: Math.max(5, clipEndSec - clipStartSec),
  };
  dataStore.dubScenes = scenes;
  persistStore(dataStore);
  return res.json({ scene: scenes[idx] });
});

app.delete('/api/admin/dub-scenes/:id', requireAdmin, (req, res) => {
  dataStore.dubScenes = (dataStore.dubScenes || []).filter((s) => s.id !== req.params.id);
  persistStore(dataStore);
  return res.json({ ok: true });
});

// Bug Reports Admin
app.get('/api/admin/reports', requireAdmin, (_req, res) => {
  res.json({ reports: dataStore.reports });
});

app.put('/api/admin/reports/:id', requireAdmin, (req, res) => {
  const idx = dataStore.reports.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'البلاغ غير موجود.' });
  const status = req.body?.status;
  if (['new', 'investigating', 'resolved'].includes(status)) {
    dataStore.reports[idx] = { ...dataStore.reports[idx], status };
    persistStore(dataStore);
  }
  return res.json({ report: dataStore.reports[idx] });
});

app.delete('/api/admin/reports/:id', requireAdmin, (req, res) => {
  dataStore.reports = dataStore.reports.filter((r) => r.id !== req.params.id);
  persistStore(dataStore);
  return res.json({ ok: true });
});

// Export & Import Backup
app.get('/api/admin/export', requireAdmin, (_req, res) => {
  res.json(dataStore);
});

app.post('/api/admin/import', requireAdmin, (req, res) => {
  const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
  const payload = req.body?.data as Partial<DataStoreSnapshot>;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'ملف النسخة الاحتياطية غير صالح.' });
  }
  if (mode === 'replace') {
    dataStore = {
      sections: Array.isArray(payload.sections) ? payload.sections : dataStore.sections,
      topics: Array.isArray(payload.topics) ? payload.topics : dataStore.topics,
      questions: Array.isArray(payload.questions) ? payload.questions : dataStore.questions,
      games: Array.isArray(payload.games) ? payload.games : dataStore.games,
      barrahCategories: Array.isArray(payload.barrahCategories) ? payload.barrahCategories : dataStore.barrahCategories,
      reports: Array.isArray(payload.reports) ? payload.reports : dataStore.reports,
      mimicSounds: Array.isArray(payload.mimicSounds) ? payload.mimicSounds : dataStore.mimicSounds,
      cheatCodes: Array.isArray(payload.cheatCodes) ? payload.cheatCodes : dataStore.cheatCodes,
      dubScenes: Array.isArray(payload.dubScenes) ? payload.dubScenes : dataStore.dubScenes,
      users: payload.users && typeof payload.users === 'object' ? payload.users : dataStore.users,
    };
  } else {
    dataStore = {
      sections: reconcileById(dataStore.sections, payload.sections),
      topics: reconcileById(dataStore.topics, payload.topics),
      questions: reconcileById(dataStore.questions, payload.questions),
      games: reconcileById(dataStore.games, payload.games),
      barrahCategories: reconcileById(dataStore.barrahCategories, payload.barrahCategories),
      reports: reconcileById(dataStore.reports, payload.reports),
      mimicSounds: reconcileById(dataStore.mimicSounds, payload.mimicSounds),
      cheatCodes: reconcileById(dataStore.cheatCodes || [], payload.cheatCodes),
      dubScenes: reconcileById(dataStore.dubScenes || [], payload.dubScenes),
      users: { ...(dataStore.users || {}), ...(payload.users || {}) },
    };
  }
  persistStore(dataStore);
  return res.json({ ok: true, store: dataStore });
});

// AI Game Designer (Server-side @google/genai + Deterministic Fallback)
function buildFallbackGameFromPrompt(prompt: string): GameConfig {
  const clean = sanitizeText(prompt, 220) || 'تحدي المجلس السريع';
  const shortTitle = clean.split(/[.،!\n]/)[0].slice(0, 32) || 'تحدي جَمْر المبتكر';
  return {
    id: `ai_${Date.now().toString(36)}`,
    title: shortTitle,
    subtitle: 'تصميم مولّد تلقائياً لإشعال حماس الجلسة',
    description: `لعبة جماعية عربية مبنية حول فكرة: ${clean}. تتنافس فيها المجموعات بسرعة البديهة والضحك.`,
    icon: '🎲',
    category: 'تصميم ذكي',
    minPlayers: 3,
    maxPlayers: 16,
    duration: '15 دقيقة',
    difficulty: 'متوسطة',
    tags: ['جديد ✨', 'أوفلاين'],
    supportsOffline: true,
    supportsOnline: false,
    isActive: true,
    underMaintenance: false,
    bgGradient: 'from-amber-600/30 via-orange-600/20 to-rose-700/25',
    accentColor: '#F97316',
    rules: [
      'ينقسم اللاعبون أو يلعبون بشكل فردي في جولات سريعة.',
      'يُطرح تحدي الجولة بناءً على الفكرة الأساسية للعبة.',
      'يُمنح اللاعبون نقاطاً مقابل الإبداع والسرعة والضحك.',
    ],
    specialMechanic: 'آلية جولات ديناميكية مصممة حسب الطلب.',
    isCustom: true,
  };
}

app.post('/api/admin/ai/games', requireAdmin, async (req, res) => {
  const prompt = sanitizeText(String(req.body?.prompt || ''), 800);
  if (!prompt) {
    return res.status(400).json({ error: 'يرجى كتابة وصف اللعبة المطلوبة.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const fallbackGame = buildFallbackGameFromPrompt(prompt);
    return res.json({ game: fallbackGame, source: 'fallback' });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `صمم لعبة جماعية عربية جديدة لمنصة "جَمْر" بناءً على هذا الطلب:\n"${prompt}"`,
      config: {
        systemInstruction:
          'أنت مصمم ألعاب جماعية عربية محترف. أرجع JSON فقط يصف لعبة ممتعة وواضحة بالعربية.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            description: { type: Type.STRING },
            icon: { type: Type.STRING },
            category: { type: Type.STRING },
            minPlayers: { type: Type.INTEGER },
            maxPlayers: { type: Type.INTEGER },
            duration: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            rules: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            specialMechanic: { type: Type.STRING },
          },
          required: ['title', 'subtitle', 'description', 'icon', 'category', 'minPlayers', 'maxPlayers', 'duration', 'difficulty', 'rules'],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    const generated: GameConfig = {
      id: `ai_${Date.now().toString(36)}`,
      title: sanitizeText(String(parsed.title || 'لعبة جديدة'), 80),
      subtitle: sanitizeText(String(parsed.subtitle || 'تجربة جماعية ممتعة'), 150),
      description: sanitizeText(String(parsed.description || prompt), 500),
      icon: sanitizeText(String(parsed.icon || '🎲'), 12),
      category: sanitizeText(String(parsed.category || 'ابتكار'), 50),
      minPlayers: Math.max(2, Number(parsed.minPlayers) || 3),
      maxPlayers: Math.min(30, Math.max(3, Number(parsed.maxPlayers) || 12)),
      duration: sanitizeText(String(parsed.duration || '15-20 دقيقة'), 40),
      difficulty: sanitizeText(String(parsed.difficulty || 'متوسطة'), 30),
      tags: ['جديد ✨', 'ذكاء اصطناعي'],
      supportsOffline: true,
      supportsOnline: false,
      isActive: true,
      underMaintenance: false,
      bgGradient: 'from-amber-600/30 via-orange-600/20 to-rose-700/25',
      accentColor: '#F97316',
      rules: Array.isArray(parsed.rules) ? parsed.rules.map((r: unknown) => sanitizeText(String(r), 260)) : [],
      specialMechanic: parsed.specialMechanic ? sanitizeText(String(parsed.specialMechanic), 200) : undefined,
      isCustom: true,
    };
    return res.json({ game: generated, source: 'gemini' });
  } catch (err) {
    console.warn('[JAMR] Gemini AI game generation fallback triggered:', err);
    const fallbackGame = buildFallbackGameFromPrompt(prompt);
    return res.json({ game: fallbackGame, source: 'fallback' });
  }
});

// ---------------------------------------------------------------------------
// HTTP Server + WebSocket Multiplayer Server + REST Room Sync Fallback
// ---------------------------------------------------------------------------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

interface ClientMeta {
  ws: WebSocket;
  playerId: string;
  username?: string | null;
  roomCode: string | null;
}

const rooms = new Map<string, RoomState>();
const roomLastActivity = new Map<string, number>();
const clients = new Map<WebSocket, ClientMeta>();

function pushRoomChatNotifications(room: RoomState, sender: Player, text: string) {
  const users = dataStore.users || {};
  const gameTitle = dataStore.games.find((g) => g.id === room.gameId)?.title || 'غرفة جَمْر';
  for (const p of room.players) {
    if (p.id === sender.id) continue;
    const rec = Object.values(users).find((u) => u.playerId === p.id);
    if (!rec) continue;
    pushUserNotification(rec.username, {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'room_chat',
      title: `رسالة جديدة في ${gameTitle} 💬`,
      body: `${sender.name}: ${text}`,
      fromDisplayName: sender.name,
      fromAvatar: sender.avatar,
      fromAvatarBg: sender.avatarBg,
      roomCode: room.code,
      gameId: room.gameId,
      gameTitle,
      read: false,
      createdAt: Date.now(),
    });
  }
}

function awardDubXpAndAchievements(room: RoomState, nextDub: NonNullable<RoomState['dubMic']>) {
  const users = dataStore.users || {};
  let changed = false;
  for (const p of room.players) {
    const rec = Object.values(users).find((u) => u.playerId === p.id);
    if (!rec) continue;
    const pts = nextDub.scoresDelta?.[p.id] || 0;
    rec.dubXp = (rec.dubXp || 0) + Math.max(10, pts);
    const award = nextDub.roundAwards?.find((a) => a.playerId === p.id);
    if (award?.title) {
      rec.dubTitles = Array.from(new Set([award.title, ...(rec.dubTitles || [])])).slice(0, 12);
    }
    if (award?.achievement) {
      rec.dubAchievements = Array.from(new Set([award.achievement, ...(rec.dubAchievements || [])])).slice(0, 12);
    }
    changed = true;
  }
  if (changed) {
    persistStore(dataStore);
  }
}

function touchRoom(code: string) {
  roomLastActivity.set(code, Date.now());
}

function sendWs(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function sanitizeRoomForClient(room: RoomState): RoomState {
  if (
    room.gameId === 'smart_detective' &&
    room.detective &&
    room.detective.phase !== 'case_closed'
  ) {
    return {
      ...room,
      detective: {
        ...room.detective,
        accusationsByPlayer: undefined,
        revealedSolution: null,
      },
    };
  }
  return room;
}

function broadcastRoom(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;
  touchRoom(roomCode);
  const safeRoom = sanitizeRoomForClient(room);
  const payload = JSON.stringify({ type: 'room_state', room: safeRoom });
  clients.forEach((meta) => {
    if (meta.roomCode === roomCode && meta.ws.readyState === WebSocket.OPEN) {
      meta.ws.send(payload);
    }
  });
}

function removePlayerFromRoom(code: string, playerId: string, reasonText?: string) {
  const room = rooms.get(code);
  if (!room) return;
  const remaining = room.players.filter((p) => p.id !== playerId);
  if (remaining.length === 0) {
    rooms.delete(code);
    roomLastActivity.delete(code);
    return;
  }

  let newHostId = room.hostId;
  let updatedPlayers = remaining;
  if (room.hostId === playerId) {
    const nextHost = remaining.find((p) => p.connected) || remaining[0];
    newHostId = nextHost.id;
    updatedPlayers = remaining.map((p) => ({ ...p, isHost: p.id === newHostId }));
  }

  const leaver = room.players.find((p) => p.id === playerId);
  const updatedRoom: RoomState = {
    ...room,
    hostId: newHostId,
    players: updatedPlayers,
    messages: appendSystemChat(room, reasonText || `غادر ${leaver?.name || 'لاعب'} الغرفة.`),
  };
  rooms.set(code, updatedRoom);
  broadcastRoom(code);
}

function handleDisconnect(ws: WebSocket, explicitLeave = false) {
  const meta = clients.get(ws);
  if (!meta) return;
  clients.delete(ws);

  if (!meta.roomCode) return;
  const room = rooms.get(meta.roomCode);
  if (!room) return;

  if (explicitLeave) {
    removePlayerFromRoom(room.code, meta.playerId);
    return;
  }

  // Keep player & room alive during temporary WebSocket drops/reconnects
  const hasOtherSocket = Array.from(clients.values()).some(
    (c) => c.roomCode === room.code && c.playerId === meta.playerId && c.ws.readyState === WebSocket.OPEN
  );
  if (hasOtherSocket) return;

  const updatedRoom: RoomState = {
    ...room,
    players: room.players.map((p) =>
      p.id === meta.playerId ? { ...p, connected: false } : p
    ),
  };
  rooms.set(room.code, updatedRoom);
  broadcastRoom(room.code);
}

function createRoomOnServer(data: Record<string, unknown>, fallbackPlayerId: string): { room?: RoomState; error?: string } {
  const gameId = String(data.gameId || 'broken_tv');
  const targetGame = dataStore.games.find((g) => g.id === gameId);
  if (targetGame && (targetGame.underMaintenance || !targetGame.isActive)) {
    return { error: 'هذه اللعبة حالياً تحت الصيانة والتطوير.' };
  }

  const pid = typeof data.playerId === 'string' && data.playerId ? data.playerId : fallbackPlayerId;
  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }
  const playerName = sanitizeText(String(data.playerName || 'المضيف'), 30) || 'المضيف';
  const avatar = sanitizeAvatarPayload(data.avatar, 'char_01');
  const avatarBg = sanitizeText(String(data.avatarBg || ''), 32) || undefined;
  const isJudgeRoom = Boolean(data.isJudgeRoom) && gameId === 'ism_hayawan';
  const totalRounds = Math.max(1, Math.min(50, Number(data.totalRounds) || 5));
  const selectedCaseId = sanitizeText(
    String(data.selectedCaseId || PUBLIC_DETECTIVE_CASES[0].id),
    40
  );

  const hostPlayer: Player = {
    id: pid,
    name: playerName,
    avatar,
    avatarBg,
    isHost: true,
    isReady: true,
    team: null,
    score: 0,
    connected: true,
    isJudge: isJudgeRoom,
  };

  const room: RoomState = {
    code,
    hostId: pid,
    gameId,
    status: 'lobby',
    maxPlayers: gameId === 'ism_hayawan' ? 100 : 16,
    players: [hostPlayer],
    messages: [],
    createdAt: Date.now(),
    isJudgeRoom,
    totalRounds,
    selectedCaseId,
  };
  room.messages = appendSystemChat(room, `أنشأ ${playerName} الغرفة بنجاح.`);
  rooms.set(code, room);
  touchRoom(code);
  return { room };
}

function joinRoomOnServer(data: Record<string, unknown>, fallbackPlayerId: string): { room?: RoomState; playerId?: string; error?: string } {
  const code = String(data.roomCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const room = rooms.get(code);
  if (!room) {
    return { error: 'رمز الغرفة غير صحيح أو انتهت الجلسة.' };
  }

  const incomingId =
    typeof data.existingPlayerId === 'string' && data.existingPlayerId
      ? data.existingPlayerId
      : typeof data.playerId === 'string' && data.playerId
        ? data.playerId
        : fallbackPlayerId;

  const incomingName = sanitizeText(String(data.playerName || ''), 30);
  const incomingAvatar = data.avatar ? sanitizeAvatarPayload(data.avatar, '') : '';
  const incomingAvatarBg = sanitizeText(String(data.avatarBg || ''), 32);

  const existing = room.players.find((p) => p.id === incomingId);
  if (existing) {
    room.players = room.players.map((p) =>
      p.id === incomingId
        ? {
            ...p,
            connected: true,
            name: incomingName || p.name,
            avatar: incomingAvatar || p.avatar,
            avatarBg: incomingAvatarBg || p.avatarBg,
          }
        : p
    );
  } else {
    if (room.players.length >= room.maxPlayers) {
      return { error: `الغرفة ممتلئة (الحد الأقصى ${room.maxPlayers} لاعب).` };
    }
    const playerName = incomingName || 'ضيف';
    const avatar = incomingAvatar || 'char_04';
    room.players.push({
      id: incomingId,
      name: playerName,
      avatar,
      avatarBg: incomingAvatarBg || undefined,
      isHost: false,
      isReady: false,
      team: null,
      score: 0,
      connected: true,
    });
    room.messages = appendSystemChat(room, `انضم ${playerName} إلى الغرفة!`);
  }
  rooms.set(code, room);
  touchRoom(code);
  return { room, playerId: incomingId };
}

function applyRoomActionOnServer(
  initialRoom: RoomState,
  pid: string,
  data: Record<string, unknown>
): { room: RoomState; error?: string; stop?: boolean } {
  let room = initialRoom;
  const type = String(data.type || '');

  switch (type) {
    case 'toggle_ready': {
      room = {
        ...room,
        players: room.players.map((p) => (p.id === pid ? { ...p, isReady: !p.isReady } : p)),
      };
      break;
    }
    case 'set_team': {
      room = {
        ...room,
        players: room.players.map((p) =>
          p.id === pid ? { ...p, team: (data.team as 'A' | 'B' | null) || null } : p
        ),
      };
      break;
    }
    case 'change_game': {
      if (pid !== room.hostId) break;
      const newGameId = String(data.gameId || room.gameId);
      const target = dataStore.games.find((g) => g.id === newGameId);
      if (target && (target.underMaintenance || !target.isActive)) {
        return { room, error: 'هذه اللعبة تحت التعديل والصيانة حالياً.' };
      }
      room = {
        ...room,
        gameId: newGameId,
        status: 'lobby',
        maxPlayers: newGameId === 'ism_hayawan' ? 100 : 16,
        brokenTv: undefined,
        ismHayawan: undefined,
        barrah: undefined,
        mafia: undefined,
        detective: undefined,
        dubMic: undefined,
        messages: appendSystemChat(room, `تم تغيير اللعبة إلى: ${target?.title || newGameId}`),
      };
      break;
    }
    case 'kick_player': {
      if (pid !== room.hostId) break;
      const targetId = String(data.targetId || '');
      if (!targetId || targetId === room.hostId) break;
      clients.forEach((cMeta) => {
        if (cMeta.roomCode === room.code && cMeta.playerId === targetId) {
          sendWs(cMeta.ws, { type: 'kicked' });
          cMeta.roomCode = null;
        }
      });
      const kicked = room.players.find((p) => p.id === targetId);
      room = {
        ...room,
        players: room.players.filter((p) => p.id !== targetId),
        messages: appendSystemChat(room, `تم إخراج ${kicked?.name || 'لاعب'} من الغرفة.`),
      };
      break;
    }
    case 'chat_message':
    case 'send_chat': {
      const sender = room.players.find((p) => p.id === pid);
      const text = sanitizeText(String(data.text || ''), 240);
      if (sender && text) {
        room = {
          ...room,
          messages: [
            ...room.messages,
            {
              id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
              senderId: sender.id,
              senderName: sender.name,
              senderAvatar: sender.avatar,
              senderAvatarBg: sender.avatarBg,
              text,
              timestamp: Date.now(),
            },
          ].slice(-80),
        };
        pushRoomChatNotifications(room, sender, text);
      }
      break;
    }
    case 'voice_signal': {
      const targetId = String(data.toId || data.targetId || '');
      clients.forEach((cMeta) => {
        if (
          cMeta.roomCode === room.code &&
          (!targetId || cMeta.playerId === targetId) &&
          cMeta.playerId !== pid
        ) {
          sendWs(cMeta.ws, {
            type: 'voice_signal',
            fromId: pid,
            toId: targetId || undefined,
            signal: data.signal,
            voiceActive: data.voiceActive,
            muted: data.muted,
          });
        }
      });
      return { room, stop: true };
    }
    case 'return_to_lobby': {
      room = {
        ...room,
        status: 'lobby',
        brokenTv: undefined,
        ismHayawan: undefined,
        barrah: undefined,
        mafia: undefined,
        detective: undefined,
        dubMic: undefined,
      };
      break;
    }
    case 'start_game': {
      if (pid !== room.hostId) break;
      if (room.gameId === 'broken_tv') {
        const pace = ([40, 60, 90].includes(Number(data.paceSeconds)) ? Number(data.paceSeconds) : 60) as 40 | 60 | 90;
        const bt = createInitialBrokenTvState(room.players, pace);
        bt.phase = 'write';
        bt.roundDeadline = Date.now() + pace * 1000;
        room = { ...room, status: 'playing', brokenTv: bt };
      } else if (room.gameId === 'ism_hayawan') {
        const rounds = Math.max(1, Math.min(50, Number(data.totalRounds || room.totalRounds || 5)));
        const ism = createInitialIsmState(rounds, Boolean(room.isJudgeRoom), room.isJudgeRoom ? room.hostId : null);
        ism.phase = 'letter_spin';
        room = { ...room, status: 'playing', ismHayawan: ism };
      } else if (room.gameId === 'barrah_salfa') {
        // Players enter Barrah Salfa and vote on the topic/category inside the game
        room = startBarrahCategoryVote(room);
      } else if (room.gameId === 'mafia_no_hakam') {
        room = startMafiaOnlineRound(room);
      } else if (room.gameId === 'smart_detective') {
        const caseId = sanitizeText(
          String(data.selectedCaseId || room.selectedCaseId || PUBLIC_DETECTIVE_CASES[0].id),
          40
        );
        room = {
          ...room,
          status: 'playing',
          selectedCaseId: caseId,
          detective: createInitialDetectiveState(caseId),
        };
      } else if (room.gameId === 'dub_mic') {
        const mode = (['live_dub', 'habd_dub', 'group_acting', 'pvp'].includes(String(data.dubMode))
          ? String(data.dubMode)
          : 'live_dub') as DubMicMode;
        const scenesPool = dataStore.dubScenes && dataStore.dubScenes.length > 0 ? dataStore.dubScenes : DEFAULT_DUB_SCENES;
        const sceneId = String(data.selectedSceneId || scenesPool[0]?.id || '');
        room = {
          ...room,
          status: 'playing',
          dubMic: createInitialDubMicState(room.players, scenesPool, sceneId, mode),
          messages: appendSystemChat(room, 'انطلقت جولة «مايك الدوبلاج»! استعدوا للهبد بالعربي 🎙️🎬'),
        };
      }
      break;
    }
    case 'broken_tv_submit': {
      room = applyBrokenTvStepSubmission(room, pid, String(data.content || ''));
      break;
    }
    case 'broken_tv_react': {
      room = applyBrokenTvReaction(
        room,
        Number(data.chainIndex || 0),
        Number(data.stepIndex || 0),
        data.reaction as BrokenTvReactionType,
        pid
      );
      break;
    }
    case 'broken_tv_advance_reveal': {
      if (room.brokenTv && pid === room.hostId) {
        const bt = room.brokenTv;
        const chain = bt.chains[bt.revealChainIndex];
        if (chain && bt.revealStepIndex + 1 < chain.steps.length) {
          room = { ...room, brokenTv: { ...bt, revealStepIndex: bt.revealStepIndex + 1 } };
        } else if (bt.revealChainIndex + 1 < bt.chains.length) {
          room = { ...room, brokenTv: { ...bt, revealChainIndex: bt.revealChainIndex + 1, revealStepIndex: 0 } };
        } else {
          room = { ...room, brokenTv: { ...bt, phase: 'podium' } };
        }
      }
      break;
    }
    case 'ism_hayawan_set_letter': {
      if (room.ismHayawan && pid === room.hostId) {
        const letter = String(data.letter || pickUnusedArabicLetter(room.ismHayawan.usedLetters));
        room = {
          ...room,
          ismHayawan: {
            ...room.ismHayawan,
            currentLetter: letter,
            usedLetters: [...room.ismHayawan.usedLetters, letter],
            phase: 'writing',
            stoppedByPlayerName: null,
            answersByPlayer: {},
            disputes: [],
          },
        };
      }
      break;
    }
    case 'ism_hayawan_sync_answers': {
      if (room.ismHayawan) {
        room = {
          ...room,
          ismHayawan: {
            ...room.ismHayawan,
            answersByPlayer: {
              ...room.ismHayawan.answersByPlayer,
              [pid]: data.answers as IsmPlayerAnswers,
            },
          },
        };
      }
      break;
    }
    case 'ism_hayawan_stop': {
      if (room.ismHayawan && room.ismHayawan.phase === 'writing') {
        const stopper = room.players.find((p) => p.id === pid);
        const mergedAnswers = {
          ...room.ismHayawan.answersByPlayer,
          ...(data.answers ? { [pid]: data.answers as IsmPlayerAnswers } : {}),
        };
        const stopperAnswers = mergedAnswers[pid];
        if (!areAllIsmFieldsFilled(stopperAnswers)) {
          return { room, error: 'أكمل كتابة جميع الخانات الـ 5 قبل الضغط على ستوب!' };
        }
        const updatedIsm: NonNullable<RoomState['ismHayawan']> = {
          ...room.ismHayawan,
          phase: 'scoring',
          stoppedByPlayerName: stopper?.name || 'أحد اللاعبين',
          answersByPlayer: mergedAnswers,
        };
        const { fieldScoresByPlayer, roundTotalsByPlayer, reasonsByPlayer } = computeIsmScores(updatedIsm, room.players);
        updatedIsm.fieldScoresByPlayer = fieldScoresByPlayer;
        updatedIsm.roundTotalsByPlayer = roundTotalsByPlayer;
        updatedIsm.reasonsByPlayer = reasonsByPlayer;
        updatedIsm.analyzedBy = 'saudi_arabic_index';
        room = {
          ...room,
          ismHayawan: updatedIsm,
          players: room.players.map((p) => ({
            ...p,
            score: p.score + (roundTotalsByPlayer[p.id] || 0),
          })),
        };
      }
      break;
    }
    case 'ism_hayawan_apply_ai_analysis': {
      if (room.ismHayawan && pid === room.hostId) {
        const nextFieldScores = data.fieldScoresByPlayer as Record<string, Record<IsmFieldKey, number>>;
        const nextRoundTotals = data.roundTotalsByPlayer as Record<string, number>;
        const nextReasons = data.reasonsByPlayer as Record<string, Record<IsmFieldKey, IsmFieldEvaluation>> | undefined;
        const prevTotals = room.ismHayawan.roundTotalsByPlayer || {};
        room = {
          ...room,
          players: room.players.map((p) => {
            const prevPts = prevTotals[p.id] || 0;
            const nextPts = nextRoundTotals?.[p.id] ?? prevPts;
            return { ...p, score: Math.max(0, p.score - prevPts + nextPts) };
          }),
          ismHayawan: {
            ...room.ismHayawan,
            fieldScoresByPlayer: nextFieldScores || room.ismHayawan.fieldScoresByPlayer,
            roundTotalsByPlayer: nextRoundTotals || room.ismHayawan.roundTotalsByPlayer,
            reasonsByPlayer: nextReasons || room.ismHayawan.reasonsByPlayer,
            analyzedBy: (data.analyzedBy as 'gemini_ai' | 'saudi_arabic_index' | 'manual') || 'gemini_ai',
          },
        };
      }
      break;
    }
    case 'ism_hayawan_set_field_score': {
      if (room.ismHayawan && pid === room.hostId) {
        const targetId = String(data.targetPlayerId || '');
        const field = data.field as IsmFieldKey;
        const newPts = Math.max(0, Math.min(10, Number(data.points || 0)));
        const prevPts = room.ismHayawan.fieldScoresByPlayer[targetId]?.[field] || 0;
        const diff = newPts - prevPts;
        room = {
          ...room,
          players: room.players.map((p) =>
            p.id === targetId ? { ...p, score: Math.max(0, p.score + diff) } : p
          ),
          ismHayawan: {
            ...room.ismHayawan,
            fieldScoresByPlayer: {
              ...room.ismHayawan.fieldScoresByPlayer,
              [targetId]: {
                ...(room.ismHayawan.fieldScoresByPlayer[targetId] || { name: 0, animal: 0, plant: 0, object: 0, country: 0 }),
                [field]: newPts,
              },
            },
            roundTotalsByPlayer: {
              ...room.ismHayawan.roundTotalsByPlayer,
              [targetId]: Math.max(0, (room.ismHayawan.roundTotalsByPlayer[targetId] || 0) + diff),
            },
          },
        };
      }
      break;
    }
    case 'ism_hayawan_judge_score_adjust': {
      if (room.ismHayawan && pid === room.hostId) {
        const targetId = String(data.targetPlayerId || '');
        const delta = Number(data.delta || 0);
        room = {
          ...room,
          players: room.players.map((p) =>
            p.id === targetId ? { ...p, score: Math.max(0, p.score + delta) } : p
          ),
          ismHayawan: {
            ...room.ismHayawan,
            roundTotalsByPlayer: {
              ...room.ismHayawan.roundTotalsByPlayer,
              [targetId]: Math.max(0, (room.ismHayawan.roundTotalsByPlayer[targetId] || 0) + delta),
            },
          },
        };
      }
      break;
    }
    case 'ism_hayawan_dispute': {
      if (room.ismHayawan) {
        const challenger = room.players.find((p) => p.id === pid);
        const targetId = String(data.targetPlayerId || '');
        const target = room.players.find((p) => p.id === targetId);
        const field = data.field as IsmFieldKey;
        const word = sanitizeText(String(data.word || ''), 60);
        const reviewer = room.ismHayawan.isJudgeRoom && room.ismHayawan.judgeId
          ? room.ismHayawan.judgeId
          : (room.players.find((p) => p.id !== pid && p.id !== targetId)?.id || room.hostId);
        room = {
          ...room,
          ismHayawan: {
            ...room.ismHayawan,
            disputes: [
              ...room.ismHayawan.disputes,
              {
                id: `dsp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                targetPlayerId: targetId,
                targetPlayerName: target?.name || 'لاعب',
                field,
                word,
                challengerId: pid,
                challengerName: challenger?.name || 'لاعب',
                assignedReviewerId: reviewer,
                status: 'pending',
              },
            ],
          },
        };
      }
      break;
    }
    case 'ism_hayawan_resolve_dispute': {
      if (room.ismHayawan) {
        const disputeId = String(data.disputeId || '');
        const approved = Boolean(data.approved);
        const d = room.ismHayawan.disputes.find((x) => x.id === disputeId);
        if (d && d.status === 'pending') {
          const oldScore = room.ismHayawan.fieldScoresByPlayer[d.targetPlayerId]?.[d.field] || 0;
          const newScore = approved ? 10 : 0;
          const diff = newScore - oldScore;
          room = {
            ...room,
            players: room.players.map((p) =>
              p.id === d.targetPlayerId ? { ...p, score: Math.max(0, p.score + diff) } : p
            ),
            ismHayawan: {
              ...room.ismHayawan,
              disputes: room.ismHayawan.disputes.map((x) =>
                x.id === disputeId ? { ...x, status: approved ? 'approved' : 'rejected' } : x
              ),
              fieldScoresByPlayer: {
                ...room.ismHayawan.fieldScoresByPlayer,
                [d.targetPlayerId]: {
                  ...(room.ismHayawan.fieldScoresByPlayer[d.targetPlayerId] || { name: 0, animal: 0, plant: 0, object: 0, country: 0 }),
                  [d.field]: newScore,
                },
              },
              roundTotalsByPlayer: {
                ...room.ismHayawan.roundTotalsByPlayer,
                [d.targetPlayerId]: Math.max(0, (room.ismHayawan.roundTotalsByPlayer[d.targetPlayerId] || 0) + diff),
              },
            },
          };
        }
      }
      break;
    }
    case 'ism_hayawan_next_round': {
      if (room.ismHayawan && pid === room.hostId) {
        if (room.ismHayawan.currentRound >= room.ismHayawan.totalRounds) {
          room = { ...room, ismHayawan: { ...room.ismHayawan, phase: 'game_over' } };
        } else {
          room = {
            ...room,
            ismHayawan: {
              ...room.ismHayawan,
              currentRound: room.ismHayawan.currentRound + 1,
              phase: 'letter_spin',
              stoppedByPlayerName: null,
              answersByPlayer: {},
              disputes: [],
            },
          };
        }
      }
      break;
    }
    case 'barrah_vote_category': {
      room = applyBarrahCategoryVote(room, pid, String(data.categoryId || 'random_all'), dataStore.barrahCategories);
      break;
    }
    case 'barrah_finalize_category': {
      const expired =
        room.barrah?.categoryVoteDeadline && Date.now() >= room.barrah.categoryVoteDeadline;
      if ((pid === room.hostId || expired) && room.barrah?.phase === 'category_vote') {
        room = finalizeBarrahCategoryVote(room, dataStore.barrahCategories);
      }
      break;
    }
    case 'barrah_restart_vote': {
      if (pid === room.hostId && room.gameId === 'barrah_salfa') {
        room = startBarrahCategoryVote(room);
      }
      break;
    }
    case 'barrah_mark_revealed': {
      if (room.barrah && !room.barrah.revealedPlayerIds.includes(pid)) {
        const revealedPlayerIds = [...room.barrah.revealedPlayerIds, pid];
        const activeCount = Math.max(1, room.players.filter((p) => p.connected).length || room.players.length);
        const allReady = revealedPlayerIds.length >= activeCount;
        room = {
          ...room,
          barrah: {
            ...room.barrah,
            revealedPlayerIds,
            phase: allReady ? 'questions_stage' : room.barrah.phase,
          },
        };
      }
      break;
    }
    case 'barrah_next_pair': {
      if (room.barrah && pid === room.hostId) {
        let pair = [...room.players].sort(() => Math.random() - 0.5);
        if (room.players.length >= 3 && pair[0]?.id === room.barrah.askerId && pair[1]?.id === room.barrah.answererId) {
          pair = [pair[1], pair[2] || pair[0]];
        }
        room = {
          ...room,
          barrah: {
            ...room.barrah,
            askerId: pair[0]?.id || room.barrah.askerId,
            answererId: pair[1]?.id || room.barrah.answererId,
          },
        };
      }
      break;
    }
    case 'barrah_start_voting': {
      if (room.barrah && pid === room.hostId) {
        room = { ...room, barrah: { ...room.barrah, phase: 'voting_pass' } };
      }
      break;
    }
    case 'barrah_vote': {
      if (room.barrah) {
        const targetId = String(data.targetId || '');
        if (targetId && targetId !== pid) {
          const votesByVoter = { ...room.barrah.votesByVoter, [pid]: targetId };
          const activeCount = Math.max(1, room.players.filter((p) => p.connected).length || room.players.length);
          const allVoted = Object.keys(votesByVoter).length >= activeCount;
          if (!allVoted) {
            room = { ...room, barrah: { ...room.barrah, votesByVoter } };
          } else {
            const tally: Record<string, number> = {};
            Object.values(votesByVoter).forEach((v) => { tally[v] = (tally[v] || 0) + 1; });
            const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
            const topSuspect = sorted[0]?.[0];
            const caught = topSuspect === room.barrah.spyId;
            room = {
              ...room,
              barrah: {
                ...room.barrah,
                votesByVoter,
                phase: caught ? 'final_chance' : 'results',
                spyGuessDeadline: caught ? Date.now() + 25000 : null,
                winner: caught ? null : 'spy',
              },
            };
          }
        }
      }
      break;
    }
    case 'barrah_spy_guess': {
      if (room.barrah && pid === room.barrah.spyId) {
        const guess = String(data.word || '');
        const won = guess === room.barrah.secretWord;
        room = {
          ...room,
          barrah: {
            ...room.barrah,
            spyGuess: guess,
            phase: 'results',
            winner: won ? 'spy' : 'insiders',
          },
        };
      }
      break;
    }
    case 'mafia_mark_revealed': {
      if (room.mafia && !room.mafia.revealedIds.includes(pid)) {
        const revealedIds = [...room.mafia.revealedIds, pid];
        const all = revealedIds.length >= room.players.length;
        room = {
          ...room,
          mafia: { ...room.mafia, revealedIds, phase: all ? 'night' : 'role_reveal' },
        };
      }
      break;
    }
    case 'mafia_night_action': {
      if (room.mafia && room.mafia.phase === 'night') {
        const currentMafia = room.mafia;
        const role = currentMafia.rolesByPlayer[pid];
        const targetId = String(data.targetId || '');
        const nc = { ...currentMafia.nightChoices };
        if (role === 'mafia') nc.mafiaTarget = targetId;
        if (role === 'doctor') nc.doctorSave = targetId;
        if (role === 'detective') nc.detectiveCheck = targetId;

        const aliveRoles = currentMafia.aliveIds.map((id) => currentMafia.rolesByPlayer[id]);
        const needMafia = aliveRoles.includes('mafia');
        const needDoc = aliveRoles.includes('doctor');
        const needDet = aliveRoles.includes('detective');
        const done =
          (!needMafia || Boolean(nc.mafiaTarget)) &&
          (!needDoc || Boolean(nc.doctorSave)) &&
          (!needDet || Boolean(nc.detectiveCheck));

        if (!done) {
          room = { ...room, mafia: { ...currentMafia, nightChoices: nc } };
        } else {
          const victimId = nc.mafiaTarget;
          const saved = victimId && victimId === nc.doctorSave;
          let aliveIds = [...currentMafia.aliveIds];
          let summary = 'انقضت الليلة بسلام! نجح الطبيب في إنقاذ الضحية.';
          if (victimId && !saved) {
            aliveIds = aliveIds.filter((id) => id !== victimId);
            const vName = room.players.find((p) => p.id === victimId)?.name || 'لاعب';
            summary = `مع الأسف! استيقظت المدينة على إقصاء ${vName} ليلاً.`;
          }
          const aliveMafia = aliveIds.filter((id) => currentMafia.rolesByPlayer[id] === 'mafia').length;
          const aliveCitizens = aliveIds.length - aliveMafia;
          const winner = aliveMafia === 0 ? 'citizens' : aliveMafia >= aliveCitizens ? 'mafia' : null;
          room = {
            ...room,
            mafia: {
              ...currentMafia,
              nightChoices: nc,
              aliveIds,
              lastNightSummary: summary,
              phase: winner ? 'game_over' : 'day_announcement',
              winner,
            },
          };
        }
      }
      break;
    }
    case 'mafia_next_phase': {
      if (room.mafia && pid === room.hostId) {
        if (room.mafia.phase === 'day_announcement') {
          room = { ...room, mafia: { ...room.mafia, phase: 'day_discussion' } };
        } else if (room.mafia.phase === 'day_discussion') {
          room = { ...room, mafia: { ...room.mafia, phase: 'day_voting', dayVotes: {} } };
        }
      }
      break;
    }
    case 'mafia_day_vote': {
      if (room.mafia && room.mafia.phase === 'day_voting' && room.mafia.aliveIds.includes(pid)) {
        const currentMafia = room.mafia;
        const targetId = String(data.targetId || '');
        const dayVotes = { ...currentMafia.dayVotes, [pid]: targetId };
        if (Object.keys(dayVotes).length < currentMafia.aliveIds.length) {
          room = { ...room, mafia: { ...currentMafia, dayVotes } };
        } else {
          const counts: Record<string, number> = {};
          Object.values(dayVotes).forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
          const eliminatedId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
          const aliveIds = eliminatedId
            ? currentMafia.aliveIds.filter((id) => id !== eliminatedId)
            : currentMafia.aliveIds;
          const aliveMafia = aliveIds.filter((id) => currentMafia.rolesByPlayer[id] === 'mafia').length;
          const aliveCitizens = aliveIds.length - aliveMafia;
          const winner = aliveMafia === 0 ? 'citizens' : aliveMafia >= aliveCitizens ? 'mafia' : null;
          room = {
            ...room,
            mafia: {
              ...currentMafia,
              dayVotes,
              aliveIds,
              dayNumber: currentMafia.dayNumber + 1,
              nightChoices: {},
              phase: winner ? 'game_over' : 'night',
              winner,
            },
          };
        }
      }
      break;
    }
    case 'detective_set_case': {
      if (pid === room.hostId) {
        const nextCaseId = sanitizeText(
          String(data.caseId || PUBLIC_DETECTIVE_CASES[0].id),
          40
        );
        room = {
          ...room,
          selectedCaseId: nextCaseId,
          detective: room.detective ? createInitialDetectiveState(nextCaseId) : room.detective,
        };
      }
      break;
    }
    case 'detective_update_progress': {
      if (room.detective) {
        room = {
          ...room,
          detective: {
            ...room.detective,
            progressByPlayer: {
              ...room.detective.progressByPlayer,
              [pid]: {
                cluesFoundCount: Number(data.cluesFoundCount || 0),
                suspectsReviewedCount: Number(data.suspectsReviewedCount || 0),
                hintsUsed: Number(data.hintsUsed || 0),
                readyForNext: Boolean(data.readyForNext),
              },
            },
          },
        };
      }
      break;
    }
    case 'detective_next_phase': {
      if (room.detective && pid === room.hostId) {
        const order: DetectiveRoomPhase[] = [
          'briefing',
          'exploration',
          'investigation',
          'discussion',
          'accusation',
          'case_closed',
        ];
        const currIdx = order.indexOf(room.detective.phase);
        const nextPhase = order[Math.min(order.length - 1, currIdx + 1)];
        if (nextPhase === 'case_closed') {
          room = closeDetectiveRoomOnServer(room);
        } else {
          room = {
            ...room,
            detective: {
              ...room.detective,
              phase: nextPhase,
              phaseDeadline: null,
            },
          };
        }
      }
      break;
    }
    case 'detective_submit_accusation': {
      if (room.detective && room.detective.phase !== 'case_closed') {
        const suspectId = sanitizeText(String(data.suspectId || ''), 40);
        const reason = sanitizeText(String(data.reason || ''), 500);
        if (suspectId) {
          const submittedAccuserIds = room.detective.submittedAccuserIds.includes(pid)
            ? room.detective.submittedAccuserIds
            : [...room.detective.submittedAccuserIds, pid];
          const acc: DetectivePlayerAccusation = {
            suspectId,
            reason,
            submittedAt: Date.now(),
          };
          room = {
            ...room,
            detective: {
              ...room.detective,
              submittedAccuserIds,
              accusationsByPlayer: {
                ...(room.detective.accusationsByPlayer || {}),
                [pid]: acc,
              },
            },
          };
          const activePlayers = room.players.filter((p) => p.connected);
          const needed = Math.max(1, activePlayers.length || room.players.length);
          if (submittedAccuserIds.length >= needed) {
            room = closeDetectiveRoomOnServer(room);
          }
        }
      }
      break;
    }
    case 'detective_close_case': {
      if (room.detective && pid === room.hostId) {
        room = closeDetectiveRoomOnServer(room);
      }
      break;
    }
    case 'detective_next_case': {
      if (room.detective && pid === room.hostId) {
        const currIdx = PUBLIC_DETECTIVE_CASES.findIndex(
          (c) => c.id === room.detective!.caseId
        );
        const nextCase =
          PUBLIC_DETECTIVE_CASES[(currIdx + 1) % PUBLIC_DETECTIVE_CASES.length] ||
          PUBLIC_DETECTIVE_CASES[0];
        room = {
          ...room,
          selectedCaseId: nextCase.id,
          detective: createInitialDetectiveState(nextCase.id),
        };
      }
      break;
    }
    case 'dub_set_config': {
      if (room.dubMic && pid === room.hostId) {
        const scenesPool = dataStore.dubScenes && dataStore.dubScenes.length > 0 ? dataStore.dubScenes : DEFAULT_DUB_SCENES;
        const nextMode = (['live_dub', 'habd_dub', 'group_acting', 'pvp'].includes(String(data.mode))
          ? String(data.mode)
          : room.dubMic.mode) as DubMicMode;
        const nextSceneId = String(data.sceneId || room.dubMic.sceneId);
        const scene = scenesPool.find((s) => s.id === nextSceneId) || scenesPool[0];
        const activePlayers = room.players.filter((p) => !p.isJudge);
        const nextAssignments: Record<string, string> = {};
        if (scene) {
          scene.characters.forEach((c, idx) => {
            const existing = room.dubMic!.assignments[c.id];
            nextAssignments[c.id] =
              existing && activePlayers.some((p) => p.id === existing)
                ? existing
                : activePlayers[idx % Math.max(1, activePlayers.length)]?.id || '';
          });
        }
        room = {
          ...room,
          dubMic: {
            ...room.dubMic,
            mode: nextMode,
            sceneId: scene?.id || nextSceneId,
            assignments: nextAssignments,
          },
        };
      }
      break;
    }
    case 'dub_pick_character': {
      if (room.dubMic) {
        const charId = String(data.characterId || '');
        const targetPlayerId = pid === room.hostId && data.targetPlayerId ? String(data.targetPlayerId) : pid;
        if (charId) {
          room = {
            ...room,
            dubMic: {
              ...room.dubMic,
              assignments: {
                ...room.dubMic.assignments,
                [charId]: targetPlayerId,
              },
            },
          };
        }
      }
      break;
    }
    case 'dub_start_watch': {
      if (room.dubMic && pid === room.hostId) {
        const scenesPool = dataStore.dubScenes && dataStore.dubScenes.length > 0 ? dataStore.dubScenes : DEFAULT_DUB_SCENES;
        const scene = scenesPool.find((s) => s.id === room.dubMic!.sceneId) || scenesPool[0];
        const clipLen = Math.max(8, (scene?.clipEndSec || 20) - (scene?.clipStartSec || 0));
        room = {
          ...room,
          dubMic: {
            ...room.dubMic,
            phase: 'watch_original',
            readyPlayerIds: [],
            phaseDeadline: Date.now() + (clipLen + 5) * 1000,
          },
        };
      }
      break;
    }
    case 'dub_skip_watch': {
      if (room.dubMic && pid === room.hostId) {
        const dm = room.dubMic;
        const nextPhase = dm.mode === 'habd_dub' || dm.mode === 'group_acting' ? 'write_script' : 'performing';
        const activePlayers = room.players.filter((p) => !p.isJudge);
        room = {
          ...room,
          dubMic: {
            ...dm,
            phase: nextPhase,
            readyPlayerIds: [],
            activePerformerId: dm.performerQueue[0] || activePlayers[0]?.id || null,
            phaseDeadline: nextPhase === 'write_script' ? Date.now() + 45_000 : Date.now() + 35_000,
          },
        };
      }
      break;
    }
    case 'dub_submit_script': {
      if (room.dubMic) {
        const script = sanitizeText(String(data.script || ''), 360);
        const readyIds = room.dubMic.readyPlayerIds.includes(pid)
          ? room.dubMic.readyPlayerIds
          : [...room.dubMic.readyPlayerIds, pid];
        room = {
          ...room,
          dubMic: {
            ...room.dubMic,
            scriptsByPlayer: {
              ...room.dubMic.scriptsByPlayer,
              [pid]: script,
            },
            readyPlayerIds: readyIds,
          },
        };
      }
      break;
    }
    case 'dub_set_ready': {
      if (room.dubMic) {
        const dm = room.dubMic;
        const activePlayers = room.players.filter((p) => !p.isJudge);
        const readyIds = dm.readyPlayerIds.includes(pid)
          ? dm.readyPlayerIds
          : [...dm.readyPlayerIds, pid];
        if (dm.phase === 'watch_original' && readyIds.length >= activePlayers.length) {
          const nextPhase = dm.mode === 'habd_dub' || dm.mode === 'group_acting' ? 'write_script' : 'performing';
          room = {
            ...room,
            dubMic: {
              ...dm,
              phase: nextPhase,
              readyPlayerIds: [],
              activePerformerId: dm.performerQueue[0] || activePlayers[0]?.id || null,
              phaseDeadline: nextPhase === 'write_script' ? Date.now() + 45_000 : Date.now() + 35_000,
            },
          };
        } else if (dm.phase === 'write_script' && readyIds.length >= activePlayers.length) {
          room = {
            ...room,
            dubMic: {
              ...dm,
              phase: 'performing',
              readyPlayerIds: [],
              activePerformerId: dm.performerQueue[0] || activePlayers[0]?.id || null,
              phaseDeadline: Date.now() + 35_000,
            },
          };
        } else {
          room = {
            ...room,
            dubMic: {
              ...dm,
              readyPlayerIds: readyIds,
            },
          };
        }
      }
      break;
    }
    case 'dub_set_active_performer': {
      if (room.dubMic && pid === room.hostId) {
        const targetId = String(data.performerId || '');
        if (targetId) {
          room = {
            ...room,
            dubMic: {
              ...room.dubMic,
              phase: 'performing',
              activePerformerId: targetId,
              phaseDeadline: Date.now() + 35_000,
            },
          };
        }
      }
      break;
    }
    case 'dub_submit_take': {
      if (room.dubMic) {
        const dm = room.dubMic;
        const player = room.players.find((p) => p.id === pid);
        if (player) {
          const charId = Object.entries(dm.assignments).find(([, assignee]) => assignee === pid)?.[0];
          const scenesPool = dataStore.dubScenes && dataStore.dubScenes.length > 0 ? dataStore.dubScenes : DEFAULT_DUB_SCENES;
          const scene = scenesPool.find((s) => s.id === dm.sceneId);
          const charName = scene?.characters.find((c) => c.id === charId)?.name;
          const newTake: DubTakeRecord = {
            id: `take_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            playerId: pid,
            playerName: player.name,
            playerAvatar: player.avatar,
            playerAvatarBg: player.avatarBg,
            characterId: charId,
            characterName: charName,
            scriptText: sanitizeText(String(data.scriptText || dm.scriptsByPlayer[pid] || ''), 360),
            audioDataUrl:
              typeof data.audioDataUrl === 'string' && data.audioDataUrl.startsWith('data:audio/')
                ? data.audioDataUrl
                : undefined,
            durationSec: Math.max(1, Math.min(45, Number(data.durationSec) || 8)),
            createdAt: Date.now(),
          };
          const filtered = dm.takes.filter((t) => t.playerId !== pid);
          const nextIdx = dm.performerQueue.indexOf(pid) + 1;
          const nextPerformer =
            nextIdx > 0 && nextIdx < dm.performerQueue.length
              ? dm.performerQueue[nextIdx]
              : dm.activePerformerId;
          room = {
            ...room,
            dubMic: {
              ...dm,
              takes: [...filtered, newTake],
              activePerformerId: nextPerformer,
            },
          };
        }
      }
      break;
    }
    case 'dub_go_ruined_it': {
      if (room.dubMic && pid === room.hostId) {
        room = {
          ...room,
          dubMic: {
            ...room.dubMic,
            phase: 'ruined_it',
            replayMode: 'dubbed',
            replaySyncAt: Date.now() + 800,
          },
        };
      }
      break;
    }
    case 'dub_set_replay': {
      if (room.dubMic && pid === room.hostId) {
        const modeVal = data.replayMode === 'original' ? 'original' : 'dubbed';
        room = {
          ...room,
          dubMic: {
            ...room.dubMic,
            replayMode: modeVal,
            replaySyncAt: Date.now() + 500,
          },
        };
      }
      break;
    }
    case 'dub_go_voting': {
      if (room.dubMic && pid === room.hostId) {
        room = {
          ...room,
          dubMic: {
            ...room.dubMic,
            phase: 'voting',
            votes: {},
            phaseDeadline: Date.now() + 30_000,
          },
        };
      }
      break;
    }
    case 'dub_cast_vote': {
      if (room.dubMic && room.dubMic.phase === 'voting') {
        const dm = room.dubMic;
        const incomingVotes = (data.votes || {}) as Partial<Record<DubVoteCategory, string>>;
        const sanitized: Partial<Record<DubVoteCategory, string>> = {};
        (['funniest', 'best_voice', 'weirdest_dialogue', 'best_acting', 'best_lipsync'] as DubVoteCategory[]).forEach(
          (cat) => {
            const target = incomingVotes[cat];
            if (typeof target === 'string' && target && target !== pid) {
              sanitized[cat] = target;
            }
          }
        );
        if (Object.keys(sanitized).length === 0) {
          return { room, error: 'لا يمكنك التصويت لنفسك! اختر لاعباً آخر في تصنيف واحد على الأقل.' };
        }
        const nextVotes = {
          ...dm.votes,
          [pid]: sanitized,
        };
        const activePlayers = room.players.filter((p) => !p.isJudge && p.connected);
        const needed = Math.max(1, activePlayers.length || room.players.length);
        if (Object.keys(nextVotes).length >= needed) {
          const nextDub = computeDubMicResults({ ...dm, votes: nextVotes }, room.players);
          room = {
            ...room,
            players: room.players.map((p) => ({
              ...p,
              score: p.score + (nextDub.scoresDelta?.[p.id] || 0),
            })),
            dubMic: nextDub,
          };
          awardDubXpAndAchievements(room, nextDub);
        } else {
          room = {
            ...room,
            dubMic: {
              ...dm,
              votes: nextVotes,
            },
          };
        }
      }
      break;
    }
    case 'dub_finalize_results': {
      if (room.dubMic && pid === room.hostId && room.dubMic.phase !== 'results') {
        const nextDub = computeDubMicResults(room.dubMic, room.players);
        room = {
          ...room,
          players: room.players.map((p) => ({
            ...p,
            score: p.score + (nextDub.scoresDelta?.[p.id] || 0),
          })),
          dubMic: nextDub,
        };
        awardDubXpAndAchievements(room, nextDub);
      }
      break;
    }
    case 'dub_play_again': {
      if (room.dubMic && pid === room.hostId) {
        const scenesPool = dataStore.dubScenes && dataStore.dubScenes.length > 0 ? dataStore.dubScenes : DEFAULT_DUB_SCENES;
        const currIdx = scenesPool.findIndex((s) => s.id === room.dubMic!.sceneId);
        const nextScene = scenesPool[(currIdx + 1) % scenesPool.length] || scenesPool[0];
        room = {
          ...room,
          dubMic: createInitialDubMicState(room.players, scenesPool, nextScene?.id, room.dubMic.mode),
        };
      }
      break;
    }
    default:
      break;
  }

  return { room };
}

function closeDetectiveRoomOnServer(room: RoomState): RoomState {
  if (!room.detective) return room;
  const caseId = room.detective.caseId;
  const caseData = PUBLIC_DETECTIVE_CASES.find((c) => c.id === caseId);
  const accusationsByPlayer = room.detective.accusationsByPlayer || {};
  let revealedSolution = room.detective.revealedSolution || null;
  const resultsByPlayer: DetectivePlayerRoundResult[] = [];
  const scoreMap: Record<string, number> = {};

  for (const p of room.players) {
    const acc = accusationsByPlayer[p.id];
    const prog = room.detective.progressByPlayer[p.id];
    const hintTiers = Array.from({ length: prog?.hintsUsed || 0 }, (_, idx) => idx + 1);
    const evalRes = evaluateAccusationSolution({
      caseId,
      accusedSuspectId: acc?.suspectId || '',
      cluesFoundCount: prog?.cluesFoundCount || 0,
      usedHintTiers: hintTiers,
      wrongAccusationsBefore: 0,
    });
    if (!revealedSolution && evalRes.solution) {
      revealedSolution = evalRes.solution;
    }
    const suspectName =
      caseData?.suspects.find((s) => s.id === acc?.suspectId)?.name || 'لم يُصوّت';
    const pointsDelta = acc ? evalRes.pointsEarned : 0;
    scoreMap[p.id] = pointsDelta;
    resultsByPlayer.push({
      playerId: p.id,
      playerName: p.name,
      avatar: p.avatar,
      avatarBg: p.avatarBg,
      accusedSuspectId: acc?.suspectId || null,
      accusedSuspectName: suspectName,
      isCorrect: Boolean(acc && evalRes.isCorrect),
      pointsDelta,
      cluesFoundCount: prog?.cluesFoundCount || 0,
      hintsUsed: prog?.hintsUsed || 0,
    });
  }

  return {
    ...room,
    players: room.players.map((p) => ({
      ...p,
      score: Math.max(0, p.score + (scoreMap[p.id] || 0)),
    })),
    detective: {
      ...room.detective,
      phase: 'case_closed',
      phaseDeadline: null,
      revealedSolution,
      resultsByPlayer,
    },
    messages: appendSystemChat(room, 'تم إغلاق القضية وكشف الحقيقة لجميع المحققين! 🔍'),
  };
}

// REST Room Endpoints (guaranteed reliable fallback & instant state sync)
app.post('/api/rooms/create', (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const fallbackPid = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const result = createRoomOnServer(body, fallbackPid);
  if (result.error || !result.room) {
    return res.status(400).json({ ok: false, error: result.error || 'تعذر إنشاء الغرفة.' });
  }
  return res.json({ ok: true, room: sanitizeRoomForClient(result.room) });
});

app.post('/api/rooms/join', (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const fallbackPid = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const result = joinRoomOnServer(body, fallbackPid);
  if (result.error || !result.room) {
    return res.status(404).json({ ok: false, error: result.error || 'رمز الغرفة غير صحيح.' });
  }
  broadcastRoom(result.room.code);
  return res.json({ ok: true, room: sanitizeRoomForClient(result.room) });
});

app.get('/api/rooms/:code', (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const room = rooms.get(code);
  if (!room) {
    return res.status(404).json({ ok: false, error: 'الغرفة غير موجودة أو انتهت الجلسة.' });
  }
  touchRoom(code);
  return res.json({ ok: true, room: sanitizeRoomForClient(room) });
});

app.post('/api/rooms/action', (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const code = String(body.roomCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const pid = String(body.playerId || '');
  const type = String(body.type || '');
  if (!code || !pid) {
    return res.status(400).json({ ok: false, error: 'بيانات الغرفة ناقصة.' });
  }
  if (type === 'leave_room') {
    removePlayerFromRoom(code, pid);
    return res.json({ ok: true, left: true });
  }
  const existing = rooms.get(code);
  if (!existing) {
    return res.status(404).json({ ok: false, error: 'الغرفة غير موجودة أو انتهت الجلسة.' });
  }
  const result = applyRoomActionOnServer(existing, pid, body);
  if (result.error) {
    return res.status(400).json({
      ok: false,
      error: result.error,
      room: sanitizeRoomForClient(existing),
    });
  }
  rooms.set(code, result.room);
  broadcastRoom(code);
  return res.json({ ok: true, room: sanitizeRoomForClient(result.room) });
});

app.post('/api/rooms/:code/dub-audio', (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const room = rooms.get(code);
  if (!room || !room.dubMic) {
    return res.status(404).json({ ok: false, error: 'الغرفة أو جولة الدوبلاج غير نشطة.' });
  }
  const pid = String(req.body?.playerId || '');
  const player = room.players.find((p) => p.id === pid);
  if (!player) {
    return res.status(404).json({ ok: false, error: 'اللاعب غير موجود في الغرفة.' });
  }
  const audioDataUrl = typeof req.body?.audioDataUrl === 'string' ? req.body.audioDataUrl : '';
  if (audioDataUrl && (!audioDataUrl.startsWith('data:audio/') || audioDataUrl.length > 4_000_000)) {
    return res.status(400).json({ ok: false, error: 'صيغة أو حجم المقطع الصوتي غير صالح.' });
  }

  const dm = room.dubMic;
  const charId = Object.entries(dm.assignments).find(([, assignee]) => assignee === pid)?.[0];
  const scenesPool = dataStore.dubScenes && dataStore.dubScenes.length > 0 ? dataStore.dubScenes : DEFAULT_DUB_SCENES;
  const scene = scenesPool.find((s) => s.id === dm.sceneId);
  const charName = scene?.characters.find((c) => c.id === charId)?.name;

  const newTake: DubTakeRecord = {
    id: `take_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    playerId: pid,
    playerName: player.name,
    playerAvatar: player.avatar,
    playerAvatarBg: player.avatarBg,
    characterId: charId,
    characterName: charName,
    scriptText: sanitizeText(String(req.body?.scriptText || dm.scriptsByPlayer[pid] || ''), 360),
    audioDataUrl: audioDataUrl || undefined,
    durationSec: Math.max(1, Math.min(45, Number(req.body?.durationSec) || 8)),
    createdAt: Date.now(),
  };

  const filtered = dm.takes.filter((t) => t.playerId !== pid);
  const nextIdx = dm.performerQueue.indexOf(pid) + 1;
  const nextPerformer =
    nextIdx > 0 && nextIdx < dm.performerQueue.length
      ? dm.performerQueue[nextIdx]
      : dm.activePerformerId;

  const updatedRoom: RoomState = {
    ...room,
    dubMic: {
      ...dm,
      takes: [...filtered, newTake],
      activePerformerId: nextPerformer,
    },
  };
  rooms.set(code, updatedRoom);
  broadcastRoom(code);
  return res.json({ ok: true, take: newTake, room: sanitizeRoomForClient(updatedRoom) });
});

// Auto-finalize Barrah Salfa live category vote when 10s timer expires
const barrahVoteSweep = setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, code) => {
    if (
      room.gameId === 'barrah_salfa' &&
      room.status === 'playing' &&
      room.barrah?.phase === 'category_vote' &&
      room.barrah.categoryVoteDeadline &&
      now >= room.barrah.categoryVoteDeadline
    ) {
      const updated = finalizeBarrahCategoryVote(room, dataStore.barrahCategories);
      rooms.set(code, updated);
      broadcastRoom(code);
    }
  });
}, 500);

// Cleanup idle rooms with 0 connected players after 5 minutes (or > 3 hours idle)
const roomCleanupInterval = setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, code) => {
    const last = roomLastActivity.get(code) || room.createdAt;
    const hasConnected = room.players.some((p) => p.connected);
    if ((!hasConnected && now - last > 5 * 60_000) || now - last > 3 * 60 * 60_000) {
      rooms.delete(code);
      roomLastActivity.delete(code);
    }
  });
}, 60_000);

// 25s heartbeat to prevent Cloudflare 100s idle WebSocket timeout
const wsHeartbeat = setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.ping();
    }
  });
}, 25_000);

wss.on('close', () => {
  clearInterval(wsHeartbeat);
  clearInterval(roomCleanupInterval);
  clearInterval(barrahVoteSweep);
});

wss.on('connection', (ws) => {
  const initialId = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  clients.set(ws, { ws, playerId: initialId, roomCode: null });

  ws.on('message', (raw) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(String(raw));
    } catch {
      return;
    }

    const type = String(data.type || '');
    if (type === 'ping') {
      sendWs(ws, { type: 'pong' });
      return;
    }

    const meta = clients.get(ws);
    if (!meta) return;
    if (data.playerId && typeof data.playerId === 'string') {
      meta.playerId = data.playerId;
    }
    if (data.username && typeof data.username === 'string') {
      meta.username = normalizeUsername(data.username);
    }

    if (type === 'bind_user') {
      const uname = normalizeUsername(data.username);
      if (uname) {
        meta.username = uname;
        const users = dataStore.users || {};
        if (users[uname]) {
          users[uname].lastSeen = Date.now();
          if (meta.playerId) users[uname].playerId = meta.playerId;
        }
      }
      sendWs(ws, { type: 'bound_user', username: meta.username || null });
      return;
    }

    if (type === 'create_room') {
      const result = createRoomOnServer(data, meta.playerId);
      if (result.error || !result.room) {
        sendWs(ws, { type: 'error', message: result.error || 'تعذر إنشاء الغرفة.' });
        return;
      }
      meta.roomCode = result.room.code;
      broadcastRoom(result.room.code);
      return;
    }

    if (type === 'join_room') {
      const result = joinRoomOnServer(data, meta.playerId);
      if (result.error || !result.room) {
        sendWs(ws, { type: 'error', message: result.error || 'رمز الغرفة غير صحيح أو انتهت الجلسة.' });
        return;
      }
      if (result.playerId) meta.playerId = result.playerId;
      meta.roomCode = result.room.code;
      broadcastRoom(result.room.code);
      return;
    }

    if (type === 'leave_room') {
      handleDisconnect(ws, true);
      meta.roomCode = null;
      return;
    }

    if (!meta.roomCode && typeof data.roomCode === 'string' && data.roomCode) {
      meta.roomCode = data.roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
    if (!meta.roomCode) return;
    const currentRoom = rooms.get(meta.roomCode);
    if (!currentRoom) return;

    const result = applyRoomActionOnServer(currentRoom, meta.playerId, data);
    if (result.error) {
      sendWs(ws, { type: 'error', message: result.error });
      return;
    }
    if (result.stop) return;

    rooms.set(currentRoom.code, result.room);
    broadcastRoom(currentRoom.code);
  });

  ws.on('close', () => handleDisconnect(ws, false));
  ws.on('error', () => handleDisconnect(ws, false));
});

// ---------------------------------------------------------------------------
// Vite Dev Middleware vs Production Static Dist
// ---------------------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.get('/@vite/client', async (_req, res, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (!result?.code) return next();
        const patched = result.code.replace(
          /transport\.connect\(createHMRHandler\(handleMessage\)\);?/g,
          '/* HMR WebSocket disabled in AI Studio dev server */'
        );
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        return res.send(patched);
      } catch {
        return next();
      }
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[JAMR] Server listening on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

void startServer();
