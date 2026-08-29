import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Trash2, 
  Edit3, 
  Search, 
  Key, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  Check, 
  X,
  Loader2,
  Info,
  Ban,
  Sparkles,
  SlidersHorizontal,
  CheckSquare,
  Square,
  RotateCcw,
  Lock,
  Building2,
  Filter
} from 'lucide-react';
import { Card, Button, getRoleBangla } from './components/Common';
import { useAuth, UserRole, SYSTEM_MODULES, ModuleKey } from './AuthContext';
import { useSearch } from './SearchContext';
import { useWarehouse } from './WarehouseContext';
import { 
  subscribeToCollection, 
  createUserAccount, 
  updateUserAccount, 
  deleteUserAccount,
  toggleUserSuspension,
  updateUserPermissions,
  cleanupLegacyRoles
} from './db';

const VALID_ROLES: UserRole[] = ['Admin', 'Sub Admin', 'OCC', 'Line Supervisor', 'Checker'];

export const UsersManagement: React.FC = () => {
  const { profile, isAdmin, isSuperAdmin } = useAuth();
  const { searchQuery, setSearchQuery } = useSearch();
  const { warehouses, selectedWarehouse, isWarehouseLocked, assignedWarehouse, userWarehouse, getWarehouseBadge } = useWarehouse();
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [depotFilter, setDepotFilter] = useState<string>('all');

  useEffect(() => {
    setSearchTerm(searchQuery);
  }, [searchQuery]);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('Checker');
  const [formWarehouse, setFormWarehouse] = useState<string>('মোহাম্মদপুর');
  const [formAllPermissions, setFormAllPermissions] = useState<boolean>(false);
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  
  // Permission Modal State
  const [permModalUser, setPermModalUser] = useState<any | null>(null);
  const [permAllModules, setPermAllModules] = useState<boolean>(false);
  const [permSelectedKeys, setPermSelectedKeys] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);
  const [cleaningLegacy, setCleaningLegacy] = useState(false);

  // UI states
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Custom confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    type: 'delete' | 'suspend' | 'activate' | null;
    user: any;
  }>({ show: false, type: null, user: null });

  // Load users in real-time
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToCollection('users', (data) => {
      setUsers(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const legacyUsers = users.filter(u => u.role && !VALID_ROLES.includes(u.role));

  const togglePasswordVisibility = (username: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [username]: !prev[username]
    }));
  };

  const handleCleanLegacyRoles = async () => {
    if (!isAdmin) return;
    try {
      setCleaningLegacy(true);
      setError('');
      setSuccess('');
      const updatedCount = await cleanupLegacyRoles('Checker');
      setSuccess(`সফলভাবে ${updatedCount} জন ইউজারের বাতিলকৃত রোল মুছে নতুন নিয়মে আপডেট করা হয়েছে।`);
    } catch (err: any) {
      setError(err.message || 'পুরাতন রোল ক্লিন করতে সমস্যা হয়েছে।');
    } finally {
      setCleaningLegacy(false);
    }
  };

  const handleEdit = (user: any) => {
    const isOwner = user.uid === profile?.uid;

    if (!isAdmin && !isOwner) {
      setError('আপনার অন্য কোনো ব্যবহারকারীর অ্যাকাউন্ট পরিবর্তন করার অনুমতি নেই।');
      return;
    }

    setEditingId(user.id);
    setFormName(user.displayName || '');
    setFormUsername(user.username || '');
    setFormPassword(user.password || '');
    setFormRole(VALID_ROLES.includes(user.role) ? user.role : 'Checker');
    setFormWarehouse(user.warehouse || assignedWarehouse || 'মোহাম্মদপুর');
    setFormAllPermissions(!!user.allPermissions);
    setFormPermissions(Array.isArray(user.permissions) ? user.permissions : []);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleDelete = (user: any) => {
    if (!isAdmin) {
      setError('ইউজার ডিলিট করার ক্ষমতা শুধুমাত্র অ্যাডমিনের আছে।');
      return;
    }

    if (user.uid === profile?.uid) {
      setError('আপনি নিজের সচল একাউন্টটি ডিলিট করতে পারবেন না!');
      return;
    }

    setConfirmModal({
      show: true,
      type: 'delete',
      user
    });
  };

  const executeDelete = async (user: any) => {
    try {
      setError('');
      setSuccess('');
      await deleteUserAccount(user.id);
      setSuccess('ইউজার একাউন্টটি সফলভাবে ডিলিট করা হয়েছে।');
    } catch (err: any) {
      setError(err.message || 'ইউজার ডিলিট করতে সমস্যা হয়েছে।');
    }
  };

  const handleToggleSuspension = (user: any) => {
    if (!isAdmin) {
      setError('ইউজার সাসপেন্ড করার ক্ষমতা শুধুমাত্র অ্যাডমিনের আছে।');
      return;
    }

    if (user.uid === profile?.uid) {
      setError('আপনি নিজেকে সাসপেন্ড করতে পারবেন না!');
      return;
    }

    setConfirmModal({
      show: true,
      type: user.isSuspended ? 'activate' : 'suspend',
      user
    });
  };

  const executeToggleSuspension = async (user: any) => {
    try {
      setError('');
      setSuccess('');
      await toggleUserSuspension(user.id, !user.isSuspended);
      setSuccess(`ইউজার একাউন্টটি সফলভাবে ${user.isSuspended ? 'সচল' : 'সাসপেন্ড'} করা হয়েছে।`);
    } catch (err: any) {
      setError(err.message || 'ইউজার সাসপেনশন পরিবর্তন করতে সমস্যা হয়েছে।');
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormUsername('');
    setFormPassword('');
    setFormRole('Checker');
    setFormWarehouse(assignedWarehouse || 'মোহাম্মদপুর');
    setFormAllPermissions(false);
    setFormPermissions([]);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleOpenPermissions = (user: any) => {
    if (!isAdmin) {
      setError('মডিউল পারমিশন নিয়ন্ত্রণ শুধুমাত্র অ্যাডমিন করতে পারবেন।');
      return;
    }
    setPermModalUser(user);
    setPermAllModules(!!user.allPermissions);
    setPermSelectedKeys(Array.isArray(user.permissions) ? user.permissions : []);
    setError('');
    setSuccess('');
  };

  const handleSavePermissions = async () => {
    if (!permModalUser) return;
    try {
      setSavingPerms(true);
      setError('');
      setSuccess('');
      await updateUserPermissions(permModalUser.id, permSelectedKeys, permAllModules);
      setSuccess(`"${permModalUser.displayName || permModalUser.username}" এর মডিউল পারমিশন সফলভাবে আপডেট করা হয়েছে।`);
      setPermModalUser(null);
    } catch (err: any) {
      setError(err.message || 'পারমিশন সংরক্ষণ করতে ব্যর্থ হয়েছে।');
    } finally {
      setSavingPerms(false);
    }
  };

  const handleToggleModulePerm = (key: string) => {
    if (permSelectedKeys.includes(key)) {
      setPermSelectedKeys(prev => prev.filter(k => k !== key));
    } else {
      setPermSelectedKeys(prev => [...prev, key]);
    }
  };

  const handleSelectAllPerms = () => {
    setPermAllModules(true);
    setPermSelectedKeys(SYSTEM_MODULES.map(m => m.key));
  };

  const handleClearAllPerms = () => {
    setPermAllModules(false);
    setPermSelectedKeys([]);
  };

  const handleResetRoleDefaults = () => {
    if (!permModalUser) return;
    const role = permModalUser.role as UserRole;
    const defaults = SYSTEM_MODULES.filter(m => m.defaultRoles.includes(role)).map(m => m.key);
    setPermAllModules(false);
    setPermSelectedKeys(defaults);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formName.trim() || !formUsername.trim() || !formPassword.trim()) {
      setError('অনুগ্রহ করে সকল ফিল্ড পূরণ করুন।');
      return;
    }

    if (formUsername.trim().includes(' ')) {
      setError('ইউজারনেমে কোনো স্পেস বা খালি জায়গা থাকা যাবে না।');
      return;
    }

    const editingUser = editingId ? users.find(u => u.id === editingId) : null;
    const isEditingSelf = editingUser ? editingUser.uid === profile?.uid : false;

    if (isEditingSelf && !isAdmin && formRole !== editingUser?.role) {
      setError('আপনি নিজের অ্যাকাউন্টের রোল পরিবর্তন করতে পারবেন না।');
      return;
    }

    // Auto assign creator's warehouse if creator is warehouse locked
    const finalWarehouse = isWarehouseLocked ? userWarehouse : (formWarehouse || 'মোহাম্মদপুর');

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (editingId) {
        // Updating existing user
        await updateUserAccount(editingId, {
          displayName: formName,
          password: formPassword,
          role: formRole,
          warehouse: finalWarehouse,
          permissions: formPermissions,
          allPermissions: formAllPermissions
        }, profile);
        setSuccess('ইউজার একাউন্টটি সফলভাবে সংশোধন করা হয়েছে।');
      } else {
        // Creating new user
        await createUserAccount(
          formName, 
          formUsername, 
          formPassword, 
          formRole,
          finalWarehouse,
          formPermissions, 
          formAllPermissions,
          profile
        );
        setSuccess(`নতুন ইউজার একাউন্ট (${finalWarehouse} ডিপো) সফলভাবে তৈরি করা হয়েছে।`);
      }
      
      setShowForm(false);
      setFormName('');
      setFormUsername('');
      setFormPassword('');
    } catch (err: any) {
      setError(err.message || 'অপারেশনটি সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setSaving(false);
    }
  };

  // Filter users list based on warehouse scoping, search and roles
  const filteredUsers = users.filter(user => {
    const isOwner = user.uid === profile?.uid;
    if (!isAdmin && !isOwner) {
      return false;
    }

    // If current logged in admin is warehouse-locked, only see users in own warehouse
    if (isWarehouseLocked && !isSuperAdmin) {
      const userWh = user.warehouse || 'মোহাম্মদপুর';
      if (userWh !== userWarehouse && !isOwner) {
        return false;
      }
    }

    // If Super Admin selects a specific depot filter
    if (!isWarehouseLocked && depotFilter !== 'all') {
      const userWh = user.warehouse || 'মোহাম্মদপুর';
      if (userWh !== depotFilter) {
        return false;
      }
    }

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (user.username || '').toLowerCase().includes(searchLower) ||
      (user.displayName || '').toLowerCase().includes(searchLower) ||
      (user.warehouse || '').toLowerCase().includes(searchLower) ||
      (user.role || '').toLowerCase().includes(searchLower);
    
    return matchesSearch;
  });

  const getRoleColorClass = (role?: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-red-50 text-red-700 border border-red-100';
      case 'Sub Admin':
        return 'bg-indigo-50 text-indigo-700 border border-indigo-100';
      case 'OCC':
        return 'bg-amber-50 text-amber-800 border border-amber-200';
      case 'Line Supervisor':
        return 'bg-sky-50 text-sky-700 border border-sky-100';
      case 'Checker':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      default:
        return 'bg-rose-50 text-rose-700 border border-rose-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="text-blue-600" />
            <span>ইউজার ও পারমিশন কন্ট্রোল (Users & Permissions)</span>
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {isWarehouseLocked ? (
              <span className="inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                <Building2 size={13} />
                <span>আপনার ডিপো: {userWarehouse} (এই ডিপোর স্টাফ ও ইউজার ম্যানেজমেন্ট)</span>
              </span>
            ) : isAdmin 
              ? 'ইউজার রোল নির্ধারণ এবং যেকোনো ইউজারকে নির্দিষ্ট বা সকল মডিউল চালানোর পারমিশন দিন।' 
              : 'আপনার প্রোফাইল তথ্য এবং পাসওয়ার্ড পরিবর্তন করুন।'}
          </p>
        </div>
        
        {isAdmin && (
          <div className="flex items-center gap-2.5">
            <Button onClick={handleOpenCreate} className="gap-2 shadow-xs">
              <UserPlus size={18} />
              <span>নতুন ইউজার যোগ করুন</span>
            </Button>
          </div>
        )}
      </div>

      {/* Legacy Roles Notice & Migration Banner */}
      {isAdmin && legacyUsers.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-bold text-sm text-amber-900">
                পুরাতন/বাতিলকৃত রোল পাওয়া গেছে ({legacyUsers.length} জন ইউজার)
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                নতুন নিয়মে শুধুমাত্র <strong>Sub Admin</strong>, <strong>OCC</strong>, <strong>Line Supervisor</strong> এবং <strong>Checker</strong> সক্রিয় রয়েছে।
                বাতিল হওয়া রোলগুলোকে স্বয়ংক্রিয়ভাবে ক্লিন ও আপডেট করতে বাটনে ক্লিক করুন।
              </p>
            </div>
          </div>
          <Button
            onClick={handleCleanLegacyRoles}
            disabled={cleaningLegacy}
            variant="secondary"
            className="text-xs py-2 px-3 bg-amber-600 text-white hover:bg-amber-700 border-none font-semibold flex-shrink-0"
          >
            {cleaningLegacy ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>ক্লিন করা হচ্ছে...</span>
              </>
            ) : (
              <span>পুরাতন রোলসমূহ ক্লিন করুন</span>
            )}
          </Button>
        </div>
      )}

      {/* Admin Protection Policy Note */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-800 flex items-center gap-2.5">
        <Lock size={16} className="text-blue-600 flex-shrink-0" />
        <span>
          <strong>নিরাপত্তা নীতি:</strong> অ্যাডমিন যেকোনো ইউজারকে যেকোনো মডিউল দেখার ও চালানোর সম্পূর্ণ ক্ষমতা দিতে পারবেন। তবে নতুন যানবাহন/স্টাফ/ডাটা অ্যাড করা বা যেকোনো কিছু ডিলিট করার একচ্ছত্র ক্ষমতা শুধুমাত্র অ্যাডমিনের কাছেই সংরক্ষিত থাকবে।
        </span>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2 animate-in fade-in">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex items-start gap-2 animate-in fade-in">
          <Check size={18} className="flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Form panel */}
        {showForm && (
          <div className="xl:col-span-1 animate-in slide-in-from-right duration-200">
            <Card title={editingId ? "ইউজার সংশোধন করুন" : "নতুন ইউজার তৈরি করুন"}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    পূর্ণ নাম (Full Name)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: মোঃ ইসমাইল হোসেন"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-sm text-slate-800 transition-all"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    ইউজারনেম (Username)
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingId}
                    placeholder="যেমন: ismail123"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-sm text-slate-800 transition-all disabled:opacity-65 disabled:bg-slate-100"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                  />
                  {!editingId && (
                    <p className="mt-1 text-xs text-slate-400">ছোট হাতের অক্ষরে কোনো স্পেস ছাড়া লিখুন। এটি দিয়ে লগইন করতে হবে।</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    পাসওয়ার্ড (Password)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="পাসওয়ার্ড লিখুন (যেমন: 123456)"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-sm text-slate-800 transition-all"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                  />
                </div>

                {/* Warehouse Assignment */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Building2 size={13} className="text-blue-600" />
                    <span>কর্মস্থল / ডিপো (Warehouse Hub)</span>
                  </label>
                  {isWarehouseLocked ? (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <div className="flex items-center gap-2 font-bold text-xs text-blue-900">
                        <Building2 size={14} className="text-blue-600" />
                        <span>{userWarehouse} (আপনার নির্ধারিত ডিপো)</span>
                      </div>
                      <p className="text-[11px] text-blue-700 mt-1">
                        যেহেতু আপনি {userWarehouse} ডিপোর এডমিন, নতুন একাউন্টটি স্বয়ংক্রিয়ভাবে আপনার ডিপোর স্টাফ হিসেবে যুক্ত হবে।
                      </p>
                    </div>
                  ) : (
                    <select
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-sm text-slate-800 transition-all"
                      value={formWarehouse}
                      onChange={(e) => setFormWarehouse(e.target.value)}
                    >
                      <option value="all">🌐 সকল ডিপো (Global / Head Office)</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.name}>🏢 {w.name} ({w.nameEn}) - {w.region}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    অ্যাকাউন্টের রোল (Account Role)
                  </label>
                  <select
                    disabled={!isAdmin}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-sm text-slate-800 transition-all disabled:opacity-65"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                  >
                    <option value="Admin">Admin (এডমিন - সর্বময় ক্ষমতা)</option>
                    <option value="Sub Admin">Sub Admin (সাব এডমিন)</option>
                    <option value="OCC">OCC (ওসিসি কন্ট্রোল)</option>
                    <option value="Line Supervisor">Line Supervisor (লাইন সুপারভাইজার)</option>
                    <option value="Checker">Checker (চেকার)</option>
                  </select>
                  {!isAdmin && (
                    <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                      <Info size={12} />
                      <span>আপনি রোল পরিবর্তন করতে পারবেন না। শুধুমাত্র অ্যাডমিন রোল নির্ধারণ করতে পারেন।</span>
                    </p>
                  )}
                </div>

                {isAdmin && formRole !== 'Admin' && (
                  <div className="pt-2 border-t border-slate-100">
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input 
                        type="checkbox" 
                        checked={formAllPermissions}
                        onChange={(e) => setFormAllPermissions(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <Sparkles size={14} className="text-amber-500" />
                        <span>সব মডিউল চালানোর ক্ষমতা দিন (Full Execution Power)</span>
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-500 leading-relaxed pl-6">
                      এটি চালু করলে এই ইউজার রোলের বাইরেও সব মডিউলে কাজ করতে পারবে। তবে ডিলিট বা নতুন কিছু যোগ করার অধিকার থাকবে না।
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-3 border-t border-slate-100">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="flex-1 justify-center"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>সংরক্ষণ হচ্ছে...</span>
                      </>
                    ) : (
                      <span>{editingId ? 'সংশোধন করুন' : 'তৈরি করুন'}</span>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowForm(false)}
                    disabled={saving}
                  >
                    <span>বাতিল</span>
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Users list panel */}
        <div className={showForm ? "xl:col-span-2" : "xl:col-span-3"}>
          <Card>
            {/* Search and filters bar */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center mb-6">
              <div className="flex items-center gap-2 w-full sm:max-w-md">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ইউজারনেম, নাম বা ডিপো দিয়ে খুঁজুন..."
                    className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-700"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setSearchQuery(e.target.value);
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                {/* Super Admin Depot Filter Selector */}
                {!isWarehouseLocked && (
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <Filter size={13} className="text-slate-500 ml-1.5" />
                    <select
                      className="bg-transparent text-xs font-bold text-slate-700 outline-none border-none py-1 pr-2"
                      value={depotFilter}
                      onChange={e => setDepotFilter(e.target.value)}
                    >
                      <option value="all">সকল ডিপো ({users.length})</option>
                      {warehouses.map(w => (
                        <option key={w.name} value={w.name}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
                  মোট: <span className="text-slate-800 font-bold">{filteredUsers.length}</span> জন
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
                <p className="text-sm text-slate-500">ইউজার তালিকা লোড করা হচ্ছে...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl">
                <Users className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                <h3 className="text-sm font-semibold text-slate-700">কোনো ইউজার পাওয়া যায়নি</h3>
                <p className="text-xs text-slate-400 mt-1">অন্য কোনো নাম দিয়ে সার্চ করে দেখুন বা নতুন ইউজার তৈরি করুন।</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">নাম (Name)</th>
                      <th className="py-3.5 px-4">ইউজারনেম (Username)</th>
                      <th className="py-3.5 px-4">ডিপো (Warehouse)</th>
                      <th className="py-3.5 px-4">পাসওয়ার্ড (Password)</th>
                      <th className="py-3.5 px-4">রোল (Role)</th>
                      <th className="py-3.5 px-4">পারমিশন অবস্থা (Access)</th>
                      <th className="py-3.5 px-4 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700 text-sm">
                    {filteredUsers.map((user) => {
                      const isOwner = user.uid === profile?.uid;
                      const canModify = isAdmin || isOwner;
                      const isLegacy = user.role && !VALID_ROLES.includes(user.role);
                      const whBadge = getWarehouseBadge(user.warehouse);

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/55 transition-colors group">
                          <td className="py-4 px-4 font-medium text-slate-900">
                            <div className="flex items-center gap-2">
                              <span className={user.isSuspended ? "line-through text-slate-400" : ""}>
                                {user.displayName || 'Unnamed User'}
                              </span>
                              {user.isSuspended && (
                                <span className="bg-red-50 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-100 flex items-center gap-0.5">
                                  <Ban size={10} />
                                  সাসপেন্ডেড
                                </span>
                              )}
                              {isOwner && (
                                <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-100">
                                  আপনি
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 font-mono text-xs text-slate-500">
                            {user.username || 'N/A'}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border ${whBadge.bg} ${whBadge.border} ${whBadge.textCol}`}>
                              <Building2 size={11} />
                              <span>{whBadge.text}</span>
                            </span>
                          </td>
                          <td className="py-4 px-4 font-mono text-xs text-slate-600">
                            <div className="flex items-center gap-2">
                              <span>
                                {(isAdmin || isOwner) && visiblePasswords[user.username] 
                                  ? (user.password || '••••••••') 
                                  : '••••••••'}
                              </span>
                              {(isAdmin || isOwner) && (
                                <button
                                  onClick={() => togglePasswordVisibility(user.username)}
                                  className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
                                  title={visiblePasswords[user.username] ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
                                >
                                  {visiblePasswords[user.username] ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${getRoleColorClass(user.role)}`}>
                                <Shield size={12} />
                                <span>{getRoleBangla(user.role)}</span>
                              </span>
                              {isLegacy && (
                                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                  বাতিলকৃত রোল
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            {user.role === 'Admin' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
                                <Sparkles size={12} className="text-red-500" />
                                <span>ফুল অ্যাডমিন</span>
                              </span>
                            ) : user.allPermissions ? (
                              <button
                                onClick={() => isAdmin && handleOpenPermissions(user)}
                                disabled={!isAdmin}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 ${isAdmin ? 'hover:bg-emerald-100 cursor-pointer' : ''}`}
                                title={isAdmin ? "পারমিশন পরিবর্তন করতে ক্লিক করুন" : ""}
                              >
                                <Sparkles size={12} className="text-emerald-600" />
                                <span>সব মডিউল সচল</span>
                              </button>
                            ) : Array.isArray(user.permissions) && user.permissions.length > 0 ? (
                              <button
                                onClick={() => isAdmin && handleOpenPermissions(user)}
                                disabled={!isAdmin}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 ${isAdmin ? 'hover:bg-blue-100 cursor-pointer' : ''}`}
                                title={isAdmin ? "পারমিশন পরিবর্তন করতে ক্লিক করুন" : ""}
                              >
                                <Key size={12} className="text-blue-500" />
                                <span>{user.permissions.length}টি মডিউল অনুমোদিত</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => isAdmin && handleOpenPermissions(user)}
                                disabled={!isAdmin}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 ${isAdmin ? 'hover:bg-slate-200 cursor-pointer' : ''}`}
                                title={isAdmin ? "পারমিশন দিতে ক্লিক করুন" : ""}
                              >
                                <span>ডিফল্ট রোল অ্যাক্সেস</span>
                              </button>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              {isAdmin && user.role !== 'Admin' && (
                                <button
                                  onClick={() => handleOpenPermissions(user)}
                                  className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                                  title="মডিউল পারমিশন ও কী কন্ট্রোল"
                                >
                                  <Key size={16} />
                                </button>
                              )}
                              <button
                                onClick={() => handleEdit(user)}
                                disabled={!canModify}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  canModify 
                                    ? 'hover:bg-blue-50 text-slate-400 hover:text-blue-600 cursor-pointer' 
                                    : 'opacity-40 cursor-not-allowed text-slate-300'
                                }`}
                                title={canModify ? "ইউজার তথ্য সংশোধন" : "সংশোধন করার অনুমতি নেই"}
                              >
                                <Edit3 size={16} />
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleToggleSuspension(user)}
                                  disabled={isOwner}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    isOwner 
                                      ? 'opacity-40 cursor-not-allowed text-slate-300' 
                                      : user.isSuspended
                                      ? 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 cursor-pointer'
                                      : 'hover:bg-amber-50 text-slate-400 hover:text-amber-600 cursor-pointer'
                                  }`}
                                  title={isOwner ? "নিজেকে সাসপেন্ড করা সম্ভব নয়" : user.isSuspended ? "একাউন্ট সচল করুন" : "একাউন্ট সাসপেন্ড করুন"}
                                >
                                  <Ban size={16} className={user.isSuspended ? "text-red-500" : ""} />
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => handleDelete(user)}
                                  disabled={isOwner}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    !isOwner
                                      ? 'hover:bg-red-50 text-slate-400 hover:text-red-600 cursor-pointer' 
                                      : 'opacity-40 cursor-not-allowed text-slate-300'
                                  }`}
                                  title={isOwner ? "নিজেকে ডিলিট করা সম্ভব নয়" : "ইউজার ডিলিট করুন"}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Permissions Modal */}
      {permModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">মডিউল পারমিশন ও এক্সেস কন্ট্রোল</h3>
                  <p className="text-xs text-slate-500">
                    ইউজার: <span className="font-semibold text-slate-800">{permModalUser.displayName || permModalUser.username}</span> | রোল: <span className="font-semibold text-blue-600">{getRoleBangla(permModalUser.role)}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setPermModalUser(null)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/50 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Full Access Toggle */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Sparkles className="text-amber-500 flex-shrink-0 mt-1" size={20} />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">সকল মডিউলে পূর্ণ এক্সেস (Full Module Access)</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      এটি চালু করলে এই ইউজার রোলের তোয়াক্কা না করে সিস্টেমের সকল মডিউল সরাসরি ব্যবহার করতে পারবেন।
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input 
                    type="checkbox" 
                    checked={permAllModules}
                    onChange={(e) => setPermAllModules(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">নির্দিষ্ট মডিউল পারমিশন নির্বাচন:</span>
                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={handleSelectAllPerms}
                    disabled={permAllModules}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 hover:bg-blue-50 rounded transition-colors disabled:opacity-40"
                  >
                    সবগুলো নির্বাচন করুন
                  </button>
                  <span className="text-slate-300">|</span>
                  <button 
                    type="button" 
                    onClick={handleClearAllPerms}
                    disabled={permAllModules}
                    className="text-xs text-slate-600 hover:text-slate-800 font-semibold px-2 py-1 hover:bg-slate-100 rounded transition-colors disabled:opacity-40"
                  >
                    সব মুছুন
                  </button>
                  <span className="text-slate-300">|</span>
                  <button 
                    type="button" 
                    onClick={handleResetRoleDefaults}
                    disabled={permAllModules}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold px-2 py-1 hover:bg-indigo-50 rounded transition-colors flex items-center gap-1 disabled:opacity-40"
                  >
                    <RotateCcw size={12} />
                    <span>রোলের ডিফল্ট রিসেট</span>
                  </button>
                </div>
              </div>

              {/* Modules Grid */}
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 transition-opacity ${permAllModules ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                {SYSTEM_MODULES.map((mod) => {
                  const isSelected = permSelectedKeys.includes(mod.key);
                  const isRoleDefault = mod.defaultRoles.includes(permModalUser.role as UserRole);

                  return (
                    <div 
                      key={mod.key}
                      onClick={() => !permAllModules && handleToggleModulePerm(mod.key)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3 ${
                        isSelected 
                          ? 'bg-blue-50/70 border-blue-200 shadow-2xs' 
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="mt-0.5">
                        {isSelected ? (
                          <CheckSquare size={18} className="text-blue-600" />
                        ) : (
                          <Square size={18} className="text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 justify-between">
                          <h5 className="text-xs font-bold text-slate-900 truncate">{mod.labelBn}</h5>
                          {isRoleDefault && (
                            <span className="text-[9px] bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.5 rounded flex-shrink-0">
                              রোলের ডিফল্ট
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{mod.descriptionBn}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPermModalUser(null)}
                disabled={savingPerms}
              >
                বাতিল
              </Button>
              <Button
                type="button"
                onClick={handleSavePermissions}
                disabled={savingPerms}
                className="gap-2"
              >
                {savingPerms ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>সংরক্ষণ হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>পারমিশন সংরক্ষণ করুন</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modals for Delete & Suspension */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${confirmModal.type === 'delete' ? 'bg-red-50 text-red-600' : confirmModal.type === 'suspend' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {confirmModal.type === 'delete' ? <Trash2 size={20} /> : confirmModal.type === 'suspend' ? <Ban size={20} /> : <Check size={20} />}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {confirmModal.type === 'delete' && 'ইউজার অ্যাকাউন্ট ডিলিট নিশ্চিতকরণ'}
                  {confirmModal.type === 'suspend' && 'ইউজার অ্যাকাউন্ট সাসপেন্ড নিশ্চিতকরণ'}
                  {confirmModal.type === 'activate' && 'ইউজার অ্যাকাউন্ট সচল নিশ্চিতকরণ'}
                </h3>
                <p className="text-xs text-slate-500">ইউজার: {confirmModal.user?.displayName || confirmModal.user?.username}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {confirmModal.type === 'delete' && 'আপনি কি নিশ্চিত যে এই অ্যাকাউন্টটি স্থায়ীভাবে মুছে ফেলতে চান? এই অ্যাকশনটি ফিরিয়ে আনা সম্ভব নয়।'}
              {confirmModal.type === 'suspend' && 'অ্যাকাউন্টটি সাসপেন্ড করলে সংশ্লিষ্ট ব্যবহারকারী সিস্টেমে লগইন করতে পারবেন না।'}
              {confirmModal.type === 'activate' && 'অ্যাকাউন্টটি পুনরায় সচল করলে সংশ্লিষ্ট ব্যবহারকারী নিয়মিত লগইন ও কাজ করতে পারবেন।'}
            </p>

            <div className="flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setConfirmModal({ show: false, type: null, user: null })}
              >
                বাতিল
              </Button>
              <Button
                variant={confirmModal.type === 'delete' ? 'danger' : 'primary'}
                onClick={async () => {
                  const { type, user } = confirmModal;
                  setConfirmModal({ show: false, type: null, user: null });
                  if (type === 'delete') {
                    await executeDelete(user);
                  } else if (type === 'suspend' || type === 'activate') {
                    await executeToggleSuspension(user);
                  }
                }}
              >
                {confirmModal.type === 'delete' && 'হ্যাঁ, ডিলিট করুন'}
                {confirmModal.type === 'suspend' && 'হ্যাঁ, সাসপেন্ড করুন'}
                {confirmModal.type === 'activate' && 'হ্যাঁ, সচল করুন'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManagement;
