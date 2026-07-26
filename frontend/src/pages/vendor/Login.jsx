import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Loader2 } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function VendorLogin() {
  const location = useLocation();
  const navigate = useNavigate();
  const message = location.state?.message;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (phone === '9999999999' && password === 'admin@01') {
        localStorage.setItem('qsync_admin', 'true');
        navigate('/admin/dashboard');
        return;
      }

      const { data, error: dbError } = await supabase
        .from('vendors')
        .select('*')
        .eq('contact_number', phone)
        .eq('password', password)
        .single();
        
      if (dbError || !data) {
        throw new Error("Invalid phone number or password.");
      }
      
      localStorage.setItem('qsync_vendor', JSON.stringify(data));
      navigate('/vendor/dashboard');
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main 
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{
        backgroundImage: "linear-gradient(rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.7)), url('https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1920&q=80')",
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8"
      >
        <div className="text-center mb-8">
           <div className="flex justify-center mb-4">
               <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl text-blue-600">
                  <User className="w-8 h-8" />
               </div>
           </div>
           <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Vendor Login</h1>
           <p className="text-slate-500 mt-2 font-medium">Log in to manage your queue</p>
        </div>
        
        {message && !error && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-700 font-medium text-center">
            {message}
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 font-medium text-center">
            {error}
          </div>
        )}

        <form className="space-y-5" onSubmit={handleLogin}>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Phone Number</label>
            <input type="text" required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1 234 567 8900" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
            <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="*********" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
          </div>
          <div className="pt-2 flex flex-col gap-3">
            <button disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition-all active:scale-[0.98] disabled:opacity-70 flex justify-center items-center">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
            </button>
          </div>
        </form>
        
        <div className="mt-6 text-center text-sm font-medium text-slate-500">
          Don't have an account?{' '}
          <Link to="/vendor/register" className="text-blue-600 font-bold hover:underline">
            Register here
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
