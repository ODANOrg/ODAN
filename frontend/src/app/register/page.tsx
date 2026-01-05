'use client';

import { useSearchParams } from 'next/navigation';
import Link from '@/components/i18n/locale-link';
import { useTranslations } from 'next-intl';
import { MessageSquare, Github, Chrome, ShieldCheck, Users, Sparkles, HeartHandshake, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const twitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

type Role = 'user' | 'volunteer' | 'both' | null;

export default function RegisterPage() {
  const t = useTranslations('register');
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role') as Role;
  const [selectedRole, setSelectedRole] = useState<Role>(initialRole);

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

  const roles = [
    {
      id: 'user' as Role,
      icon: Users,
      title: t('roles.user.title'),
      description: t('roles.user.description'),
      color: 'border-sky-500 bg-sky-50 dark:bg-sky-950/30',
    },
    {
      id: 'volunteer' as Role,
      icon: HeartHandshake,
      title: t('roles.volunteer.title'),
      description: t('roles.volunteer.description'),
      color: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      id: 'both' as Role,
      icon: Sparkles,
      title: t('roles.both.title'),
      description: t('roles.both.description'),
      color: 'border-purple-500 bg-purple-50 dark:bg-purple-950/30',
    },
  ];

  const handleRegister = (provider: string) => {
    // Include role in the auth URL if selected
    const url = api.getAuthUrl(provider);
    const separator = url.includes('?') ? '&' : '?';
    const roleParam = selectedRole ? `${separator}role=${selectedRole}` : '';
    window.location.href = `${url}${roleParam}`;
  };

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container max-w-4xl py-12">
        <Button variant="ghost" className="mb-6 text-white/70 hover:text-white" asChild>
          <Link href="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('backToLogin')}
          </Link>
        </Button>

        <div className="text-center text-white mb-8">
          <Badge variant="outline" className="mb-4 border-white/30 bg-white/10 text-white">
            {t('badge')}
          </Badge>
          <h1 className="text-3xl font-bold md:text-4xl">{t('title')}</h1>
          <p className="mt-2 text-white/70 max-w-xl mx-auto">{t('subtitle')}</p>
        </div>

        {/* Step 1: Choose Role */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">1</span>
              {t('step1.title')}
            </CardTitle>
            <CardDescription>{t('step1.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={cn(
                    'relative flex flex-col items-center p-6 rounded-xl border-2 transition-all text-center',
                    selectedRole === role.id
                      ? role.color
                      : 'border-border hover:border-muted-foreground/50 bg-background'
                  )}
                >
                  {selectedRole === role.id && (
                    <div className="absolute top-2 right-2">
                      <div className="h-3 w-3 rounded-full bg-primary" />
                    </div>
                  )}
                  <role.icon className="h-10 w-10 mb-3 text-primary" />
                  <h3 className="font-semibold text-lg">{role.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Choose Provider */}
        <Card className={cn(!selectedRole && 'opacity-50 pointer-events-none')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">2</span>
              {t('step2.title')}
            </CardTitle>
            <CardDescription>{t('step2.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {providers.map((provider) => (
              <div key={provider.id}>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 border-muted-foreground/20 text-left h-auto py-3"
                  size="lg"
                  onClick={() => handleRegister(provider.id)}
                  disabled={!selectedRole}
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
              {t('alreadyHaveAccount')}{' '}
              <Button variant="link" className="px-1" asChild>
                <Link href="/login">{t('signIn')}</Link>
              </Button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
