import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'pt-BR', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export async function getMessages(locale: Locale) {
  return (await import(`./messages/${locale}.json`)).default;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = (locales as readonly string[]).includes(requested)
    ? (requested as Locale)
    : defaultLocale;

  return {
    locale,
    messages: await getMessages(locale),
  };
});
