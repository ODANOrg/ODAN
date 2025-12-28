'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { User, Settings, Clock, Ticket, Users, Award, Moon, Sun, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/lib/store';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDuration } from '@/lib/utils';

const locales = [
  { code: 'en', name: 'English' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'es', name: 'Español' },
];

export default function ProfilePage() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { user, token } = useAuthStore();

  const { data: stats } = useQuery({
    queryKey: ['user-stats'],
    queryFn: () => api.getUserStats(token!),
    enabled: !!token,
  });

  if (!user) {
    return null;
  }

  const isVolunteer = user.role === 'VOLUNTEER' || user.role === 'ADMIN';

  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">{t('profile.title')}</h1>

      {/* Profile Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatar} />
              <AvatarFallback className="text-xl">{user.name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{user.name}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
              <Badge variant={isVolunteer ? 'default' : 'secondary'} className="mt-2">
                {isVolunteer ? 'Volunteer' : 'User'}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">{t('profile.stats.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {isVolunteer ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatDuration((stats?.timeSpent || 0) * 60)}</p>
                    <p className="text-sm text-muted-foreground">{t('profile.stats.timeSpent')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Ticket className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.ticketsResolved || 0}</p>
                    <p className="text-sm text-muted-foreground">{t('profile.stats.ticketsResolved')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.peopleHelped || 0}</p>
                    <p className="text-sm text-muted-foreground">{t('profile.stats.peopleHelped')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Award className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.certificates || 0}</p>
                    <p className="text-sm text-muted-foreground">Certificates</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Ticket className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.ticketsCreated || 0}</p>
                    <p className="text-sm text-muted-foreground">{t('profile.stats.ticketsCreated')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Ticket className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.ticketsResolved || 0}</p>
                    <p className="text-sm text-muted-foreground">{t('profile.stats.ticketsResolved')}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('profile.settings.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? (
                <Moon className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Sun className="h-5 w-5 text-muted-foreground" />
              )}
              <Label>{t('profile.settings.theme')}</Label>
            </div>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t('profile.settings.themeLight')}</SelectItem>
                <SelectItem value="dark">{t('profile.settings.themeDark')}</SelectItem>
                <SelectItem value="system">{t('profile.settings.themeSystem')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Language */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <Label>{t('profile.settings.language')}</Label>
            </div>
            <Select
              defaultValue="en"
              onValueChange={(locale) => {
                router.push(`/${locale}/profile`);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locales.map((locale) => (
                  <SelectItem key={locale.code} value={locale.code}>
                    {locale.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
