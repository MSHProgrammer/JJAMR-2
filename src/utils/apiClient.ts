export interface ApiResult<T = Record<string, any>> {
  ok: boolean;
  status: number;
  data: T | null;
  rawText: string;
  isHtmlOrStatic: boolean;
  isAuthBlocked: boolean;
  networkError: boolean;
}

export async function tryUnlockIframeStorageAccess(): Promise<void> {
  try {
    if (
      typeof window !== 'undefined' &&
      window.self !== window.top &&
      typeof document.requestStorageAccess === 'function'
    ) {
      await document.requestStorageAccess();
    }
  } catch {
    // Browser denied or unsupported; ignore cleanly
  }
}

export async function apiFetchJson<T = Record<string, any>>(
  url: string,
  options: RequestInit = {},
  config?: { unlockStorageOnGesture?: boolean }
): Promise<ApiResult<T>> {
  if (config?.unlockStorageOnGesture) {
    await tryUnlockIframeStorageAccess();
  }

  const doFetch = () =>
    fetch(url, {
      credentials: 'include',
      cache: 'no-store',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

  try {
    let res = await doFetch();
    if ([502, 503, 504].includes(res.status)) {
      await new Promise((r) => window.setTimeout(r, 1100));
      res = await doFetch();
    }

    const rawText = await res.text();
    let parsed: T | null = null;
    try {
      parsed = rawText ? (JSON.parse(rawText) as T) : null;
    } catch {
      parsed = null;
    }

    const lower = rawText.toLowerCase();
    const isAuthBlocked =
      !parsed &&
      (res.status === 405 ||
        lower.includes('__cookie_check') ||
        lower.includes('applet-auth-bridge') ||
        lower.includes('405 not allowed') ||
        lower.includes('aistudio'));

    const isHtmlOrStatic = !parsed && (res.status === 404 || res.status === 405 || isAuthBlocked || lower.includes('<!doctype html') || lower.includes('<html'));

    return {
      ok: res.ok && parsed !== null,
      status: res.status,
      data: parsed,
      rawText,
      isHtmlOrStatic,
      isAuthBlocked,
      networkError: false,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      rawText: '',
      isHtmlOrStatic: true,
      isAuthBlocked: false,
      networkError: true,
    };
  }
}
