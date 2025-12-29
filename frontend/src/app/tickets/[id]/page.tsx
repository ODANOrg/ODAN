'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Clock,
  User,
  MessageSquare,
  CheckCircle,
  Play,
  Square,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { useAuthStore, useTimerStore } from '@/lib/store';
import { timeAgo, formatDuration } from '@/lib/utils';
import { ResponseEditor } from '@/components/tickets/response-editor';
import { ChatPanel } from '@/components/tickets/chat-panel';

const statusColors: Record<string, 'default' | 'secondary' | 'success' | 'warning'> = {
  OPEN: 'default',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'secondary',
};

export default function TicketDetailPage() {
  const t = useTranslations();
  const params = useParams();
  const id = params.id as string;
  const { token, user } = useAuthStore();
  const queryClient = useQueryClient();
  const { isRunning, seconds, startTimer, stopTimer, tick } = useTimerStore();
  const [showChat, setShowChat] = useState(false);

  // Timer tick
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isRunning, tick]);

  // Fetch ticket
  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.getTicket(id, token || undefined),
  });

  // Fetch responses
  const { data: responses = [] } = useQuery({
    queryKey: ['responses', id],
    queryFn: () => api.getResponses(id, token || undefined),
    enabled: !!ticket,
  });

  // Accept ticket
  const acceptMutation = useMutation({
    mutationFn: () => api.acceptTicket(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      startTimer(id);
    },
  });

  // Release ticket
  const releaseMutation = useMutation({
    mutationFn: () => api.releaseTicket(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      stopTimer();
    },
  });

  // Resolve ticket
  const resolveMutation = useMutation({
    mutationFn: () => api.resolveTicket(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    },
  });

  if (isLoading) {
    return (
      <div className="container py-8 max-w-4xl">
        <Skeleton className="h-10 w-3/4 mb-4" />
        <Skeleton className="h-32 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="container py-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Ticket not found</p>
      </div>
    );
  }

  const isVolunteer = user?.role === 'VOLUNTEER' || user?.role === 'ADMIN';
  const isAssignedToMe = ticket.assignedTo?.id === user?.id;
  const isAuthor = ticket.author?.id === user?.id;
  const canAccept = isVolunteer && ticket.status === 'OPEN';
  const canRelease = isAssignedToMe && ticket.status === 'IN_PROGRESS';
  const canResolve = isAuthor && ticket.status === 'IN_PROGRESS';
  const canRespond = isAssignedToMe && ticket.status === 'IN_PROGRESS';

  return (
    <div className="container py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Badge variant={statusColors[ticket.status]}>
              {t(`tickets.status.${ticket.status.toLowerCase().replace('_', '')}`)}
            </Badge>
            <Badge variant="outline">{t(`categories.${ticket.category.toLowerCase()}`)}</Badge>
          </div>
          <h1 className="text-3xl font-bold">{ticket.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Avatar className="h-5 w-5">
                <AvatarImage src={ticket.author?.avatar} />
                <AvatarFallback>{ticket.author?.name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <span>{ticket.author?.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{timeAgo(ticket.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Timer */}
        {isRunning && (
          <div className="flex items-center gap-2 text-primary font-mono text-2xl">
            <Clock className="h-6 w-6" />
            {formatDuration(seconds)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        {canAccept && (
          <Button onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}>
            <Play className="mr-2 h-4 w-4" />
            {t('tickets.accept')}
          </Button>
        )}
        {canRelease && (
          <Button variant="outline" onClick={() => releaseMutation.mutate()} disabled={releaseMutation.isPending}>
            <Square className="mr-2 h-4 w-4" />
            {t('tickets.release')}
          </Button>
        )}
        {canResolve && (
          <Button variant="default" onClick={() => resolveMutation.mutate()} disabled={resolveMutation.isPending}>
            <CheckCircle className="mr-2 h-4 w-4" />
            {t('tickets.resolve')}
          </Button>
        )}
        {(isAssignedToMe || isAuthor) && ticket.status !== 'CLOSED' && (
          <Button variant="outline" onClick={() => setShowChat(!showChat)}>
            <MessageSquare className="mr-2 h-4 w-4" />
            {t('chat.title')}
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{ticket.description}</p>
              {ticket.images && ticket.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {ticket.images.map((img: string, i: number) => (
                    <a key={i} href={img} target="_blank" rel="noreferrer" className="relative h-24 w-24">
                      <Image
                        src={img}
                        alt=""
                        fill
                        className="object-cover rounded border hover:border-primary"
                      />
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Responses */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Responses ({responses.length})</h2>
            {responses.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {t('tickets.noResponses')}
                </CardContent>
              </Card>
            ) : (
              responses.map((response: any) => (
                <Card key={response.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={response.author?.avatar} />
                          <AvatarFallback>{response.author?.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{response.author?.name}</p>
                          <p className="text-xs text-muted-foreground">{timeAgo(response.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {formatDuration(response.timeSpent)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="prose dark:prose-invert max-w-none">
                      {response.content}
                    </div>
                    {response.images && response.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {response.images.map((img: string, i: number) => (
                          <a key={i} href={img} target="_blank" rel="noreferrer" className="relative h-24 w-24">
                            <Image
                              src={img}
                              alt=""
                              fill
                              className="object-cover rounded border"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                    {response.sources && response.sources.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm font-medium mb-2">Sources:</p>
                        <ul className="text-sm space-y-1">
                          {response.sources.map((source: string, i: number) => (
                            <li key={i}>
                              <a
                                href={source}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline"
                              >
                                {source}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Response Editor */}
          {canRespond && <ResponseEditor ticketId={id} timeSpent={seconds} />}
        </div>

        {/* Sidebar / Chat */}
        <div className="space-y-6">
          {/* Assigned Volunteer */}
          {ticket.assignedTo && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Assigned Volunteer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={ticket.assignedTo.avatar} />
                    <AvatarFallback>{ticket.assignedTo.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{ticket.assignedTo.name}</p>
                    <p className="text-xs text-muted-foreground">Volunteer</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chat Panel */}
          {showChat && (isAssignedToMe || isAuthor) && (
            <ChatPanel ticketId={id} />
          )}
        </div>
      </div>
    </div>
  );
}
