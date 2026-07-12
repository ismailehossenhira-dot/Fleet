import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { 
  addRequest, 
  updateRequest, 
  deleteRequest, 
  subscribeToCollection 
} from './db';
import { Card, Button } from './components/Common';
import { 
  PlusCircle, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Search, 
  MapPin, 
  Truck, 
  AlertCircle, 
  FileText,
  Loader2,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const Requests: React.FC = () => {
  const { isAdmin, isSubAdmin, isLineSupervisor, profile } = useAuth();
  const canManage = isAdmin || isSubAdmin || isLineSupervisor;

  // Real-time requests collection state
  const [requests, setRequests] = useState<any[]>([]);

  // Local UI State
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'Fulfilled' | 'Rejected'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    zone: '',
    type: 'Small',
    quantity: 1,
    notes: ''
  });

  // Notes Local States
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [newNoteTexts, setNewNoteTexts] = useState<Record<string, string>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Custom Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'success' | 'info';
  }>({ show: false, title: '', message: '', onConfirm: () => {} });

  // Common Zones for dropdown
  const commonZones = [
    'Zone A (জোন এ)',
    'Zone B (জোন বি)',
    'Zone C (জোন সি)',
    'Zone D (জোন ডি)',
    'Dhaka (ঢাকা)',
    'Chittagong (চট্টগ্রাম)',
    'Gazipur (গাজীপুর)',
    'Narayanganj (নারায়ণগঞ্জ)'
  ];

  // Subscribe to requests collection
  useEffect(() => {
    const unsubRequests = subscribeToCollection('requests', setRequests);
    return () => {
      unsubRequests();
    };
  }, []);

  // Toggle notes collapse
  const toggleNotes = (requestId: string) => {
    setExpandedNotes(prev => ({ ...prev, [requestId]: !prev[requestId] }));
  };

  // Handle Request Submission
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.zone.trim()) {
      setError('দয়া করে জোন বা স্থান নির্বাচন/লিখুন।');
      return;
    }
    if (formData.quantity < 1) {
      setError('গাড়ির সংখ্যা অবশ্যই ১ বা তার বেশি হতে হবে।');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const initialNotesList = [];
      if (formData.notes.trim()) {
        initialNotesList.push({
          id: Math.random().toString(36).substring(2, 9),
          text: formData.notes.trim(),
          createdBy: profile?.displayName || profile?.username || profile?.email || 'User',
          createdByUid: profile?.uid || 'unknown',
          createdAt: new Date().toISOString()
        });
      }

      await addRequest({
        zone: formData.zone.trim(),
        type: formData.type,
        quantity: Number(formData.quantity),
        notes: formData.notes.trim(),
        notesList: initialNotesList
      }, profile);
      
      setFormData({
        zone: '',
        type: 'Small',
        quantity: 1,
        notes: ''
      });
      setShowCreateForm(false);
      setSuccess('গাড়ির চাহিদাপত্র সফলভাবে সাবমিট করা হয়েছে।');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'চাহিদাপত্র সাবমিট করতে ব্যর্থ হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  // Update Status directly (Fulfill / Reject)
  const handleUpdateStatus = (requestId: string, newStatus: 'Fulfilled' | 'Rejected') => {
    const title = newStatus === 'Fulfilled' ? 'চাহিদা পূরণ নিশ্চিত করুন' : 'চাহিদা প্রত্যাখ্যান নিশ্চিত করুন';
    const message = newStatus === 'Fulfilled' 
      ? 'আপনি কি নিশ্চিত যে এই চাহিদাটি পূরণ (Fulfilled) হিসেবে চিহ্নিত করতে চান?' 
      : 'আপনি কি নিশ্চিত যে এই চাহিদাটি প্রত্যাখ্যান (Rejected) করতে চান?';
      
    setConfirmModal({
      show: true,
      title,
      message,
      confirmText: newStatus === 'Fulfilled' ? 'হ্যাঁ, পূরণ করুন' : 'হ্যাঁ, প্রত্যাখ্যান করুন',
      variant: newStatus === 'Fulfilled' ? 'success' : 'danger',
      onConfirm: async () => {
        try {
          await updateRequest(requestId, { status: newStatus }, profile);
          setSuccess(`চাহিদাটি সফলভাবে ${newStatus === 'Fulfilled' ? 'পূরণ' : 'প্রত্যাখ্যান'} করা হয়েছে।`);
          setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
          setError('অবস্থা পরিবর্তন করতে ব্যর্থ হয়েছে।');
        }
      }
    });
  };

  // Delete Request
  const handleDeleteRequest = (requestId: string) => {
    setConfirmModal({
      show: true,
      title: 'চাহিদা রেকর্ড মুছে ফেলা',
      message: 'আপনি কি চাহিদা রেকর্ডটি চিরতরে মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।',
      confirmText: 'হ্যাঁ, মুছে ফেলুন',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteRequest(requestId);
          setSuccess('চাহিদা রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে।');
          setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
          setError('মুছে ফেলতে ব্যর্থ হয়েছে।');
        }
      }
    });
  };

  // Add Comment/Note
  const handleAddNote = async (requestId: string, currentNotesList: any[], text: string) => {
    if (!text.trim()) return;
    const newNote = {
      id: Math.random().toString(36).substring(2, 9),
      text: text.trim(),
      createdBy: profile?.displayName || profile?.username || profile?.email || 'User',
      createdByUid: profile?.uid || 'unknown',
      createdAt: new Date().toISOString()
    };
    const updatedList = [...(currentNotesList || []), newNote];
    try {
      await updateRequest(requestId, { notesList: updatedList }, profile);
      setSuccess('মন্তব্য যোগ করা হয়েছে।');
      setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      setError('মন্তব্য যোগ করতে ব্যর্থ হয়েছে।');
    }
  };

  // Edit Comment/Note
  const handleEditNote = async (requestId: string, currentNotesList: any[], noteId: string, newText: string) => {
    if (!newText.trim()) return;
    const updatedList = (currentNotesList || []).map(note => {
      if (note.id === noteId) {
        return { ...note, text: newText.trim(), updatedAt: new Date().toISOString() };
      }
      return note;
    });
    try {
      await updateRequest(requestId, { notesList: updatedList }, profile);
      setSuccess('মন্তব্যটি সফলভাবে আপডেট করা হয়েছে।');
      setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      setError('মন্তব্যটি আপডেট করতে ব্যর্থ হয়েছে।');
    }
  };

  // Delete Comment/Note
  const handleDeleteNote = async (requestId: string, currentNotesList: any[], noteId: string) => {
    const updatedList = (currentNotesList || []).filter(note => note.id !== noteId);
    try {
      await updateRequest(requestId, { notesList: updatedList }, profile);
      setSuccess('মন্তব্যটি মুছে ফেলা হয়েছে।');
      setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      setError('মন্তব্যটি মুছতে ব্যর্থ হয়েছে।');
    }
  };

  // Filter & Search Requests
  const filteredRequests = requests.filter(req => {
    // Tab Filter
    if (activeTab === 'Pending' && req.status !== 'Pending') return false;
    if (activeTab === 'Fulfilled' && req.status !== 'Fulfilled') return false;
    if (activeTab === 'Rejected' && req.status !== 'Rejected') return false;

    // Search Filter
    const query = searchQuery.toLowerCase();
    return (
      req.zone.toLowerCase().includes(query) ||
      (req.createdBy && req.createdBy.toLowerCase().includes(query)) ||
      (req.notes && req.notes.toLowerCase().includes(query)) ||
      req.type.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <Clock size={12} />
            পেন্ডিং (Pending)
          </span>
        );
      case 'Fulfilled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle size={12} />
            পূরণকৃত (Fulfilled)
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            <XCircle size={12} />
            বাতিল (Rejected)
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">গাড়ির চাহিদা তালিকা (Requests)</h2>
          <p className="text-sm text-slate-500 mt-1">জোন থেকে গাড়ির রিকুইজিশন তৈরি ও মনিটর করুন</p>
        </div>
        <Button 
          variant={showCreateForm ? 'secondary' : 'primary'} 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 h-11 px-5"
        >
          {showCreateForm ? 'চাহিদা তালিকা দেখুন' : 'নতুন চাহিদা তৈরি করুন'}
          {!showCreateForm && <PlusCircle size={16} />}
        </Button>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm flex items-center gap-2 animate-in fade-in">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Create Request Form */}
      {showCreateForm && (
        <Card title="গাড়ির চাহিদা রিকুইজিশন ফর্ম (New Vehicle Request)" className="max-w-2xl mx-auto">
          <form onSubmit={handleCreateRequest} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                জোন বা স্থান (Zone / Area) <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-accent focus:bg-white transition-all"
                  value={formData.zone}
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                >
                  <option value="">জোন নির্বাচন করুন...</option>
                  {commonZones.map(z => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                  <option value="other">অন্যান্য (নিচে লিখুন)...</option>
                </select>
                
                <input
                  type="text"
                  placeholder="অন্য জোনের নাম লিখুন..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-accent focus:bg-white transition-all"
                  value={formData.zone === 'other' || (!commonZones.includes(formData.zone) && formData.zone !== '') ? formData.zone : ''}
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  disabled={formData.zone !== 'other' && commonZones.includes(formData.zone)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  গাড়ির ধরণ (Vehicle Type) <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-accent focus:bg-white transition-all"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="Small">Small (ছোট - পিকআপ ইত্যাদি)</option>
                  <option value="Medium">Medium (মাঝারি - মিনি ট্রাক ইত্যাদি)</option>
                  <option value="Large">Large (বড় - ১০/১২ চাকার ট্রাক ইত্যাদি)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  গাড়ির সংখ্যা (Quantity Required) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-accent focus:bg-white transition-all"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                বিশেষ নির্দেশনা বা প্রথম মন্তব্য (First Note / Purpose)
              </label>
              <textarea
                placeholder="যেমন: কোন শিপমেন্ট যাবে, বা কখন গাড়ি পৌঁছাতে হবে..."
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-accent focus:bg-white transition-all"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setShowCreateForm(false)}>
                বাতিল
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>সাবমিট করা হচ্ছে...</span>
                  </>
                ) : (
                  <span>চাহিদা সাবমিট করুন</span>
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Requests Full-width Table / List */}
      {!showCreateForm && (
        <div className="space-y-4 w-full">
          {/* Search and Filters */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Tab Filters */}
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 self-start">
              {(['All', 'Pending', 'Fulfilled', 'Rejected'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeTab === tab 
                      ? 'bg-white text-slate-800 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab === 'All' && 'সব চাহিদা'}
                  {tab === 'Pending' && 'পেন্ডিং'}
                  {tab === 'Fulfilled' && 'পূরণকৃত'}
                  {tab === 'Rejected' && 'বাতিল'}
                </button>
              ))}
            </div>

            {/* Search input */}
            <div className="relative flex-1 max-w-xs">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="জোন বা রিকুয়েস্টার খুঁজুন..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-accent focus:bg-white transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Full-width elegant List Layout */}
          <div className="space-y-3">
            {filteredRequests.length === 0 ? (
              <div className="bg-white p-12 text-center text-slate-400 border border-slate-200 rounded-xl italic">
                কোন গাড়ির চাহিদা পাওয়া যায়নি।
              </div>
            ) : (
              filteredRequests.map(req => {
                const dateStr = req.createdAt?.seconds 
                  ? new Date(req.createdAt.seconds * 1000).toLocaleDateString('bn-BD', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: 'numeric'
                    })
                  : 'এখনই';

                // Robust parsing of notes array
                const requestNotes: any[] = req.notesList || (req.notes ? [{
                  id: 'legacy',
                  text: req.notes,
                  createdBy: req.createdBy || 'Legacy User',
                  createdByUid: 'legacy',
                  createdAt: req.createdAt?.seconds ? new Date(req.createdAt.seconds * 1000).toISOString() : new Date().toISOString()
                }] : []);

                return (
                  <div 
                    key={req.id}
                    className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md relative overflow-hidden"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Left: Info */}
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="p-1 rounded bg-slate-100 text-slate-600">
                            <MapPin size={14} />
                          </span>
                          <h4 className="font-bold text-slate-800 text-sm">{req.zone}</h4>
                          <span className="text-[10px] text-slate-400 font-mono ml-2">({dateStr})</span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <Truck size={12} className="text-slate-400" />
                            গাড়ির ধরণ: <strong className="text-slate-700">{req.type === 'Small' ? 'ছোট (Small)' : req.type === 'Medium' ? 'মাঝারি (Medium)' : 'বড় (Large)'}</strong>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <FileText size={12} className="text-slate-400" />
                            চাহিদা পরিমাণ: <strong className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{req.quantity} টি</strong>
                          </span>
                          <span className="text-slate-400">| চাহিদাকারী: <strong className="text-slate-600 font-medium">{req.createdBy}</strong></span>
                        </div>

                        {/* Collapsible/Compact Dropdown Notes Section */}
                        <div className="mt-3 border-t border-slate-100/60 pt-2.5 max-w-3xl">
                          <button
                            onClick={() => toggleNotes(req.id)}
                            className="flex items-center gap-2 text-xs text-slate-600 hover:text-accent font-semibold transition-all focus:outline-none bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200/40"
                          >
                            <FileText size={13} className="text-slate-500" />
                            <span>মন্তব্য ও নোটসমূহ ({requestNotes.length})</span>
                            {expandedNotes[req.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>

                          {expandedNotes[req.id] && (
                            <div className="mt-3 pl-3 border-l-2 border-slate-200 space-y-2.5 animate-in slide-in-from-top-1 duration-150">
                              {/* Existing notes list */}
                              {requestNotes.length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic py-1">কোন মন্তব্য নেই।</p>
                              ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                  {requestNotes.map(note => {
                                    const isOwner = note.createdByUid === profile?.uid;
                                    const noteDate = new Date(note.createdAt).toLocaleDateString('bn-BD', {
                                      hour: 'numeric',
                                      minute: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    });

                                    return (
                                      <div key={note.id} className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60 text-xs flex items-start justify-between gap-2 group">
                                        <div className="flex-1 min-w-0">
                                          {editingNoteId === note.id ? (
                                            <div className="flex items-center gap-1.5 mt-1">
                                              <input
                                                type="text"
                                                className="flex-1 px-2 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-accent bg-white"
                                                value={editingNoteText}
                                                onChange={(e) => setEditingNoteText(e.target.value)}
                                                autoFocus
                                              />
                                              <button
                                                onClick={() => {
                                                  handleEditNote(req.id, requestNotes, note.id, editingNoteText);
                                                  setEditingNoteId(null);
                                                }}
                                                className="text-[10px] bg-accent text-white px-2.5 py-1.5 rounded-lg hover:opacity-90 font-bold"
                                              >
                                                সংরক্ষণ
                                              </button>
                                              <button
                                                onClick={() => setEditingNoteId(null)}
                                                className="text-[10px] bg-slate-200 text-slate-600 px-2.5 py-1.5 rounded-lg hover:bg-slate-300"
                                              >
                                                বাতিল
                                              </button>
                                            </div>
                                          ) : (
                                            <>
                                              <p className="text-slate-700 leading-relaxed break-words font-medium">{note.text}</p>
                                              <p className="text-[9px] text-slate-400 mt-0.5 font-medium">
                                                {note.createdBy} • {noteDate}
                                              </p>
                                            </>
                                          )}
                                        </div>

                                        {isOwner && editingNoteId !== note.id && (
                                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                              onClick={() => {
                                                setEditingNoteId(note.id);
                                                setEditingNoteText(note.text);
                                              }}
                                              className="p-1 text-slate-400 hover:text-accent rounded hover:bg-slate-200/50 transition-all"
                                              title="সম্পাদনা করুন"
                                            >
                                              <Edit2 size={12} />
                                            </button>
                                            <button
                                              onClick={() => {
                                                setConfirmModal({
                                                  show: true,
                                                  title: 'মন্তব্য মুছুন',
                                                  message: 'আপনি কি নিশ্চিত যে এই মন্তব্যটি মুছে ফেলতে চান?',
                                                  confirmText: 'হ্যাঁ, মুছুন',
                                                  variant: 'danger',
                                                  onConfirm: () => {
                                                    handleDeleteNote(req.id, requestNotes, note.id);
                                                  }
                                                });
                                              }}
                                              className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-all"
                                              title="মুছে ফেলুন"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* New Note input form */}
                              <div className="flex items-center gap-2 mt-2 max-w-xl">
                                <input
                                  type="text"
                                  placeholder="নতুন মন্তব্য লিখুন..."
                                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-accent transition-all"
                                  value={newNoteTexts[req.id] || ''}
                                  onChange={(e) => setNewNoteTexts(prev => ({ ...prev, [req.id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleAddNote(req.id, requestNotes, newNoteTexts[req.id] || '');
                                      setNewNoteTexts(prev => ({ ...prev, [req.id]: '' }));
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    handleAddNote(req.id, requestNotes, newNoteTexts[req.id] || '');
                                    setNewNoteTexts(prev => ({ ...prev, [req.id]: '' }));
                                  }}
                                  className="px-3 py-2 bg-accent text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all focus:outline-none"
                                >
                                  যোগ করুন
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Status & Action buttons */}
                      <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(req.status)}
                        </div>

                        {/* Status changing actions for canManage roles */}
                        {canManage && (
                          <div className="flex items-center gap-2">
                            {req.status === 'Pending' && (
                              <>
                                <button
                                  onClick={() => handleUpdateStatus(req.id, 'Fulfilled')}
                                  className="text-xs font-bold text-emerald-600 hover:text-white hover:bg-emerald-600 border border-emerald-200 bg-emerald-50 px-3 py-1.5 rounded-lg transition-all"
                                >
                                  পূরণ হয়েছে (Fulfill)
                                </button>
                                <button
                                  onClick={() => handleUpdateStatus(req.id, 'Rejected')}
                                  className="text-xs font-bold text-red-600 hover:text-white hover:bg-red-600 border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg transition-all"
                                >
                                  প্রত্যাখ্যান (Reject)
                                </button>
                              </>
                            )}

                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteRequest(req.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-all"
                                title="মুছে ফেলুন"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Elegant Custom Confirmation Modal (Iframe-safe) */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900">{confirmModal.title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{confirmModal.message}</p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all"
              >
                {confirmModal.cancelText || 'বাতিল'}
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(prev => ({ ...prev, show: false }));
                }}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-sm hover:opacity-90 transition-all ${
                  confirmModal.variant === 'danger' ? 'bg-red-600 shadow-red-100' : 'bg-accent shadow-accent/10'
                }`}
              >
                {confirmModal.confirmText || 'হ্যাঁ, নিশ্চিত করুন'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Requests;
