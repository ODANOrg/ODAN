"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { localizeHref } from '@/components/i18n/locale-link';

export default function ClientAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const locale = useLocale();
  const t = useTranslations('auth.callback');

  useEffect(() => {
    const token = searchParams.get('token');
    const errorMsg = searchParams.get('error');

    if (errorMsg) {
      setError(errorMsg);
      setTimeout(() => router.push(localizeHref('/login', locale)), 1500);
      return;
    }

    if (token) {
      api.getMe(token)
        .then((user) => {
          setAuth(user as any, token);

          let postAuthRedirect: string | null = null;
          try {
            postAuthRedirect = localStorage.getItem('odan-post-auth-redirect');
            if (postAuthRedirect) localStorage.removeItem('odan-post-auth-redirect');
          } catch {
            // ignore
          }

          router.push(localizeHref(postAuthRedirect || '/dashboard', locale));
        })
        .catch(() => {
          setError(t('failed'));
          setTimeout(() => router.push(localizeHref('/login', locale)), 1500);
        });
    } else {
      setError(t('noToken'));
      setTimeout(() => router.push(localizeHref('/login', locale)), 1500);
    }
  }, [searchParams, router, setAuth, locale, t]);

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <p className="text-destructive">{error}</p>
            <p className="text-muted-foreground">{t('redirecting')}</p>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-muted-foreground">{t('authenticating')}</p>
          </>
        )}
      </div>
    </div>
  );
}
