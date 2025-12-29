import { setRequestLocale } from 'next-intl/server';

export const locales = ['en', 'pt-BR', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export async function getMessages(locale: Locale) {
  return (await import(`./messages/${locale}.json`)).default;
}

export async function middleware(request: Request) {
  const locale = request.headers.get('accept-language')?.split(',')[0] || defaultLocale;
  setRequestLocale(locale);
  return { messages: await getMessages(locale) };
}
