import React, { useEffect, useState } from 'react';
import { 
  Truck, 
  Users, 
  MapPin, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Activity,
  ArrowRight,
  Edit2
} from 'lucide-react';
import { Card } from './components/Common';
import { subscribeToCollection, updateVehicleStatus } from './db';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useSearch } from './SearchContext';
import { cn } from './lib/utils';

const StatCard: React.FC<{ 
  label: string, 
  value: number | string, 
  icon: any, 
  trend?: string
}> = ({ label, value, trend, icon: Icon }) => (
  <div className="bg-surface border border-border p-5 rounded-xl shadow-sm">
    <div className="flex justify-between items-start">
      <div className="stat-label text-[10px] uppercase font-bold text-text-muted tracking-wider">{label}</div>
      <div className="text-accent opacity-20"><Icon size={14} /></div>
    </div>
    <div className="mt-1 flex items-baseline gap-2">
      <div className="text-2xl font-bold text-text-main">{value}</div>
      {trend && <span className="text-xs font-semibold text-accent">{trend}</span>}
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const { searchQuery } = useSearch();

  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    const unsubVehicles = subscribeToCollection('vehicles', setVehicles);
    const unsubTrips = subscribeToCollection('trips', setTrips);
    const unsubDrivers = subscribeToCollection('drivers', setDrivers);
    return () => {
      unsubVehicles();
      unsubTrips();
      unsubDrivers();
    };
  }, []);

  const handleSaveNotes = async (vehicleId: string) => {
    setIsSavingNotes(true);
    try {
      await updateVehicleStatus(vehicleId, 'Maintenance', tempNotes.trim());
      setEditingNotesId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const stats = {
    totalVehicles: vehicles.length,
    activeFleet: vehicles.filter(v => v.status !== 'Maintenance').length,
    availableVehicles: vehicles.filter(v => v.status === 'Available').length,
    onTripVehicles: vehicles.filter(v => v.status === 'On Trip').length,
    maintenanceVehicles: vehicles.filter(v => v.status === 'Maintenance').length,
    runningTrips: trips.filter(t => t.status === 'Running').length,
    completedTrips: trips.filter(t => t.status === 'Completed').length,
    totalDrivers: drivers.length,
    typeBreakdown: {
      Small: vehicles.filter(v => v.type === 'Small').length,
      Medium: vehicles.filter(v => v.type === 'Medium').length,
      Large: vehicles.filter(v => v.type === 'Large').length,
    }
  };

  const filteredSearch = {
    vehicles: vehicles.filter(v => 
      v.vehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.vin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.id?.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    drivers: drivers.filter(d => 
      d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.driverId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.role?.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    trips: trips.filter(t => 
      t.driverName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.vehicleId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.location?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  };

  const isSearching = searchQuery.length > 0;

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {isSearching ? (
          <motion.div
            key="search-results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between border-b border-border pb-4">
               <h2 className="text-xl font-bold text-text-main">Search Results for "{searchQuery}"</h2>
               <p className="text-xs text-text-muted">Found {filteredSearch.vehicles.length + filteredSearch.drivers.length + filteredSearch.trips.length} matches</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card title="Matching Vehicles">
                <div className="space-y-3">
                  {filteredSearch.vehicles.map(v => (
                    <Link key={v.id} to="/vehicles" className="block p-3 hover:bg-slate-50 border border-border rounded-xl transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">{v.vehicleNumber}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                          v.status === 'Available' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                        )}>{v.status}</span>
                      </div>
                      <p className="text-[10px] text-text-muted mt-1">{v.type} • VIN: {v.vin}</p>
                    </Link>
                  ))}
                  {filteredSearch.vehicles.length === 0 && <p className="text-xs text-text-muted italic py-4">No vehicles found.</p>}
                </div>
              </Card>

              <Card title="Matching Drivers">
                <div className="space-y-3">
                  {filteredSearch.drivers.map(d => (
                    <Link key={d.id} to="/drivers" className="block p-3 hover:bg-slate-50 border border-border rounded-xl transition-colors">
                      <div className="flex items-center justify-between">
                         <span className="font-bold text-sm">{d.name}</span>
                         <span className="text-[9px] font-bold text-accent uppercase tracking-wider">{d.driverId}</span>
                      </div>
                      <p className="text-[10px] text-text-muted mt-1">{d.role || 'Driver'}</p>
                    </Link>
                  ))}
                  {filteredSearch.drivers.length === 0 && <p className="text-xs text-text-muted italic py-4">No staff found.</p>}
                </div>
              </Card>

              <Card title="Matching Trips">
                <div className="space-y-3">
                  {filteredSearch.trips.map(t => (
                    <Link key={t.id} to="/trips" className="block p-3 hover:bg-slate-50 border border-border rounded-xl transition-colors">
                      <div className="flex items-center justify-between">
                         <span className="font-bold text-sm">{t.location}</span>
                         <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                            t.status === 'Running' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                         )}>{t.status}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-text-muted">{t.driverName}</span>
                        <span className="text-[10px] font-bold text-slate-400">{t.vehicleId}</span>
                      </div>
                    </Link>
                  ))}
                  {filteredSearch.trips.length === 0 && <p className="text-xs text-text-muted italic py-4">No trips found.</p>}
                </div>
              </Card>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dashboard-stats"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Net Active Fleet" value={stats.activeFleet} icon={Truck} />
          <StatCard label="Available (Ready)" value={stats.availableVehicles} icon={CheckCircle} />
          <StatCard label="On Trip (Running)" value={stats.onTripVehicles} trend="▲" icon={Activity} />
        </div>
        <div className="bg-primary text-white p-5 rounded-xl flex flex-col justify-center">
          <div className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Under Maintenance (Offline)</div>
          <div className="text-2xl font-bold mt-1 text-orange-300">{stats.maintenanceVehicles}</div>
          <div className="text-[9px] mt-1 opacity-50">Total Fleet: {stats.totalVehicles}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(stats.typeBreakdown).map(([type, count]) => (
          <div key={type} className="bg-surface border border-border p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-text-muted">{type} Vehicles</p>
              <h4 className="text-xl font-bold text-text-main">{count}</h4>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-accent">
              <Truck size={20} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title="Live Fleet Status">
             <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-border">
                    <th className="px-5 py-3 font-semibold text-text-muted">Vehicle ID</th>
                    <th className="px-5 py-3 font-semibold text-text-muted">Driver</th>
                    <th className="px-5 py-3 font-semibold text-text-muted">Destination</th>
                    <th className="px-5 py-3 font-semibold text-text-muted text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {trips.filter(t => t.status === 'Running').map(trip => (
                    <tr key={trip.id}>
                      <td className="px-5 py-3 font-semibold">{trip.vehicleId}</td>
                      <td className="px-5 py-3 text-text-muted">{trip.driverName}</td>
                      <td className="px-5 py-3">{trip.location}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold text-[10px]">On Trip</span>
                      </td>
                    </tr>
                  ))}
                  {stats.runningTrips === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-text-muted italic">No active trips running.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Maintenance Alerts">
            <div className="space-y-3">
              {vehicles.filter(v => v.status === 'Maintenance').map(v => (
                <div key={v.id} className="p-3 bg-red-50 border border-red-100 rounded-lg space-y-2">
                  <div className="flex items-start gap-3 justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} className="text-danger flex-shrink-0" />
                      <div className="text-xs">
                        <p className="font-bold text-danger">{v.vehicleNumber}</p>
                      </div>
                    </div>
                    {editingNotesId !== v.id && (
                      <button 
                        onClick={() => { setEditingNotesId(v.id); setTempNotes(v.maintenanceNotes || ''); }}
                        className="text-[10px] text-accent hover:underline flex items-center gap-1 bg-white border px-1.5 py-0.5 rounded shadow-2xs font-semibold cursor-pointer"
                        title="সমস্যা বা নোট পরিবর্তন করুন"
                      >
                        <Edit2 size={10} />
                        <span>নোট লিখুন</span>
                      </button>
                    )}
                  </div>

                  {editingNotesId === v.id ? (
                    <div className="space-y-1.5 pl-6">
                      <textarea
                        className="w-full p-2 text-xs border border-amber-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-100 bg-white"
                        placeholder="গাড়ির কি কি সমস্যা রয়েছে লিখুন..."
                        value={tempNotes}
                        onChange={e => setTempNotes(e.target.value)}
                        rows={2}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          disabled={isSavingNotes}
                          onClick={() => handleSaveNotes(v.id)}
                          className="px-2.5 py-1 bg-accent text-white rounded text-[10px] font-bold hover:bg-accent/95 disabled:opacity-50 cursor-pointer"
                        >
                          {isSavingNotes ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                        </button>
                        <button
                          disabled={isSavingNotes}
                          onClick={() => setEditingNotesId(null)}
                          className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-bold hover:bg-slate-300 cursor-pointer"
                        >
                          বাতিল
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pl-6 text-xs">
                      <p className="text-slate-600 font-medium">
                        {v.maintenanceNotes ? (
                          <span className="text-amber-700 bg-amber-50 border border-amber-100/50 px-2 py-1 rounded block whitespace-pre-wrap">
                            {v.maintenanceNotes}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">গাড়ির কোনো নির্দিষ্ট সমস্যা বা নোট লেখা নেই।</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              ))}
              {vehicles.filter(v => v.status === 'Maintenance').length === 0 && (
                <div className="text-center py-4 text-text-muted text-xs">No active alerts.</div>
              )}
            </div>
          </Card>

          <Card title="Quick Driver Stats">
             <Link to="/drivers" className="block group">
               <div className="space-y-4">
                 <div className="flex justify-between items-center text-xs">
                   <div className="flex flex-col">
                     <span className="text-text-muted">Total Active Drivers</span>
                     <span className="text-[9px] text-accent font-bold group-hover:underline flex items-center gap-1">
                       View All Drivers <ArrowRight size={10} />
                     </span>
                   </div>
                   <span className="font-bold text-lg">{stats.totalDrivers}</span>
                 </div>
                 <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                   <div className="h-full bg-accent transition-all duration-500" style={{ width: `${Math.min((stats.totalDrivers / (stats.totalVehicles || 1)) * 100, 100)}%` }} />
                 </div>
                 <div className="pt-2 border-t border-slate-50">
                    <div className="flex -space-x-2 overflow-hidden">
                      {drivers.slice(0, 5).map((driver, i) => (
                        <div key={driver.id || i} className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-600 uppercase">
                          {driver.name?.charAt(0) || 'D'}
                        </div>
                      ))}
                      {stats.totalDrivers > 5 && (
                        <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400">
                          +{stats.totalDrivers - 5}
                        </div>
                      )}
                    </div>
                 </div>
               </div>
             </Link>
          </Card>
        </div>
      </div>
      </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
