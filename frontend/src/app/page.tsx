'use client';

import { useEffect, useRef } from 'react';
import Link from '@/components/i18n/locale-link';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  HeartHandshake,
  MessageCircle,
  ShieldCheck,
  Timer,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

type StatItem = {
  label: string;
  value: number;
  fallback: string;
};

export default function HomePage() {
  const t = useTranslations('landing');
  const pageRef = useRef<HTMLDivElement>(null);
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.getStats(),
  });

  const steps = (t.raw('steps') as { title: string; description: string }[]).map((step, idx) => ({
    ...step,
    icon:
      idx === 0 ? <MessageCircle className="h-6 w-6 text-primary" /> :
      idx === 1 ? <HeartHandshake className="h-6 w-6 text-primary" /> :
      <CheckCircle2 className="h-6 w-6 text-primary" />,
  }));

  const reasons = (t.raw('reasons') as { title: string; description: string }[]).map((reason, idx) => ({
    ...reason,
    icon:
      idx === 0 ? <HeartHandshake className="h-5 w-5" /> :
      idx === 1 ? <ShieldCheck className="h-5 w-5" /> :
      idx === 2 ? <Award className="h-5 w-5" /> :
      <Timer className="h-5 w-5" />,
  }));

  const formatNumber = (value: number | undefined | null, fallback: string) => {
    if (value === undefined || value === null) return fallback;
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const statItems: StatItem[] = [
    { label: t('activeTickets'), value: stats?.openTickets ?? 2345, fallback: '2.345' },
    { label: t('volunteers'), value: stats?.totalVolunteers ?? stats?.volunteers ?? 1234, fallback: '1.234' },
    { label: t('hours'), value: stats?.totalHoursVolunteered ?? stats?.hoursSpent ?? 34567, fallback: '34.567' },
  ];

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.from('.hero-float', {
        opacity: 0,
        y: 40,
        duration: 1.2,
        ease: 'power3.out',
        stagger: 0.15,
      });

          gsap.utils.toArray<HTMLElement>('.card-pop').forEach((card: HTMLElement) => {
        gsap.from(card, {
          y: 30,
          opacity: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 80%',
          },
        });
      });
    }, pageRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={pageRef} className="flex flex-col">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.25),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(56,189,248,0.25),transparent_35%),linear-gradient(135deg,var(--tw-gradient-from),var(--tw-gradient-to))] from-slate-900 via-slate-950 to-slate-900" />
        <div className="absolute inset-0 opacity-30" aria-hidden>
          <div className="grid h-full w-full grid-cols-8 gap-px">
            {Array.from({ length: 64 }).map((_, i) => (
              <div key={i} className="border border-white/5" />
            ))}
          </div>
        </div>

        <div className="container relative pb-24 pt-20 md:pt-28">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
            <div className="flex flex-col items-center space-y-8 text-center text-white lg:items-start lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium hero-float">
                <HeartHandshake className="h-4 w-4" />
                {t('badge')}
              </div>
              <div className="space-y-4 hero-float">
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
                  {t('title')}
                </h1>
                <p className="mx-auto max-w-2xl text-lg text-white/80 lg:mx-0">
                  {t('subtitle')}
                </p>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start hero-float">
                <Button size="lg" asChild className="w-full shadow-xl shadow-primary/30 sm:w-auto">
                  <Link href="/tickets/new">
                    {t('ctaHelp')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="w-full border-white/30 bg-white/10 text-white sm:w-auto"
                >
                  <Link href="/login?role=volunteer">
                    {t('ctaVolunteer')}
                  </Link>
                </Button>
              </div>
              <div className="flex flex-wrap justify-center gap-3 text-sm text-white/70 hero-float lg:justify-start">
                <Badge variant="outline" className="border-white/30 bg-white/5 text-white">
                  {t('badgeNoAds')}
                </Badge>
                <Badge variant="outline" className="border-white/30 bg-white/5 text-white">
                  {t('badgeTelegram')}
                </Badge>
                <Badge variant="outline" className="border-white/30 bg-white/5 text-white">
                  {t('badgeCert')}
                </Badge>
              </div>
            </div>

            <Card className="card-pop mx-auto w-full max-w-md border-white/10 bg-white/10 text-white backdrop-blur sm:max-w-lg lg:max-w-none">
              <CardHeader className="space-y-2">
                <CardTitle className="text-2xl">{t('quickTitle')}</CardTitle>
                <CardDescription className="text-white/70">
                  {t('quickSubtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div>
                    <p className="text-sm text-white/60">{t('activeTickets')}</p>
                    <p className="text-2xl font-semibold">{statItems[0].fallback}</p>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-100">
                    {t('realtimeBadge')}
                  </Badge>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-white/60">{t('hours')}</p>
                    <p className="text-lg font-semibold">{formatNumber(stats?.hoursSpent, '34.567')}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-white/60">{t('volunteers')}</p>
                    <p className="text-lg font-semibold">{formatNumber(stats?.volunteers, statItems[1].fallback)}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-white/60">{t('privacyLabel')}</p>
                  <p className="text-sm text-white">{t('privacy')}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="container py-16 md:py-20 space-y-10">
        <div className="flex flex-col gap-3 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t('stepsTitle')}</h2>
          <p className="text-lg text-muted-foreground">
            {t('stepsSubtitle')}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.title} className="card-pop">
              <CardHeader className="space-y-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {step.icon}
                </div>
                <CardTitle>{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section id="voluntarios" className="py-16 md:py-20 bg-muted/40">
        <div className="container grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <div className="space-y-6 card-pop text-center lg:text-left">
            <Badge variant="secondary" className="bg-primary/10 text-primary">{t('volunteersBadge')}</Badge>
            <h3 className="text-3xl font-semibold tracking-tight">{t('volunteersTitle')}</h3>
            <p className="text-muted-foreground text-lg">
              {t('volunteersSubtitle')}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">{t('stats.hours')}</CardTitle>
                  <p className="text-2xl font-semibold">45h</p>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">{t('stats.tickets')}</CardTitle>
                  <p className="text-2xl font-semibold">38</p>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">{t('stats.rating')}</CardTitle>
                  <p className="text-2xl font-semibold">4.8</p>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">{t('stats.certs')}</CardTitle>
                  <p className="text-2xl font-semibold">{t('stats.certsValue')}</p>
                </CardHeader>
              </Card>
            </div>
            <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
              <Button asChild>
                <Link href="/login?role=volunteer">{t('ctaVolunteerPrimary')}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/certificates">{t('ctaVolunteerSecondary')}</Link>
              </Button>
            </div>
          </div>

          <div className="space-y-4 card-pop">
            <Card className="overflow-hidden">
              <CardHeader className="space-y-3 bg-gradient-to-br from-primary/10 via-background to-background">
                <CardTitle className="text-xl">{t('toolsTitle')}</CardTitle>
                <CardDescription>
                  {t('toolsSubtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {t('toolsTimerLabel', { time: '00:12:34' })}
                  </div>
                  <div className="mt-2 rounded-md border bg-muted/40 p-3 text-sm">
                    {t('toolsToolbar')}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('toolsEditorNote')}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{t('toolsWhiteboardLabel')}</p>
                  <p className="text-sm text-muted-foreground">{t('toolsWhiteboardNote')}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="por-que" className="container py-16 md:py-20 space-y-10">
        <div className="space-y-3 text-center">
          <h3 className="text-3xl font-semibold tracking-tight">{t('reasonsTitle')}</h3>
          <p className="text-lg text-muted-foreground">
            {t('reasonsSubtitle')}
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {reasons.map((reason) => (
            <Card key={reason.title} className="card-pop h-full">
              <CardHeader className="space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {reason.icon}
                </div>
                <CardTitle className="text-lg">{reason.title}</CardTitle>
                <CardDescription>{reason.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section id="sobre" className="py-16 md:py-20 bg-muted/40">
        <div className="container grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <div className="space-y-4 card-pop text-center lg:text-left">
            <Badge variant="secondary" className="bg-secondary text-foreground">{t('transparencyBadge')}</Badge>
            <h3 className="text-3xl font-semibold tracking-tight">{t('transparencyTitle')}</h3>
            <p className="text-muted-foreground text-lg">
              {t('transparencySubtitle')}
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {statItems.map((item) => (
                <Card key={item.label} className="card-pop">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">{item.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{formatNumber(item.value, item.fallback)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card className="card-pop">
            <CardHeader>
              <CardTitle className="text-xl">{t('flowsTitle')}</CardTitle>
              <CardDescription>
                {t('flowsSubtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-lg border p-3">
                <p className="font-semibold text-foreground">{t('flowsUserLabel')}</p>
                <p>{t('flows.user')}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="font-semibold text-foreground">{t('flowsVolunteerLabel')}</p>
                <p>{t('flows.volunteer')}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="font-semibold text-foreground">{t('flowsVerifyLabel')}</p>
                <p>{t('flows.verify')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="container py-16 md:py-20 text-center space-y-6">
        <Badge variant="outline" className="card-pop">{t('ctaBadge')}</Badge>
        <h3 className="text-3xl font-semibold tracking-tight">{t('ctaTitle')}</h3>
        <p className="max-w-2xl mx-auto text-muted-foreground text-lg">
          {t('ctaSubtitle')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center card-pop">
          <Button size="lg" asChild>
            <Link href="/tickets/new">
              {t('ctaPrimary')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/tickets">{t('ctaSecondary')}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
