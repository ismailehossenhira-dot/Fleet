import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Wrench, 
  Plus, 
  Search, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  DollarSign, 
  Filter, 
  FileText, 
  Printer, 
  Truck, 
  User, 
  ChevronRight, 
  TrendingUp, 
  Settings, 
  Sparkles, 
  Edit2,
  Radio,
  ChevronDown
} from 'lucide-react';
import { Card, Button, AuditDetailsDropdown } from './components/Common';
import { GPSDeviceManagement } from './components/GPSDeviceManagement';
import { 
  subscribeToCollection, 
  addMaintenanceRecord, 
  updateMaintenanceRecord, 
  deleteMaintenanceRecord,
  completeMaintenanceRecord
} from './db';
import { cn } from './lib/utils';
import { useAuth } from './AuthContext';
import { useSearch } from './SearchContext';
import { useTheme } from './ThemeContext';

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  category: 'Oil Change' | 'Brake Service' | 'Engine Repair' | 'Tire & Wheel' | 'Battery / Electrical' | 'Suspension' | 'AC Service' | 'Body Work' | 'Routine Inspection' | 'Other';
  title: string;
  description: string;
  cost: number;
  workshopName: string;
  mechanicName?: string;
  mechanicPhone?: string;
  odometerReading?: number;
  priority: 'Low' | 'Medium' | 'High' | 'Emergency';
  status: 'Pending' | 'In Progress' | 'Completed';
  startDate: string;
  completedDate?: string;
  partsReplaced?: string;
  nextServiceDueKm?: number;
  nextServiceDueDate?: string;
  invoiceNumber?: string;
  notes?: string;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

const MAINTENANCE_CATEGORIES = [
  'Oil Change',
  'Brake Service',
  'Engine Repair',
  'Tire & Wheel',
  'Battery / Electrical',
  'Suspension',
  'AC Service',
  'Body Work',
  'Routine Inspection',
  'Other'
];

const CATEGORY_NAMES_BN: Record<string, string> = {
  'Oil Change': 'ইঞ্জিন অয়েল ও ফিল্টার পরিবর্তন',
  'Brake Service': 'ব্রেক প্যাড ও ব্রেক সিস্টেম',
  'Engine Repair': 'ইঞ্জিন ও ট্রান্সমিশন মেরামত',
  'Tire & Wheel': 'টায়ার ও চাকা এলাইনমেন্ট',
  'Battery / Electrical': 'ব্যাটারি ও ইলেকট্রিক্যাল সিস্টেম',
  'Suspension': 'সাসপেনশন ও জাম্পার মেরামত',
  'AC Service': 'এসি কুলিং ও গ্যাস রিফিল',
  'Body Work': 'বডি মেরামত ও ডেন্টিং-পেইন্টিং',
  'Routine Inspection': 'রুটিন চেকআপ ও টিউনিং',
  'Other': 'অন্যান্য রক্ষণাবেক্ষণ'
};

interface MaintenanceProps {
  defaultTab?: 'records' | 'gps';
}

