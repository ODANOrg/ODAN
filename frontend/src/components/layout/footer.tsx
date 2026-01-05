'use client';

import Link from '@/components/i18n/locale-link';
import { useTranslations } from 'next-intl';
import { Github } from 'lucide-react';

export function Footer() {
  const t = useTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30">
      <div className="container grid gap-6 py-10 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">O</div>
            <span>{t('footer.brand')}</span>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
              {t('footer.tagline')}
          </p>
          <p className="text-xs text-muted-foreground">{t('footer.copyright', { year })}</p>
        </div>

        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div className="space-y-2">
            <p className="font-semibold text-foreground">{t('footer.navHow')}</p>
            <div className="flex flex-col space-y-1 text-muted-foreground">
              <Link href="/how-it-works" className="hover:text-foreground">{t('footer.navHow')}</Link>
              <Link href="/volunteers" className="hover:text-foreground">{t('footer.navVolunteers')}</Link>
              <Link href="/about" className="hover:text-foreground">{t('footer.navAbout')}</Link>
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-foreground">{t('footer.legal')}</p>
            <div className="flex flex-col space-y-1 text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground">{t('footer.terms')}</Link>
              <Link href="/privacy" className="hover:text-foreground">{t('footer.privacy')}</Link>
              <Link href="/contact" className="hover:text-foreground">{t('footer.contact')}</Link>
            </div>
          </div>
          <div className="md:col-span-2 flex items-center gap-4 text-muted-foreground">
            <a
              href="https://github.com/odan-project"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              <Github className="h-5 w-5" />
              <span className="sr-only">{t('footer.github')}</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
