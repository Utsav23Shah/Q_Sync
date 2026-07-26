import { BrowserRouter as Router, Routes, Route, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Store, ArrowRight, QrCode } from 'lucide-react';

// Import Pages
import VendorLogin from './pages/vendor/Login';
import VendorRegister from './pages/vendor/Register';
import VendorDashboard from './pages/vendor/Dashboard';
import CustomerVendorPage from './pages/customer/CustomerVendorPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';

// --- MARKETING / ROOT ROUTE ---

function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-slate-900 rounded-2xl text-white">
              <QrCode className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Q_<span className="text-blue-600">Sync</span></h1>
          <p className="text-slate-500 mt-2 font-medium">The ultimate zero-friction virtual queue platform for local businesses.</p>
        </div>
        
        <div className="pt-2 flex flex-col gap-3">
          <Link to="/vendor/login" className="w-full text-center py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition-all active:scale-[0.98]">
            Login
          </Link>
          <Link to="/vendor/register" className="w-full text-center py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold rounded-xl transition-all active:scale-[0.98]">
            Register Business
          </Link>
        </div>
      </div>
    </main>
  );
}

// --- MAIN ROUTER ---

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/vendor/login" element={<VendorLogin />} />
        <Route path="/vendor/register" element={<VendorRegister />} />
        <Route path="/vendor/dashboard" element={<VendorDashboard />} />
        <Route path="/v/:vendorId" element={<CustomerVendorPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
