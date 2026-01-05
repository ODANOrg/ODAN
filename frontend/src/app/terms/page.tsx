'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function TermsPage() {
  const t = useTranslations('terms');

  const sections = t.raw('sections') as { title: string; content: string }[];

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-gradient-to-b from-background to-muted/20">
      <div className="container max-w-4xl py-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileText className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold md:text-4xl">{t('title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('lastUpdated')}</p>
        </div>

        <Card>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none pt-6">
            <p className="lead">{t('intro')}</p>

            {sections.map((section, index) => (
              <div key={index} className="mt-8">
                <h2 className="text-xl font-semibold">{section.title}</h2>
                <p className="mt-2 whitespace-pre-line">{section.content}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
