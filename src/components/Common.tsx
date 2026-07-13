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
  PlusCircle,
  ClipboardList,
  Sunrise,
  Bell,
  Volume2
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { signOut } from '../firebase';
import { useAuth, UserRole } from '../AuthContext';
import { useSearch } from '../SearchContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeToCollection } from '../db';

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
  { to: '/requests', icon: ClipboardList, label: 'Requests', roles: ['Admin', 'Sub Admin', 'Checker', 'Line Supervisor'] },
  { to: '/drivers', icon: Users, label: 'Drivers', roles: ['Admin', 'Sub Admin'] },
  { to: '/new-trip', icon: PlusCircle, label: 'New Trip', roles: ['Admin', 'Sub Admin', 'Line Supervisor'] },
  { to: '/trips', icon: MapPin, label: 'Trips', roles: ['Admin', 'Sub Admin', 'Checker', 'Line Supervisor'] },
  { to: '/morning-prep', icon: Sunrise, label: 'Morning Prep', roles: ['Admin', 'Sub Admin', 'Checker', 'Line Supervisor'] },
  { to: '/cases', icon: FileWarning, label: 'Cases', roles: ['Admin', 'Sub Admin', 'Checker'] },
  { to: '/reports', icon: History, label: 'Reports', roles: ['Admin', 'Sub Admin', 'Checker', 'Line Supervisor'] },
  { to: '/users', icon: Users, label: 'Users', roles: ['Admin', 'Sub Admin', 'Checker', 'Line Supervisor'] },
];

