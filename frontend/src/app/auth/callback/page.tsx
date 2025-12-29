import React, { Suspense } from 'react';
import ClientAuthCallback from './ClientAuthCallback';

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="container flex items-center justify-center min-h-[calc(100vh-8rem)]"><p className="text-muted-foreground">Authenticating...</p></div>}>
      <ClientAuthCallback />
    </Suspense>
  );
}
