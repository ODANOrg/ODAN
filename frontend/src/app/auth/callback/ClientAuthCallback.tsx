"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

export default function ClientAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const errorMsg = searchParams.get('error');

    if (errorMsg) {
      setError(errorMsg);
      setTimeout(() => router.push('/login'), 3000);
      return;
    }

    if (token) {
      api.getMe(token)
        .then((user) => {
          setAuth(user as any, token);
          router.push('/dashboard');
        })
        .catch(() => {
          setError('Failed to authenticate');
          setTimeout(() => router.push('/login'), 3000);
        });
    } else {
      setError('No token received');
      setTimeout(() => router.push('/login'), 3000);
    }
  }, [searchParams, router, setAuth]);

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <p className="text-destructive">{error}</p>
            <p className="text-muted-foreground">Redirecting to login...</p>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-muted-foreground">Authenticating...</p>
          </>
        )}
      </div>
    </div>
  );
}
