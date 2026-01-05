'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Upload, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Link from '@/components/i18n/locale-link';

const categories = ['OS', 'SOFTWARE', 'HARDWARE', 'NETWORK', 'SECURITY', 'MOBILE', 'OTHER'];

interface SimilarTicket {
  id: string;
  title: string;
  score: number;
  status: string;
}

export default function NewTicketPage() {
  const t = useTranslations();
  const router = useRouter();
  const { token, isAuthenticated } = useAuthStore();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  
  const [showSimilar, setShowSimilar] = useState(false);
  const [similarTickets, setSimilarTickets] = useState<SimilarTicket[]>([]);
  const [duplicate, setDuplicate] = useState<SimilarTicket | null>(null);
  const [checked, setChecked] = useState(false);

  // Check for similar tickets
  const checkSimilar = useMutation({
    mutationFn: () => api.checkSimilarTickets({ title, description }, token!),
    onSuccess: (data) => {
      setChecked(true);
      if (data.hasDuplicate && data.duplicate) {
        setDuplicate(data.duplicate);
        setShowSimilar(true);
      } else if (data.similar && data.similar.length > 0) {
        setSimilarTickets(data.similar);
        setShowSimilar(true);
      } else {
        // No duplicates or similar, proceed to create
        createTicket.mutate();
      }
    },
  });

  // Create ticket
  const createTicket = useMutation({
    mutationFn: () => api.createTicket({ title, description, category, images }, token!),
    onSuccess: (data) => {
      router.push(`/tickets/${data.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAuthenticated || !token) {
      router.push('/login');
      return;
    }

    if (!checked) {
      checkSimilar.mutate();
    } else {
      createTicket.mutate();
    }
  };

  const handleContinue = () => {
    setShowSimilar(false);
    createTicket.mutate();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !token) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const result = await api.uploadImage(file, token);
        setImages((prev) => [...prev, result.url]);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
    setUploading(false);
  };

  const isLoading = checkSimilar.isPending || createTicket.isPending;

  return (
    <div className="container py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{t('tickets.create.title')}</CardTitle>
          <CardDescription>{t('home.features.help.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">{t('tickets.create.titleLabel')}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setChecked(false);
                }}
                placeholder={t('tickets.create.titlePlaceholder')}
                required
                minLength={10}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('tickets.create.descriptionLabel')}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setChecked(false);
                }}
                placeholder={t('tickets.create.descriptionPlaceholder')}
                required
                minLength={50}
                className="min-h-[200px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">{t('tickets.create.categoryLabel')}</Label>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {t(`categories.${cat.toLowerCase()}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('tickets.create.imagesLabel')}</Label>
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
                <label className="flex items-center justify-center w-20 h-20 rounded border border-dashed cursor-pointer hover:border-primary">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  )}
                </label>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || !category}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {checkSimilar.isPending ? t('tickets.create.checking') : t('tickets.create.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Similar Tickets Dialog */}
      <Dialog open={showSimilar} onOpenChange={setShowSimilar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {duplicate ? (
                <span className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  {t('tickets.duplicate.title')}
                </span>
              ) : (
                <span className="flex items-center gap-2 text-yellow-500">
                  <AlertTriangle className="h-5 w-5" />
                  {t('tickets.similar.title')}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {duplicate ? t('tickets.duplicate.description') : t('tickets.similar.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-64 overflow-auto">
            {duplicate ? (
              <Link href={`/tickets/${duplicate.id}`}>
                <Card className="cursor-pointer hover:border-primary">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">{duplicate.title}</CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            ) : (
              similarTickets.map((ticket) => (
                <Link key={ticket.id} href={`/tickets/${ticket.id}`}>
                  <Card className="cursor-pointer hover:border-primary">
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{ticket.title}</CardTitle>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(ticket.score * 100)}% match
                        </span>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))
            )}
          </div>

          <DialogFooter>
            {duplicate ? (
              <Button asChild>
                <Link href={`/tickets/${duplicate.id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t('tickets.duplicate.viewExisting')}
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowSimilar(false)}>
                  {t('tickets.similar.viewSolution')}
                </Button>
                <Button onClick={handleContinue} disabled={createTicket.isPending}>
                  {createTicket.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('tickets.similar.continueAnyway')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
