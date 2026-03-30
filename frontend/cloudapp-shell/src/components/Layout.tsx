import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { LogOut, User as UserIcon, LayoutGrid, Sun, Moon, Menu, X } from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';
import { useRemoteModules } from '../context/RemoteModulesContext';
import { useLogout } from '../hooks/useLogout';
import { useAuth } from '../hooks/useAuth';
import { getVisibleAuthedRoutes, type RouteItem } from '../constants/routes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { trackEvent } from '../lib/analytics/umami';

interface LayoutProps {
  children?: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const router = useRouter();
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const { logout } = useLogout();
  const { isAdmin, isReady, username } = useAuth();
  const { remoteStatus, hasLoaded: remoteStatusLoaded } = useRemoteModules();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    trackEvent('auth_logout', { area: 'header' });
    await logout();
    window.location.href = '/login';
  };

  const handleNavigationClick = (area: string, label: string, path: string) => {
    trackEvent('nav_click', { area, label, path });
  };

  const authedRoutes = getVisibleAuthedRoutes({
    isAdmin,
    remoteStatus,
    remoteStatusLoaded,
  });
  const publicRoutes: RouteItem[] = [
    {
      id: 'login',
      label: 'Login',
      path: '/login',
      icon: ({ size = 20 } = {}) => <LayoutGrid size={size} />,
      adminOnly: false,
    }
  ];
  const mobileRoutes = isReady ? authedRoutes : publicRoutes;
  const desktopNavRoutes = mobileRoutes.filter((route) => route.path !== '/');

  const mobileNavRoutes = mobileRoutes.filter((route) => route.path !== '/');
  const primaryMobileRouteCount = 5;
  const primaryMobileRoutes = mobileNavRoutes.slice(0, primaryMobileRouteCount);
  const overflowMobileRoutes = mobileNavRoutes.slice(primaryMobileRouteCount);

  const isDashboard = router.pathname === '/';
  const fullHeightRoutes = ['/jira', '/chatllm', '/maps', '/petstore', '/chat'];
  const isFullHeight = fullHeightRoutes.some((route) => router.pathname.startsWith(route));
  const isRouteActive = (path: string) => (
    router.pathname === path || (path !== '/' && router.pathname.startsWith(path + '/'))
  );
  const isMobileOverflowRouteActive = overflowMobileRoutes.some((route) => isRouteActive(route.path));

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [router.pathname]);

  return (
    <div className={`flex flex-col min-h-screen h-[100dvh] transition-colors duration-200 overflow-x-hidden ${isDashboard ? 'bg-white dark:bg-gray-900' : 'bg-gray-100 dark:bg-gray-900'}`}>
      {isDashboard && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -inset-[100%] w-[300%] h-[300%] leaf-pattern animate-leaf opacity-60"></div>
        </div>
      )}

      <header className="bg-gray-900 dark:bg-gray-950 text-white shadow-lg z-30 shrink-0 relative safe-top">
        <div className="max-w-7xl mx-auto safe-x">
          <div className="hidden md:grid grid-cols-[1fr_auto_1fr] items-center min-h-16 py-2 gap-4">
            <div className="justify-self-start">
              <Link
                href="/"
                className="flex-shrink-0 flex items-center gap-1"
                onClick={() => handleNavigationClick('desktop_brand', 'Home', '/')}
              >
                <Image src="/drawing_white.svg" alt="CloudApp" width={50} height={50} />
                <span className="hidden xl:inline font-bold text-xl tracking-tight">CloudApp</span>
              </Link>
            </div>

            <div className="justify-self-center relative">
              <div className="flex items-center justify-center gap-1">
                {desktopNavRoutes.map((item) => {
                  const isActive = isRouteActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      prefetch={false}
                      onClick={() => handleNavigationClick('desktop_nav', item.label, item.path)}
                      aria-label={item.label}
                      title={item.label}
                      className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                        isActive ? 'bg-gray-800 text-blue-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                      }`}
                    >
                      {item.icon({ size: 20 })}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="justify-self-end flex items-center gap-2 shrink-0">
              <button
                onClick={toggleTheme}
                className="p-1 rounded-full text-gray-400 hover:text-yellow-400 hover:bg-gray-800 transition"
              >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              {username ? (
                <>
                  <Link
                    href="/profile"
                    onClick={() => handleNavigationClick('desktop_profile', 'Profile', '/profile')}
                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition group"
                  >
                    <div className="bg-gray-700 group-hover:bg-gray-600 p-1.5 rounded-full transition">
                      <UserIcon size={16} />
                    </div>
                    <span className="hidden xl:inline max-w-[100px] truncate">{username}</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition"
                  >
                    <LogOut size={18} />
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="text-sm text-blue-400 hover:text-blue-300"
                  onClick={() => handleNavigationClick('desktop_auth', 'Login', '/login')}
                >
                  Login
                </Link>
              )}
            </div>
          </div>

          <div className="md:hidden flex items-center min-h-16 py-2 gap-1">
            <Link
              href="/"
              prefetch={false}
              onClick={() => handleNavigationClick('mobile_brand', 'Home', '/')}
              aria-label="Home"
              className={`flex h-11 w-11 items-center justify-center rounded-md transition-colors ${
                isRouteActive('/') ? 'bg-gray-800' : 'hover:bg-gray-800'
              }`}
            >
              <Image src="/drawing_white.svg" alt="CloudApp Home" width={36} height={36} />
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-center gap-1">
                {primaryMobileRoutes.map((item) => {
                  const isActive = isRouteActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      prefetch={false}
                      onClick={() => handleNavigationClick('mobile_nav', item.label, item.path)}
                      aria-label={item.label}
                      title={item.label}
                      className={`flex h-11 w-11 items-center justify-center rounded-md transition-colors ${
                        isActive ? 'bg-gray-800 text-blue-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                      }`}
                    >
                      {item.icon({ size: 20 })}
                    </Link>
                  );
                })}

                {overflowMobileRoutes.length > 0 && (
                  <DropdownMenu open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={isMobileMenuOpen ? 'Close more menu' : 'Open more menu'}
                        className={`flex h-11 w-11 items-center justify-center rounded-md transition-colors ${
                          isMobileMenuOpen || isMobileOverflowRouteActive
                            ? 'bg-gray-800 text-blue-400'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                        }`}
                      >
                        {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="md:hidden w-[min(22rem,calc(100vw-1rem))]"
                      align="end"
                      side="bottom"
                      sideOffset={8}
                    >
                      <DropdownMenuGroup>
                        <div className="grid grid-cols-3 gap-1">
                          {overflowMobileRoutes.map((item) => {
                            const isActive = isRouteActive(item.path);
                            return (
                              <DropdownMenuItem key={item.path} asChild>
                                <Link
                                  href={item.path}
                                  prefetch={false}
                                  onClick={() => handleNavigationClick('mobile_overflow', item.label, item.path)}
                                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-md transition-colors min-h-[56px] ${
                                    isActive ? 'bg-gray-800 text-blue-400' : 'text-gray-300 hover:text-white hover:bg-gray-800'
                                  }`}
                                >
                                  {item.icon({ size: 20 })}
                                  <span className="text-[10px] leading-none">{item.label}</span>
                                </Link>
                              </DropdownMenuItem>
                            );
                          })}
                        </div>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {username ? (
                <>
                  <Link
                    href="/profile"
                    prefetch={false}
                    onClick={() => handleNavigationClick('mobile_profile', 'Profile', '/profile')}
                    aria-label="Profile"
                    title="Profile"
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
                      isRouteActive('/profile')
                        ? 'bg-gray-700 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <UserIcon size={16} />
                  </Link>
                  <button
                    onClick={handleLogout}
                    aria-label="Logout"
                    title="Logout"
                    className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition"
                  >
                    <LogOut size={18} />
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  prefetch={false}
                  onClick={() => handleNavigationClick('mobile_auth', 'Login', '/login')}
                  aria-label="Login"
                  title="Login"
                  className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
                    isRouteActive('/login')
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <UserIcon size={16} />
                </Link>
              )}
            </div>
          </div>
        </div>

      </header>

      <div className={`flex-1 relative z-10 overflow-y-auto touch-scroll custom-scrollbar safe-bottom ${isDashboard ? '' : 'bg-gray-100 dark:bg-gray-900'}`}>
        <div className={`${isFullHeight ? 'h-full min-h-0' : 'max-w-7xl py-8 mx-auto safe-x'}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
