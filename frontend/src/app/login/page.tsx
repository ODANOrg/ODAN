'use client';

import Link from '@/components/i18n/locale-link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { MessageSquare, Github, Chrome, ShieldCheck, Users, HeartHandshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

const twitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export default function LoginPage() {
  const t = useTranslations('auth');

  const providers = [
    {
      id: 'telegram',
      icon: MessageSquare,
      color: 'bg-[#0088cc]',
      recommended: true,
      label: t('providers.telegramLabel'),
    },
    {
      id: 'google',
      icon: Chrome,
      color: 'bg-[#4285F4]',
      label: t('providers.googleLabel'),
    },
    {
      id: 'github',
      icon: Github,
      color: 'bg-[#333]',
      label: t('providers.githubLabel'),
    },
    {
      id: 'twitter',
      icon: twitterIcon,
      color: 'bg-black dark:bg-white dark:text-black',
      label: t('providers.twitterLabel'),
    },
  ];

  const handleLogin = (provider: string) => {
    window.location.href = api.getAuthUrl(provider);
  };

  return (
    <div className="min-h-[calc(100vh-6rem)] overflow-x-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container grid grid-cols-1 gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:py-12">
        <div className="flex w-full max-w-full flex-col items-center justify-center space-y-4 text-center text-white sm:space-y-6 lg:items-start lg:text-left">
          <Badge variant="outline" className="w-fit border-white/30 bg-white/10 text-white lg:mx-0">
            {t('loginHeroBadge')}
          </Badge>
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold leading-tight sm:text-4xl md:text-5xl">
              {t('loginHeroTitle')}
            </h1>
            <p className="max-w-full text-base text-white/80 sm:max-w-2xl sm:text-lg">
              {t('loginHeroSubtitle')}
            </p>
          </div>

          <div className="grid w-full max-w-full grid-cols-1 gap-4 sm:max-w-2xl sm:grid-cols-2 lg:max-w-none">
            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t('cards.user.title')}</CardTitle>
                <CardDescription className="text-white/70">
                  {t('cards.user.subtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-2 text-sm text-white/70">
                <Users className="h-4 w-4" />
                {t('cards.user.bullet')}
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t('cards.volunteer.title')}</CardTitle>
                <CardDescription className="text-white/70">
                  {t('cards.volunteer.subtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-2 text-sm text-white/70">
                <HeartHandshake className="h-4 w-4" />
                {t('cards.volunteer.bullet')}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="relative card-pop mx-auto w-full max-w-full lg:mx-0 lg:justify-self-end">
          <div className="absolute inset-x-6 top-0 h-1 rounded-full bg-gradient-to-r from-primary via-sky-400 to-primary" />
          <CardHeader className="text-center space-y-3 pt-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Image src="/logo.svg" alt="ODAN" width={28} height={28} className="dark:invert" />
            </div>
            <CardTitle className="text-2xl">{t('loginTitle')}</CardTitle>
            <CardDescription>{t('loginSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {providers.map((provider) => (
              <div key={provider.id} className="space-y-2">
                <Button
                  variant="outline"
                  className="flex w-full flex-row items-start gap-3 border-muted-foreground/20 text-left h-auto py-3"
                  size="lg"
                  onClick={() => handleLogin(provider.id)}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-lg text-white ${provider.color}`}
                    aria-hidden
                  >
                    <provider.icon className="h-5 w-5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <div className="flex w-full flex-wrap items-start gap-2">
                      <span className="break-words text-sm font-semibold leading-tight sm:text-base whitespace-normal">
                        {provider.label}
                      </span>
                      {provider.recommended && (
                        <Badge
                          variant="secondary"
                          className="w-fit shrink-0 bg-emerald-100 text-emerald-700"
                        >
                          {t('preferredBadge')}
                        </Badge>
                      )}
                    </div>
                    {provider.recommended && (
                      <span className="break-words text-xs text-muted-foreground whitespace-normal">
                        {t('telegramNote')}
                      </span>
                    )}
                  </div>
                </Button>
                {provider.recommended && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <div className="flex items-center gap-2 font-semibold">
                      <ShieldCheck className="h-4 w-4" />
                      {t('recommendedReasonTitle')}
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {(t.raw('recommendedReasons') as string[]).map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}

            <p className="text-center text-sm text-muted-foreground">
              {t('noAccount')}{' '}
              <Button variant="link" className="px-1" asChild>
                <Link href="/register">{t('createAccount')}</Link>
              </Button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
