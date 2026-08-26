import React, { useState, useMemo } from 'react';
import { 
  Truck, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  ShieldAlert, 
  Layers, 
  Weight, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../AuthContext';
import { 
  addVehicleModel, 
  updateVehicleModel, 
  deleteVehicleModel, 
  VehicleModelRecord 
} from '../db';
import { VEHICLE_TYPES, cn } from '../lib/utils';

interface VehicleModelManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  customModels: VehicleModelRecord[];
  vehicles: any[];
  onModelSelected?: (modelName: string) => void;
}

const PRESET_CATEGORIES = [
  'Pickup (পিকআপ)',
  'Mini Truck (মিনি ট্রাক)',
  'Medium Covered Van (মাঝারি কাভার্ড ভ্যান)',
  'Heavy Open Truck (ভারী উন্মুক্ত ট্রাক)',
  'Trailer / Long Vehicle (ট্রেইলার)',
  'Freezer Van (হিমায়িত ভ্যান)',
  'Electric Truck / EV (ইলেকট্রিক যান)',
  'Other / Specialized (অন্যান্য)'
];

const PRESET_CAPACITIES = [
  '1.0 Ton',
  '1.5 Ton',
  '2.0 Ton',
  '3.0 Ton',
  '3.5 Ton',
  '5.0 Ton',
  '7.5 Ton',
  '10 Ton',
  '15 Ton',
  '20+ Ton'
];

