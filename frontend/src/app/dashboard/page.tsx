'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Clock, Ticket, Users, Award, Plus, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatDuration, timeAgo } from '@/lib/utils';
import { UserStats } from '@/types/backend';

const statusColors: Record<string, 'default' | 'secondary' | 'success' | 'warning'> = {
  OPEN: 'default',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'secondary',
};

export default function DashboardPage() {
  const t = useTranslations();
  const { token, user } = useAuthStore();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['user-stats'],
    queryFn: () => api.getUserStats(token!),
    enabled: !!token,
  });

  const { data: recentTickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ['recent-tickets'],
    queryFn: () => api.getTickets({ page: 1 }, token!),
    enabled: !!token,
  });

  const isVolunteer = user?.role === 'VOLUNTEER' || user?.role === 'ADMIN';

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('nav.dashboard')}</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.name}!
          </p>
        </div>
        <Button asChild>
          <Link href="/tickets/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('tickets.new')}
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {isVolunteer ? t('profile.stats.ticketsResolved') : t('profile.stats.ticketsCreated')}
                </CardTitle>
                <Ticket className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isVolunteer ? stats?.ticketsResolved || 0 : stats?.ticketsCreated || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  +{stats?.ticketsThisMonth || 0} this month
                </p>
              </CardContent>
            </Card>

            {isVolunteer && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t('profile.stats.timeSpent')}</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatDuration((stats?.timeSpent || 0) * 60)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Total volunteer time
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t('profile.stats.peopleHelped')}</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.peopleHelped || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Unique users helped
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Certificates</CardTitle>
                    <Award className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.certificates || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      <Link href="/certificates" className="text-primary hover:underline">
                        View all certificates
                      </Link>
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            {!isVolunteer && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Resolved Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats?.resolvedRate ? `${Math.round(stats.resolvedRate * 100)}%` : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Of your tickets resolved
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Recent Tickets */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Tickets</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tickets">View all</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {ticketsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentTickets?.tickets?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No tickets yet</p>
              <Button asChild className="mt-4">
                <Link href="/tickets/new">{t('tickets.new')}</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {recentTickets?.tickets?.slice(0, 5).map((ticket: any) => (
                <Link
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{ticket.title}</p>
                    <p className="text-sm text-muted-foreground">{timeAgo(ticket.createdAt)}</p>
                  </div>
                  <Badge variant={statusColors[ticket.status]}>
                    {t(`tickets.status.${ticket.status.toLowerCase().replace('_', '')}`)}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
