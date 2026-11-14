import type { JamrainTopicSpec, Question, Topic } from '../types/jamr.ts';
import { SPORTS_TOPICS } from './jamrain/sports.ts';
import { CINEMA_TOPICS } from './jamrain/cinema.ts';
import { SCIENCE_TOPICS } from './jamrain/science.ts';
import { CULTURE_TOPICS } from './jamrain/culture.ts';
import { GAMING_TOPICS } from './jamrain/gaming.ts';
import { FOOD_TOPICS } from './jamrain/food.ts';
import { HISTORY_TOPICS } from './jamrain/history.ts';
import { RELIGION_TOPICS } from './jamrain/religion.ts';

export const ALL_JAMRAIN_TOPIC_SPECS: JamrainTopicSpec[] = [
  ...SPORTS_TOPICS,
  ...CINEMA_TOPICS,
  ...SCIENCE_TOPICS,
  ...CULTURE_TOPICS,
  ...GAMING_TOPICS,
  ...FOOD_TOPICS,
  ...HISTORY_TOPICS,
  ...RELIGION_TOPICS,
];

export const DEFAULT_100_TOPICS: Topic[] = ALL_JAMRAIN_TOPIC_SPECS.slice(0, 100).map((spec) => ({
  id: spec.id,
  name: spec.name,
  category: spec.category,
  sectionId: spec.sectionId,
  icon: spec.icon,
  illustrationKey: spec.id,
  description: `موضوع ${spec.name} ضمن قسم ${spec.category} — أسئلة حقيقية متدرجة الصعوبة (200 / 400 / 600)`,
}));

export function buildDefaultJamrainQuestions(): Question[] {
  const result: Question[] = [];

  ALL_JAMRAIN_TOPIC_SPECS.slice(0, 100).forEach((spec) => {
    const tiers: Array<{ points: 200 | 400 | 600; items: JamrainTopicSpec['tier200'] }> = [
      { points: 200, items: spec.tier200 },
      { points: 400, items: spec.tier400 },
      { points: 600, items: spec.tier600 },
    ];

    tiers.forEach(({ points, items }) => {
      items.forEach((fact, idx) => {
        result.push({
          id: `q_${spec.id}_${points}_${idx + 1}`,
          topicId: spec.id,
          points,
          question: fact.q,
          answer: fact.a,
          hint: fact.hint,
          explanation: fact.explanation,
        });
      });
    });
  });

  return result;
}

// Backward-compatible export alias used by App.tsx and server.ts
export function buildDefault6000Questions(): Question[] {
  return buildDefaultJamrainQuestions();
}

const LEGACY_FILLER_SNIPPETS = [
  'كم مرة تقريباً تتجدد خلايا التذوق في اللسان',
  'سؤال سرعة مرتبط بـ',
  'ما القارة التي لا تحتوي على أي صحراء حارة',
  'ما عاصمة سويسرا الإدارية الفعلية',
  'معلومة ذهبية في "',
  'في سباق النقاط بـ "',
  'لغز ذكاء لـ "',
  'سؤال معارف لـ "',
  'تحدي النجوم في "',
  'سؤال ثقافي لـ "',
  'جولة سريعة في "',
  'سؤال عام في "',
  'تحدي المعرفة في "',
  'نقطة حاسمة في "',
  'معلومة دقيقة في "',
  'سؤال متقدم في "',
  'تحدي الـ 600 في "',
  'سؤال الختام في "',
];

export function isLegacyFillerQuestion(q: Partial<Question>): boolean {
  if (!q) return true;
  const id = String(q.id || '');
  const text = String(q.question || '');
  // Old generator IDs were q_top_xxx_1..60 without tier suffix (_200_, _400_, _600_)
  if (/^q_top_[a-z0-9_]+_\d+$/i.test(id)) return true;
  if (LEGACY_FILLER_SNIPPETS.some((snippet) => text.includes(snippet))) return true;
  return false;
}
