import React from 'react';
import { 
  LayoutDashboard, 
  Truck, 
  Users, 
  MapPin, 
  ClipboardCheck, 
  FileWarning, 
  History, 
  LogOut,
  ChevronRight,
  Menu,
  X,
  QrCode,
  PlusCircle
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { signOut } from '../firebase';
import { useAuth, UserRole } from '../AuthContext';
import { useSearch } from '../SearchContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface NavItem {
  to: string;
  icon: any;
  label: string;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['Admin', 'Sub Admin', 'Checker', 'Line Supervisor'] },
  { to: '/qr-scanner', icon: QrCode, label: 'QR Scanner', roles: ['Admin', 'Sub Admin', 'Checker', 'Line Supervisor'] },
  { to: '/vehicles', icon: Truck, label: 'Vehicles', roles: ['Admin', 'Sub Admin', 'Checker', 'Line Supervisor'] },
  { to: '/drivers', icon: Users, label: 'Drivers', roles: ['Admin', 'Sub Admin'] },
  { to: '/new-trip', icon: PlusCircle, label: 'New Trip', roles: ['Admin', 'Sub Admin', 'Line Supervisor'] },
  { to: '/trips', icon: MapPin, label: 'Trips', roles: ['Admin', 'Sub Admin', 'Checker', 'Line Supervisor'] },
  { to: '/return', icon: ClipboardCheck, label: 'Return', roles: ['Admin', 'Sub Admin', 'Checker', 'Line Supervisor'] },
  { to: '/cases', icon: FileWarning, label: 'Cases', roles: ['Admin', 'Sub Admin', 'Checker'] },
  { to: '/reports', icon: History, label: 'Reports', roles: ['Admin', 'Sub Admin', 'Checker', 'Line Supervisor'] },
  { to: '/users', icon: Users, label: 'Users', roles: ['Admin', 'Sub Admin'] },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const { searchQuery, setSearchQuery } = useSearch();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const handleLogout = async () => {
    await signOut();
  };

  const filteredNavItems = NAV_ITEMS.filter(item => {
    if (!profile?.role) return false;
    return item.roles.includes(profile.role);
  });

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transform bg-primary text-white border-r border-white/10 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 px-6 py-8">
            <div className="flex items-center justify-center w-6 h-6 rounded bg-accent text-white shadow-lg">
              <div className="w-3 h-3 bg-white/20 rounded-sm" />
            </div>
            <h1 className="font-bold tracking-tight text-lg">FleetManager</h1>
          </div>

          <nav className="flex-1 px-3 space-y-1">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group text-sm",
                  isActive 
                    ? "bg-white/10 text-white font-semibold" 
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="p-4 mt-auto border-t border-white/10">
            <div className="px-4 py-2 mb-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">V 2.4.0 • Build ID 9012</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-bg">
        {/* Desktop Header */}
        <header className="h-16 flex items-center justify-between px-8 bg-surface border-b border-border flex-shrink-0">
          <div className="hidden lg:flex items-center bg-slate-50 border border-border px-4 py-2 rounded-lg w-80 gap-3">
            <Menu size={16} className="text-text-muted" />
            <input 
              type="text" 
              placeholder="Search vehicle, driver, or case ID..." 
              className="bg-transparent border-none outline-none text-xs w-full text-text-main placeholder:text-text-muted"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-text-main leading-none">{profile?.displayName || user?.displayName || 'Unknown User'}</p>
              <p className="text-[11px] text-accent font-bold mt-1 leading-none uppercase tracking-wider">{profile?.role || 'Guest'}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-200 border border-border overflow-hidden">
               {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-accent/10 flex items-center justify-center text-accent">
                    <Users size={16} />
                  </div>
                )}
            </div>
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg lg:hidden"
            >
              <Menu size={24} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export const Card: React.FC<{ children: React.ReactNode, title?: React.ReactNode, className?: string }> = ({ children, title, className }) => (
  <div className={cn("bg-surface rounded-xl shadow-sm border border-border overflow-hidden", className)}>
    {title && (
      <div className="px-5 py-4 border-b border-border bg-[#f8fafc]">
        {typeof title === 'string' ? (
          <h3 className="font-semibold text-sm text-text-main">{title}</h3>
        ) : (
          title
        )}
      </div>
    )}
    <div className="p-5">
      {children}
    </div>
  </div>
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }> = ({ 
  children, className, variant = 'primary', ...props 
}) => {
  const variants = {
    primary: 'bg-accent text-white hover:opacity-90',
    secondary: 'bg-surface text-text-main border border-border hover:bg-slate-50',
    danger: 'bg-danger text-white hover:opacity-90',
    ghost: 'bg-transparent text-text-muted hover:bg-slate-100 hover:text-text-main',
  };

  return (
    <button 
      className={cn(
        "px-4 py-2 rounded-lg font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
