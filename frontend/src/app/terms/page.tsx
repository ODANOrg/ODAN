import { getTranslations } from 'next-intl/server';

export default async function TermsPage() {
  const t = await getTranslations('pages.terms');
  const sections = t.raw('sections') as { title: string; body: string[] }[];

  return (
    <div className="container py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="space-y-6">
        {sections.map((section) => (
          <section key={section.title} className="space-y-2">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <div className="space-y-2 text-muted-foreground">
              {section.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
