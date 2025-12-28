'use client';

import Link from 'next/link';
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

const locales = [
  { code: 'en', name: 'English' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'es', name: 'Español' },
];

export function Header() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, isAuthenticated, clearAuth } = useAuthStore();
  const { toggleSidebar } = useUIStore();

  const currentLocale = pathname.split('/')[1] || 'en';

  const handleLogout = async () => {
    if (token) {
      try {
        await api.logout(token);
      } catch (e) {
        // Ignore errors
      }
    }
    clearAuth();
    router.push('/');
  };

  const changeLocale = (locale: string) => {
    const segments = pathname.split('/');
    if (locales.some((l) => l.code === segments[1])) {
      segments[1] = locale;
    } else {
      segments.splice(1, 0, locale);
    }
    router.push(segments.join('/'));
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Button variant="ghost" size="icon" className="mr-2 md:hidden" onClick={toggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>

        <Link href="/" className="flex items-center space-x-2">
          <Image
            src="/logo.svg"
            alt="ODAN"
            width={100}
            height={30}
            priority
            className="dark:invert"
          />
        </Link>

        <nav className="hidden md:flex items-center space-x-6 ml-6">
          <Link
            href="/"
            className={cn(
              'text-sm font-medium transition-colors hover:text-primary',
              pathname === '/' ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {t('nav.home')}
          </Link>
          <Link
            href="/tickets"
            className={cn(
              'text-sm font-medium transition-colors hover:text-primary',
              pathname.includes('/tickets') ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {t('nav.tickets')}
          </Link>
          {isAuthenticated && (
            <Link
              href="/certificates"
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary',
                pathname.includes('/certificates') ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {t('nav.certificates')}
            </Link>
          )}
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
                    {t('nav.dashboard')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/tickets/new">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('nav.newTicket')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    {t('nav.profile')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/certificates">
                    <Award className="mr-2 h-4 w-4" />
                    {t('nav.certificates')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">{t('nav.login')}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
