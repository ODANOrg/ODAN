'use client';

import Link from '@/components/i18n/locale-link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  Moon,
  Sun,
  Home,
  Ticket,
  Plus,
  Award,
  User,
  LogOut,
  Globe,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { useAuthStore, useUIStore } from '@/lib/store';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { defaultLocale } from '@/i18n';

const locales = [
  { code: 'en', name: 'English' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'es', name: 'Español' },
];

export function Header() {
  const tNav = useTranslations('nav');
  const tNavCustom = useTranslations('navCustom');
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, isAuthenticated, clearAuth } = useAuthStore();
  const { toggleSidebar } = useUIStore();

  const segments = pathname.split('/');
  const maybeLocale = segments[1];
  const currentLocale = locales.some((l) => l.code === maybeLocale) ? maybeLocale : defaultLocale;
  const homeHref = currentLocale === defaultLocale ? '/' : `/${currentLocale}`;

  const handleLogout = async () => {
    if (token) {
      try {
        await api.logout(token);
      } catch (e) {
        // Ignore errors
      }
    }
    clearAuth();
    router.push(homeHref);
  };

  const changeLocale = (locale: string) => {
    const segments = pathname.split('/');
    const hasLocale = locales.some((l) => l.code === segments[1]);

    // If switching to default locale (as-needed), remove the locale segment.
    if (locale === defaultLocale) {
      if (hasLocale) segments.splice(1, 1);
      router.push(segments.join('/') || '/');
      return;
    }

    if (hasLocale) segments[1] = locale;
    else segments.splice(1, 0, locale);
    router.push(segments.join('/'));
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Button variant="ghost" size="icon" className="mr-2 md:hidden" onClick={toggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>

        <Link href={homeHref} className="flex items-center space-x-2">
          <Image src="/logo.svg" alt="ODAN" width={30} height={30} priority className="dark:invert" />
        </Link>

        <nav className="hidden md:flex items-center space-x-6 ml-6">
          {(
            [
              {
                href: '/',
                label: tNav('home'),
                active: pathname === '/' || pathname === `/${currentLocale}`,
              },
              {
                href: '/#como-funciona',
                label: tNavCustom('how'),
                active: pathname === '/' || pathname === `/${currentLocale}`,
              },
              {
                href: '/#voluntarios',
                label: tNavCustom('volunteers'),
                active: pathname === '/' || pathname === `/${currentLocale}`,
              },
              {
                href: '/#sobre',
                label: tNavCustom('about'),
                active: pathname === '/' || pathname === `/${currentLocale}`,
              },
              {
                href: '/tickets',
                label: tNav('tickets'),
                active: pathname.includes('/tickets'),
              },
              isAuthenticated
                ? {
                    href: '/certificates',
                    label: tNav('certificates'),
                    active: pathname.includes('/certificates'),
                  }
                : null,
            ]
              .filter(Boolean)
              .map((item) => item as { href: string; label: string; active: boolean })
          )
            .filter(Boolean)
            .map((item) => {
              const navItem = item as { href: string; label: string; active: boolean };
              return (
                <Link
                  key={navItem.href}
                  href={navItem.href}
                  className={cn(
                    'text-sm font-medium transition-colors hover:text-primary',
                    navItem.active ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {navItem.label}
                </Link>
              );
            })}
        </nav>

        <div className="flex flex-1 items-center justify-end space-x-2">
          {/* Language Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Globe className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={currentLocale} onValueChange={changeLocale}>
                {locales.map((locale) => (
                  <DropdownMenuRadioItem key={locale.code} value={locale.code}>
                    {locale.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* User Menu */}
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">
                    <Home className="mr-2 h-4 w-4" />
                      {tNav('dashboard')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/tickets/new">
                    <Plus className="mr-2 h-4 w-4" />
                      {tNav('newTicket')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                      {tNav('profile')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/certificates">
                    <Award className="mr-2 h-4 w-4" />
                      {tNav('certificates')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {tNav('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <div className="hidden md:flex items-center gap-2">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">{tNav('signIn')}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/login?mode=signup">
                    <Sparkles className="mr-1 h-4 w-4" />
                    {tNav('signUp')}
                  </Link>
                </Button>
              </div>
              <Button asChild size="sm" className="md:hidden">
                <Link href="/login">{tNav('signIn')}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
