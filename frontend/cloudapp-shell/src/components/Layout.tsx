import React, { useContext, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { LogOut, User as UserIcon, LayoutGrid, FileText, Folder, ShoppingCart, MessageSquare, Cat, Trello, Sun, Moon, Map, Brain, Bot } from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';
import { useLogout } from '../hooks/useLogout';
import { isTokenExpired } from '../hooks/useAuth';

interface LayoutProps {
  children?: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const router = useRouter();
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const { logout } = useLogout();

  const user = typeof window !== 'undefined' ? localStorage.getItem('NEXT_PUBLIC_MY_USERNAME') : null;

  const [userToken, setUserToken] = useState('');

  let token = 'placeholder';

  useEffect(() => {
      const checkToken = () => {
          if (typeof window !== "undefined") {
              const t = localStorage.getItem("NEXT_PUBLIC_MY_TOKEN") || '';
              if (t === '' || isTokenExpired(t)) {
                  if (t !== '') {
                      localStorage.removeItem("NEXT_PUBLIC_MY_TOKEN");
                      localStorage.removeItem("NEXT_PUBLIC_MY_USERNAME");
                  }
                  setUserToken('');
                  if (router.pathname !== '/login') {
                      router.push("/login");
                  }
              } else {
                  setUserToken(t);
              }
          }
      };

      checkToken();

      const intervalId = setInterval(checkToken, 60_000);
      router.events.on('routeChangeComplete', checkToken);
      return () => {
          router.events.off('routeChangeComplete', checkToken);
          clearInterval(intervalId);
      };
  }, [router]);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const authedRoutes = [
    { label: 'Dashboard', path: '/', icon: <LayoutGrid size={20} /> },
    { label: 'Jira', path: '/jira', icon: <Trello size={20} /> },
    { label: 'Notes', path: '/notes', icon: <FileText size={20} /> },
    { label: 'Files', path: '/files', icon: <Folder size={20} /> },
    { label: 'Shop', path: '/shop', icon: <ShoppingCart size={20} /> },
    { label: 'Chat', path: '/chat', icon: <MessageSquare size={20} /> },
    { label: 'Maps', path: '/maps', icon: <Map size={20} /> },
    { label: 'MLOps', path: '/mlops', icon: <Brain size={20} /> },
    { label: 'GPT', path: '/chatllm', icon: <Bot size={20} /> },
    { label: 'PetStore', path: '/petstore', icon: <Cat size={20} /> },
  ];

  const publicRoutes = [
    { label: 'Login', path: '/login', icon: <LayoutGrid size={20} /> }
  ];

  const isDashboard = router.pathname === '/';

  return (
    <div className={`flex flex-col h-screen transition-colors duration-200 overflow-hidden ${isDashboard ? 'bg-white dark:bg-gray-900' : 'bg-gray-100 dark:bg-gray-900'}`}>

      {/* Background patterns */}
      {isDashboard && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -inset-[100%] w-[300%] h-[300%] leaf-pattern animate-leaf opacity-60"></div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="bg-gray-900 dark:bg-gray-950 text-white shadow-lg z-30 shrink-0 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-16 py-2 gap-6">
            <div className="flex items-center">
              <Link href="/" className="flex-shrink-0 flex items-center gap-2">
                <img src="/drawing_white.svg" alt="CloudApp" width={32} height={32} />
                <span className="font-bold text-xl tracking-tight">CloudApp</span>
              </Link>
              <div className="hidden md:block ml-6 lg:ml-10">
                <div className="flex items-baseline space-x-2">
                  {(userToken === null || userToken === '') ? (
                          <>
                             {publicRoutes.map((item) => {
                                const isActive = router.pathname === item.path || (item.path !== '/' && router.pathname.startsWith(item.path));
                                return (
                                 <Link
                                   key={item.path}
                                   href={item.path}
                                   prefetch={false}
                                   className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
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
                      ) :
                      <>
                          {authedRoutes.map((item) => {
                             const isActive = router.pathname === item.path || (item.path !== '/' && router.pathname.startsWith(item.path));
                             return (
                              <Link
                                key={item.path}
                                href={item.path}
                                prefetch={false}
                                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
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
                  }
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-gray-400 hover:text-yellow-400 hover:bg-gray-800 transition"
              >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              {user ? (
                <>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition group"
                  >
                    <div className="bg-gray-700 group-hover:bg-gray-600 p-1.5 rounded-full transition">
                      <UserIcon size={16} />
                    </div>
                    <span className="hidden sm:inline max-w-[100px] truncate">{user}</span>
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

        {/* Mobile Nav */}
        <div className="md:hidden border-t border-gray-800 bg-gray-900 dark:bg-gray-950 overflow-x-auto">
           <div className="flex gap-1 px-2 py-2 min-w-max">
             {(userToken === null || userToken === '') ? (
                     <>
                         {publicRoutes.map(item => {
                            const isActive = router.pathname === item.path || (item.path !== '/' && router.pathname.startsWith(item.path));
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
                            )
                         })}
                     </>
                 ) :
                 <>
                     {authedRoutes.map(item => {
                        const isActive = router.pathname === item.path || (item.path !== '/' && router.pathname.startsWith(item.path));
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
                        )
                     })}
                 </>
             }
           </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className={`flex-1 overflow-y-auto relative z-10 custom-scrollbar ${isDashboard ? '' : 'bg-gray-100 dark:bg-gray-900'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
