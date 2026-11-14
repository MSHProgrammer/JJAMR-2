const ARABIC_DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u0640]/g;

export function stripDiacritics(input: string): string {
  return (input || '').replace(ARABIC_DIACRITICS_REGEX, '');
}

export function normalizeDigits(input: string): string {
  if (!input) return '';
  const eastern = '٠١٢٣٤٥٦٧٨٩';
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  return input
    .replace(/[٠-٩]/g, (d) => String(eastern.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)));
}

export function normalizeArabic(input: string): string {
  let text = stripDiacritics((input || '').trim().toLowerCase());
  text = text
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ');
  return text;
}

export function normalizeFirstLetter(char: string): string {
  const c = normalizeArabic(char).charAt(0);
  if (!c) return '';
  if (c === 'أ' || c === 'إ' || c === 'آ' || c === 'ا') return 'ا';
  if (c === 'ة' || c === 'ه') return 'ه';
  if (c === 'ى' || c === 'ي') return 'ي';
  return c;
}

export function wordStartsWithLetter(word: string, targetLetter: string): boolean {
  const cleanWord = stripDiacritics((word || '').trim());
  if (!cleanWord || cleanWord.length < 2) return false;
  const firstChar = normalizeFirstLetter(cleanWord.charAt(0));
  const target = normalizeFirstLetter(targetLetter);
  return firstChar !== '' && firstChar === target;
}

export function sanitizeText(input: string, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}
