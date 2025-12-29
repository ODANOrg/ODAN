'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Paintbrush, AlertTriangle, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useAuthStore, useTimerStore } from '@/lib/store';
import { formatDuration } from '@/lib/utils';
import { Whiteboard } from './whiteboard';

interface ResponseEditorProps {
  ticketId: string;
  timeSpent: number;
}

export function ResponseEditor({ ticketId, timeSpent }: ResponseEditorProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { token } = useAuthStore();
  const { stopTimer, resetTimer } = useTimerStore();
  
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [pendingPaste, setPendingPaste] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  // Detect paste
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (text && text.length > 100) {
      e.preventDefault();
      setPendingPaste(text);
      setShowSourceDialog(true);
    }
  }, []);

  const handleConfirmSource = () => {
    if (sourceUrl) {
      setSources((prev) => [...prev, sourceUrl]);
    }
    setContent((prev) => prev + pendingPaste);
    setPendingPaste('');
    setSourceUrl('');
    setShowSourceDialog(false);
  };

  const handleWhiteboardSave = (imageUrl: string) => {
    setImages((prev) => [...prev, imageUrl]);
    setShowWhiteboard(false);
  };

  // Submit response
  const submitMutation = useMutation({
    mutationFn: () =>
      api.createResponse(
        {
          ticketId,
          content,
          timeSpent: stopTimer(),
          images,
          sources,
        },
        token!
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responses', ticketId] });
      setContent('');
      setImages([]);
      setSources([]);
      resetTimer();
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('response.editor.title')}</CardTitle>
            <span className="text-sm text-muted-foreground font-mono">
              {t('response.editor.timeSpent', { time: formatDuration(timeSpent) })}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handlePaste}
            placeholder={t('response.editor.placeholder')}
            className="min-h-[200px]"
          />

          {/* Source warnings */}
          {sources.length > 0 && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Sources cited:</p>
              <ul className="text-sm space-y-1">
                {sources.map((source, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <LinkIcon className="h-3 w-3" />
                    <a href={source} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      {source}
                    </a>
                    <button
                      type="button"
                      className="text-destructive text-xs"
                      onClick={() => setSources((prev) => prev.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Images preview */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative w-20 h-20 rounded border overflow-hidden">
                  <Image src={img} alt="" fill className="object-cover" />
                  <button
                    type="button"
                    className="absolute top-0 right-0 p-1 bg-destructive text-white text-xs"
                    onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowWhiteboard(true)}
            >
              <Paintbrush className="mr-2 h-4 w-4" />
              {t('response.editor.whiteboard')}
            </Button>
            <div className="flex-1" />
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={!content.trim() || submitMutation.isPending}
            >
              {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('response.editor.submit')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Source Dialog */}
      <Dialog open={showSourceDialog} onOpenChange={setShowSourceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              {t('response.editor.sourceRequired')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">{t('response.editor.pastedWarning')}</p>
            <Input
              placeholder="https://..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSourceDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleConfirmSource}>
              {t('common.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Whiteboard Dialog */}
      <Dialog open={showWhiteboard} onOpenChange={setShowWhiteboard}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('whiteboard.title')}</DialogTitle>
          </DialogHeader>
          <Whiteboard onSave={handleWhiteboardSave} ticketId={ticketId} />
        </DialogContent>
      </Dialog>
    </>
  );
}
