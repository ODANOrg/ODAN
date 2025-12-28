'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { CheckCircle, XCircle, Shield, Clock, Users, Ticket, Calendar } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/utils';

export default function VerifyCertificatePage() {
  const t = useTranslations();
  const params = useParams();
  const id = params.id as string;

  const { data, isLoading } = useQuery({
    queryKey: ['certificate-verify', id],
    queryFn: () => api.verifyCertificate(id),
  });

  if (isLoading) {
    return (
      <div className="container py-8 max-w-lg">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const { valid, certificate } = data || { valid: false };

  return (
    <div className="container py-8 max-w-lg">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {valid ? (
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
            )}
          </div>
          <CardTitle>
            {valid ? t('certificate.verification.valid') : t('certificate.verification.invalid')}
          </CardTitle>
          {valid && (
            <CardDescription>
              <Badge variant="success" className="mt-2">
                <Shield className="h-3 w-3 mr-1" />
                {t('certificate.verification.blockchain')}
              </Badge>
            </CardDescription>
          )}
        </CardHeader>
        {valid && certificate && (
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-lg font-semibold">{certificate.user?.name}</p>
              <p className="text-muted-foreground">
                {formatDate(certificate.startDate)} - {formatDate(certificate.endDate)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center py-4 border-y">
              <div>
                <Clock className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="font-bold">{formatDuration(certificate.hoursSpent * 3600)}</p>
                <p className="text-xs text-muted-foreground">{t('certificate.details.hoursSpent')}</p>
              </div>
              <div>
                <Ticket className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="font-bold">{certificate.ticketsHelped}</p>
                <p className="text-xs text-muted-foreground">{t('certificate.details.ticketsHelped')}</p>
              </div>
              <div>
                <Users className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="font-bold">{certificate.peopleHelped}</p>
                <p className="text-xs text-muted-foreground">{t('certificate.details.peopleHelped')}</p>
              </div>
            </div>

            <div className="flex justify-center">
              <QRCodeSVG
                value={window.location.href}
                size={128}
                className="rounded-lg"
              />
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <p>Certificate ID: {certificate.id}</p>
              <p>Blockchain Hash: {certificate.blockchainHash?.slice(0, 16)}...</p>
              <p className="flex items-center justify-center gap-1 mt-2">
                <Calendar className="h-4 w-4" />
                {t('certificate.details.issuedAt')}: {formatDate(certificate.createdAt)}
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
