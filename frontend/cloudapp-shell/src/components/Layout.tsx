import React, { useContext } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { LogOut, User as UserIcon, LayoutGrid, Sun, Moon } from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';
import { useLogout } from '../hooks/useLogout';
import { useAuth } from '../hooks/useAuth';
import { allAuthedRoutes } from '../constants/routes';

interface LayoutProps {
  children?: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const router = useRouter();
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const { logout } = useLogout();
  const { isAdmin, isReady, username } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const authedRoutes = allAuthedRoutes.filter((route) => !route.adminOnly || isAdmin);
  const publicRoutes = [
    { label: 'Login', path: '/login', icon: <LayoutGrid size={20} /> }
  ];

  const isDashboard = router.pathname === '/';
  const fullHeightRoutes = ['/jira', '/chatllm', '/maps', '/petstore', '/chat'];
  const isFullHeight = fullHeightRoutes.some((route) => router.pathname.startsWith(route));

  return (
    <div className={`flex flex-col h-screen transition-colors duration-200 overflow-hidden ${isDashboard ? 'bg-white dark:bg-gray-900' : 'bg-gray-100 dark:bg-gray-900'}`}>
      {isDashboard && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -inset-[100%] w-[300%] h-[300%] leaf-pattern animate-leaf opacity-60"></div>
        </div>
      )}

      <header className="bg-gray-900 dark:bg-gray-950 text-white shadow-lg z-30 shrink-0 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-16 py-2 gap-10">
            <div className="flex items-center">
              <Link href="/" className="flex-shrink-0 flex items-center gap-1">
                <Image src="/drawing_white.svg" alt="CloudApp" width={50} height={50} />
                <span className="hidden xl:inline font-bold text-xl tracking-tight">CloudApp</span>
              </Link>
              <div className="hidden md:block ml-6 lg:ml-10">
                <div className="flex items-baseline space-x-0.5 xl:space-x-1">
                  {!isReady ? (
                    <>
                      {publicRoutes.map((item) => {
                        const isActive = router.pathname === item.path || (item.path !== '/' && router.pathname.startsWith(item.path + '/'));
                        return (
                          <Link
                            key={item.path}
                            href={item.path}
                            prefetch={false}
                            className={`shrink-0 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                              isActive
                                ? 'bg-gray-800 text-blue-400'
                                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                            }`}
                          >
                            {item.icon}
                            <span className="hidden xl:inline">{item.label}</span>
                          </Link>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      {authedRoutes.map((item) => {
                        const isActive = router.pathname === item.path || (item.path !== '/' && router.pathname.startsWith(item.path + '/'));
                        return (
                          <Link
                            key={item.path}
                            href={item.path}
                            prefetch={false}
                            className={`shrink-0 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                              isActive
                                ? 'bg-gray-800 text-blue-400'
                                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                            }`}
                          >
                            {item.icon}
                            <span className="hidden xl:inline">{item.label}</span>
                          </Link>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
                <Link href="/login" className="text-sm text-blue-400 hover:text-blue-300">Login</Link>
              )}
            </div>
          </div>
        </div>

        <div className="md:hidden border-t border-gray-800 bg-gray-900 dark:bg-gray-950 overflow-x-auto">
          <div className="flex gap-1 px-2 py-2 min-w-max">
            {!isReady ? (
              <>
                {publicRoutes.map((item) => {
                  const isActive = router.pathname === item.path || (item.path !== '/' && router.pathname.startsWith(item.path + '/'));
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      prefetch={false}
                      className={`flex flex-col items-center justify-center p-3 rounded-md transition-colors min-w-[60px] ${
                        isActive ? 'bg-gray-800 text-blue-400' : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {item.icon}
                    </Link>
                  );
                })}
              </>
            ) : (
              <>
                {authedRoutes.map((item) => {
                  const isActive = router.pathname === item.path || (item.path !== '/' && router.pathname.startsWith(item.path + '/'));
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      prefetch={false}
                      className={`flex flex-col items-center justify-center p-3 rounded-md transition-colors min-w-[60px] ${
                        isActive ? 'bg-gray-800 text-blue-400' : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {item.icon}
                    </Link>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </header>

      <div className={`flex-1 relative z-10 ${isFullHeight ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'} ${isDashboard ? '' : 'bg-gray-100 dark:bg-gray-900'}`}>
        <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${isFullHeight ? 'h-full' : 'max-w-7xl py-8'}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
