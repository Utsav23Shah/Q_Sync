import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Loader2 } from 'lucide-react';

export default function AdminLogin() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      if (phone === '9999999999' && password === 'admin@01') {
        localStorage.setItem('qsync_admin', 'true');
        navigate('/admin/dashboard');
      } else {
        alert("Invalid Admin Credentials.");
        setLoading(false);
      }
    }, 500);
  };

  return (
    <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
           <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
             <Shield className="w-8 h-8" />
           </div>
           <h1 className="text-2xl font-extrabold text-slate-900">Super Admin</h1>
           <p className="text-slate-500 font-medium mt-1">System Oversight Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Admin ID (Phone)</label>
            <input type="text" required value={phone} onChange={e=>setPhone(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:outline-none" placeholder="Enter Admin ID" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
            <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:outline-none" placeholder="••••••••" />
          </div>
          
          <button type="submit" disabled={loading} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center mt-4">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Access Command Center'}
          </button>
        </form>
      </motion.div>
    </main>
  );
}
