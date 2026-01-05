'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from '@/components/i18n/locale-link';
import { Plus, Clock, User, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { timeAgo } from '@/lib/utils';
import { useState } from 'react';

const statusColors: Record<string, 'default' | 'secondary' | 'success' | 'warning'> = {
  OPEN: 'default',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'secondary',
};

export default function TicketsPage() {
  const t = useTranslations();
  const { token } = useAuthStore();
  const [status, setStatus] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', status, category],
    queryFn: () => api.getTickets({ status, category }, token || undefined),
  });

  const tickets = data?.tickets || [];
  const filteredTickets = search
    ? tickets.filter(
        (t: any) =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase())
      )
    : tickets;

  return (
    <div className="container py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('tickets.title')}</h1>
          <p className="text-muted-foreground">{t('home.features.help.description')}</p>
        </div>
        <Button asChild>
          <Link href="/tickets/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('tickets.new')}
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <Input
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="md:w-64"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="OPEN">{t('tickets.status.open')}</SelectItem>
            <SelectItem value="IN_PROGRESS">{t('tickets.status.inProgress')}</SelectItem>
            <SelectItem value="RESOLVED">{t('tickets.status.resolved')}</SelectItem>
            <SelectItem value="CLOSED">{t('tickets.status.closed')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="md:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Categories</SelectItem>
            <SelectItem value="OS">{t('categories.os')}</SelectItem>
            <SelectItem value="SOFTWARE">{t('categories.software')}</SelectItem>
            <SelectItem value="HARDWARE">{t('categories.hardware')}</SelectItem>
            <SelectItem value="NETWORK">{t('categories.network')}</SelectItem>
            <SelectItem value="SECURITY">{t('categories.security')}</SelectItem>
            <SelectItem value="MOBILE">{t('categories.mobile')}</SelectItem>
            <SelectItem value="OTHER">{t('categories.other')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Ticket List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
            </Card>
          ))
        ) : filteredTickets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">{t('tickets.noResponses')}</p>
              <Button asChild className="mt-4">
                <Link href="/tickets/new">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('tickets.new')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredTickets.map((ticket: any) => (
            <Link key={ticket.id} href={`/tickets/${ticket.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{ticket.title}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {ticket.description}
                      </CardDescription>
                    </div>
                    <Badge variant={statusColors[ticket.status]}>
                      {t(`tickets.status.${ticket.status.toLowerCase().replace('_', '')}`)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={ticket.author?.avatar} />
                        <AvatarFallback>
                          {ticket.author?.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span>{ticket.author?.name || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{timeAgo(ticket.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      <span>{ticket._count?.responses || 0}</span>
                    </div>
                    <Badge variant="outline">{t(`categories.${ticket.category.toLowerCase()}`)}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