const Maintenance: React.FC<MaintenanceProps> = ({ defaultTab }) => {
  const { isAdmin, isSubAdmin, isChecker, isLineSupervisor, profile } = useAuth();
  const { searchQuery } = useSearch();
  const { isEmerald, isCrimson, isAmber, currentThemeOption } = useTheme();
  const canManage = isAdmin || isSubAdmin || isLineSupervisor;
  const location = useLocation();
  const navigate = useNavigate();

  const isGPSInitial = location.pathname.includes('/maintenance/gps') || location.search.includes('tab=gps') || defaultTab === 'gps';
  const [subSection, setSubSection] = useState<'records' | 'gps'>(isGPSInitial ? 'gps' : 'records');
  const [isSubMenuDropdownOpen, setIsSubMenuDropdownOpen] = useState(false);
  const subMenuDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (subMenuDropdownRef.current && !subMenuDropdownRef.current.contains(e.target as Node)) {
        setIsSubMenuDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (location.pathname.includes('/maintenance/gps') || location.search.includes('tab=gps') || defaultTab === 'gps') {
      setSubSection('gps');
    } else {
      setSubSection('records');
    }
  }, [location.pathname, location.search, defaultTab]);

  const handleSwitchTab = (tab: 'records' | 'gps') => {
    setSubSection(tab);
    setIsSubMenuDropdownOpen(false);
    if (tab === 'gps') {
      navigate('/maintenance/gps', { replace: true });
    } else {
      navigate('/maintenance', { replace: true });
    }
  };

  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'In Progress' | 'Completed'>('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    vehiclePlate: '',
    category: 'Oil Change' as MaintenanceRecord['category'],
    title: '',
    description: '',
    cost: '',
    workshopName: '',
    mechanicName: '',
    mechanicPhone: '',
    odometerReading: '',
    priority: 'Medium' as MaintenanceRecord['priority'],
    status: 'In Progress' as MaintenanceRecord['status'],
    startDate: new Date().toISOString().split('T')[0],
    partsReplaced: '',
    nextServiceDueKm: '',
    nextServiceDueDate: '',
    invoiceNumber: '',
    notes: '',
    setVehicleToMaintenance: true
  });

  useEffect(() => {
    const unsubMaintenance = subscribeToCollection('maintenance', (data: any[]) => {
      setRecords(data as MaintenanceRecord[]);
    });
    const unsubVehicles = subscribeToCollection('vehicles', setVehicles);

    return () => {
      unsubMaintenance();
      unsubVehicles();
    };
  }, []);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesTab = activeTab === 'All' ? true : r.status === activeTab;
      const matchesCategory = categoryFilter === 'All' ? true : r.category === categoryFilter;
      const matchesPriority = priorityFilter === 'All' ? true : r.priority === priorityFilter;
      
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        (r.vehiclePlate || '').toLowerCase().includes(q) ||
        (r.title || '').toLowerCase().includes(q) ||
        (r.workshopName || '').toLowerCase().includes(q) ||
        (r.mechanicName || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q) ||
        (CATEGORY_NAMES_BN[r.category] || '').toLowerCase().includes(q) ||
        (r.invoiceNumber || '').toLowerCase().includes(q)
      );

      return matchesTab && matchesCategory && matchesPriority && matchesSearch;
    });
  }, [records, activeTab, categoryFilter, priorityFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = records.length;
    const pendingCount = records.filter(r => r.status === 'Pending').length;
    const inProgressCount = records.filter(r => r.status === 'In Progress').length;
    const completedCount = records.filter(r => r.status === 'Completed').length;
    const totalCost = records.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
    const thisMonthCost = records.reduce((sum, r) => {
      if (!r.startDate) return sum;
      const recDate = new Date(r.startDate);
      const now = new Date();
      if (recDate.getMonth() === now.getMonth() && recDate.getFullYear() === now.getFullYear()) {
        return sum + (Number(r.cost) || 0);
      }
      return sum;
    }, 0);

    return {
      totalCount,
      pendingCount,
      inProgressCount,
      completedCount,
      totalCost,
      thisMonthCost
    };
  }, [records]);

  const handleOpenAdd = () => {
    setEditingRecord(null);
    setFormData({
      vehiclePlate: vehicles.length > 0 ? vehicles[0].vehicleNumber : '',
      category: 'Oil Change',
      title: '',
      description: '',
      cost: '',
      workshopName: '',
      mechanicName: '',
      mechanicPhone: '',
      odometerReading: '',
      priority: 'Medium',
      status: 'In Progress',
      startDate: new Date().toISOString().split('T')[0],
      partsReplaced: '',
      nextServiceDueKm: '',
      nextServiceDueDate: '',
      invoiceNumber: '',
      notes: '',
      setVehicleToMaintenance: true
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (rec: MaintenanceRecord) => {
    setEditingRecord(rec);
    setFormData({
      vehiclePlate: rec.vehiclePlate || '',
      category: rec.category || 'Oil Change',
      title: rec.title || '',
      description: rec.description || '',
      cost: rec.cost ? String(rec.cost) : '',
      workshopName: rec.workshopName || '',
      mechanicName: rec.mechanicName || '',
      mechanicPhone: rec.mechanicPhone || '',
      odometerReading: rec.odometerReading ? String(rec.odometerReading) : '',
      priority: rec.priority || 'Medium',
      status: rec.status || 'In Progress',
      startDate: rec.startDate || new Date().toISOString().split('T')[0],
      partsReplaced: rec.partsReplaced || '',
      nextServiceDueKm: rec.nextServiceDueKm ? String(rec.nextServiceDueKm) : '',
      nextServiceDueDate: rec.nextServiceDueDate || '',
      invoiceNumber: rec.invoiceNumber || '',
      notes: rec.notes || '',
      setVehicleToMaintenance: false
    });
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehiclePlate.trim() || !formData.title.trim()) {
      alert('গাড়ির নম্বর ও মেইনটেনেন্স টাইটেল প্রদান করুন।');
      return;
    }

    const matchedVeh = vehicles.find(v => v.vehicleNumber.toUpperCase() === formData.vehiclePlate.trim().toUpperCase());
    const vehicleId = matchedVeh ? matchedVeh.id : formData.vehiclePlate.trim().toUpperCase();

    const recordPayload = {
      vehicleId,
      vehiclePlate: formData.vehiclePlate.trim().toUpperCase(),
      category: formData.category,
      title: formData.title.trim(),
      description: formData.description.trim(),
      cost: Number(formData.cost) || 0,
      workshopName: formData.workshopName.trim(),
      mechanicName: formData.mechanicName.trim(),
      mechanicPhone: formData.mechanicPhone.trim(),
      odometerReading: Number(formData.odometerReading) || 0,
      priority: formData.priority,
      status: formData.status,
      startDate: formData.startDate,
      partsReplaced: formData.partsReplaced.trim(),
      nextServiceDueKm: Number(formData.nextServiceDueKm) || 0,
      nextServiceDueDate: formData.nextServiceDueDate,
      invoiceNumber: formData.invoiceNumber.trim(),
      notes: formData.notes.trim()
    };

    if (editingRecord) {
      await updateMaintenanceRecord(editingRecord.id, recordPayload, profile);
    } else {
      await addMaintenanceRecord(recordPayload, formData.setVehicleToMaintenance, profile);
    }

    setShowAddModal(false);
    setEditingRecord(null);
  };

  const handleQuickComplete = async (rec: MaintenanceRecord) => {
    const confirmComplete = window.confirm(`গাড়ি ${rec.vehiclePlate}-এর মেইনটেনেন্স সম্পন্ন হয়েছে এবং গাড়িটি পুনরায় সচল (Available) করতে চান?`);
    if (!confirmComplete) return;

    await completeMaintenanceRecord(rec.id, rec.vehicleId, rec.vehiclePlate, profile);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই মেইনটেনেন্স রেকর্ডটি ডিলিট করতে চান?')) return;
    await deleteMaintenanceRecord(id);
    setDeletingId(null);
    if (selectedRecord?.id === id) {
      setSelectedRecord(null);
    }
  };

  const printMaintenanceReport = (rec: MaintenanceRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>মেইনটেনেন্স স্লিপ - ${rec.vehiclePlate}</title>
          <style>
            body { font-family: 'Hind Siliguri', Arial, sans-serif; padding: 25px; color: #0f172a; font-size: 13px; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
            .header h1 { font-size: 20px; margin: 0; }
            .header p { margin: 3px 0 0; color: #64748b; font-size: 11px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 18px; }
            .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #fafafa; }
            .card h3 { font-size: 12px; margin: 0 0 8px; text-transform: uppercase; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-weight: bold; }
            .row { display: flex; justify-content: space-between; margin-bottom: 6px; }
            .label { color: #64748b; font-size: 11px; }
            .val { font-weight: 600; color: #0f172a; }
            .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 15px; }
            .footer { margin-top: 50px; display: flex; justify-content: space-between; font-size: 11px; }
            .sig { border-top: 1px dashed #94a3b8; width: 140px; text-align: center; padding-top: 5px; }
            @media print { .no-print { display: none !important; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>গাড়ি মেইনটেনেন্স ও সার্ভিসিং রিপোর্ট</h1>
            <p>FleetFlow Pro • প্রিন্ট তারিখ: ${new Date().toLocaleString('bn-BD')}</p>
          </div>

          <div style="background: #e2e8f0; padding: 8px 12px; border-radius: 6px; font-size: 14px; font-weight: bold; margin-bottom: 15px; display: flex; justify-content: space-between;">
            <span>গাড়ির নম্বর: ${rec.vehiclePlate}</span>
            <span>ইনভয়েস: ${rec.invoiceNumber || 'N/A'}</span>
          </div>

          <div class="grid">
            <div class="card">
              <h3>কাজের বিবরণ</h3>
              <div class="row"><span class="label">কাজের ধরন:</span> <span class="val">${CATEGORY_NAMES_BN[rec.category] || rec.category}</span></div>
              <div class="row"><span class="label">টাইটেল:</span> <span class="val">${rec.title}</span></div>
              <div class="row"><span class="label">স্ট্যাটাস:</span> <span class="val">${rec.status === 'Completed' ? 'সম্পন্ন' : rec.status === 'In Progress' ? 'চলমান' : 'পেন্ডিং'}</span></div>
              <div class="row"><span class="label">অগ্রাধিকার:</span> <span class="val">${rec.priority}</span></div>
              <div class="row"><span class="label">শুরুর তারিখ:</span> <span class="val">${rec.startDate || 'N/A'}</span></div>
              <div class="row"><span class="label">শেষের তারিখ:</span> <span class="val">${rec.completedDate || 'চলমান'}</span></div>
            </div>

            <div class="card">
              <h3>ওয়ার্কশপ ও খরচ</h3>
              <div class="row"><span class="label">ওয়ার্কশপ:</span> <span class="val">${rec.workshopName || 'N/A'}</span></div>
              <div class="row"><span class="label">মেকানিক:</span> <span class="val">${rec.mechanicName || 'N/A'}</span></div>
              <div class="row"><span class="label">মোবাইল:</span> <span class="val">${rec.mechanicPhone || 'N/A'}</span></div>
              <div class="row"><span class="label">বর্তমান কি.মি.:</span> <span class="val">${rec.odometerReading ? rec.odometerReading + ' km' : 'N/A'}</span></div>
              <div class="row"><span class="label">পরবর্তী সার্ভিস (কি.মি.):</span> <span class="val">${rec.nextServiceDueKm ? rec.nextServiceDueKm + ' km' : 'N/A'}</span></div>
              <div class="row"><span class="label">মোট খরচ:</span> <span class="val" style="color: #b91c1c; font-size: 14px;">৳${rec.cost.toLocaleString('bn-BD')}</span></div>
            </div>
          </div>

          ${rec.description ? `
            <div class="box">
              <strong style="font-size: 11px; color: #475569; display: block; margin-bottom: 4px;">বিস্তারিত কাজের বিবরণী:</strong>
              <div>${rec.description}</div>
            </div>
          ` : ''}

          ${rec.partsReplaced ? `
            <div class="box">
              <strong style="font-size: 11px; color: #475569; display: block; margin-bottom: 4px;">পরিবর্তনকৃত পার্টস/যন্ত্রাংশ:</strong>
              <div>${rec.partsReplaced}</div>
            </div>
          ` : ''}

          <div class="footer">
            <div class="sig">মেকানিক / ওয়ার্কশপ স্বাক্ষর</div>
            <div class="sig">ফ্লিট ইনচার্জ স্বাক্ষর</div>
            <div class="sig">কর্তৃপক্ষের অনুমোদন</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Sub-Menu Selector & Dropdown (Maintenance vs GPS Device) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Dropdown Selector Button */}
        <div className="relative" ref={subMenuDropdownRef}>
          <button
            type="button"
            onClick={() => setIsSubMenuDropdownOpen(!isSubMenuDropdownOpen)}
            className={cn(
              "flex items-center gap-2.5 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm border shadow-xs transition-all active:scale-[0.98]",
              isEmerald 
                ? "bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-50" 
                : isCrimson
                ? "bg-white text-rose-900 border-rose-200 hover:bg-rose-50"
                : isAmber
                ? "bg-white text-amber-900 border-amber-200 hover:bg-amber-50"
                : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
            )}
          >
            <div className="flex items-center gap-2">
              {subSection === 'records' ? (
                <Wrench size={16} className="text-blue-600" />
              ) : (
                <Radio size={16} className="text-amber-500 animate-pulse" />
              )}
              <span className="font-extrabold text-slate-700">মেইনটেনেন্স সাব-মেনু:</span>
              <span className="font-black text-slate-900">
                {subSection === 'records' ? 'গাড়ির সার্ভিস ও মেরামত' : 'GPS Device ও ক্যামেরা'}
              </span>
            </div>
            <ChevronDown 
              size={16} 
              className={cn(
                "transition-transform duration-200 text-slate-400",
                isSubMenuDropdownOpen ? "rotate-180" : "rotate-0"
              )} 
            />
          </button>

          {/* Dropdown Content Menu */}
          {isSubMenuDropdownOpen && (
            <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                সাব-মেনু বেছে নিন (Select Menu)
              </p>

              <button
                type="button"
                onClick={() => handleSwitchTab('records')}
                className={cn(
                  "w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-3 group",
                  subSection === 'records'
                    ? "bg-blue-50 text-blue-900 font-extrabold border border-blue-200"
                    : "hover:bg-slate-50 text-slate-700"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    subSection === 'records' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                  )}>
                    <Wrench size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold">গাড়ির সার্ভিস ও মেরামত</div>
                    <div className="text-[10px] text-slate-400">নিয়মিত মেইনটেনেন্স ও মেরামতের খরচ</div>
                  </div>
                </div>
                {subSection === 'records' && (
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSwitchTab('gps')}
                className={cn(
                  "w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-3 mt-1 group",
                  subSection === 'gps'
                    ? "bg-amber-50 text-amber-950 font-extrabold border border-amber-200"
                    : "hover:bg-slate-50 text-slate-700"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    subSection === 'gps' ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                  )}>
                    <Radio size={16} className={subSection === 'gps' ? 'animate-pulse' : ''} />
                  </div>
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>GPS Device ও ক্যামেরা</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-200 text-amber-800 font-black uppercase">ADL/BDT</span>
                    </div>
                    <div className="text-[10px] text-slate-400">ডিভাইস ও ক্যামেরা সমস্যা ও ভেন্ডর রিপোর্ট</div>
                  </div>
                </div>
                {subSection === 'gps' && (
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Quick Tab Switcher Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-2xl">
          <button
            onClick={() => handleSwitchTab('records')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5",
              subSection === 'records'
                ? isEmerald 
                  ? "bg-[#2ea884] text-white shadow-xs" 
                  : isCrimson
                  ? "bg-[#ea2340] text-white shadow-xs"
                  : isAmber
                  ? "bg-[#f59e0b] text-slate-950 shadow-xs"
                  : "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            )}
          >
            <Wrench size={14} />
            <span>সার্ভিসিং রেকর্ডস</span>
          </button>

          <button
            onClick={() => handleSwitchTab('gps')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5",
              subSection === 'gps'
                ? isEmerald 
                  ? "bg-[#2ea884] text-white shadow-xs" 
                  : isCrimson
                  ? "bg-[#ea2340] text-white shadow-xs"
                  : isAmber
                  ? "bg-[#f59e0b] text-slate-950 shadow-xs"
                  : "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            )}
          >
            <Radio size={14} className={subSection === 'gps' ? 'animate-pulse' : ''} />
            <span>GPS ও ক্যামেরা</span>
          </button>
        </div>
      </div>

      {subSection === 'gps' ? (
        <GPSDeviceManagement />
      ) : (
        <>
          {/* Top Header Banner */}
          <div className={cn(
            "p-4 sm:p-5 rounded-2xl border shadow-xs flex items-center justify-between gap-4 flex-wrap",
            isEmerald 
              ? "bg-gradient-to-r from-[#e8f7f2] via-[#d3f1e7] to-white border-[#b5e7d8]"
              : isCrimson
              ? "bg-gradient-to-r from-[#fff1f2] via-[#ffe4e6] to-white border-[#fecdd3]"
              : isAmber
              ? "bg-gradient-to-r from-[#fffbeb] via-[#fef3c7] to-white border-[#fde68a]"
              : "bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white border-blue-100"
          )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-md font-bold shrink-0 bg-gradient-to-br",
            currentThemeOption.previewGradient
          )}>
            <Wrench size={22} className="sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                ফ্লিট মেইনটেনেন্স ও সার্ভিসিং
              </h2>
              <span className={cn(
                "hidden sm:inline-block text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border shadow-2xs",
                isEmerald ? "bg-[#d5f3e8] text-[#0f513f] border-[#a1dec9]" :
                isCrimson ? "bg-[#ffe4e6] text-[#9f1239] border-[#fecdd3]" :
                isAmber ? "bg-[#fef3c7] text-[#78350f] border-[#fde68a]" :
                "bg-blue-100 text-blue-800 border-blue-200"
              )}>
                Maintenance Log
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              গাড়ির সার্ভিসিং, মেরামত, পার্টস পরিবর্তন এবং খরচ সংক্রান্ত সকল হিসাব সংরক্ষণ
            </p>
          </div>
        </div>

        {canManage && (
          <Button 
            onClick={handleOpenAdd}
            className="flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold shadow-sm"
          >
            <Plus size={16} />
            <span>নতুন মেইনটেনেন্স যুক্ত করুন</span>
          </Button>
        )}
      </div>

      {/* Overview Analytics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">মোট সার্ভিস রেকর্ড</span>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1 font-mono">{stats.totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <FileText size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">চলমান সার্ভিসিং</span>
            <p className="text-xl sm:text-2xl font-black text-amber-600 mt-1 font-mono">{stats.inProgressCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-200/60">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">সম্পন্ন কাজ</span>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-1 font-mono">{stats.completedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-200/60">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">চলতি মাসের খরচ</span>
            <p className="text-lg sm:text-2xl font-black text-rose-600 mt-1 font-mono">৳{stats.thisMonthCost.toLocaleString('bn-BD')}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-200/60">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100">
          {(['All', 'In Progress', 'Pending', 'Completed'] as const).map((tab) => {
            const count = tab === 'All' ? stats.totalCount :
                          tab === 'In Progress' ? stats.inProgressCount :
                          tab === 'Pending' ? stats.pendingCount : stats.completedCount;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5",
                  activeTab === tab 
                    ? "bg-slate-900 text-white shadow-xs" 
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <span>
                  {tab === 'All' ? 'সকল রেকর্ড' : tab === 'In Progress' ? 'চলমান' : tab === 'Pending' ? 'পেন্ডিং' : 'সম্পন্ন'}
                </span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black",
                  activeTab === tab ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Secondary Category and Priority Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-slate-400"
            >
              <option value="All">সকল ক্যাটাগরি (All Categories)</option>
              {MAINTENANCE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{CATEGORY_NAMES_BN[cat] || cat}</option>
              ))}
            </select>
          </div>

          <div className="w-40">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-slate-400"
            >
              <option value="All">সকল প্রায়োরিটি</option>
              <option value="Low">Low (সাধারণ)</option>
              <option value="Medium">Medium (মাঝারি)</option>
              <option value="High">High (জরুরি)</option>
              <option value="Emergency">Emergency (অতীব জরুরি)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Maintenance Records List / Table */}
      {filteredRecords.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 shadow-2xs">
          <Wrench size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-700">কোন মেইনটেনেন্স রেকর্ড খুঁজে পাওয়া যায়নি</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            গাড়ির সার্ভিসিং বা মেরামতের জন্য উপরে 'নতুন মেইনটেনেন্স যুক্ত করুন' বাটনে ক্লিক করুন।
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecords.map((rec) => {
            const isCompleted = rec.status === 'Completed';
            const isInProgress = rec.status === 'In Progress';
            const isHighPriority = rec.priority === 'High' || rec.priority === 'Emergency';

            return (
              <div 
                key={rec.id}
                className={cn(
                  "bg-white rounded-2xl border transition-all p-4 flex flex-col justify-between shadow-2xs hover:shadow-xs",
                  isCompleted ? "border-slate-200/80" : isInProgress ? "border-amber-300/80 bg-amber-50/10" : "border-slate-200"
                )}
              >
                <div>
                  {/* Top Bar: Vehicle Plate & Status */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-slate-900 text-white font-black font-mono text-xs rounded-lg shadow-2xs">
                        {rec.vehiclePlate}
                      </span>
                      {isHighPriority && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200 animate-pulse">
                          {rec.priority}
                        </span>
                      )}
                    </div>

                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                      isCompleted ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      isInProgress ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-slate-100 text-slate-600 border-slate-200"
                    )}>
                      {isCompleted ? 'সম্পন্ন' : isInProgress ? 'চলমান' : 'পেন্ডিং'}
                    </span>
                  </div>

                  {/* Title & Category */}
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">
                    {rec.title}
                  </h4>
                  <p className="text-[11px] font-semibold text-blue-700 mt-0.5">
                    {CATEGORY_NAMES_BN[rec.category] || rec.category}
                  </p>

                  {/* Workshop and Cost Information */}
                  <div className="mt-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[11px]">ওয়ার্কশপ:</span>
                      <span className="font-semibold text-slate-800 truncate max-w-[140px]">{rec.workshopName || 'উল্লেখ নেই'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[11px]">শুরুর তারিখ:</span>
                      <span className="font-medium text-slate-700 font-mono">{rec.startDate || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                      <span className="text-slate-500 text-[11px] font-bold">খরচ (Cost):</span>
                      <span className="font-black text-rose-600 font-mono text-sm">৳{rec.cost.toLocaleString('bn-BD')}</span>
                    </div>
                  </div>

                  {rec.partsReplaced && (
                    <div className="mt-2.5 text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                      <span className="font-bold text-slate-700">পার্টস: </span>
                      {rec.partsReplaced}
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => printMaintenanceReport(rec)}
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                      title="প্রিন্ট স্লিপ"
                    >
                      <Printer size={15} />
                    </button>
                    {canManage && (
                      <button
                        onClick={() => handleOpenEdit(rec)}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        title="এডিট করুন"
                      >
                        <Edit2 size={15} />
                      </button>
                    )}
                    {canManage && (
                      <button
                        onClick={() => handleDelete(rec.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                        title="ডিলিট করুন"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  {canManage && !isCompleted && (
                    <button
                      onClick={() => handleQuickComplete(rec)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1 active:scale-95"
                    >
                      <CheckCircle2 size={13} />
                      <span>সম্পন্ন করুন</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Wrench size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingRecord ? 'মেইনটেনেন্স রেকর্ড এডিট করুন' : 'নতুন মেইনটেনেন্স এন্ট্রি'}
                  </h3>
                  <p className="text-[11px] text-slate-500">গাড়ির সার্ভিসিং ও খরচের তথ্য সংরক্ষণ করুন</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Vehicle Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">গাড়ির নম্বর *</label>
                  <select
                    value={formData.vehiclePlate}
                    onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value })}
                    required
                    className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                  >
                    <option value="">গাড়ি নির্বাচন করুন</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.vehicleNumber}>
                        {v.vehicleNumber} ({v.type || 'Standard'}) - {v.status}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ক্যাটাগরি / কাজের ধরন *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    required
                    className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                  >
                    {MAINTENANCE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{CATEGORY_NAMES_BN[cat] || cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">কাজের বিবরণ / টাইটেল *</label>
                <input
                  type="text"
                  placeholder="যেমন: Mobil 1 Oil change & front brake shoe replacement"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full text-xs font-medium px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Cost */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">মোট খরচ (৳) *</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    className="w-full text-xs font-mono font-bold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-rose-600"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">স্ট্যাটাস</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                  >
                    <option value="In Progress">চলমান (In Progress)</option>
                    <option value="Pending">পেন্ডিং (Pending)</option>
                    <option value="Completed">সম্পন্ন (Completed)</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">অগ্রাধিকার (Priority)</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Workshop Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ওয়ার্কশপ / গ্যারেজ</label>
                  <input
                    type="text"
                    placeholder="যেমন: Central Auto Works"
                    value={formData.workshopName}
                    onChange={(e) => setFormData({ ...formData, workshopName: e.target.value })}
                    className="w-full text-xs font-medium px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>

                {/* Mechanic Name & Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">মেকানিকের নাম / মোবাইল</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="নাম"
                      value={formData.mechanicName}
                      onChange={(e) => setFormData({ ...formData, mechanicName: e.target.value })}
                      className="w-1/2 text-xs font-medium px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="মোবাইল"
                      value={formData.mechanicPhone}
                      onChange={(e) => setFormData({ ...formData, mechanicPhone: e.target.value })}
                      className="w-1/2 text-xs font-medium px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Start Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">শুরুর তারিখ</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>

                {/* Odometer */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">বর্তমান কি.মি. (Odometer)</label>
                  <input
                    type="number"
                    placeholder="km"
                    value={formData.odometerReading}
                    onChange={(e) => setFormData({ ...formData, odometerReading: e.target.value })}
                    className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>

                {/* Invoice Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">রসিদ / বিল নম্বর</label>
                  <input
                    type="text"
                    placeholder="INV-001"
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Parts Replaced */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">পরিবর্তনকৃত পার্টস (Parts Replaced)</label>
                <input
                  type="text"
                  placeholder="যেমন: Mobil 20W-50 (4L), Oil Filter, Front Brake Pad"
                  value={formData.partsReplaced}
                  onChange={(e) => setFormData({ ...formData, partsReplaced: e.target.value })}
                  className="w-full text-xs font-medium px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              {/* Detailed Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">অতিরিক্ত নোট / বিবরণ</label>
                <textarea
                  rows={2}
                  placeholder="মেইনটেনেন্স সংক্রান্ত বিস্তারিত মন্তব্য..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              {/* Auto update vehicle status to Maintenance checkbox */}
              {!editingRecord && formData.status !== 'Completed' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="setVehicleStatus"
                    checked={formData.setVehicleToMaintenance}
                    onChange={(e) => setFormData({ ...formData, setVehicleToMaintenance: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="setVehicleStatus" className="text-xs font-bold text-amber-900 cursor-pointer">
                    গাড়ির বর্তমান স্ট্যাটাস স্বয়ংক্রিয়ভাবে 'Maintenance' এ পরিবর্তন করুন
                  </label>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  বাতিল
                </button>
                <Button type="submit" className="py-2.5 px-5 text-xs font-bold rounded-xl shadow-sm">
                  {editingRecord ? 'আপডেট করুন' : 'সংরক্ষণ করুন'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default Maintenance;
