/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AuthProvider, useAuth, UserRole } from './AuthContext';
import { SearchProvider } from './SearchContext';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Button } from './components/Common';
import Dashboard from './Dashboard';
import Vehicles from './Vehicles';
import Trips from './Trips';
import VehicleReturn from './VehicleReturn';
import Drivers from './Drivers';
import CaseManagement from './CaseManagement';
import Reports from './Reports';
import QRScanner from './QRScanner';
import UsersManagement from './UsersManagement';
import { loginWithUsernameAndPassword } from './db';
import { Truck, KeyRound, User, AlertCircle, Loader2 } from 'lucide-react';

const Login: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If user is already authenticated, redirect to dashboard automatically
  if (user && !authLoading) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('ইউজারনেম এবং পাসওয়ার্ড উভয়ই প্রদান করুন।');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await loginWithUsernameAndPassword(username, password);
    } catch (err: any) {
      setError(err.message || 'লগইন করতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-200 mb-6">
            <Truck size={32} />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">FleetFlow Pro</h1>
          <p className="mt-2 text-slate-500">Logistics & Fleet Management Redefined</p>
        </div>
        
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-slate-600 mb-6 text-center font-medium">ইউজারনেম এবং পাসওয়ার্ড দিয়ে লগইন করুন</p>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2 animate-in fade-in">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <User size={16} />
                </span>
                <input
                  type="text"
                  placeholder="যেমন: admin"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-sm transition-all text-slate-800"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <KeyRound size={16} />
                </span>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-sm transition-all text-slate-800"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full py-3.5 text-sm font-semibold gap-2">
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>যাচাই করা হচ্ছে...</span>
                </>
              ) : (
                <span>লগইন করুন</span>
              )}
            </Button>
          </form>
        </div>
        
        <p className="text-xs text-center text-slate-400">Secure entry for authorized transport personnel only.</p>
      </div>
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;
  
  return <Layout>{children}</Layout>;
};

export default function App() {
  return (
    <AuthProvider>
      <SearchProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/vehicles" element={<ProtectedRoute><Vehicles /></ProtectedRoute>} />
            <Route path="/trips" element={<ProtectedRoute><Trips /></ProtectedRoute>} />
            <Route path="/return" element={<ProtectedRoute><VehicleReturn /></ProtectedRoute>} />
            <Route path="/drivers" element={<ProtectedRoute><Drivers /></ProtectedRoute>} />
            <Route path="/cases" element={<ProtectedRoute><CaseManagement /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/qr-scanner" element={<ProtectedRoute><QRScanner /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UsersManagement /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </HashRouter>
      </SearchProvider>
    </AuthProvider>
  );
}
