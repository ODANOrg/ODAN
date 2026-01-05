'use client';

import NextLink from 'next/link';
import type { ComponentProps } from 'react';
import { useLocale } from 'next-intl';
import { defaultLocale, locales } from '@/i18n';

type Props = Omit<ComponentProps<typeof NextLink>, 'href'> & {
  href: string;
};

function localizeHref(href: string, locale: string) {
  if (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  ) {
    return href;
  }

  if (href.startsWith('#')) return href;

  const match = href.match(/^([^?#]*)(.*)$/);
  const pathPart = match?.[1] ?? href;
  const suffix = match?.[2] ?? '';

  if (!pathPart.startsWith('/')) return href;

  const segments = pathPart.split('/');
  const maybeLocale = segments[1];
  const hasLocale = (locales as readonly string[]).includes(maybeLocale);

  if (locale === defaultLocale) {
    if (hasLocale) segments.splice(1, 1);
    const normalized = segments.join('/') || '/';
    return `${normalized}${suffix}`;
  }

  if (hasLocale) segments[1] = locale;
  else segments.splice(1, 0, locale);

  return `${segments.join('/')}${suffix}`;
}

export default function LocaleLink({ href, ...props }: Props) {
  const locale = useLocale();
  return <NextLink href={localizeHref(href, locale)} {...props} />;
}
