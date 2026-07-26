import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Store, Loader2, MapPin } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '../../lib/supabase';

// Fix leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function LocationMarker({ position, setPosition, setAddress }) {
  const map = useMap();
  
  useEffect(() => {
    if (navigator.geolocation && !position) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setPosition([latitude, longitude]);
          map.flyTo([latitude, longitude], 13);
          
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
            .then(res => res.json())
            .then(data => {
              if (data && data.display_name) {
                setAddress(data.display_name);
              }
            })
            .catch(err => console.error("Geocoding failed", err));
        },
        (err) => console.error(err)
      );
    }
  }, [map, position, setPosition, setAddress]);

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.display_name) {
            setAddress(data.display_name);
          }
        })
        .catch(err => console.error("Geocoding failed", err));
    },
  });

  return position === null ? null : <Marker position={position} />;
}

export default function VendorRegister() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [position, setPosition] = useState(null);

  const [formData, setFormData] = useState({
    shop_name: '',
    address: '',
    contact_number: '',
    password: '',
    category: 'SALON',
    servicing_units: 1,
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddressChange = (address) => {
    setFormData(prev => ({ ...prev, address }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!position) {
      setError('Please allow location access or click on the map to mark your location.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const vendorId = crypto.randomUUID();
      const payload = {
        id: vendorId,
        shop_name: formData.shop_name,
        contact_number: formData.contact_number,
        password: formData.password,
        address: formData.address,
        category: formData.category,
        servicing_units: parseInt(formData.servicing_units),
        latitude: position[0],
        longitude: position[1]
      };
      
      const { error: dbError } = await supabase.from('vendors').insert([payload]);
      if (dbError) throw dbError;
      
      // Save locally to keep them logged in
      localStorage.setItem('qsync_vendor', JSON.stringify(payload));
      
      navigate('/vendor/dashboard');
    } catch (err) {
      console.error(err);
      setError('Registration failed. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main 
      className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8"
      style={{
        backgroundImage: "linear-gradient(rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.7)), url('https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1920&q=80')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="w-full max-w-xl mx-auto">
        <div className="text-center mb-8">
           <div className="flex justify-center mb-4">
               <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl text-blue-600">
                  <Store className="w-8 h-8" />
               </div>
           </div>
           <h1 className="text-3xl font-extrabold text-white tracking-tight">Register Business</h1>
           <p className="text-slate-300 mt-2 font-medium">Or <Link to="/vendor/login" className="text-blue-400 hover:underline">sign in to your account</Link></p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-2xl p-8"
        >
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 font-medium text-center">
              {error}
            </div>
          )}
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Business Name</label>
                <input name="shop_name" type="text" required value={formData.shop_name} onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Contact Number</label>
                <input name="contact_number" type="tel" required value={formData.contact_number} onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
              <input name="password" type="password" required value={formData.password} onChange={handleChange} placeholder="Secure password"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" /> Mark Location on Map
              </label>
              <div className="h-[250px] w-full rounded-xl overflow-hidden border border-slate-200 mb-3 z-0 relative">
                <MapContainer center={[20.5937, 78.9629]} zoom={4} className="h-full w-full z-0">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <LocationMarker position={position} setPosition={setPosition} setAddress={handleAddressChange} />
                </MapContainer>
              </div>
              <p className="text-xs text-slate-500 mb-2">We try to auto-detect your location. Click the map to adjust it.</p>
              
              <input name="address" type="text" required value={formData.address} onChange={handleChange} placeholder="Full Address"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
                <select name="category" value={formData.category} onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none">
                  <option value="SALON">Salon/Barber</option>
                  <option value="CLINIC">Doctor/Clinic</option>
                  <option value="MECHANIC">Mechanic</option>
                  <option value="FOOD">Food/Canteen</option>
                  <option value="TAILOR">Tailor</option>
                  <option value="GOVT">Government</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Servicing Units</label>
                <input name="servicing_units" type="number" min="1" required value={formData.servicing_units} onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" disabled={loading}
                className="w-full flex justify-center py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition-all active:scale-[0.98] disabled:opacity-70">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Register Business'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </main>
  );
}
