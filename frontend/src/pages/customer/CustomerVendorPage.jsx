import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CheckCircle, Loader2, Users, MapPin, Clock, ArrowDownCircle, Star, MessageSquareHeart, Navigation } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet marker icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function CustomerVendorPage() {
  const { vendorId } = useParams();
  const [vendorData, setVendorData] = useState(null);
  const [vendorServices, setVendorServices] = useState([]);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedServices, setSelectedServices] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [scheduleTime, setScheduleTime] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);

  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [liveQueue, setLiveQueue] = useState([]);
  const [eta, setEta] = useState(0);
  const [travelTimeMins, setTravelTimeMins] = useState(null);

  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [showThankYou, setShowThankYou] = useState(false);

  useEffect(() => {
    async function loadData() {
      const { data: v } = await supabase.from('vendors').select('*').eq('id', vendorId).single();
      if (v) setVendorData(v);
      else setVendorData({ shop_name: 'Vendor Not Found' }); 
      
      const { data: s } = await supabase.from('vendor_services').select('*').eq('vendor_id', vendorId);
      if (s) {
        setVendorServices(s);
      }
      
      const savedId = localStorage.getItem(`qsync_ticket_${vendorId}`);
      if (savedId) {
        const { data: savedTicket } = await supabase.from('queue_tokens').select('*').eq('id', savedId).single();
        if (savedTicket && savedTicket.status !== 'CANCELLED') {
           setTicket(savedTicket);
        } else {
           localStorage.removeItem(`qsync_ticket_${vendorId}`);
        }
      }
    }
    loadData();
  }, [vendorId]);

  useEffect(() => {
    if (ticket) {
      fetchLiveQueue();
      const poller = setInterval(fetchLiveQueue, 5000);
      const channel = supabase.channel('public:queue_tokens')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_tokens', filter: `vendor_id=eq.${vendorId}` }, () => {
          fetchLiveQueue();
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); clearInterval(poller); }
    }
  }, [ticket?.id, vendorId]);

  // Separate effect for travel time calculation - depends on vendorData AND ticket
  useEffect(() => {
    if (!ticket || !vendorData?.latitude || !vendorData?.longitude) return;
    if (!("geolocation" in navigator)) return;
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${longitude},${latitude};${vendorData.longitude},${vendorData.latitude}?overview=false`
          );
          const osrmData = await res.json();
          if (osrmData.routes && osrmData.routes.length > 0) {
            setTravelTimeMins(Math.ceil(osrmData.routes[0].duration / 60));
          }
        } catch (err) {
          console.log("Could not calculate travel time", err);
        }
      },
      (err) => {
        console.log("Geolocation denied or unavailable:", err.message);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, [ticket?.id, vendorData?.latitude, vendorData?.longitude]);
  
  const prevStrikes = useRef(0);
  useEffect(() => {
    if (ticket) {
      if (prevStrikes.current !== 0 && ticket.strikes > prevStrikes.current) {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e=>console.log(e));
        alert("🔔 DING DING! The vendor has pinged you. Your turn is approaching!");
      }
      prevStrikes.current = ticket.strikes;
    }
  }, [ticket?.strikes]);

  async function fetchLiveQueue() {
    const { data } = await supabase.from('queue_tokens')
      .select('*')
      .eq('vendor_id', vendorId)
      .in('status', ['WAITING', 'SERVING'])
      .order('position', { ascending: true });
    
    if (data) {
      const activeQueue = data.filter(d => !d.is_scheduled);
      setLiveQueue(activeQueue);
    }
    
    if (ticket) {
      const { data: myTicketData } = await supabase.from('queue_tokens').select('*').eq('id', ticket.id).single();
      if (myTicketData) {
        setTicket(myTicketData);
        if (!myTicketData.is_scheduled && myTicketData.status !== 'COMPLETED') {
          let etaMins = data ? data.filter(q => !q.is_scheduled && q.position < myTicketData.position).reduce((acc, q) => {
            const booked = q.service_booked ? q.service_booked.split(', ') : [];
            let rowMins = 0;
            booked.forEach(b => {
              const svc = vendorServices.find(s => s.name === b);
              rowMins += (svc ? (parseInt(svc.estimated_time_mins) || 15) : 15);
            });
            if(booked.length === 0) rowMins = 15;
            return acc + rowMins;
          }, 0) : 0;
          setEta(etaMins);
        }
      }
    }
  }

  const handleNativeCapture = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result);
        setIsCapturing(false);
      };
      reader.readAsDataURL(file);
    } else {
      setIsCapturing(false);
    }
  };

  const handleJoinQueue = async (e) => {
    e.preventDefault();
    if (selectedServices.length === 0) {
      alert("Please select at least one service.");
      return;
    }
    setLoading(true);

    try {
      let photoUrl = null;
      if (photo) {
        const base64Res = await fetch(photo);
        const blob = await base64Res.blob();
        const fileName = `live_${Date.now()}.jpg`;
        const { error: uploadErr } = await supabase.storage.from('live_photos').upload(fileName, blob);
        
        if (!uploadErr) {
          photoUrl = supabase.storage.from('live_photos').getPublicUrl(fileName).data.publicUrl;
        } else {
          console.error("Photo upload error (continuing without photo):", uploadErr);
        }
      }

      const isScheduled = scheduleTime !== '';
      const { data: currentQueue } = await supabase.from('queue_tokens')
        .select('position').eq('vendor_id', vendorId).in('status', ['WAITING', 'SERVING'])
        .order('position', { ascending: false }).limit(1);
        
      const nextPos = (currentQueue && currentQueue.length > 0) ? currentQueue[0].position + 1 : 1;

      const payload = {
        vendor_id: vendorId, customer_name: name, customer_phone: phone, 
        service_booked: selectedServices.join(', '), photo_url: photoUrl,
        position: isScheduled ? null : nextPos,
        token_number: isScheduled ? 0 : nextPos,
        status: 'WAITING',
        is_scheduled: isScheduled,
        scheduled_time: isScheduled ? scheduleTime : null
      };

      const { data, error } = await supabase.from('queue_tokens').insert([payload]).select().single();
      if (error) throw error;
      localStorage.setItem(`qsync_ticket_${vendorId}`, data.id);
      setTicket(data);
    } catch (err) {
      console.error(err);
      alert("Failed to join queue. Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePushBack = async () => {
    const pushAmount = prompt("How many spots do you want to push back? (e.g. 5)", "5");
    if(!pushAmount) return;
    const amount = parseInt(pushAmount);
    if(isNaN(amount) || amount <= 0) return;
    
    setLoading(true);
    const { data } = await supabase.from('queue_tokens').select('id, position').eq('vendor_id', vendorId).in('status', ['WAITING', 'SERVING']).order('position', { ascending: true });
    
    const currentIndex = data.findIndex(d => d.id === ticket.id);
    if(currentIndex !== -1) {
      let newQueue = [...data];
      const me = newQueue.splice(currentIndex, 1)[0];
      const newIndex = Math.min(currentIndex + amount, newQueue.length);
      newQueue.splice(newIndex, 0, me);
      
      for (let i = 0; i < newQueue.length; i++) {
         await supabase.from('queue_tokens').update({ position: i + 1, token_number: String(i+1) }).eq('id', newQueue[i].id);
      }
      fetchLiveQueue();
    }
    setLoading(false);
  };

  const handleCancel = async () => {
    const confirmCancel = window.confirm("Are you sure you want to leave the queue?");
    if (!confirmCancel) return;
    setLoading(true);
    await supabase.from('queue_tokens').update({ status: 'CANCELLED' }).eq('id', ticket.id);
    localStorage.removeItem(`qsync_ticket_${vendorId}`);
    setTicket(null);
    setLoading(false);
  };

  const handleSubmitFeedback = async () => {
    setLoading(true);
    if (feedbackRating > 0) {
      await supabase.from('feedbacks').insert([{
        vendor_id: vendorId,
        customer_name: ticket.customer_name,
        rating: feedbackRating,
        comment: feedbackComment
      }]);
    }
    localStorage.removeItem(`qsync_ticket_${vendorId}`);
    setShowThankYou(true);
    setLoading(false);
  };

  if (!vendorData) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;

  const currentServing = liveQueue.find(q => q.status === 'SERVING');

  if (showThankYou) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-900" style={{ backgroundImage: "linear-gradient(rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.8)), url('https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1920&q=80')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl w-full max-w-md p-8 text-center relative z-10">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="w-24 h-24 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
            <MessageSquareHeart className="w-12 h-12" />
          </motion.div>
          <h2 className="text-3xl font-black text-white mb-3">Thank You!</h2>
          <p className="text-slate-300 font-medium mb-8">We hope you had a great experience with {vendorData.shop_name}.</p>
          <button onClick={() => { setShowThankYou(false); setTicket(null); }} className="w-full py-4 bg-white text-slate-900 font-bold rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all">
            Done
          </button>
        </motion.div>
      </main>
    );
  }

  if (ticket) {
    if (ticket.status === 'COMPLETED') {
      return (
        <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-900" style={{ backgroundImage: "linear-gradient(rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.8)), url('https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1920&q=80')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl w-full max-w-md p-8 text-center relative z-10">
            <h2 className="text-3xl font-black text-white mb-2">Service Completed!</h2>
            <p className="text-slate-300 font-medium mb-8">How was your experience with {vendorData.shop_name}?</p>
            
            <div className="flex justify-center gap-3 mb-8">
              {[1, 2, 3, 4, 5].map((star, idx) => (
                <motion.button key={star} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1 * idx }} onClick={() => setFeedbackRating(star)} className="focus:outline-none hover:scale-110 active:scale-95 transition-transform">
                  <Star className={`w-12 h-12 ${feedbackRating >= star ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'text-white/20'}`} />
                </motion.button>
              ))}
            </div>

            <textarea 
              placeholder="Leave a comment (optional)..."
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              className="w-full p-4 bg-white/5 border border-white/10 rounded-xl mb-6 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:outline-none resize-none h-28 text-white placeholder-slate-400 transition-all"
            />

            <div className="space-y-3">
              <button onClick={handleSubmitFeedback} disabled={loading} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)] flex justify-center items-center transition-all hover:scale-[1.02] active:scale-[0.98]">
                {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Submit Feedback'}
              </button>
              <button onClick={handleSubmitFeedback} disabled={loading} className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all">
                Skip
              </button>
            </div>
          </motion.div>
        </main>
      );
    }
    const peopleAhead = liveQueue.filter(q => q.position < ticket.position).length;

    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-600/20 to-transparent blur-3xl -z-10"></div>
        <div className="absolute top-1/4 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -z-10"></div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-6 relative z-10">
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{vendorData.shop_name}</h1>
            <p className="text-slate-500 font-medium flex items-center justify-center gap-1 mt-1"><MapPin className="w-4 h-4"/> {vendorData.address}</p>
          </div>

          {ticket.is_scheduled ? (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-xl overflow-hidden border border-white mb-6">
              <div className="bg-indigo-600 p-8 text-center text-white relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <Clock className="w-16 h-16 mx-auto mb-4 opacity-90 relative z-10" />
                <h2 className="text-2xl font-bold relative z-10">Scheduled for {ticket.scheduled_time}</h2>
                <p className="opacity-80 font-medium mt-1 relative z-10">You will be automatically added to the live queue at this time.</p>
              </div>
              <div className="p-6">
                 <button onClick={handleCancel} disabled={loading} className="w-full py-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm">
                    Cancel My Ticket
                 </button>
              </div>
            </motion.div>
          ) : (
            <motion.div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-blue-900/5 border border-white p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
              
              {ticket.status === 'SERVING' ? (
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="space-y-4">
                  <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto relative">
                     <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-20"></div>
                     <CheckCircle className="w-12 h-12 relative z-10" />
                  </div>
                  <div>
                    <p className="text-emerald-600 font-bold tracking-widest uppercase text-sm mb-1">It's Your Turn!</p>
                    <h2 className="text-4xl font-black text-slate-900">#{ticket.token_number || ticket.position}</h2>
                  </div>
                  <p className="text-slate-500 font-medium">Please approach the desk for service.</p>
                </motion.div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <p className="text-slate-500 font-bold tracking-widest uppercase text-xs mb-2">Your Token Number</p>
                    <div className="inline-block relative group">
                      <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                      <h2 className="text-6xl font-black text-slate-900 relative z-10">#{ticket.token_number || ticket.position}</h2>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-200/50">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                      <Users className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                      <p className="text-3xl font-black text-slate-900">{peopleAhead}</p>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-1">Ahead of you</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                      <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                      <p className="text-3xl font-black text-slate-900">{eta}</p>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-1">Est. Mins</p>
                    </div>
                  </div>

                  {travelTimeMins !== null && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`p-5 rounded-2xl border text-left ${eta > travelTimeMins + 5 ? 'bg-indigo-50 border-indigo-200' : 'bg-rose-50 border-rose-200 shadow-lg shadow-rose-500/10'}`}>
                       <div className="flex items-start gap-4">
                         <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${eta > travelTimeMins + 5 ? 'bg-indigo-100 text-indigo-600' : 'bg-rose-100 text-rose-600 animate-pulse'}`}>
                           <Navigation className="w-6 h-6" />
                         </div>
                         <div>
                           <h4 className={`font-bold text-lg ${eta > travelTimeMins + 5 ? 'text-indigo-900' : 'text-rose-900'}`}>Smart Departure</h4>
                           <p className={`text-sm font-medium mt-1 ${eta > travelTimeMins + 5 ? 'text-indigo-700' : 'text-rose-700'}`}>
                             {eta > travelTimeMins + 5 ? (
                               <>Leave in <strong>{eta - travelTimeMins - 5} mins</strong> to arrive right on time. Drive is ~{travelTimeMins}m.</>
                             ) : (
                               <>Leave <strong>now!</strong> The drive takes ~{travelTimeMins}m and your turn is in ~{eta}m.</>
                             )}
                           </p>
                         </div>
                       </div>
                    </motion.div>
                  )}

                  <div className="space-y-3 pt-4 border-t border-slate-200/50">
                    <button onClick={handlePushBack} disabled={loading} className="w-full py-3 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm">
                      <ArrowDownCircle className="w-5 h-5" /> Push Back Position
                    </button>
                    <button onClick={handleCancel} disabled={loading} className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm">
                      Cancel My Ticket
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {currentServing && ticket.status === 'WAITING' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-5 shadow-lg shadow-blue-600/20 flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">Now Serving</p>
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-black backdrop-blur-sm shadow-inner">#{currentServing.token_number || currentServing.position}</div>
                   <p className="font-bold text-lg text-white drop-shadow-sm">{currentServing.customer_name}</p>
                </div>
              </div>
              <ArrowDownCircle className="w-8 h-8 text-blue-300 opacity-50" />
            </motion.div>
          )}

          {vendorData.latitude && vendorData.longitude && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-lg border border-white overflow-hidden mb-6 relative z-0">
              <div className="h-48">
                <MapContainer center={[vendorData.latitude, vendorData.longitude]} zoom={15} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[vendorData.latitude, vendorData.longitude]}>
                    <Popup>{vendorData.shop_name}</Popup>
                  </Marker>
                </MapContainer>
              </div>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${vendorData.latitude},${vendorData.longitude}`} target="_blank" rel="noreferrer" className="block w-full py-4 bg-emerald-600 text-white font-bold text-center hover:bg-emerald-700 transition-colors shadow-inner">
                <div className="flex items-center justify-center gap-2"><MapPin className="w-5 h-5"/> Get Directions</div>
              </a>
            </motion.div>
          )}

          {!ticket.is_scheduled && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-lg border border-white p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-blue-600"/> Live Queue Tracker</h3>
              <div className="space-y-3">
                {liveQueue.map((q, idx) => (
                  <div key={q.id} className={`flex items-center gap-4 p-3 rounded-2xl border transition-all ${q.id === ticket.id ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white/50 border-slate-100 hover:bg-white hover:shadow-sm'}`}>
                    <div className={`w-10 h-10 font-bold rounded-xl flex items-center justify-center ${q.id === ticket.id ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-slate-100 text-slate-700 shadow-inner'}`}>
                      {q.position}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">
                        {q.id === ticket.id ? 'You' : q.customer_name}
                      </p>
                      <p className="text-xs text-slate-500">{q.service_booked}</p>
                    </div>
                    {q.status === 'SERVING' && <span className="ml-auto text-[10px] font-black text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">Serving</span>}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      </main>
    );
  }

  // --- REGISTRATION SCREEN ---
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-600/10 to-transparent blur-3xl -z-10"></div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-slate-200/50 border border-white p-8 relative z-10">
        <div className="text-center mb-8">
           <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-sm border border-blue-100/50">
             <Users className="w-10 h-10" />
           </div>
           <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{vendorData.shop_name}</h1>
           <p className="text-slate-500 mt-2 font-medium">Join the queue digitally</p>
        </div>

        <form onSubmit={handleJoinQueue} className="space-y-6">
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Your Name</label>
              <input type="text" required value={name} onChange={e=>setName(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium text-slate-900" placeholder="Enter full name" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Mobile Number</label>
              <input type="tel" required value={phone} onChange={e=>setPhone(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium text-slate-900" placeholder="+1 234 567 8900" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Select Services</label>
              <div className="space-y-2 max-h-48 overflow-y-auto bg-slate-50 border border-slate-200 rounded-2xl p-3 scrollbar-hide">
                {vendorServices.length > 0 ? (
                  vendorServices.map(s => (
                    <label key={s.id} className="flex items-center gap-3 p-3 hover:bg-white rounded-xl cursor-pointer transition-all border border-transparent hover:border-slate-200 hover:shadow-sm">
                      <input 
                        type="checkbox" 
                        checked={selectedServices.includes(s.name)}
                        onChange={() => {
                          setSelectedServices(prev => prev.includes(s.name) ? prev.filter(x => x !== s.name) : [...prev, s.name])
                        }}
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-bold text-slate-800">{s.name} <span className="text-slate-400 font-medium text-sm ml-1">({s.estimated_time_mins}m)</span></span>
                    </label>
                  ))
                ) : (
                  <label className="flex items-center gap-3 p-3">
                    <input type="checkbox" checked={true} readOnly className="w-5 h-5 rounded border-slate-300 text-blue-600" />
                    <span className="font-bold text-slate-800">General Check-in</span>
                  </label>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Schedule (Optional)</label>
              <input type="time" value={scheduleTime} onChange={e=>setScheduleTime(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium text-slate-900" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Live Photo (Optional)</label>
              {!photo && !isCapturing && (
                <button type="button" onClick={() => setIsCapturing(true)} className="w-full h-36 border-2 border-dashed border-slate-300 bg-slate-50 rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:bg-slate-100 hover:border-slate-400 transition-all active:scale-[0.98]">
                  <Camera className="w-8 h-8 mb-2 text-slate-400" />
                  <span className="font-bold">Tap to open camera</span>
                </button>
              )}
              {isCapturing && (
                <div className="relative rounded-2xl overflow-hidden bg-white z-10 shadow-lg border border-slate-200 p-6 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                     <Camera className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">Take a Photo</h3>
                  <p className="text-sm text-slate-500 mb-6 text-center">Your device camera will open securely.</p>
                  
                  <div className="relative w-full">
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="user" 
                      onChange={handleNativeCapture}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    />
                    <button type="button" className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-md pointer-events-none">
                      Open Camera
                    </button>
                  </div>
                  
                  <button type="button" onClick={() => setIsCapturing(false)} className="mt-4 px-4 py-2 text-slate-500 font-bold text-sm hover:text-slate-700 transition-colors">
                    Cancel
                  </button>
                </div>
              )}
              {photo && (
                <div className="relative rounded-2xl overflow-hidden border-4 border-white shadow-xl group">
                  <img src={photo} alt="Selfie" className="w-full object-cover h-48 transition-transform group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button type="button" onClick={() => {setPhoto(null); setIsCapturing(true);}} className="px-5 py-2 bg-white/90 backdrop-blur-md text-slate-900 font-bold rounded-xl text-sm shadow-lg hover:scale-105 transition-all">Retake</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-lg tracking-wide rounded-2xl shadow-xl shadow-blue-600/30 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center mt-2">
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (scheduleTime ? 'Schedule Token' : 'Join Queue Now')}
          </button>
        </form>
      </motion.div>
    </main>
  );
}