export const VehicleModelManagementModal: React.FC<VehicleModelManagementModalProps> = ({
  isOpen,
  onClose,
  customModels,
  vehicles,
  onModelSelected
}) => {
  const { isAdmin, isSuperAdmin, profile } = useAuth();
  const canManage = isAdmin || isSuperAdmin;

  // Tabs / views: 'list' | 'add'
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');

  // New model form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState(PRESET_CATEGORIES[0]);
  const [capacity, setCapacity] = useState('1.5 Ton');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Edit model state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [editCapacity, setEditCapacity] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Search in model list
  const [searchQuery, setSearchQuery] = useState('');

  // Combine default and custom models
  const allModels = useMemo(() => {
    const defaultList = VEHICLE_TYPES.map(t => {
      const existingCustom = customModels.find(m => m.name.toLowerCase() === t.toLowerCase());
      const count = vehicles.filter(v => v.type === t).length;
      return {
        id: existingCustom?.id || `default-${t}`,
        name: t,
        category: existingCustom?.category || 'Standard Fleet',
        capacity: existingCustom?.capacity || 'Standard',
        description: existingCustom?.description || 'সিস্টেমের ডিফল্ট নিবন্ধিত মডেল',
        isDefault: true,
        vehicleCount: count,
        customRecord: existingCustom
      };
    });

    const nonDefaultCustomList = customModels
      .filter(m => !VEHICLE_TYPES.some(t => t.toLowerCase() === m.name.toLowerCase()))
      .map(m => {
        const count = vehicles.filter(v => v.type === m.name).length;
        return {
          id: m.id || m.name,
          name: m.name,
          category: m.category || 'General Truck',
          capacity: m.capacity || 'Custom',
          description: m.description || '',
          isDefault: false,
          vehicleCount: count,
          customRecord: m
        };
      });

    return [...defaultList, ...nonDefaultCustomList];
  }, [customModels, vehicles]);

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return allModels;
    const q = searchQuery.toLowerCase();
    return allModels.filter(m => 
      m.name.toLowerCase().includes(q) || 
      m.category.toLowerCase().includes(q) ||
      m.capacity.toLowerCase().includes(q)
    );
  }, [allModels, searchQuery]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!canManage) {
      setFormError('শুধুমাত্র অ্যাডমিনরা নতুন মডেল সংযুক্ত করতে পারেন। (Only Admins can add vehicle models)');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('দয়া করে গাড়ির মডেলের নাম প্রদান করুন।');
      return;
    }

    // Check duplicate name
    const exists = allModels.some(m => m.name.toLowerCase() === trimmedName.toLowerCase());
    if (exists) {
      setFormError(`"${trimmedName}" মডেলটি ইতোমধ্যে ফ্লিট সিস্টেমে বিদ্যমান রয়েছে।`);
      return;
    }

    try {
      setIsSubmitting(true);
      await addVehicleModel({
        name: trimmedName,
        category,
        capacity,
        description
      }, profile);

      setFormSuccess(`"${trimmedName}" মডেলটি সফলভাবে সিস্টেমে সংযুক্ত হয়েছে!`);
      if (onModelSelected) {
        onModelSelected(trimmedName);
      }

      // Reset form
      setName('');
      setDescription('');
      setTimeout(() => {
        setFormSuccess(null);
        setActiveTab('list');
      }, 1200);
    } catch (err: any) {
      console.error('Error adding vehicle model:', err);
      setFormError(err.message || 'মডেল সংরক্ষণে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (model: any) => {
    if (!model.customRecord?.id) return;
    setEditingId(model.customRecord.id);
    setEditCategory(model.customRecord.category || PRESET_CATEGORIES[0]);
    setEditCapacity(model.customRecord.capacity || '1.5 Ton');
    setEditDescription(model.customRecord.description || '');
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateVehicleModel(id, {
        category: editCategory,
        capacity: editCapacity,
        description: editDescription
      }, profile);
      setEditingId(null);
    } catch (err: any) {
      console.error('Error updating vehicle model:', err);
      alert('মডেল আপডেট ব্যর্থ হয়েছে: ' + err.message);
    }
  };

  const handleDeleteCustom = async (id: string, modelName: string, vehicleCount: number) => {
    if (vehicleCount > 0) {
      const confirmDelete = window.confirm(
        `সতর্কবার্তা: "${modelName}" মডেলের অধীনে বর্তমানে ${vehicleCount}টি গাড়ি নিবন্ধিত রয়েছে। আপনি কি নিশ্চিত যে এটি মুছতে চান?`
      );
      if (!confirmDelete) return;
    }

    try {
      await deleteVehicleModel(id);
      setDeletingId(null);
    } catch (err: any) {
      console.error('Error deleting vehicle model:', err);
      alert('মডেল মুছে ফেলতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl md:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold shadow-xs">
              <Truck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 text-base md:text-lg">
                  গাড়ির মডেল ম্যানেজমেন্ট (Vehicle Models)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 inline-flex items-center gap-1">
                  <ShieldAlert size={11} />
                  <span>Admin Only</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ফ্লিটের জন্য নতুন মডেল তৈরি, ক্যাটাগরি ও টনেজ কনফিগার করুন
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors font-bold text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Admin Check Warning Banner if non-admin */}
        {!canManage && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center gap-2 text-xs text-amber-800 font-medium">
            <Info size={16} className="shrink-0 text-amber-600" />
            <span>
              অনুমতি সতর্কতা: নতুন গাড়ির মডেল তৈরি বা এডিট করার ক্ষমতা শুধুমাত্র অনুমোদিত অ্যাডমিন (Admin / Super Admin) একাউন্টে সংরক্ষিত।
            </span>
          </div>
        )}

        {/* Nav Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-5 sm:px-6 gap-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={cn(
              "px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer border-b-2",
              activeTab === 'list'
                ? "bg-white text-blue-600 border-blue-600 shadow-2xs"
                : "text-slate-500 hover:text-slate-900 border-transparent"
            )}
          >
            <Layers size={14} />
            <span>সকল মডেল তালিকা ({allModels.length})</span>
          </button>

          {canManage && (
            <button
              type="button"
              onClick={() => setActiveTab('add')}
              className={cn(
                "px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer border-b-2",
                activeTab === 'add'
                  ? "bg-white text-blue-600 border-blue-600 shadow-2xs"
                  : "text-slate-500 hover:text-slate-900 border-transparent"
              )}
            >
              <Plus size={14} />
              <span>+ নতুন মডেল সংযুক্ত করুন</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-5 sm:p-6 flex-1 space-y-4">
          {activeTab === 'add' && canManage ? (
            <form onSubmit={handleAddSubmit} className="space-y-4 max-w-lg mx-auto">
              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-2.5">
                <Sparkles size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 space-y-0.5">
                  <p className="font-bold">অ্যাডমিন হিসেবে নতুন মডেল যোগ করুন</p>
                  <p className="text-blue-700">
                    এখানে যে মডেল যুক্ত করবেন তা তাৎক্ষণিকভাবে ফ্লিটের গাড়ি এন্ট্রি ড্রপডাউন, ফিল্টারিং এবং ড্যাশবোর্ড অ্যানালিটিক্সে উপলব্ধ হবে।
                  </p>
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  মডেলের নাম (Vehicle Model Name) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: Ashok Leyland 1616, Mahindra Bolero, Tata Ace"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    বডি / ক্যাটাগরি (Body Type)
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-xs text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {PRESET_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    ধারণ ক্ষমতা / টনেজ (Capacity)
                  </label>
                  <select
                    value={capacity}
                    onChange={e => setCapacity(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-xs text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {PRESET_CAPACITIES.map(cap => (
                      <option key={cap} value={cap}>{cap}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  বিবরণ / স্পেসিফিকেশন (ঐচ্ছিক)
                </label>
                <textarea
                  rows={2}
                  placeholder="গাড়ির ইঞ্জিন সাইজ, ব্যবহারের ধরন বা বিশেষ তথ্য..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs text-slate-700"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md shadow-blue-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus size={16} />
                  <span>{isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'মডেল সংরক্ষণ করুন (Save Model)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-3 border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  বাতিল
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {/* Search bar & Add Button */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <input
                    type="text"
                    placeholder="মডেল খুঁজুন..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-slate-50/50"
                  />
                  <Layers size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {canManage && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('add')}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Plus size={14} />
                    <span>নতুন মডেল যুক্ত করুন</span>
                  </button>
                )}
              </div>

              {/* Models List */}
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-white">
                {filteredModels.map(model => {
                  const isEditing = editingId === model.customRecord?.id;

                  return (
                    <div key={model.id} className="p-3.5 sm:p-4 hover:bg-slate-50/70 transition-colors">
                      {isEditing ? (
                        <div className="space-y-3 bg-blue-50/40 p-3.5 rounded-xl border border-blue-200">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-blue-900">
                              মডেল এডিট: {model.name}
                            </span>
                            <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-bold">
                              Custom Model
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 block mb-1">ক্যাটাগরি</label>
                              <select
                                value={editCategory}
                                onChange={e => setEditCategory(e.target.value)}
                                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                              >
                                {PRESET_CATEGORIES.map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 block mb-1">ধারণ ক্ষমতা</label>
                              <select
                                value={editCapacity}
                                onChange={e => setEditCapacity(e.target.value)}
                                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                              >
                                {PRESET_CAPACITIES.map(cap => (
                                  <option key={cap} value={cap}>{cap}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">বিবরণ</label>
                            <input
                              type="text"
                              value={editDescription}
                              onChange={e => setEditDescription(e.target.value)}
                              className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                              placeholder="বিবরণ..."
                            />
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(model.customRecord.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Check size={12} />
                              <span>সংরক্ষণ</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                            >
                              বাতিল
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-slate-900">
                                {model.name}
                              </h4>
                              {model.isDefault ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  Default
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                  Custom Admin Model
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Truck size={12} className="text-slate-400" />
                                <span>{model.category}</span>
                              </span>
                              {model.capacity && (
                                <span className="flex items-center gap-1">
                                  <Weight size={12} className="text-slate-400" />
                                  <span>{model.capacity}</span>
                                </span>
                              )}
                              {model.description && (
                                <span className="text-slate-400 italic truncate max-w-xs">
                                  • {model.description}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <span className={cn(
                              "px-2.5 py-1 rounded-lg text-xs font-mono font-bold",
                              model.vehicleCount > 0 
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200/70"
                                : "bg-slate-100 text-slate-500"
                            )}>
                              {model.vehicleCount} গাড়ি নিবন্ধিত
                            </span>

                            {canManage && !model.isDefault && model.customRecord?.id && (
                              <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                                <button
                                  type="button"
                                  title="মডেল এডিট করুন"
                                  onClick={() => handleStartEdit(model)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button
                                  type="button"
                                  title="মডেল মুছুন"
                                  onClick={() => handleDeleteCustom(model.customRecord.id, model.name, model.vehicleCount)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredModels.length === 0 && (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <Truck size={32} className="mx-auto text-slate-300" />
                    <p className="text-xs font-medium">কোনো মডেল পাওয়া যায়নি।</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>মোট মডেল সংখ্যা: <strong>{allModels.length}</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg transition-colors cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
