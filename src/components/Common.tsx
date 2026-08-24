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
  Volume2,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Compass,
  Palette,
  Check,
  Sparkles,
  Search
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { signOut } from '../firebase';
import { useAuth, UserRole } from '../AuthContext';
import { useSearch } from '../SearchContext';
import { useTheme, THEME_OPTIONS, ThemeMode } from '../ThemeContext';
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
  const { theme, setTheme, toggleTheme, isEmerald, isOcean, isCrimson, isAmber, currentThemeOption } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [activeReturns, setActiveReturns] = React.useState<ReturnNotification[]>([]);
  const [vehicles, setVehicles] = React.useState<any[]>([]);
  const [trips, setTrips] = React.useState<any[]>([]);
  const [isVehiclesLoaded, setIsVehiclesLoaded] = React.useState(false);
  const [isTripsLoaded, setIsTripsLoaded] = React.useState(false);

  const prevComputedStatusesRef = React.useRef<Record<string, string>>({});
  const isFirstLoadRef = React.useRef(true);
  const profileMenuRef = React.useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = React.useRef<HTMLInputElement>(null);

  // Focus mobile search input when opened
  React.useEffect(() => {
    if (isMobileSearchOpen) {
      setTimeout(() => {
        mobileSearchInputRef.current?.focus();
      }, 100);
    }
  }, [isMobileSearchOpen]);

  // Close profile dropdown on outside click
  React.useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isProfileMenuOpen]);

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
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Mobile Drawer / Full Sheet Menu */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className={cn(
                "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] text-white shadow-2xl lg:hidden flex flex-col justify-between",
                isEmerald 
                  ? "bg-[#071f18] border-r border-emerald-900/40" 
                  : isCrimson
                    ? "bg-[#160507] border-r border-rose-950/40"
                    : isAmber
                      ? "bg-[#18150f] border-r border-amber-950/50"
                      : "bg-primary border-r border-white/10"
              )}
            >
              <div className="flex flex-col h-full overflow-hidden">
                {/* Mobile Drawer Header */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "relative w-9 h-9 rounded-xl p-0.5 shadow-md flex items-center justify-center group flex-shrink-0 bg-gradient-to-br",
                      isEmerald 
                        ? "from-[#3ebd97] via-[#2ea884] to-[#155341]" 
                        : isCrimson
                          ? "from-[#ff385c] via-[#ea2340] to-[#881337]"
                          : isAmber
                            ? "from-[#fbbf24] via-[#f59e0b] to-[#78350f]"
                            : "from-blue-500 via-blue-600 to-indigo-700"
                    )}>
                      <div className="w-full h-full bg-slate-900/70 rounded-[10px] flex items-center justify-center">
                        <Compass size={18} className="text-white animate-[spin_10s_linear_infinite]" />
                      </div>
                    </div>
                    <div>
                      <h2 className="font-extrabold text-base leading-tight flex items-center gap-1.5">
                        <span>FleetManager</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-black bg-white/20 text-white">
                          PRO
                        </span>
                      </h2>
                      <p className="text-[10px] text-slate-400 font-medium">মোবাইল লজিস্টিকস পোর্টাল</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center transition-colors active:scale-95"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Mobile User Profile Summary in Drawer */}
                <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-inner flex-shrink-0",
                    isEmerald ? "bg-[#2ea884]" : isCrimson ? "bg-[#ea2340]" : isAmber ? "bg-[#f59e0b] text-slate-950" : "bg-blue-600"
                  )}>
                    {(profile?.displayName || user?.displayName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{profile?.displayName || user?.displayName || 'User'}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-300 font-semibold mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      {profile?.role === 'Admin' ? 'অ্যাডমিন' : (profile?.role || 'User')}
                    </span>
                  </div>
                </div>

                {/* Mobile Drawer Navigation List */}
                <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto overscroll-contain">
                  <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">সবগুলো অপশন (Menu)</p>
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
                          "flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-150 text-[14px] font-bold active:scale-[0.98]",
                          isActive 
                            ? isEmerald 
                              ? "bg-[#2ea884] text-white shadow-md"
                              : isCrimson
                                ? "bg-[#ea2340] text-white shadow-md"
                                : isAmber
                                  ? "bg-[#f59e0b] text-slate-950 shadow-md"
                                  : "bg-blue-600 text-white shadow-md" 
                            : "text-slate-200 hover:bg-white/10",
                          hasPending && "bg-amber-500/20 text-amber-200 border border-amber-500/40",
                          hasActiveReturns && "bg-rose-600 text-white border border-rose-500"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon size={19} className="stroke-[2.3]" />
                          <span>{item.label}</span>
                        </div>

                        {hasPending && (
                          <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-red-500 text-[11px] font-black text-white">
                            {pendingCount}
                          </span>
                        )}

                        {hasActiveReturns && (
                          <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-white text-[11px] font-black text-rose-600">
                            {activeReturns.length}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </nav>

                {/* Mobile Drawer Footer with Signout & Theme Quick Toggle */}
                <div className="p-3 border-t border-white/10 bg-black/20 space-y-2">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[11px] font-bold text-slate-400">থিম (Theme)</span>
                    <div className="flex items-center gap-1.5">
                      {THEME_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setTheme(opt.id)}
                          className={cn(
                            "w-6 h-6 rounded-full border transition-all active:scale-90",
                            theme === opt.id ? "ring-2 ring-white scale-110 border-transparent" : "opacity-60 border-white/40"
                          )}
                          style={{ backgroundColor: opt.primaryColor }}
                          title={opt.englishName}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsSidebarOpen(false);
                      handleLogout();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-2 active:scale-98 transition-transform"
                  >
                    <LogOut size={15} />
                    <span>সাইন আউট (Sign Out)</span>
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar (Only visible on lg+ screens) */}
      <aside className={cn(
        "hidden lg:flex flex-col w-68 text-white flex-shrink-0",
        isEmerald 
          ? "bg-[#071f18] border-r border-emerald-900/40" 
          : isCrimson
            ? "bg-[#160507] border-r border-rose-950/40"
            : isAmber
              ? "bg-[#18150f] border-r border-amber-950/50"
              : "bg-primary border-r border-white/10"
      )}>
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
            <div className={cn(
              "relative w-9 h-9 rounded-xl p-0.5 shadow-md flex items-center justify-center group flex-shrink-0 bg-gradient-to-br",
              isEmerald 
                ? "from-[#3ebd97] via-[#2ea884] to-[#155341] shadow-emerald-500/30" 
                : isCrimson
                  ? "from-[#ff385c] via-[#ea2340] to-[#881337] shadow-rose-500/35"
                  : isAmber
                    ? "from-[#fbbf24] via-[#f59e0b] to-[#78350f] shadow-amber-500/35"
                    : "from-blue-500 via-blue-600 to-indigo-700 shadow-blue-500/30"
            )}>
              <div className="w-full h-full bg-slate-900/70 rounded-[10px] flex items-center justify-center backdrop-blur-xs relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
                <Compass 
                  size={19} 
                  className={cn(
                    "text-white animate-[spin_10s_linear_infinite]",
                    isEmerald 
                      ? "drop-shadow-[0_0_8px_rgba(46,168,132,0.8)]" 
                      : isCrimson
                        ? "drop-shadow-[0_0_8px_rgba(234,35,64,0.85)]"
                        : isAmber
                          ? "drop-shadow-[0_0_8px_rgba(245,158,11,0.85)]"
                          : "drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                  )} 
                />
              </div>
            </div>
            <div>
              <h1 className="font-extrabold tracking-tight text-lg leading-tight flex items-center gap-1">
                <span>FleetManager</span>
                <span className={cn(
                  "text-[10px] px-1 py-0.2 rounded font-black border",
                  isEmerald 
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30" 
                    : isCrimson
                      ? "bg-rose-500/20 text-rose-300 border-rose-400/30"
                      : isAmber
                        ? "bg-amber-500/20 text-amber-300 border-amber-400/30"
                        : "bg-blue-500/20 text-blue-400 border-blue-400/30"
                )}>
                  PRO
                </span>
              </h1>
              <p className="text-[11px] font-semibold text-slate-400">লজিস্টিকস ম্যানেজমেন্ট</p>
            </div>
          </div>

          <nav className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto">
            {filteredNavItems.map((item) => {
              const isRequests = item.to === '/requests';
              const hasPending = isRequests && pendingCount > 0;
              
              const isVehicles = item.to === '/vehicles';
              const hasActiveReturns = isVehicles && activeReturns.length > 0;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => cn(
                    "flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 group text-[15px] font-bold tracking-normal",
                    isActive 
                      ? isEmerald 
                        ? "bg-[#2ea884] text-white font-extrabold shadow-md shadow-emerald-950/40"
                        : isCrimson
                          ? "bg-[#ea2340] text-white font-extrabold shadow-md shadow-rose-950/50"
                          : isAmber
                            ? "bg-[#f59e0b] text-slate-950 font-black shadow-md shadow-amber-950/50"
                            : "bg-blue-600 text-white font-extrabold shadow-md shadow-blue-900/30" 
                      : "text-slate-200 hover:text-white hover:bg-white/10 font-bold",
                    hasPending && "bg-amber-500/20 text-amber-200 border border-amber-500/30 hover:bg-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse font-extrabold",
                    hasActiveReturns && "bg-rose-600 text-white border border-rose-500 hover:bg-rose-700 shadow-[0_0_15px_rgba(239,68,68,0.5)] font-black animate-pulse"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={20} className="stroke-[2.3]" />
                    <span>{item.label}</span>
                  </div>

                  {hasPending && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-red-500 text-[11px] font-black text-white shadow-sm">
                        {pendingCount}
                      </span>
                    </div>
                  )}

                  {hasActiveReturns && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-white text-[11px] font-black text-rose-600 shadow-sm">
                        {activeReturns.length}
                      </span>
                    </div>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="p-3.5 mt-auto border-t border-white/10 bg-black/15 flex items-center justify-between text-slate-400">
            <p className="text-[11px] font-bold tracking-wide text-slate-300">FleetFlow Pro</p>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300">v2.4</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-bg relative">
        {/* Top Header Bar (Adaptive for Mobile & Desktop) */}
        <header className="h-14 sm:h-16 flex items-center justify-between px-3.5 sm:px-6 md:px-8 bg-surface border-b border-border flex-shrink-0 z-30 shadow-2xs">
          {/* Mobile Header Left Brand */}
          <div className="flex items-center gap-2 lg:hidden">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-1 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors active:scale-95"
              aria-label="Open Menu"
            >
              <Menu size={22} className="stroke-[2.4]" />
            </button>

            <div className="flex items-center gap-2">
              <div className={cn(
                "w-7 h-7 rounded-lg p-0.5 shadow-xs flex items-center justify-center bg-gradient-to-br",
                isEmerald 
                  ? "from-[#3ebd97] to-[#155341]" 
                  : isCrimson
                    ? "from-[#ff385c] to-[#881337]"
                    : isAmber
                      ? "from-[#fbbf24] to-[#78350f]"
                      : "from-blue-500 to-indigo-700"
              )}>
                <div className="w-full h-full bg-slate-950 rounded-[6px] flex items-center justify-center">
                  <Compass size={14} className="text-white" />
                </div>
              </div>
              <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight leading-tight">
                FleetManager
              </span>
            </div>
          </div>

          {/* Desktop Search Bar */}
          <div className={cn(
            "hidden lg:flex items-center bg-slate-50 border border-border px-4 py-2.5 rounded-xl w-84 gap-3 transition-all",
            isEmerald 
              ? "focus-within:border-[#2ea884] focus-within:ring-2 focus-within:ring-[#2ea884]/20 focus-within:bg-white" 
              : isCrimson
                ? "focus-within:border-[#ea2340] focus-within:ring-2 focus-within:ring-[#ea2340]/20 focus-within:bg-white"
                : isAmber
                  ? "focus-within:border-[#f59e0b] focus-within:ring-2 focus-within:ring-[#f59e0b]/20 focus-within:bg-white"
                  : "focus-within:border-blue-500 focus-within:bg-white"
          )}>
            <Search size={18} className="text-text-muted" />
            <input 
              type="text" 
              placeholder="গাড়ি, ড্রাইভার অথবা ট্রিপ খুঁজুন..." 
              className="bg-transparent border-none outline-none text-sm font-medium w-full text-text-main placeholder:text-text-muted"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Top Header Right Controls */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Mobile Quick Search Button */}
            <button
              type="button"
              onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
              className={cn(
                "p-2 rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden transition-colors active:scale-95",
                (isMobileSearchOpen || searchQuery) && (
                  isEmerald ? "bg-emerald-50 text-[#2ea884]" : isCrimson ? "bg-rose-50 text-[#ea2340]" : isAmber ? "bg-amber-50 text-[#d97706]" : "bg-blue-50 text-blue-600"
                )
              )}
              aria-label="Search"
            >
              <Search size={19} className="stroke-[2.3]" />
            </button>

            {/* Quick QR Scanner Link for Mobile Phone Top Bar */}
            <NavLink
              to="/qr-scanner"
              className={({ isActive }) => cn(
                "p-2 rounded-xl lg:hidden transition-all active:scale-95 flex items-center justify-center",
                isActive 
                  ? isEmerald ? "bg-[#2ea884] text-white" : isCrimson ? "bg-[#ea2340] text-white" : isAmber ? "bg-[#f59e0b] text-slate-950" : "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              )}
              title="QR Scanner"
            >
              <QrCode size={19} className="stroke-[2.3]" />
            </NavLink>

            {/* User Profile Trigger & Dropdown Menu */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className={cn(
                  "flex items-center gap-2 p-1 sm:px-3 sm:py-1.5 rounded-xl border transition-all cursor-pointer select-none active:scale-95",
                  isProfileMenuOpen 
                    ? isEmerald
                      ? "bg-[#e8f7f2] border-[#a7e3d1] shadow-xs" 
                      : isCrimson
                        ? "bg-[#fff1f2] border-[#fecdd3] shadow-xs"
                        : isAmber
                          ? "bg-[#fef3c7] border-[#fde68a] shadow-xs"
                          : "bg-blue-50/80 border-blue-200 shadow-xs"
                    : "border-transparent hover:bg-slate-100 hover:border-slate-200"
                )}
              >
                <div className="text-right hidden sm:flex flex-col items-end justify-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-black text-slate-900 leading-tight">
                      {profile?.displayName || user?.displayName || 'User'}
                    </span>
                    <span 
                      className="w-2 h-2 rounded-full inline-block ring-2 ring-white" 
                      style={{ backgroundColor: currentThemeOption.primaryColor }}
                    />
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={cn(
                      "text-[10px] font-extrabold px-2 py-0.2 rounded uppercase border",
                      isEmerald 
                        ? "text-[#0f513f] bg-[#e2f7ef] border-[#a1dec9]" 
                        : isCrimson
                          ? "text-[#9f1239] bg-[#ffe4e6] border-[#fecdd3]"
                          : isAmber
                            ? "text-[#78350f] bg-[#fef3c7] border-[#fde68a]"
                            : "text-blue-700 bg-blue-50 border-blue-200"
                    )}>
                      {profile?.role || 'User'}
                    </span>
                  </div>
                </div>

                {/* Avatar Icon */}
                <div className={cn(
                  "w-8 h-8 rounded-full border overflow-hidden relative shadow-xs flex items-center justify-center flex-shrink-0 font-extrabold text-xs",
                  isEmerald 
                    ? "border-[#2ea884] bg-[#e8f7f2] text-[#2ea884]" 
                    : isCrimson 
                      ? "border-[#ea2340] bg-[#fff1f2] text-[#ea2340]" 
                      : isAmber
                        ? "border-[#f59e0b] bg-[#fef3c7] text-[#b45309]"
                        : "border-blue-500 bg-blue-50 text-blue-600"
                )}>
                  {(profile?.displayName || user?.displayName || 'U').charAt(0).toUpperCase()}
                </div>

                <ChevronDown 
                  size={14} 
                  className={cn(
                    "text-slate-400 transition-transform duration-200 hidden sm:block",
                    isProfileMenuOpen && "rotate-180 text-text-main"
                  )} 
                />
              </button>

              {/* Profile & Theme Popover Menu */}
              <AnimatePresence>
                {isProfileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                    className="absolute right-0 top-full mt-2 w-72 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 text-slate-800 space-y-3.5"
                  >
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center text-white font-extrabold text-base shadow-md flex-shrink-0 bg-gradient-to-br",
                        isEmerald 
                          ? "from-[#3ebd97] via-[#2ea884] to-[#165a44]" 
                          : isCrimson
                            ? "from-[#ff385c] via-[#ea2340] to-[#991b1b]"
                            : isAmber
                              ? "from-[#fbbf24] via-[#f59e0b] to-[#78350f] text-slate-950"
                              : "from-blue-500 via-blue-600 to-indigo-700"
                      )}>
                        {(profile?.displayName || user?.displayName || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-extrabold text-sm text-slate-900 truncate">
                          {profile?.displayName || user?.displayName || 'User'}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                          {profile?.role === 'Admin' ? 'অ্যাডমিন' : profile?.role}
                        </p>
                      </div>
                    </div>

                    {/* Theme Selector */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                        <Palette size={13} className={isEmerald ? "text-[#2ea884]" : isCrimson ? "text-[#ea2340]" : isAmber ? "text-[#d97706]" : "text-blue-600"} />
                        <span>থিম পরিবর্তন (Theme)</span>
                      </label>
                      <div className="space-y-1.5">
                        {THEME_OPTIONS.map((opt) => {
                          const isSelected = theme === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setTheme(opt.id)}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all cursor-pointer active:scale-98",
                                isSelected
                                  ? opt.id === 'emerald-teal'
                                    ? "bg-[#e8f7f2] border-[#2ea884] ring-1 ring-[#2ea884]"
                                    : opt.id === 'crimson-red'
                                      ? "bg-[#fff1f2] border-[#ea2340] ring-1 ring-[#ea2340]"
                                      : opt.id === 'carrybee-amber'
                                        ? "bg-[#fef3c7] border-[#f59e0b] ring-1 ring-[#f59e0b]"
                                        : "bg-blue-50 border-blue-600 ring-1 ring-blue-600"
                                  : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                              )}
                            >
                              <div className="flex items-center gap-2.5">
                                <span 
                                  className="w-3.5 h-3.5 rounded-full shadow-xs flex-shrink-0"
                                  style={{ backgroundColor: opt.primaryColor }}
                                />
                                <span className={cn(
                                  "text-xs font-bold",
                                  isSelected ? "text-slate-900 font-extrabold" : "text-slate-700"
                                )}>
                                  {opt.englishName}
                                </span>
                              </div>
                              {isSelected && (
                                <Check size={14} className="stroke-[3] text-slate-900" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          handleLogout();
                        }}
                        className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all border border-rose-200 active:scale-98"
                      >
                        <LogOut size={14} className="stroke-[2.2]" />
                        <span>সাইন আউট (Sign Out)</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Mobile Slide-down Search Bar */}
        <AnimatePresence>
          {isMobileSearchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden bg-white border-b border-border px-3.5 py-2.5 shadow-sm overflow-hidden z-20"
            >
              <div className={cn(
                "flex items-center bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl gap-2",
                isEmerald ? "focus-within:border-[#2ea884]" : isCrimson ? "focus-within:border-[#ea2340]" : isAmber ? "focus-within:border-[#f59e0b]" : "focus-within:border-blue-500"
              )}>
                <Search size={16} className="text-slate-400 flex-shrink-0" />
                <input
                  ref={mobileSearchInputRef}
                  type="text"
                  placeholder="গাড়ি, ড্রাইভার অথবা ট্রিপ খুঁজুন..."
                  className="bg-transparent border-none outline-none text-xs font-medium w-full text-slate-800 placeholder:text-slate-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Viewport with Phone-Optimized Padding */}
        <div className="flex-1 overflow-y-auto px-3 py-3.5 sm:px-6 sm:py-6 pb-28 lg:pb-8 overscroll-contain">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="max-w-7xl mx-auto w-full"
          >
            {children}
          </motion.div>
        </div>

        {/* ============================================================== */}
        {/* ULTRA ERGONOMIC MOBILE PHONE BOTTOM NAVIGATION BAR (lg:hidden) */}
        {/* ============================================================== */}
        <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden pointer-events-none">
          <nav 
            className="relative pointer-events-auto bg-white/95 backdrop-blur-lg border-t border-slate-200/80 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] flex items-center justify-between px-2 pt-1.5 select-none"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
          >
            {/* 1. Dashboard (Left 1) */}
            <NavLink
              to="/"
              className={({ isActive }) => cn(
                "flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-150 relative active:scale-95",
                isActive 
                  ? isEmerald 
                    ? "text-[#2ea884] font-black" 
                    : isCrimson 
                      ? "text-[#ea2340] font-black" 
                      : isAmber 
                        ? "text-[#d97706] font-black" 
                        : "text-blue-600 font-black"
                  : "text-slate-500 font-bold hover:text-slate-800"
              )}
            >
              {({ isActive }) => (
                <>
                  <LayoutDashboard size={20} className={cn("transition-transform", isActive ? "scale-110 stroke-[2.6]" : "stroke-[2]")} />
                  <span className="text-[10px] mt-0.5 tracking-tight font-semibold">হোম</span>
                  {isActive && (
                    <motion.div 
                      layoutId="mobileNavIndicator"
                      className={cn(
                        "w-4 h-1 rounded-full mt-0.5",
                        isEmerald ? "bg-[#2ea884]" : isCrimson ? "bg-[#ea2340]" : isAmber ? "bg-[#f59e0b]" : "bg-blue-600"
                      )}
                    />
                  )}
                </>
              )}
            </NavLink>

            {/* 2. Vehicles (Left 2) */}
            <NavLink
              to="/vehicles"
              className={({ isActive }) => cn(
                "flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-150 relative active:scale-95",
                isActive 
                  ? isEmerald 
                    ? "text-[#2ea884] font-black" 
                    : isCrimson 
                      ? "text-[#ea2340] font-black" 
                      : isAmber 
                        ? "text-[#d97706] font-black" 
                        : "text-blue-600 font-black"
                  : "text-slate-500 font-bold hover:text-slate-800"
              )}
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Truck size={20} className={cn("transition-transform", isActive ? "scale-110 stroke-[2.6]" : "stroke-[2]")} />
                    {activeReturns.length > 0 && (
                      <span className="absolute -top-1 -right-2 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[9px] font-black text-white animate-pulse shadow-xs">
                        {activeReturns.length}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] mt-0.5 tracking-tight font-semibold">গাড়িসমূহ</span>
                  {isActive && (
                    <motion.div 
                      layoutId="mobileNavIndicator"
                      className={cn(
                        "w-4 h-1 rounded-full mt-0.5",
                        isEmerald ? "bg-[#2ea884]" : isCrimson ? "bg-[#ea2340]" : isAmber ? "bg-[#f59e0b]" : "bg-blue-600"
                      )}
                    />
                  )}
                </>
              )}
            </NavLink>

            {/* 3. HERO EXACT CENTER: FLOATING QR SCANNER (Center 3) */}
            <div className="flex-1 flex flex-col items-center justify-center relative -top-4 z-50">
              <div className="relative flex flex-col items-center">
                {/* Outer Subtle Glow Halo */}
                <div className={cn(
                  "absolute -inset-1 rounded-full blur-xs opacity-60 animate-pulse",
                  isEmerald 
                    ? "bg-emerald-400/50" 
                    : isCrimson 
                      ? "bg-rose-400/50" 
                      : isAmber 
                        ? "bg-amber-400/60" 
                        : "bg-blue-400/50"
                )} />
                
                <NavLink
                  to="/qr-scanner"
                  className={({ isActive }) => cn(
                    "relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 border-[3.5px] border-white shadow-[0_8px_20px_rgba(0,0,0,0.18)] cursor-pointer",
                    isActive 
                      ? "ring-4 ring-offset-2 scale-105" 
                      : "hover:scale-105",
                    isEmerald 
                      ? "bg-gradient-to-br from-[#3ebd97] via-[#2ea884] to-[#155341] text-white shadow-emerald-600/40 ring-emerald-400" 
                      : isCrimson 
                        ? "bg-gradient-to-br from-[#ff385c] via-[#ea2340] to-[#881337] text-white shadow-rose-600/40 ring-rose-400" 
                        : isAmber 
                          ? "bg-gradient-to-br from-[#fbbf24] via-[#f59e0b] to-[#78350f] text-slate-950 shadow-amber-600/40 ring-amber-400 font-black" 
                          : "bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 text-white shadow-blue-600/40 ring-blue-400"
                  )}
                  aria-label="Scan QR Code"
                >
                  <QrCode size={26} className="stroke-[2.6] drop-shadow-xs" />
                </NavLink>
                
                <span className={cn(
                  "text-[10px] font-black tracking-tight mt-1 px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs",
                  isAmber && "bg-amber-950 text-amber-200"
                )}>
                  QR
                </span>
              </div>
            </div>

            {/* 4. Trips (Right 2) */}
            <NavLink
              to="/trips"
              className={({ isActive }) => cn(
                "flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-150 relative active:scale-95",
                isActive 
                  ? isEmerald 
                    ? "text-[#2ea884] font-black" 
                    : isCrimson 
                      ? "text-[#ea2340] font-black" 
                      : isAmber 
                        ? "text-[#d97706] font-black" 
                        : "text-blue-600 font-black"
                  : "text-slate-500 font-bold hover:text-slate-800"
              )}
            >
              {({ isActive }) => (
                <>
                  <MapPin size={20} className={cn("transition-transform", isActive ? "scale-110 stroke-[2.6]" : "stroke-[2]")} />
                  <span className="text-[10px] mt-0.5 tracking-tight font-semibold">ট্রিপস</span>
                  {isActive && (
                    <motion.div 
                      layoutId="mobileNavIndicator"
                      className={cn(
                        "w-4 h-1 rounded-full mt-0.5",
                        isEmerald ? "bg-[#2ea884]" : isCrimson ? "bg-[#ea2340]" : isAmber ? "bg-[#f59e0b]" : "bg-blue-600"
                      )}
                    />
                  )}
                </>
              )}
            </NavLink>

            {/* 5. Mobile Drawer Menu (Right 1) */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-slate-500 hover:text-slate-800 transition-all active:scale-95 cursor-pointer"
            >
              <div className="relative">
                <Menu size={20} className="stroke-[2.2]" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-3.5 min-w-[14px] px-1 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold mt-0.5 tracking-tight">মেনু</span>
            </button>
          </nav>
        </div>
      </main>

      {/* Floating Returned Vehicle Pop-up Notifications (Phone Friendly) */}
      {isEligibleRole && activeReturns.length > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 left-3 sm:left-auto z-50 space-y-2 max-w-sm pointer-events-none">
          <AnimatePresence>
            {activeReturns.map((notif) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 30, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
                className="pointer-events-auto bg-slate-900 text-white border border-slate-800 p-3.5 rounded-2xl shadow-2xl flex items-start gap-3 relative overflow-hidden"
              >
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500 via-rose-500 to-amber-500 opacity-90" />
                
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0 mt-0.5 animate-pulse">
                  <Truck size={17} className="animate-bounce" />
                </div>
                
                <div className="flex-1 min-w-0 pr-4">
                  <h4 className="font-bold text-xs sm:text-sm tracking-tight text-white flex items-center gap-1.5">
                    গাড়ি ফিরে এসেছে!
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5 font-medium leading-relaxed">
                    গাড়ি <span className="font-extrabold text-amber-400 font-mono">{notif.vehicleNumber}</span> ফিরে এসেছে এবং এখন <span className="text-emerald-400 font-bold">Available</span>।
                  </p>
                </div>

                <button
                  onClick={() => dismissNotification(notif.id)}
                  className="absolute top-2.5 right-2.5 p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
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

export const Card: React.FC<{ children: React.ReactNode, title?: React.ReactNode, className?: string, bodyClassName?: string }> = ({ children, title, className, bodyClassName }) => (
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
    <div className={cn("p-5", bodyClassName)}>
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

export const AuditDetailsDropdown: React.FC<{
  createdBy?: string;
  updatedBy?: string;
  resolvedBy?: string;
  className?: string;
}> = ({ createdBy, updatedBy, resolvedBy, className }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!createdBy && !updatedBy && !resolvedBy) return null;

  return (
    <div ref={containerRef} className={cn("relative inline-flex items-center", className)}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          "inline-flex items-center justify-center w-4 h-4 rounded transition-all duration-150 cursor-pointer",
          isOpen
            ? "bg-blue-100 text-blue-700 font-bold shadow-xs scale-105"
            : "text-slate-400 hover:text-blue-600 hover:bg-slate-100 active:scale-95"
        )}
        title="এন্ট্রি ও এডিট তথ্য দেখতে ক্লিক করুন"
        aria-label="এন্ট্রি ও এডিট তথ্য ড্রপডাউন"
      >
        {isOpen ? <ChevronUp size={13} strokeWidth={2.5} /> : <ChevronDown size={13} strokeWidth={2.5} />}
      </button>

      {isOpen && (
        <div 
          onClick={(e) => e.stopPropagation()} 
          className="absolute left-0 top-full mt-1 bg-white border border-slate-200 p-2.5 rounded-xl shadow-xl space-y-1.5 text-[10px] text-slate-700 min-w-[200px] max-w-xs z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <UserCheck size={11} className="text-blue-600" />
              <span>ইউজার হিস্ট্রি</span>
            </span>
            <button 
              type="button" 
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 font-bold p-0.5"
            >
              ✕
            </button>
          </div>
          {createdBy && (
            <div className="flex items-start gap-1.5 pt-0.5">
              <span className="font-semibold text-slate-500 min-w-[48px]">এন্ট্রি:</span>
              <span className="font-medium text-slate-800 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 break-all flex-1">
                {createdBy}
              </span>
            </div>
          )}
          {updatedBy && (
            <div className="flex items-start gap-1.5">
              <span className="font-semibold text-slate-500 min-w-[48px]">এডিট:</span>
              <span className="font-medium text-slate-800 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 break-all flex-1">
                {updatedBy}
              </span>
            </div>
          )}
          {resolvedBy && (
            <div className="flex items-start gap-1.5">
              <span className="font-semibold text-emerald-600 min-w-[48px]">সমাধান:</span>
              <span className="font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 break-all flex-1">
                {resolvedBy}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export * from './ProfileModals';

