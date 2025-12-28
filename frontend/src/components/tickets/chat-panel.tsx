'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Send, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/store';
import {
  getSocket,
  connectSocket,
  joinTicketChat,
  leaveTicketChat,
  sendMessage,
  sendTyping,
  stopTyping,
} from '@/lib/socket';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
}

interface ChatPanelProps {
  ticketId: string;
}

export function ChatPanel({ ticketId }: ChatPanelProps) {
  const t = useTranslations();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    connectSocket();
    joinTicketChat(ticketId);

    const socket = getSocket();

    socket.on('message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('typing', (data: { userId: string; userName: string }) => {
      if (data.userId !== user?.id) {
        setIsTyping(data.userName);
      }
    });

    socket.on('stop-typing', () => {
      setIsTyping(null);
    });

    socket.on('recording-started', () => {
      setIsRecording(true);
    });

    socket.on('messages-history', (history: Message[]) => {
      setMessages(history);
    });

    return () => {
      leaveTicketChat(ticketId);
      socket.off('message');
      socket.off('typing');
      socket.off('stop-typing');
      socket.off('recording-started');
      socket.off('messages-history');
    };
  }, [ticketId, user?.id]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(ticketId, input);
    setInput('');
    stopTyping(ticketId);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);

    sendTyping(ticketId);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(ticketId);
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="flex flex-col h-96">
      <CardHeader className="py-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{t('chat.title')}</CardTitle>
          {isRecording && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {t('chat.recording')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-2',
                message.sender.id === user?.id ? 'flex-row-reverse' : ''
              )}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={message.sender.avatar} />
                <AvatarFallback>{message.sender.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  'max-w-[70%] rounded-lg px-3 py-2 text-sm',
                  message.sender.id === user?.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{t('chat.typing', { name: isTyping })}</span>
              <span className="animate-pulse">...</span>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            className="flex-1"
          />
          <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
