import React, { useContext, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  BookOpen,
  Car,
  CheckSquare,
  Layout,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Sun,
  Users,
  Wrench,
  X,
} from 'lucide-react';

import ApprovalInterface from './components/ApprovalInterface';
import ErrorDashboard from './components/ErrorDashboard';
import LoginPage from './components/LoginPage';
import ObservabilityDashboard from './components/ObservabilityDashboard';
import RAGDashboard from './components/RAGDashboard';
import ServicesDashboard from './components/ServicesDashboard';
import StreamingInterface from './components/StreamingInterface';
import ToolsExplorer from './components/ToolsExplorer';
import UnifiedDashboard from './components/UnifiedDashboard';
import UserManagement from './components/UserManagement';
import { ThemeContext } from './context/ThemeContext';
import { useCloudAppAuth } from './hooks/useCloudAppAuth';

enum View {
  UNIFIED = 'unified',
  DASHBOARD = 'dashboard',
  STREAMING = 'streaming',
  APPROVALS = 'approvals',
  USER_MANAGEMENT = 'user-management',
  ERRORS = 'errors',
  TOOLS = 'tools',
  SERVICES = 'services',
  RAG = 'rag',
}

interface NavItemProps {
  view: View;
  icon: React.ElementType;
  label: string;
  currentView: View;
  onSelect: (view: View) => void;
}

function NavItem({ view, icon: Icon, label, currentView, onSelect }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(view)}
      className={`flex items-center w-full px-4 py-3 mb-1 rounded-lg transition-colors ${
        currentView === view
          ? 'bg-blue-600 text-white shadow-md'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400'
      }`}
    >
      <Icon className="w-5 h-5 mr-3" />
      <span className="font-medium">{label}</span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 mt-6">
      {children}
    </p>
  );
}

export default function App() {
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const {
    isInitialized,
    isAuthenticated,
    username,
    isLoggingIn,
    error: authError,
    login,
    logout,
  } = useCloudAppAuth();

  const [currentView, setCurrentView] = useState<View>(View.UNIFIED);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSelectView = (view: View) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  };

  const renderContent = () => {
    switch (currentView) {
      case View.UNIFIED:
        return <UnifiedDashboard />;
      case View.DASHBOARD:
        return <ObservabilityDashboard />;
      case View.STREAMING:
        return <StreamingInterface />;
      case View.APPROVALS:
        return <ApprovalInterface />;
      case View.USER_MANAGEMENT:
        return <UserManagement />;
      case View.ERRORS:
        return <ErrorDashboard />;
      case View.TOOLS:
        return <ToolsExplorer />;
      case View.SERVICES:
        return <ServicesDashboard />;
      case View.RAG:
        return <RAGDashboard />;
      default:
        return <UnifiedDashboard />;
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} loading={isLoggingIn} error={authError} />;
  }

  const userInitials = (username || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 transition-colors">
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-screen sticky top-0">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2 text-blue-600">
            <LayoutDashboard className="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">AI Monitor</span>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            <NavItem view={View.UNIFIED} icon={Layout} label="Command Center" currentView={currentView} onSelect={handleSelectView} />

            <SectionLabel>Platform</SectionLabel>
            <NavItem view={View.DASHBOARD} icon={Activity} label="Observability" currentView={currentView} onSelect={handleSelectView} />
            <NavItem view={View.ERRORS} icon={AlertOctagon} label="Error Handling" currentView={currentView} onSelect={handleSelectView} />
            <NavItem view={View.TOOLS} icon={Wrench} label="Tools Explorer" currentView={currentView} onSelect={handleSelectView} />

            <SectionLabel>Intelligence</SectionLabel>
            <NavItem view={View.RAG} icon={BookOpen} label="Documents (RAG)" currentView={currentView} onSelect={handleSelectView} />

            <SectionLabel>Services</SectionLabel>
            <NavItem view={View.SERVICES} icon={Car} label="All Services" currentView={currentView} onSelect={handleSelectView} />

            <SectionLabel>Operations</SectionLabel>
            <NavItem view={View.STREAMING} icon={MessageSquare} label="Live Chat" currentView={currentView} onSelect={handleSelectView} />
            <NavItem view={View.APPROVALS} icon={CheckSquare} label="Approvals" currentView={currentView} onSelect={handleSelectView} />
            <NavItem view={View.USER_MANAGEMENT} icon={Users} label="User Management" currentView={currentView} onSelect={handleSelectView} />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-xs">
              {userInitials}
            </div>
            <div className="ml-3 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{username}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">CloudApp session</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {isDark ? 'Light' : 'Dark'}
            </button>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-50 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-2 text-blue-600">
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100">AI Monitor</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-white dark:bg-slate-900 z-40 pt-16 px-4 md:hidden">
          <nav className="space-y-2">
            <NavItem view={View.UNIFIED} icon={Layout} label="Command Center" currentView={currentView} onSelect={handleSelectView} />
            <NavItem view={View.DASHBOARD} icon={Activity} label="Observability" currentView={currentView} onSelect={handleSelectView} />
            <NavItem view={View.ERRORS} icon={AlertOctagon} label="Error Handling" currentView={currentView} onSelect={handleSelectView} />
            <NavItem view={View.TOOLS} icon={Wrench} label="Tools Explorer" currentView={currentView} onSelect={handleSelectView} />
            <NavItem view={View.RAG} icon={BookOpen} label="Documents (RAG)" currentView={currentView} onSelect={handleSelectView} />
            <NavItem view={View.SERVICES} icon={Car} label="All Services" currentView={currentView} onSelect={handleSelectView} />
            <NavItem view={View.STREAMING} icon={MessageSquare} label="Live Chat" currentView={currentView} onSelect={handleSelectView} />
            <NavItem view={View.APPROVALS} icon={CheckSquare} label="Approvals" currentView={currentView} onSelect={handleSelectView} />
            <NavItem view={View.USER_MANAGEMENT} icon={Users} label="User Management" currentView={currentView} onSelect={handleSelectView} />
          </nav>

          <div className="mt-6 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{username}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">CloudApp session</p>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                logout();
              }}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 w-full md:p-0 pt-16 md:pt-0 overflow-x-hidden bg-slate-50 dark:bg-slate-950">
        <div className="h-full">{renderContent()}</div>
      </main>
    </div>
  );
}
