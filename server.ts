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
  BarrahCategory,
  BrokenTvReactionType,
  BugReport,
  DataStoreSnapshot,
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
} from './src/types/jamr.ts';
import { DEFAULT_GAMES, DEFAULT_SECTIONS } from './src/data/defaultGames.ts';
import {
  buildDefault6000Questions,
  DEFAULT_100_TOPICS,
  isLegacyFillerQuestion,
} from './src/data/jamrain100Topics.ts';
import { DEFAULT_BARRAH_CATEGORIES } from './src/data/barrahSalfaCategories.ts';
import { checkArabicSaudiDictionary } from './src/data/arabicSaudiDictionary.ts';
import { normalizeArabic, normalizeDigits, sanitizeText, wordStartsWithLetter } from './src/utils/arabicNormalize.ts';
import {
  appendSystemChat,
  applyBrokenTvReaction,
  applyBrokenTvStepSubmission,
  areAllIsmFieldsFilled,
  computeIsmScores,
  createInitialBrokenTvState,
  createInitialIsmState,
  generateRoomCode,
  pickUnusedArabicLetter,
  startBarrahOnlineRound,
  startMafiaOnlineRound,
} from './src/shared/roomEngine.ts';

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
  });
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

  if (!description || description.length < 4) {
    return res.status(400).json({ error: 'يرجى كتابة وصف واضح للبلاغ.' });
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

  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) {
    return res.status(503).json({
      error: 'كلمة مرور الإدارة (ADMIN_PASSWORD) غير مهيأة في إعدادات البيئة على الخادم.',
    });
  }

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
// HTTP Server + WebSocket Multiplayer Server
// ---------------------------------------------------------------------------
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

interface ClientMeta {
  ws: WebSocket;
  playerId: string;
  roomCode: string | null;
}

const rooms = new Map<string, RoomState>();
const clients = new Map<WebSocket, ClientMeta>();

function sendWs(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoom(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const payload = JSON.stringify({ type: 'room_state', room });
  clients.forEach((meta) => {
    if (meta.roomCode === roomCode && meta.ws.readyState === WebSocket.OPEN) {
      meta.ws.send(payload);
    }
  });
}

function handleDisconnect(ws: WebSocket) {
  const meta = clients.get(ws);
  if (!meta) return;
  clients.delete(ws);

  if (!meta.roomCode) return;
  const room = rooms.get(meta.roomCode);
  if (!room) return;

  const remaining = room.players.filter((p) => p.id !== meta.playerId);
  if (remaining.length === 0) {
    rooms.delete(room.code);
    return;
  }

  let newHostId = room.hostId;
  let updatedPlayers = remaining;
  if (room.hostId === meta.playerId) {
    const nextHost = remaining.find((p) => p.connected) || remaining[0];
    newHostId = nextHost.id;
    updatedPlayers = remaining.map((p) => ({ ...p, isHost: p.id === newHostId }));
  }

  const leaver = room.players.find((p) => p.id === meta.playerId);
  const updatedRoom: RoomState = {
    ...room,
    hostId: newHostId,
    players: updatedPlayers,
    messages: appendSystemChat(room, `غادر ${leaver?.name || 'لاعب'} الغرفة.`),
  };
  rooms.set(room.code, updatedRoom);
  broadcastRoom(room.code);
}

// 25s heartbeat to prevent Cloudflare 100s idle WebSocket timeout
const wsHeartbeat = setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.ping();
    }
  });
}, 25_000);

