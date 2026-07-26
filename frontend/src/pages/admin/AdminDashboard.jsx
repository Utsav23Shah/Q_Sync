import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Shield, LogOut, MapPin, Trash2, MessageSquare, Star, X } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [feedbacks, setFeedbacks] = useState([]);
  const [viewingFeedback, setViewingFeedback] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('qsync_admin')) {
      navigate('/admin/login');
      return;
    }
    fetchVendors();
  }, [navigate]);

  async function fetchVendors() {
    const { data } = await supabase.from('vendors').select('*');
    if (data) setVendors(data);
  }

  const handleLogout = () => {
    localStorage.removeItem('qsync_admin');
    navigate('/admin/login');
  };

  const handleDelete = async (id) => {
    if (window.confirm("WARNING: This will permanently delete this vendor and all associated queue tokens and feedback. Proceed?")) {
      await supabase.from('vendors').delete().eq('id', id);
      fetchVendors();
    }
  };

  const handleMessage = async (vendor) => {
    const msg = prompt(`Enter a message to broadcast to ${vendor.shop_name}'s dashboard:`, vendor.admin_message || "");
    if (msg !== null) {
      await supabase.from('vendors').update({ admin_message: msg === "" ? null : msg }).eq('id', vendor.id);
      fetchVendors();
      alert("Message sent to vendor!");
    }
  };

  const handleViewFeedback = async (vendor) => {
    setSelectedVendor(vendor);
    const { data } = await supabase.from('feedbacks').select('*').eq('vendor_id', vendor.id).order('created_at', { ascending: false });
    if (data) {
      setFeedbacks(data);
      setViewingFeedback(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600 rounded-lg"><Shield className="w-5 h-5"/></div>
            <h1 className="text-xl font-black">Super Admin Command Center</h1>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold transition-colors">
            <LogOut className="w-4 h-4"/> Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-600" /> Global Vendor Map
            </div>
            <div className="h-96 relative z-0">
              <MapContainer center={[37.7749, -122.4194]} zoom={4} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {vendors.filter(v => v.latitude && v.longitude).map(v => (
                  <Marker key={v.id} position={[v.latitude, v.longitude]}>
                    <Popup>
                      <strong>{v.shop_name}</strong><br/>
                      {v.address}<br/>
                      {v.contact_number}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>

        <div className="space-y-4 h-[600px] overflow-y-auto pr-2">
          <h2 className="font-bold text-xl text-slate-800">All Registered Vendors ({vendors.length})</h2>
          {vendors.map(v => (
            <div key={v.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 relative">
              <div className="mb-4">
                <h3 className="font-bold text-lg text-slate-900">{v.shop_name}</h3>
                <p className="text-xs text-slate-500">{v.owner_name} • {v.contact_number}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleViewFeedback(v)} className="py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 flex flex-col items-center gap-1">
                  <Star className="w-4 h-4"/> Feedback
                </button>
                <button onClick={() => handleMessage(v)} className="py-2 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 flex flex-col items-center gap-1">
                  <MessageSquare className="w-4 h-4"/> Message
                </button>
                <button onClick={() => handleDelete(v.id)} className="py-2 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 flex flex-col items-center gap-1">
                  <Trash2 className="w-4 h-4"/> Delete
                </button>
              </div>
            </div>
          ))}
        </div>

      </main>

      {viewingFeedback && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Feedback for {selectedVendor?.shop_name}</h3>
              <button onClick={() => setViewingFeedback(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              {feedbacks.length === 0 ? (
                <p className="text-slate-500 text-center py-8 font-medium">No feedback collected yet.</p>
              ) : (
                feedbacks.map(f => (
                  <div key={f.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-slate-900">{f.customer_name || 'Anonymous'}</div>
                      <div className="flex text-amber-400">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < f.rating ? 'fill-current' : 'text-slate-300'}`} />
                        ))}
                      </div>
                    </div>
                    {f.comment && <p className="text-slate-600 text-sm">{f.comment}</p>}
                    <p className="text-[10px] text-slate-400 mt-2">{new Date(f.created_at).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
