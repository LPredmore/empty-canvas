import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ImportWizard } from './ImportWizard';
import { 
  LayoutDashboard, Users, MessageSquare, AlertCircle, History, 
  ShieldCheck, PlusCircle, LogOut, Scale, Bot, Menu, X
} from 'lucide-react';

export const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/assistant', icon: Bot, label: 'Assistant' },
    { to: '/people', icon: Users, label: 'People' },
    { to: '/conversations', icon: MessageSquare, label: 'Conversations' },
    { to: '/issues', icon: AlertCircle, label: 'Issues' },
    { to: '/rules', icon: Scale, label: 'Rules & Obligations' },
    { to: '/timeline', icon: History, label: 'Timeline' },
  ];

  const handleNavClick = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <ImportWizard 
        isOpen={isImportOpen} 
        onClose={() => setIsImportOpen(false)} 
        onSuccess={(id) => navigate(`/conversations/${id}`)}
      />

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0
        transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            <span className="font-bold text-xl tracking-tight">CoParent Intel</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-1 hover:bg-slate-800 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-primary text-white shadow-lg' 
                    : 'hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <button 
            onClick={() => {
              setIsImportOpen(true);
              setIsSidebarOpen(false);
            }}
            className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Quick Import</span>
          </button>
          <button 
            onClick={() => api.signOut()}
            className="flex items-center justify-center gap-2 w-full bg-transparent hover:bg-slate-800 text-slate-400 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-card border-b border-border flex items-center px-4 lg:px-8 justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-muted rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg lg:text-xl font-semibold text-card-foreground capitalize">
               {location.pathname === '/' ? 'Dashboard' : location.pathname.split('/')[1].replace('-', ' ')}
            </h1>
          </div>
          <div className="flex items-center gap-4">
             <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                ME
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto h-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};