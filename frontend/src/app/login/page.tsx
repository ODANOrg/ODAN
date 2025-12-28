'use client';

import { useTranslations } from 'next-intl';
import { MessageSquare, Github, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

const providers = [
  {
    id: 'telegram',
    icon: MessageSquare,
    color: 'bg-[#0088cc]',
    recommended: true,
  },
  {
    id: 'google',
    icon: Chrome,
    color: 'bg-[#4285F4]',
  },
  {
    id: 'github',
    icon: Github,
    color: 'bg-[#333]',
  },
  {
    id: 'twitter',
    icon: ({ className }: { className?: string }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    color: 'bg-black dark:bg-white dark:text-black',
  },
];

export default function LoginPage() {
  const t = useTranslations();

  const handleLogin = (provider: string) => {
    window.location.href = api.getAuthUrl(provider);
  };

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-8rem)] py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-primary-foreground">O</span>
          </div>
          <CardTitle className="text-2xl">{t('auth.loginTitle')}</CardTitle>
          <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers.map((provider) => (
            <div key={provider.id}>
              <Button
                variant="outline"
                className="w-full h-12 relative"
                onClick={() => handleLogin(provider.id)}
              >
                <div
                  className={`absolute left-3 w-8 h-8 rounded flex items-center justify-center text-white ${provider.color}`}
                >
                  <provider.icon className="h-4 w-4" />
                </div>
                <span className="ml-6">
                  {t('auth.continueWith', { provider: t(`auth.providers.${provider.id}`) })}
                </span>
                {provider.recommended && (
                  <span className="absolute right-3 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                    ★
                  </span>
                )}
              </Button>
              {provider.recommended && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  {t('auth.telegramNote')}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