wss.on('close', () => clearInterval(wsHeartbeat));

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

    if (type === 'create_room') {
      const gameId = String(data.gameId || 'broken_tv');
      const targetGame = dataStore.games.find((g) => g.id === gameId);
      if (targetGame && (targetGame.underMaintenance || !targetGame.isActive)) {
        sendWs(ws, { type: 'error', message: 'هذه اللعبة حالياً تحت الصيانة والتطوير.' });
        return;
      }

      let code = generateRoomCode();
      while (rooms.has(code)) {
        code = generateRoomCode();
      }
      const playerName = sanitizeText(String(data.playerName || 'المضيف'), 30) || 'المضيف';
      const avatar = sanitizeText(String(data.avatar || 'char_01'), 16) || 'char_01';
      const isJudgeRoom = Boolean(data.isJudgeRoom) && gameId === 'ism_hayawan';
      const totalRounds = Math.max(1, Math.min(50, Number(data.totalRounds) || 5));

      const hostPlayer: Player = {
        id: meta.playerId,
        name: playerName,
        avatar,
        isHost: true,
        isReady: true,
        team: null,
        score: 0,
        connected: true,
        isJudge: isJudgeRoom,
      };

      const room: RoomState = {
        code,
        hostId: meta.playerId,
        gameId,
        status: 'lobby',
        maxPlayers: gameId === 'ism_hayawan' ? 100 : 16,
        players: [hostPlayer],
        messages: [],
        createdAt: Date.now(),
        isJudgeRoom,
        totalRounds,
      };
      room.messages = appendSystemChat(room, `أنشأ ${playerName} الغرفة بنجاح.`);
      rooms.set(code, room);
      meta.roomCode = code;
      broadcastRoom(code);
      return;
    }

    if (type === 'join_room') {
      const code = String(data.roomCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const room = rooms.get(code);
      if (!room) {
        sendWs(ws, { type: 'error', message: 'رمز الغرفة غير صحيح أو انتهت الجلسة.' });
        return;
      }

      const incomingId = typeof data.existingPlayerId === 'string' && data.existingPlayerId
        ? data.existingPlayerId
        : meta.playerId;
      meta.playerId = incomingId;
      meta.roomCode = code;

      const existing = room.players.find((p) => p.id === incomingId);
      if (existing) {
        room.players = room.players.map((p) =>
          p.id === incomingId ? { ...p, connected: true } : p
        );
      } else {
        if (room.players.length >= room.maxPlayers) {
          sendWs(ws, { type: 'error', message: `الغرفة ممتلئة (الحد الأقصى ${room.maxPlayers} لاعب).` });
          meta.roomCode = null;
          return;
        }
        const playerName = sanitizeText(String(data.playerName || 'ضيف'), 30) || 'ضيف';
        const avatar = sanitizeText(String(data.avatar || 'char_04'), 16) || 'char_04';
        room.players.push({
          id: incomingId,
          name: playerName,
          avatar,
          isHost: false,
          isReady: false,
          team: null,
          score: 0,
          connected: true,
        });
        room.messages = appendSystemChat(room, `انضم ${playerName} إلى الغرفة!`);
      }
      rooms.set(code, room);
      broadcastRoom(code);
      return;
    }

    if (type === 'leave_room') {
      handleDisconnect(ws);
      return;
    }

    if (!meta.roomCode) return;
    let room = rooms.get(meta.roomCode);
    if (!room) return;
    const pid = meta.playerId;

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
          sendWs(ws, { type: 'error', message: 'هذه اللعبة تحت التعديل والصيانة حالياً.' });
          return;
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
          messages: appendSystemChat(room, `تم تغيير اللعبة إلى: ${target?.title || newGameId}`),
        };
        break;
      }
      case 'kick_player': {
        if (pid !== room.hostId) break;
        const targetId = String(data.targetId || '');
        if (!targetId || targetId === room.hostId) break;
        clients.forEach((cMeta) => {
          if (cMeta.roomCode === room!.code && cMeta.playerId === targetId) {
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
                text,
                timestamp: Date.now(),
              },
            ].slice(-80),
          };
        }
        break;
      }
      case 'voice_signal': {
        const targetId = String(data.targetId || '');
        clients.forEach((cMeta) => {
          if (cMeta.roomCode === room!.code && (!targetId || cMeta.playerId === targetId) && cMeta.playerId !== pid) {
            sendWs(cMeta.ws, {
              type: 'voice_signal',
              fromId: pid,
              signal: data.signal,
            });
          }
        });
        return;
      }
      case 'return_to_lobby': {
        room = {
          ...room,
          status: 'lobby',
          brokenTv: undefined,
          ismHayawan: undefined,
          barrah: undefined,
          mafia: undefined,
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
          room = startBarrahOnlineRound(room, String(data.categoryId || 'random_all'), dataStore.barrahCategories);
        } else if (room.gameId === 'mafia_no_hakam') {
          room = startMafiaOnlineRound(room);
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
            sendWs(ws, { type: 'error', message: 'أكمل كتابة جميع الخانات الـ 5 قبل الضغط على ستوب!' });
            return;
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
      case 'barrah_mark_revealed': {
        if (room.barrah && !room.barrah.revealedPlayerIds.includes(pid)) {
          const revealedPlayerIds = [...room.barrah.revealedPlayerIds, pid];
          const allReady = revealedPlayerIds.length >= room.players.length;
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
            const allVoted = Object.keys(votesByVoter).length >= room.players.length;
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
      default:
        break;
    }

    rooms.set(room.code, room);
    broadcastRoom(room.code);
  });

  ws.on('close', () => handleDisconnect(ws));
  ws.on('error', () => handleDisconnect(ws));
});

// ---------------------------------------------------------------------------
// Vite Dev Middleware vs Production Static Dist
// ---------------------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
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
