'use client';

import Link from '@/components/i18n/locale-link';
import { useTranslations } from 'next-intl';
import { MessageSquare, Github, Chrome, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';

const twitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export default function LoginPage() {
  const t = useTranslations('login');

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
    <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-12">
      <div className="container max-w-md">
        <Card className="relative">
          <div className="absolute inset-x-6 top-0 h-1 rounded-full bg-gradient-to-r from-primary via-sky-400 to-primary" />
          <CardHeader className="text-center space-y-3 pt-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <span className="text-2xl font-bold">O</span>
            </div>
            <CardTitle className="text-2xl">{t('title')}</CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {providers.map((provider) => (
              <div key={provider.id}>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 border-muted-foreground/20 text-left h-auto py-3"
                  size="lg"
                  onClick={() => handleLogin(provider.id)}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-lg text-white ${provider.color}`}
                    aria-hidden
                  >
                    <provider.icon className="h-5 w-5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col items-start">
                    <span className="text-base font-semibold truncate">{provider.label}</span>
                    {provider.recommended && (
                      <span className="text-xs text-muted-foreground">{t('telegramNote')}</span>
                    )}
                  </div>
                  {provider.recommended && (
                    <Badge variant="secondary" className="ml-auto shrink-0 bg-emerald-100 text-emerald-700">
                      {t('preferredBadge')}
                    </Badge>
                  )}
                </Button>
                {provider.recommended && (
                  <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
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

            <Separator />

            <p className="text-center text-sm text-muted-foreground">
              {t('noAccount')}{' '}
              <Button variant="link" className="px-1" asChild>
                <Link href="/register">
                  <Sparkles className="mr-1 h-3 w-3" />
                  {t('createAccount')}
                </Link>
              </Button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
