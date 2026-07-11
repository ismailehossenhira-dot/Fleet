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
  Ban
} from 'lucide-react';
import { Card, Button } from './components/Common';
import { useAuth, UserRole } from './AuthContext';
import { useSearch } from './SearchContext';
import { 
  subscribeToCollection, 
  createUserAccount, 
  updateUserAccount, 
  deleteUserAccount,
  toggleUserSuspension
} from './db';

const UsersManagement: React.FC = () => {
  const { profile, isAdmin, isSubAdmin, isSuperAdmin } = useAuth();
  const { searchQuery, setSearchQuery } = useSearch();
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

  const togglePasswordVisibility = (username: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [username]: !prev[username]
    }));
  };

  const handleEdit = (user: any) => {
    // Check permission to edit this user
    if (isSubAdmin && user.role !== 'Sub Admin') {
      setError('সাব-এডমিন শুধুমাত্র অন্য সাব-এডমিন একাউন্ট সংশোধন করতে পারবেন।');
      return;
    }

    setEditingId(user.id);
    setFormName(user.displayName || '');
    setFormUsername(user.username || '');
    setFormPassword(user.password || '');
    setFormRole(user.role || 'Checker');
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleDelete = (user: any) => {
    if (!isSuperAdmin) {
      setError('ইউজার ডিলিট করার ক্ষমতা শুধুমাত্র সুপার এডমিনের আছে।');
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
    if (!isSuperAdmin) {
      setError('ইউজার সাসপেন্ড করার ক্ষমতা শুধুমাত্র সুপার এডমিনের আছে।');
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
    // Default role: Sub Admin if isSubAdmin, else Checker
    setFormRole(isSubAdmin ? 'Sub Admin' : 'Checker');
    setShowForm(true);
    setError('');
    setSuccess('');
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

    // Role safety validation
    if (isSubAdmin && formRole !== 'Sub Admin') {
      setError('সাব-এডমিন শুধুমাত্র "Sub Admin" রোল সম্পন্ন ইউজার তৈরি বা পরিবর্তন করতে পারবেন।');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (editingId) {
        // Updating existing user
        await updateUserAccount(editingId, {
          displayName: formName,
          password: formPassword,
          role: formRole
        });
        setSuccess('ইউজার একাউন্টটি সফলভাবে সংশোধন করা হয়েছে।');
      } else {
        // Creating new user
        await createUserAccount(formName, formUsername, formPassword, formRole);
        setSuccess('নতুন ইউজার একাউন্ট সফলভাবে তৈরি করা হয়েছে।');
      }
      
      // Reset form on success
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

  // Filter users list based on search and roles visibility
  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (user.username || '').toLowerCase().includes(searchLower) ||
      (user.displayName || '').toLowerCase().includes(searchLower);
    
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="text-blue-600" />
            <span>ইউজার ম্যানেজমেন্ট (User Accounts)</span>
          </h2>
          <p className="text-slate-500">
            {isAdmin 
              ? 'সকল সিস্টেম ব্যবহারকারীদের একাউন্ট তৈরি ও পাসওয়ার্ড পরিবর্তন করুন।' 
              : 'সাব-এডমিন একাউন্ট তৈরি ও পরিচালনা করুন।'}
          </p>
        </div>
        
        <Button onClick={handleOpenCreate} className="gap-2">
          <UserPlus size={18} />
          <span>নতুন ইউজার যোগ করুন</span>
        </Button>
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    অ্যাকাউন্টের রোল (Account Role)
                  </label>
                  <select
                    disabled={isSubAdmin}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-sm text-slate-800 transition-all"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                  >
                    {isSubAdmin ? (
                      <option value="Sub Admin">Sub Admin (সাব এডমিন)</option>
                    ) : (
                      <>
                        <option value="Admin">Admin (এডমিন)</option>
                        <option value="Sub Admin">Sub Admin (সাব এডমিন)</option>
                        <option value="Line Supervisor">Line Supervisor (লাইন সুপারভাইজার)</option>
                        <option value="Checker">Checker (চেকার)</option>
                      </>
                    )}
                  </select>
                  {isSubAdmin && (
                    <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                      <Info size={12} />
                      <span>সাব-এডমিন শুধুমাত্র সাব-এডমিন রোল নির্বাচন করতে পারেন।</span>
                    </p>
                  )}
                </div>

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
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ইউজারনেম বা নাম দিয়ে খুঁজুন..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-700"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSearchQuery(e.target.value);
                  }}
                />
              </div>
              <div className="text-xs text-slate-500 font-medium">
                মোট ইউজার: <span className="text-slate-800 font-bold">{filteredUsers.length}</span> জন
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
                      <th className="py-3.5 px-4">পাসওয়ার্ড (Password)</th>
                      <th className="py-3.5 px-4">রোল (Role)</th>
                      <th className="py-3.5 px-4 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700 text-sm">
                    {filteredUsers.map((user) => {
                      const isOwner = user.uid === profile?.uid;
                      const isSubAdminTarget = user.role === 'Sub Admin';
                      const canModify = isAdmin || (isSubAdmin && isSubAdminTarget);

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
                          <td className="py-4 px-4 font-mono text-xs text-slate-600">
                            <div className="flex items-center gap-2">
                              <span>
                                {visiblePasswords[user.username] 
                                  ? (user.password || '••••••••') 
                                  : '••••••••'}
                              </span>
                              <button
                                onClick={() => togglePasswordVisibility(user.username)}
                                className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-400 hover:text-slate-600"
                                title={visiblePasswords[user.username] ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
                              >
                                {visiblePasswords[user.username] ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              user.role === 'Admin' 
                                ? 'bg-red-50 text-red-700 border border-red-100'
                                : user.role === 'Sub Admin'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                : user.role === 'Line Supervisor'
                                ? 'bg-sky-50 text-sky-700 border border-sky-100'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}>
                              <Shield size={12} />
                              <span>{user.role || 'Checker'}</span>
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEdit(user)}
                                disabled={!canModify}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  canModify 
                                    ? 'hover:bg-blue-50 text-slate-400 hover:text-blue-600' 
                                    : 'opacity-40 cursor-not-allowed text-slate-300'
                                }`}
                                title={canModify ? "ইউজার তথ্য সংশোধন" : "সংশোধন করার অনুমতি নেই"}
                              >
                                <Edit3 size={16} />
                              </button>
                              {isSuperAdmin && (
                                <button
                                  onClick={() => handleToggleSuspension(user)}
                                  disabled={isOwner}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    isOwner 
                                      ? 'opacity-40 cursor-not-allowed text-slate-300' 
                                      : user.isSuspended
                                      ? 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'
                                      : 'hover:bg-amber-50 text-slate-400 hover:text-amber-600'
                                  }`}
                                  title={isOwner ? "নিজেকে সাসপেন্ড করা সম্ভব নয়" : user.isSuspended ? "একাউন্ট সচল করুন" : "একাউন্ট সাসপেন্ড করুন"}
                                >
                                  <Ban size={16} className={user.isSuspended ? "text-red-500" : ""} />
                                </button>
                              )}
                              {isSuperAdmin && (
                                <button
                                  onClick={() => handleDelete(user)}
                                  disabled={isOwner}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    !isOwner
                                      ? 'hover:bg-red-50 text-slate-400 hover:text-red-600' 
                                      : 'opacity-40 cursor-not-allowed text-slate-300'
                                  }`}
                                  title={isOwner ? "নিজের একাউন্ট ডিলিট করা সম্ভব নয়" : "ইউজার ডিলিট করুন"}
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

      {/* Custom Confirmation Modal */}
      {confirmModal.show && confirmModal.user && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-center gap-3 text-amber-600 mb-4">
                <div className={`p-2 rounded-xl ${confirmModal.type === 'delete' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                  {confirmModal.type === 'delete' ? <Trash2 size={24} /> : <Ban size={24} />}
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {confirmModal.type === 'delete' 
                    ? 'ইউজার মুছে ফেলার নিশ্চিতকরণ' 
                    : confirmModal.type === 'suspend'
                    ? 'ইউজার সাসপেন্ড নিশ্চিতকরণ'
                    : 'ইউজার সচল করার নিশ্চিতকরণ'}
                </h3>
              </div>
              
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                {confirmModal.type === 'delete' ? (
                  <>আপনি কি নিশ্চিতভাবে <strong>{confirmModal.user.displayName || confirmModal.user.username}</strong> ইউজারটি মুছে ফেলতে চান? এই অ্যাকশনটি আর পরিবর্তন করা যাবে না।</>
                ) : confirmModal.type === 'suspend' ? (
                  <>আপনি কি নিশ্চিতভাবে <strong>{confirmModal.user.displayName || confirmModal.user.username}</strong> ইউজারটিকে সাসপেন্ড করতে চান? সাসপেন্ড করা ইউজাররা সিস্টেমে লগইন করতে পারবেন না।</>
                ) : (
                  <>আপনি কি নিশ্চিতভাবে <strong>{confirmModal.user.displayName || confirmModal.user.username}</strong> ইউজারটিকে পুনরায় সচল (Active) করতে চান?</>
                )}
              </p>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmModal({ show: false, type: null, user: null })}
                  className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const u = confirmModal.user;
                    const t = confirmModal.type;
                    setConfirmModal({ show: false, type: null, user: null });
                    if (t === 'delete') {
                      await executeDelete(u);
                    } else {
                      await executeToggleSuspension(u);
                    }
                  }}
                  className={`px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors cursor-pointer ${
                    confirmModal.type === 'delete' 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : confirmModal.type === 'suspend'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {confirmModal.type === 'delete' 
                    ? 'হ্যাঁ, ডিলিট করুন' 
                    : confirmModal.type === 'suspend'
                    ? 'হ্যাঁ, সাসপেন্ড করুন'
                    : 'হ্যাঁ, সচল করুন'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManagement;
