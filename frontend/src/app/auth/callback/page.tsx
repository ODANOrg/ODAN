import React, { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import ClientAuthCallback from './ClientAuthCallback';

export default async function AuthCallbackPage() {
  const t = await getTranslations('auth.callback');
  return (
    <Suspense
      fallback={
        <div className="container flex items-center justify-center min-h-[calc(100vh-8rem)]">
          <p className="text-muted-foreground">{t('authenticating')}</p>
        </div>
      }
    >
      <ClientAuthCallback />
    </Suspense>
  );
}
