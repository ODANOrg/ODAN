'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Github } from 'lucide-react';

export function Footer() {
  const t = useTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t">
      <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
            O
          </div>
          <p className="text-center text-sm leading-loose md:text-left">
            {t('footer.copyright', { year })}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Link
            href="/about"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t('footer.about')}
          </Link>
          <Link
            href="/privacy"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t('footer.privacy')}
          </Link>
          <Link
            href="/terms"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t('footer.terms')}
          </Link>
          <a
            href="https://github.com/odan-project"
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            <Github className="h-5 w-5" />
            <span className="sr-only">{t('footer.github')}</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
