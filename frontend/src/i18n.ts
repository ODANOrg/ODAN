import { setRequestLocale } from 'next-intl/server';

export const locales = ['en', 'pt-BR', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export async function getMessages(locale: Locale) {
  return (await import(`./messages/${locale}.json`)).default;
}

export async function middleware(request: Request) {
  const header = request.headers.get('accept-language') || '';
  const raw = header.split(',')[0]?.trim();

  let locale: Locale = defaultLocale;

  if (raw) {
    if ((locales as readonly string[]).includes(raw)) {
      locale = raw as Locale;
    } else {
      const base = raw.split('-')[0];
      if (base === 'pt') locale = 'pt-BR';
      else if (base === 'es') locale = 'es';
      else locale = 'en';
    }
  }

  setRequestLocale(locale);
  return { messages: await getMessages(locale) };
}

// Default request config required by `next-intl` server helpers
export default async function getRequestConfig(request: Request) {
  const header = request?.headers?.get ? request.headers.get('accept-language') || '' : '';
  const raw = header.split(',')[0]?.trim();

  let locale: Locale = defaultLocale;
  if (raw) {
    if ((locales as readonly string[]).includes(raw)) {
      locale = raw as Locale;
    } else {
      const base = raw.split('-')[0];
      if (base === 'pt') locale = 'pt-BR';
      else if (base === 'es') locale = 'es';
      else locale = 'en';
    }
  }

  return {
    locale,
    messages: await getMessages(locale),
  };
}