interface ReturnNotification {
  id: string;
  vehicleId: string;
  vehicleNumber: string;
  previousStatus: string;
}

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const { searchQuery, setSearchQuery } = useSearch();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [activeReturns, setActiveReturns] = React.useState<ReturnNotification[]>([]);
  const [vehicles, setVehicles] = React.useState<any[]>([]);
  const [trips, setTrips] = React.useState<any[]>([]);
  const [isVehiclesLoaded, setIsVehiclesLoaded] = React.useState(false);
  const [isTripsLoaded, setIsTripsLoaded] = React.useState(false);

  const prevComputedStatusesRef = React.useRef<Record<string, string>>({});
  const isFirstLoadRef = React.useRef(true);

  React.useEffect(() => {
    const unsub = subscribeToCollection('requests', (items: any[]) => {
      const count = items.filter(r => r.status === 'Pending').length;
      setPendingCount(count);
    });
    return () => unsub();
  }, []);

  React.useEffect(() => {
    const unsubVehicles = subscribeToCollection('vehicles', (list) => {
      setVehicles(list);
      setIsVehiclesLoaded(true);
    });
    const unsubTrips = subscribeToCollection('trips', (list) => {
      setTrips(list);
      setIsTripsLoaded(true);
    });
    return () => {
      unsubVehicles();
      unsubTrips();
    };
  }, []);

  React.useEffect(() => {
    if (!isVehiclesLoaded || !isTripsLoaded) return;

    // Compute current status for each vehicle
    const currentStatuses: Record<string, string> = {};
    vehicles.forEach(v => {
      let status = 'Available';
      if (v.status === 'Maintenance') {
        status = 'Maintenance';
      } else {
        const hasRunningTrip = trips.some(t => t.vehicleId === v.id && t.status === 'Running');
        if (hasRunningTrip) {
          status = 'On Trip';
        } else {
          const hasPendingTrip = trips.some(t => t.vehicleId === v.id && t.status === 'Pending');
          if (hasPendingTrip) {
            status = 'Pending Out Scan';
          }
        }
      }
      currentStatuses[v.id] = status;
    });

    if (isFirstLoadRef.current) {
      prevComputedStatusesRef.current = currentStatuses;
      isFirstLoadRef.current = false;
      return;
    }

    const prevStatuses = prevComputedStatusesRef.current;

    vehicles.forEach(vehicle => {
      const oldStatus = prevStatuses[vehicle.id];
      const newStatus = currentStatuses[vehicle.id];

      if (oldStatus && oldStatus !== newStatus && newStatus === 'Available') {
        if (oldStatus === 'On Trip' || oldStatus === 'Maintenance') {
          const notificationId = `${vehicle.id}-${Date.now()}`;
          const newNotification: ReturnNotification = {
            id: notificationId,
            vehicleId: vehicle.id,
            vehicleNumber: vehicle.vehicleNumber,
            previousStatus: oldStatus
          };

          setActiveReturns(prev => [...prev, newNotification]);

          // Play sound only for Checker and Line Supervisor
          const isEligibleRole = profile?.role === 'Checker' || profile?.role === 'Line Supervisor';
          if (isEligibleRole) {
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

              const osc1 = audioCtx.createOscillator();
              const gain1 = audioCtx.createGain();
              osc1.type = 'sine';
              osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
              gain1.gain.setValueAtTime(0.12, audioCtx.currentTime);
              gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
              osc1.connect(gain1);
              gain1.connect(audioCtx.destination);
              osc1.start();
              osc1.stop(audioCtx.currentTime + 0.3);

              setTimeout(() => {
                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
                gain2.gain.setValueAtTime(0.12, audioCtx.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
                osc2.connect(gain2);
                gain2.connect(audioCtx.destination);
                osc2.start();
                osc2.stop(audioCtx.currentTime + 0.45);
              }, 150);
            } catch (soundErr) {
              console.warn("Audio Context error or blocked:", soundErr);
            }
          }

          // Auto-dismiss after 6 seconds
          setTimeout(() => {
            setActiveReturns(prev => prev.filter(n => n.id !== notificationId));
          }, 6000);
        }
      }
    });

    prevComputedStatusesRef.current = currentStatuses;
  }, [vehicles, trips, isVehiclesLoaded, isTripsLoaded, profile?.role]);

  const dismissNotification = (id: string) => {
    setActiveReturns(prev => prev.filter(n => n.id !== id));
  };

  const isEligibleRole = profile?.role === 'Checker' || profile?.role === 'Line Supervisor';

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
            {filteredNavItems.map((item) => {
              const isRequests = item.to === '/requests';
              const hasPending = isRequests && pendingCount > 0;
              
              const isVehicles = item.to === '/vehicles';
              const hasActiveReturns = isVehicles && activeReturns.length > 0;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsSidebarOpen(false)}
                  className={({ isActive }) => cn(
                    "flex items-center justify-between px-4 py-2.5 rounded-lg transition-all duration-200 group text-sm",
                    isActive 
                      ? "bg-white/10 text-white font-semibold" 
                      : "text-slate-400 hover:text-white hover:bg-white/5",
                    hasPending && "bg-amber-500/10 text-amber-200 border border-amber-500/20 hover:bg-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.2)] animate-pulse",
                    hasActiveReturns && "bg-rose-600 text-white border border-rose-500 hover:bg-rose-700 shadow-[0_0_15px_rgba(239,68,68,0.5)] font-bold animate-pulse"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={18} className={cn(
                      "transition-colors",
                      hasPending && "text-amber-400 animate-pulse",
                      hasActiveReturns && "text-white animate-bounce"
                    )} />
                    <span className={cn(
                      "transition-all",
                      hasPending && "font-bold text-amber-100",
                      hasActiveReturns && "font-black text-white"
                    )}>
                      {item.label}
                    </span>
                  </div>

                  {hasPending && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                      <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-md">
                        {pendingCount}
                      </span>
                    </div>
                  )}

                  {hasActiveReturns && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                      </span>
                      <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-white text-[10px] font-black text-rose-600 shadow-md">
                        {activeReturns.length}
                      </span>
                    </div>
                  )}
                </NavLink>
              );
            })}
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

      {/* Floating Returned Vehicle Pop-up Notifications */}
      {isEligibleRole && activeReturns.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 space-y-3 max-w-sm w-full pointer-events-none">
          <AnimatePresence>
            {activeReturns.map((notif) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
                className="pointer-events-auto bg-slate-900 text-white border border-slate-800 p-4 rounded-2xl shadow-2xl flex items-start gap-3.5 relative overflow-hidden"
              >
                {/* Decorative top accent strip */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500 via-rose-500 to-amber-500 opacity-80" />
                
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0 mt-0.5 animate-pulse">
                  <Truck size={18} className="animate-bounce" />
                </div>
                
                <div className="flex-1 min-w-0 pr-4">
                  <h4 className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
                    গাড়ি ফিরে এসেছে!
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">
                    গাড়ি <span className="font-extrabold text-amber-400 text-sm font-mono tracking-wider">{notif.vehicleNumber}</span> {notif.previousStatus === 'Maintenance' ? 'মেইনটেনেন্স' : 'ট্রিপ'} থেকে ফিরে এসেছে এবং এখন <span className="text-emerald-400 font-extrabold">Available</span> রয়েছে।
                  </p>
                </div>

                <button
                  onClick={() => dismissNotification(notif.id)}
                  className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
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
