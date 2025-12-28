'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Award, Download, Shield, Calendar, Clock, Users, Ticket, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatDuration, formatDate } from '@/lib/utils';

export default function CertificatesPage() {
  const t = useTranslations();
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);

  // Fetch certificates
  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ['certificates'],
    queryFn: () => api.getCertificates(token!),
    enabled: !!token,
  });

  // Generate certificate
  const generateMutation = useMutation({
    mutationFn: () => api.generateCertificate({ startDate, endDate }, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      setShowGenerate(false);
      setStartDate('');
      setEndDate('');
    },
  });

  // Download certificate
  const handleDownload = async (id: string) => {
    if (!token) return;
    const blob = await api.downloadCertificate(id, token);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certificate-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('certificate.title')}</h1>
          <p className="text-muted-foreground">
            {t('home.features.certificate.description')}
          </p>
        </div>
        <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
          <DialogTrigger asChild>
            <Button>
              <Award className="mr-2 h-4 w-4" />
              {t('certificate.generate')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('certificate.generate')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">{t('certificate.periodStart')}</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">{t('certificate.periodEnd')}</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGenerate(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!startDate || !endDate || generateMutation.isPending}
              >
                {generateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('certificate.generate')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Certificate List */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-32 mx-auto" />
              </CardContent>
            </Card>
          ))
        ) : certificates.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No certificates yet. Start volunteering to earn certificates!
              </p>
            </CardContent>
          </Card>
        ) : (
          certificates.map((cert: any) => (
            <Card key={cert.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Volunteer Certificate</CardTitle>
                  <Badge variant="success">
                    <Shield className="h-3 w-3 mr-1" />
                    {t('certificate.verification.blockchain')}
                  </Badge>
                </div>
                <CardDescription>
                  {formatDate(cert.startDate)} - {formatDate(cert.endDate)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center">
                  <QRCodeSVG
                    value={`${window.location.origin}/certificates/verify/${cert.id}`}
                    size={128}
                    className="rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <Clock className="h-5 w-5 mx-auto text-muted-foreground" />
                    <p className="font-bold">{formatDuration(cert.hoursSpent * 3600)}</p>
                    <p className="text-xs text-muted-foreground">{t('certificate.details.hoursSpent')}</p>
                  </div>
                  <div>
                    <Ticket className="h-5 w-5 mx-auto text-muted-foreground" />
                    <p className="font-bold">{cert.ticketsHelped}</p>
                    <p className="text-xs text-muted-foreground">{t('certificate.details.ticketsHelped')}</p>
                  </div>
                  <div>
                    <Users className="h-5 w-5 mx-auto text-muted-foreground" />
                    <p className="font-bold">{cert.peopleHelped}</p>
                    <p className="text-xs text-muted-foreground">{t('certificate.details.peopleHelped')}</p>
                  </div>
                </div>
                <Button className="w-full" onClick={() => handleDownload(cert.id)}>
                  <Download className="mr-2 h-4 w-4" />
                  {t('certificate.download')}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
