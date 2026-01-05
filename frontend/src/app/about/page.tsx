'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Users, Shield, Award, Github, Globe, Sparkles } from 'lucide-react';
import Link from '@/components/i18n/locale-link';

export default function AboutPage() {
  const t = useTranslations('about');

  const values = t.raw('values') as { title: string; description: string; icon: string }[];
  const team = t.raw('team') as { name: string; role: string; bio: string }[];

  const iconMap: Record<string, typeof Heart> = {
    heart: Heart,
    users: Users,
    shield: Shield,
    award: Award,
    globe: Globe,
    sparkles: Sparkles,
  };

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-gradient-to-b from-background to-muted/20">
      <div className="container max-w-5xl py-12">
        {/* Hero */}
        <div className="mb-12 text-center">
          <Badge variant="secondary" className="mb-4">{t('badge')}</Badge>
          <h1 className="text-3xl font-bold md:text-5xl">{t('title')}</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">{t('subtitle')}</p>
        </div>

        {/* Mission */}
        <Card className="mb-12">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t('mission.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-lg text-muted-foreground">{t('mission.content')}</p>
          </CardContent>
        </Card>

        {/* Values */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-center mb-8">{t('valuesTitle')}</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {values.map((value, index) => {
              const IconComponent = iconMap[value.icon] || Heart;
              return (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-lg">{value.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{value.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* How it started */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="text-2xl">{t('story.title')}</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none">
            <p>{t('story.content')}</p>
          </CardContent>
        </Card>

        {/* Open Source */}
        <Card className="mb-12 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6 py-8">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <Github className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">{t('openSource.title')}</h3>
                <p className="text-white/70">{t('openSource.description')}</p>
              </div>
            </div>
            <Button variant="secondary" size="lg" asChild>
              <a href="https://github.com/odan-project/odan" target="_blank" rel="noopener noreferrer">
                {t('openSource.button')}
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">{t('cta.title')}</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">{t('cta.description')}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/register">{t('cta.volunteer')}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/tickets/new">{t('cta.getHelp')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
