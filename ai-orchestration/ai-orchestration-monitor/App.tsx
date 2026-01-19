// =============================================================================
// App.tsx - Main Application Component
// =============================================================================
// AI Orchestration Monitor - Fully integrated with backend
// =============================================================================

import React, { useState } from 'react';
import { 
  Activity, MessageSquare, CheckSquare, AlertOctagon, 
  LayoutDashboard, Menu, X, Layout, Wrench, Car 
} from 'lucide-react';

// Import all components
import ObservabilityDashboard from './components/ObservabilityDashboard';
import StreamingInterface from './components/StreamingInterface';
import ApprovalInterface from './components/ApprovalInterface';
import ErrorDashboard from './components/ErrorDashboard';
import UnifiedDashboard from './components/UnifiedDashboard';
import ToolsExplorer from './components/ToolsExplorer';
import ServicesDashboard from './components/ServicesDashboard';

enum View {
  UNIFIED = 'unified',
  DASHBOARD = 'dashboard',
  STREAMING = 'streaming',
  APPROVALS = 'approvals',
  ERRORS = 'errors',
  TOOLS = 'tools',
  SERVICES = 'services',
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>(View.UNIFIED);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      case View.ERRORS:
        return <ErrorDashboard />;
      case View.TOOLS:
        return <ToolsExplorer />;
      case View.SERVICES:
        return <ServicesDashboard />;
      default:
        return <UnifiedDashboard />;
    }
  };

  const NavItem = ({ 
    view, 
    icon: Icon, 
    label 
  }: { 
    view: View; 
    icon: React.ElementType; 
    label: string 
  }) => (
    <button
      onClick={() => {
        setCurrentView(view);
        setIsMobileMenuOpen(false);
      }}
      className={`flex items-center w-full px-4 py-3 mb-1 rounded-lg transition-colors ${
        currentView === view
          ? 'bg-blue-600 text-white shadow-md'
          : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600'
      }`}
    >
      <Icon className="w-5 h-5 mr-3" />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-screen sticky top-0">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center space-x-2 text-blue-600">
            <LayoutDashboard className="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight text-slate-900">AI Monitor</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            <NavItem view={View.UNIFIED} icon={Layout} label="Command Center" />
            
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-6">
              Platform
            </p>
            <NavItem view={View.DASHBOARD} icon={Activity} label="Observability" />
            <NavItem view={View.ERRORS} icon={AlertOctagon} label="Error Handling" />
            <NavItem view={View.TOOLS} icon={Wrench} label="Tools Explorer" />
            
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-6">
              Services
            </p>
            <NavItem view={View.SERVICES} icon={Car} label="All Services" />
            
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-6">
              Operations
            </p>
            <NavItem view={View.STREAMING} icon={MessageSquare} label="Live Chat" />
            <NavItem view={View.APPROVALS} icon={CheckSquare} label="Approvals" />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
              AD
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-slate-900">Admin User</p>
              <p className="text-xs text-slate-500">admin@system.ai</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-white border-b border-slate-200 z-50 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-2 text-blue-600">
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-lg font-bold text-slate-900">AI Monitor</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
          className="text-slate-600"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-white z-40 pt-16 px-4 md:hidden">
          <nav className="space-y-2">
            <NavItem view={View.UNIFIED} icon={Layout} label="Command Center" />
            <NavItem view={View.DASHBOARD} icon={Activity} label="Observability" />
            <NavItem view={View.ERRORS} icon={AlertOctagon} label="Error Handling" />
            <NavItem view={View.TOOLS} icon={Wrench} label="Tools Explorer" />
            <NavItem view={View.SERVICES} icon={Car} label="All Services" />
            <NavItem view={View.STREAMING} icon={MessageSquare} label="Live Chat" />
            <NavItem view={View.APPROVALS} icon={CheckSquare} label="Approvals" />
          </nav>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full md:p-0 pt-16 md:pt-0 overflow-x-hidden">
        <div className="h-full">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
