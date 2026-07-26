import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Webcam from 'react-webcam';
import { Camera, CheckCircle, Loader2, Users, MapPin, Clock, ArrowDownCircle, Star, MessageSquareHeart } from 'lucide-react';
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
  const webcamRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [liveQueue, setLiveQueue] = useState([]);
  const [eta, setEta] = useState(0);

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
        // Calculate ETA
        if (!myTicketData.is_scheduled && myTicketData.status !== 'COMPLETED') {
          let etaMins = data.filter(q => !q.is_scheduled && q.position < myTicketData.position).reduce((acc, q) => {
            const booked = q.service_booked ? q.service_booked.split(', ') : [];
            let rowMins = 0;
            booked.forEach(b => {
              const svc = vendorServices.find(s => s.name === b);
              rowMins += (svc ? (parseInt(svc.estimated_time_mins) || 15) : 15);
            });
            if(booked.length === 0) rowMins = 15;
            return acc + rowMins;
          }, 0);
          setEta(etaMins);
        }
      }
    }
  }

  const capturePhoto = () => {
    const imageSrc = webcamRef.current.getScreenshot();
    setPhoto(imageSrc);
    setIsCapturing(false);
  };

  const handleJoinQueue = async (e) => {
    e.preventDefault();
    if (!photo) {
      alert("Live photo is required.");
      return;
    }
    if (selectedServices.length === 0) {
      alert("Please select at least one service.");
      return;
    }
    setLoading(true);

    try {
      const base64Res = await fetch(photo);
      const blob = await base64Res.blob();
      const fileName = `live_${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage.from('live_photos').upload(fileName, blob);
      
      let photoUrl = null;
      if (!uploadErr) photoUrl = supabase.storage.from('live_photos').getPublicUrl(fileName).data.publicUrl;

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
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8 border border-slate-100 text-center">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <MessageSquareHeart className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Thank You for Visiting!</h2>
          <p className="text-slate-500 font-medium mb-8">We hope you had a great experience. Sorry for any wait!</p>
          <button onClick={() => { setShowThankYou(false); setTicket(null); }} className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl shadow-md">
            Done
          </button>
        </motion.div>
      </main>
    );
  }

  if (ticket) {
    if (ticket.status === 'COMPLETED') {
      return (
        <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8 border border-slate-100 text-center">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Service Completed!</h2>
            <p className="text-slate-500 font-medium mb-8">How was your experience with {vendorData.shop_name}?</p>
            
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setFeedbackRating(star)} className="focus:outline-none transition-transform hover:scale-110 active:scale-95">
                  <Star className={`w-10 h-10 ${feedbackRating >= star ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                </button>
              ))}
            </div>

            <textarea 
              placeholder="Leave a comment (optional)..."
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl mb-6 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none h-24 text-sm"
            />

            <div className="space-y-3">
              <button onClick={handleSubmitFeedback} disabled={loading} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-md flex justify-center items-center">
                {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Submit Feedback'}
              </button>
              <button onClick={handleSubmitFeedback} disabled={loading} className="w-full py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">
                Skip
              </button>
            </div>
          </motion.div>
        </main>
      );
    }
    const peopleAhead = liveQueue.filter(q => q.position < ticket.position).length;

    return (
      <main className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-md mx-auto">
          {ticket.is_scheduled ? (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 mb-6">
              <div className="bg-indigo-600 p-8 text-center text-white">
                <Clock className="w-16 h-16 mx-auto mb-4 opacity-90" />
                <h2 className="text-2xl font-bold">Scheduled for {ticket.scheduled_time}</h2>
                <p className="opacity-80 font-medium mt-1">You will be automatically added to the live queue at this time.</p>
              </div>
              <div className="p-6">
                 <button onClick={handleCancel} disabled={loading} className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
                    Cancel My Ticket
                 </button>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 mb-6">
              
              {currentServing ? (
                <div className="bg-slate-900 p-4 text-center text-white flex justify-center items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  <span className="font-bold">Currently Serving: #{currentServing.token_number || currentServing.position}</span>
                </div>
              ) : (
                <div className="bg-slate-900 p-4 text-center text-slate-300 font-medium">
                  Vendor is not currently serving anyone.
                </div>
              )}

              <div className="bg-blue-600 p-6 text-center text-white">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-90" />
                <h2 className="text-xl font-bold">You're in line!</h2>
                <p className="font-medium mt-1 opacity-90">{peopleAhead === 0 ? "You're next!" : `${peopleAhead} people ahead of you`}</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center">
                    <p className="text-slate-500 font-semibold mb-1 text-xs uppercase">Token</p>
                    <p className="text-3xl font-black text-slate-900">#{ticket.token_number || ticket.position}</p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center">
                    <p className="text-slate-500 font-semibold mb-1 text-xs uppercase">Est. Wait</p>
                    <p className="text-3xl font-black text-blue-600">{eta} <span className="text-sm">min</span></p>
                  </div>
                </div>
                
                {ticket.status === 'WAITING' && (
                  <div className="space-y-3">
                    <button onClick={handlePushBack} disabled={loading} className="w-full py-3 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
                      <ArrowDownCircle className="w-5 h-5" /> I'm Running Late (Push Back)
                    </button>
                    <button onClick={handleCancel} disabled={loading} className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
                      Cancel My Ticket
                    </button>
                  </div>
                )}
                {ticket.status === 'SERVING' && <div className="p-3 bg-emerald-100 text-emerald-800 font-bold rounded-xl text-center">IT IS YOUR TURN!</div>}
              </div>
            </motion.div>
          )}

          {vendorData.latitude && vendorData.longitude && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-6 relative z-0">
              <div className="h-48">
                <MapContainer center={[vendorData.latitude, vendorData.longitude]} zoom={15} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[vendorData.latitude, vendorData.longitude]}>
                    <Popup>{vendorData.shop_name}</Popup>
                  </Marker>
                </MapContainer>
              </div>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${vendorData.latitude},${vendorData.longitude}`} target="_blank" rel="noreferrer" className="block w-full py-3 bg-emerald-600 text-white font-bold text-center hover:bg-emerald-700 transition-colors">
                <div className="flex items-center justify-center gap-2"><MapPin className="w-5 h-5"/> Get Directions</div>
              </a>
            </div>
          )}

          {!ticket.is_scheduled && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-bold text-slate-800 mb-4">Live Queue Tracker</h3>
              <div className="space-y-3">
                {liveQueue.map((q) => (
                  <div key={q.id} className={`flex items-center gap-4 p-3 rounded-xl border ${q.id === ticket.id ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100'}`}>
                    <div className={`w-10 h-10 font-bold rounded-lg flex items-center justify-center ${q.id === ticket.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>
                      {q.position}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{q.id === ticket.id ? 'You' : q.customer_name}</p>
                      <p className="text-xs text-slate-500">{q.service_booked}</p>
                    </div>
                    {q.status === 'SERVING' && <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full uppercase">Serving</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 flex flex-col items-center py-10">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8 border border-slate-100">
        <div className="text-center mb-8">
           <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
             <Users className="w-8 h-8" />
           </div>
           <h1 className="text-2xl font-extrabold text-slate-900">{vendorData.shop_name}</h1>
           <p className="text-slate-500 font-medium mt-1">Join the virtual queue</p>
        </div>

        <form onSubmit={handleJoinQueue} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Your Name</label>
            <input type="text" required value={name} onChange={e=>setName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none" placeholder="Enter full name" />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Mobile Number</label>
            <input type="tel" required value={phone} onChange={e=>setPhone(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none" placeholder="+1 234 567 8900" />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Select Services</label>
            <div className="space-y-2 max-h-48 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-3">
              {vendorServices.length > 0 ? (
                vendorServices.map(s => (
                  <label key={s.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      checked={selectedServices.includes(s.name)}
                      onChange={() => {
                        setSelectedServices(prev => prev.includes(s.name) ? prev.filter(x => x !== s.name) : [...prev, s.name])
                      }}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium text-slate-700">{s.name} <span className="text-slate-400 text-sm">({s.estimated_time_mins}m)</span></span>
                  </label>
                ))
              ) : (
                <label className="flex items-center gap-3 p-2">
                  <input type="checkbox" checked={true} readOnly className="w-5 h-5 rounded border-slate-300 text-blue-600" />
                  <span className="font-medium text-slate-700">General Check-in</span>
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Schedule for Later (Optional)</label>
            <input type="time" value={scheduleTime} onChange={e=>setScheduleTime(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
            <p className="text-xs text-slate-500 mt-1">Leave blank to join immediately.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Live Photo Verification</label>
            {!photo && !isCapturing && (
              <button type="button" onClick={() => setIsCapturing(true)} className="w-full h-32 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
                <Camera className="w-8 h-8 mb-2 opacity-50" />
                <span className="font-semibold">Tap to open camera</span>
              </button>
            )}
            {isCapturing && (
              <div className="relative rounded-xl overflow-hidden bg-black z-10">
                <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: "user" }} mirrored={true} className="w-full object-cover" />
                <button type="button" onClick={capturePhoto} className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-white text-slate-900 font-bold rounded-full shadow-lg">
                  Capture
                </button>
              </div>
            )}
            {photo && (
              <div className="relative rounded-xl overflow-hidden border border-slate-200">
                <img src={photo} alt="Selfie" className="w-full object-cover h-48" />
                <button type="button" onClick={() => {setPhoto(null); setIsCapturing(true);}} className="absolute top-2 right-2 p-2 bg-white/90 backdrop-blur text-slate-900 font-bold rounded-lg text-xs">Retake</button>
              </div>
            )}
          </div>

          <button type="submit" disabled={loading || !photo} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center mt-4">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (scheduleTime ? 'Schedule Token' : 'Join Queue Now')}
          </button>
        </form>
      </motion.div>
    </main>
  );
}
