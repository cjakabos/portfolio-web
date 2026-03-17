// components/PetStoreLayout.tsx
import React from 'react';
import { LayoutDashboard, Users, Cat, Calendar, Briefcase } from 'lucide-react';
import { usePetStoreNavigation } from './PetStoreApp';

interface PetStoreLayoutProps {
  children: React.ReactNode;
}

const PetStoreLayout: React.FC<PetStoreLayoutProps> = ({ children }) => {
  const { currentPage, navigate } = usePetStoreNavigation();

  const navItems = [
    { label: 'Dashboard', page: 'dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'Customers', page: 'customers', icon: <Users size={20} /> },
    { label: 'Pets', page: 'pets', icon: <Cat size={20} /> },
    { label: 'Employees', page: 'employees', icon: <Briefcase size={20} /> },
    { label: 'Schedule', page: 'schedule', icon: <Calendar size={20} /> },
  ];

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0 bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 hidden md:flex flex-col z-10 transition-colors duration-200">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-indigo-50 dark:bg-gray-800">
          <h1 className="text-xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
            <Cat className="text-indigo-600 dark:text-indigo-400" />
            PetStore
          </h1>
          <p className="text-xs text-indigo-400 mt-1">CloudApp Module</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentPage === item.page;
            return (
              <button
                key={item.page}
                onClick={() => navigate(item.page, 'sidebar')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-auto p-4 md:p-8 pt-4 md:pt-8 pb-24 md:pb-8 bg-slate-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around p-2 px-safe pb-safe z-20">
        {navItems.map((item) => (
          <button 
            key={item.page} 
            onClick={() => navigate(item.page, 'mobile')}
            aria-label={item.label}
            className={`m-0 w-auto min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-full ${
              currentPage === item.page
                ? 'text-indigo-600 bg-indigo-50 dark:bg-gray-700 dark:text-indigo-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {item.icon}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default PetStoreLayout;
