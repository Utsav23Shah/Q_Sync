import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, CheckCircle, SkipForward, Clock, LogOut, UserPlus, QrCode, X, ArrowRight, BellRing, Trash2, History, Settings, Plus, Scissors, Camera, Loader2, Star, Shield, BarChart3, Sparkles, GripVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import Webcam from 'react-webcam';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function VendorDashboard() {
  const navigate = useNavigate();
  const [vendorData, setVendorData] = useState(null);
  
  const [activeTab, setActiveTab] = useState('LIVE_QUEUE'); // LIVE_QUEUE, HISTORY, PROFILE, FEEDBACK, ANALYTICS

  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [services, setServices] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  
  const [currentServing, setCurrentServing] = useState(null);
  
  // Manual Entry State
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualServices, setManualServices] = useState([]);
  const [manualPhoto, setManualPhoto] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const webcamRef = useRef(null);
  const [isAdding, setIsAdding] = useState(false);

  // Profile Edit State
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('');

  // AI State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);

  useEffect(() => {
    const data = localStorage.getItem('qsync_vendor');
    if (data) {
      const parsed = JSON.parse(data);
      setVendorData(parsed);
      fetchInitialData(parsed.id);
      
      const channel = supabase.channel('dashboard_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_tokens', filter: `vendor_id=eq.${parsed.id}` }, () => fetchQueue(parsed.id))
        .subscribe();
        
      // Auto-scheduler polling
      const interval = setInterval(async () => {
        const now = new Date();
        const timeString = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        
        const { data: scheduled } = await supabase.from('queue_tokens')
          .select('*').eq('vendor_id', parsed.id).eq('is_scheduled', true).eq('status', 'WAITING').lte('scheduled_time', timeString);
          
        if (scheduled && scheduled.length > 0) {
           for (const t of scheduled) {
             const { data: currentQ } = await supabase.from('queue_tokens').select('position').eq('vendor_id', parsed.id).eq('is_scheduled', false).in('status', ['WAITING', 'SERVING']).order('position', { ascending: false }).limit(1);
             const nextPos = (currentQ && currentQ.length > 0) ? currentQ[0].position + 1 : 1;
             await supabase.from('queue_tokens').update({ is_scheduled: false, position: nextPos, token_number: String(nextPos) }).eq('id', t.id);
           }
           fetchQueue(parsed.id);
        }
      }, 60000);
        
      return () => { 
        supabase.removeChannel(channel); 
        clearInterval(interval);
      }
    } else {
      navigate('/vendor/login');
    }
  }, [navigate]);

  async function fetchInitialData(vid) {
    await fetchQueue(vid);
    await fetchHistory(vid);
    await fetchServices(vid);
    await fetchFeedbacks(vid);
  }

  async function fetchQueue(vid) {
    const { data } = await supabase.from('queue_tokens').select('*').eq('vendor_id', vid).eq('is_scheduled', false).in('status', ['WAITING', 'SERVING']).order('position', { ascending: true });
    if (data) {
      const serving = data.find(q => q.status === 'SERVING');
      const waiting = data.filter(q => q.status === 'WAITING');
      setCurrentServing(serving || null);
      setQueue(waiting);
    }
  }

  async function fetchHistory(vid) {
    const { data } = await supabase.from('queue_tokens').select('*').eq('vendor_id', vid).eq('status', 'COMPLETED').order('completed_at', { ascending: false });
    if (data) setHistory(data);
  }

  async function fetchServices(vid) {
    const { data } = await supabase.from('vendor_services').select('*').eq('vendor_id', vid);
    if (data) setServices(data);
  }

  async function fetchFeedbacks(vid) {
    const { data } = await supabase.from('feedbacks').select('*').eq('vendor_id', vid).order('created_at', { ascending: false });
    if (data) setFeedbacks(data);
  }

  const handleReplyAdmin = async () => {
    const reply = prompt("Enter your reply to the admin:");
    if (reply !== null) {
       await supabase.from('vendors').update({ admin_message: null }).eq('id', vendorData.id);
       setVendorData({...vendorData, admin_message: null});
       alert("Reply sent to admin!");
    }
  };

  const handleCallNext = async () => {
    if (queue.length > 0) {
      const nextId = queue[0].id; // Queue is already JS sorted so index 0 is the VIP if any
      await supabase.from('queue_tokens').update({ status: 'SERVING' }).eq('id', nextId);
      fetchQueue(vendorData.id);
    }
  };

  const handleComplete = async () => {
    if (currentServing) {
      await supabase.from('queue_tokens').update({ status: 'COMPLETED', completed_at: new Date().toISOString() }).eq('id', currentServing.id);
      await reindexQueue();
      fetchHistory(vendorData.id);
    }
  };

  const handleSkip = async () => {
    if (currentServing) {
      const pushAmount = prompt("How many spots to push back?", "2");
      if (!pushAmount) return;
      const amt = parseInt(pushAmount);
      if (isNaN(amt) || amt <= 0) return;
      await supabase.from('queue_tokens').update({ position: currentServing.position + amt, status: 'WAITING' }).eq('id', currentServing.id);
      await reindexQueue();
    }
  };

  const handleRing = async (id, currentStrikes) => { 
    await supabase.from('queue_tokens').update({ strikes: (currentStrikes || 0) + 1 }).eq('id', id);
  };

  const handleDelete = async (id) => {
    await supabase.from('queue_tokens').update({ status: 'CANCELLED' }).eq('id', id);
    await reindexQueue();
  };

  async function reindexQueue() {
    const { data } = await supabase.from('queue_tokens').select('id, status, position').eq('vendor_id', vendorData.id).eq('is_scheduled', false).in('status', ['WAITING', 'SERVING']).order('position', { ascending: true });
    if (data) {
      for (let i = 0; i < data.length; i++) {
        await supabase.from('queue_tokens').update({ position: i + 1, token_number: String(i + 1) }).eq('id', data[i].id);
      }
    }
    fetchQueue(vendorData.id);
  }

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    if (sourceIndex === destIndex) return;

    // Optimistically update UI
    const newQueue = Array.from(queue);
    const [movedItem] = newQueue.splice(sourceIndex, 1);
    newQueue.splice(destIndex, 0, movedItem);
    setQueue(newQueue);

    // Update DB
    const allTokens = currentServing ? [currentServing, ...newQueue] : [...newQueue];
    for (let i = 0; i < allTokens.length; i++) {
      await supabase.from('queue_tokens').update({ position: i + 1, token_number: String(i + 1) }).eq('id', allTokens[i].id);
    }
    // No need to fetch immediately since we optimistically updated, but good for sync
    fetchQueue(vendorData.id);
  };

  const capturePhoto = () => {
    if (!webcamRef.current) {
      alert("Camera is not available. You can continue without a photo.");
      setManualPhoto(null);
      setIsCapturing(false);
      return;
    }
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setManualPhoto(imageSrc);
    } else {
      alert("Failed to capture photo. You can continue without one.");
      setManualPhoto(null);
    }
    setIsCapturing(false);
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (!manualName.trim()) return;
    setIsAdding(true);
    
    try {
      let photoUrl = null;
      if (manualPhoto) {
        const base64Res = await fetch(manualPhoto);
        const blob = await base64Res.blob();
        const fileName = `manual_${Date.now()}.jpg`;
        const { error: uploadErr } = await supabase.storage.from('live_photos').upload(fileName, blob);
        if (!uploadErr) {
          photoUrl = supabase.storage.from('live_photos').getPublicUrl(fileName).data.publicUrl;
        }
      }

      const { data: currentQ } = await supabase.from('queue_tokens').select('position').eq('vendor_id', vendorData.id).eq('is_scheduled', false).in('status', ['WAITING', 'SERVING']).order('position', { ascending: false }).limit(1);
      const nextPos = (currentQ && currentQ.length > 0) ? currentQ[0].position + 1 : 1;

      await supabase.from('queue_tokens').insert([{
        vendor_id: vendorData.id,
        customer_name: manualName,
        customer_phone: manualPhone,
        service_booked: manualServices.join(', '),
        photo_url: photoUrl,
        position: nextPos,
        token_number: String(nextPos)
      }]);
      
      await reindexQueue();
      
      setManualName(''); setManualPhone(''); setManualPhoto(null);
      setShowManualEntry(false);
    } catch(err) {
      alert("Error adding manually: " + err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('vendor_services').insert([{ vendor_id: vendorData.id, name: newServiceName, estimated_time_mins: parseInt(newServiceDuration), is_active: true }]);
    if(error) alert("Failed to add service. Error: " + error.message);
    else { setNewServiceName(''); setNewServiceDuration(''); fetchServices(vendorData.id); }
  };

  const handleLogout = () => {
    localStorage.removeItem('qsync_vendor');
    navigate('/vendor/login');
  };

  const generateAIInsights = async () => {
    setAiLoading(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        setAiInsights(`📊 AI Analysis Summary (Demo Mode)

✅ Strengths: Customers appreciate the service quality and friendly staff.
⚠️ Areas to Improve: Waiting times during peak hours could be reduced.
💡 Suggestion: Consider adding more staff during 12-2 PM and 5-7 PM rush hours.

To enable real AI insights, add VITE_GEMINI_API_KEY to your .env.local file.`);
        setAiLoading(false);
        return;
      }
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const feedbackTexts = feedbacks.map(f => `Rating: ${f.rating}/5, Comment: ${f.comment || 'No comment'}`).join('\n');
      const prompt = `You are an AI business assistant for a shop named ${vendorData.shop_name}. 
      Analyze the following customer feedbacks and provide a concise, actionable summary including:
      1. Overall Sentiment
      2. Key Strengths
      3. Areas for Improvement
      
      Feedbacks:
      ${feedbackTexts || 'No feedback yet.'}`;

      const result = await model.generateContent(prompt);
      setAiInsights(result.response.text());
    } catch (error) {
      setAiInsights("Failed to generate insights: " + error.message);
    }
    setAiLoading(false);
  };

  // --- ANALYTICS CALCULATIONS ---
  const getAnalyticsData = () => {
    let avgWait = 0;
    const dailyVolume = {};
    const serviceFreq = {};

    history.forEach(h => {
      // Calculate Wait (simplification: created_at to completed_at)
      if(h.completed_at && h.created_at) {
        const diffMins = (new Date(h.completed_at) - new Date(h.created_at)) / 60000;
        avgWait += diffMins;
      }
      
      // Daily Volume
      const day = new Date(h.completed_at).toLocaleDateString(undefined, { weekday: 'short' });
      dailyVolume[day] = (dailyVolume[day] || 0) + 1;

      // Services
      const svcs = h.service_booked ? h.service_booked.split(', ') : ['General'];
      svcs.forEach(s => {
        serviceFreq[s] = (serviceFreq[s] || 0) + 1;
      });
    });

    const avgWaitResult = history.length > 0 ? Math.round(avgWait / history.length) : 0;
    const chartData = Object.keys(dailyVolume).map(k => ({ name: k, customers: dailyVolume[k] }));
    const pieData = Object.keys(serviceFreq).map(k => ({ name: k, value: serviceFreq[k] }));

    return { avgWaitResult, chartData, pieData };
  };
  const { avgWaitResult, chartData, pieData } = getAnalyticsData();


  if (!vendorData) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-100 flex-col hidden md:flex h-screen sticky top-0">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Q_<span className="text-blue-600">Sync</span></h1>
          <p className="text-sm font-medium text-slate-500 mt-1 truncate">{vendorData.shop_name}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('LIVE_QUEUE')} className={`w-full flex items-center gap-3 px-4 py-3 font-semibold rounded-xl transition-colors ${activeTab === 'LIVE_QUEUE' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Users className="w-5 h-5" /> Live Queue
          </button>
          <button onClick={() => setActiveTab('HISTORY')} className={`w-full flex items-center gap-3 px-4 py-3 font-semibold rounded-xl transition-colors ${activeTab === 'HISTORY' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <History className="w-5 h-5" /> History
          </button>
          <button onClick={() => setActiveTab('ANALYTICS')} className={`w-full flex items-center gap-3 px-4 py-3 font-semibold rounded-xl transition-colors ${activeTab === 'ANALYTICS' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <BarChart3 className="w-5 h-5" /> Analytics
          </button>
          <button onClick={() => setActiveTab('FEEDBACK')} className={`w-full flex items-center gap-3 px-4 py-3 font-semibold rounded-xl transition-colors ${activeTab === 'FEEDBACK' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Star className="w-5 h-5" /> Feedback & AI
          </button>
          <button onClick={() => setActiveTab('PROFILE')} className={`w-full flex items-center gap-3 px-4 py-3 font-semibold rounded-xl transition-colors ${activeTab === 'PROFILE' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Settings className="w-5 h-5" /> Profile & Services
          </button>
        </nav>
        
        <div className="p-4 border-t border-slate-100 space-y-2">
          <button onClick={handleLogout} className="flex items-center justify-center w-full gap-2 py-3 text-slate-600 font-bold border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors">Switch Account</button>
          <button onClick={handleLogout} className="flex items-center justify-center w-full gap-2 py-3 text-red-600 font-bold bg-red-50 hover:bg-red-100 rounded-xl transition-colors">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8">
        
        {/* MOBILE TABS */}
        <div className="md:hidden mb-6 flex items-center justify-between">
          <div className="flex gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-100 overflow-x-auto flex-1 mr-4">
            <button onClick={()=>setActiveTab('LIVE_QUEUE')} className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap ${activeTab==='LIVE_QUEUE'?'bg-blue-600 text-white':'text-slate-600'}`}>Queue</button>
            <button onClick={()=>setActiveTab('ANALYTICS')} className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap ${activeTab==='ANALYTICS'?'bg-blue-600 text-white':'text-slate-600'}`}>Analytics</button>
            <button onClick={()=>setActiveTab('FEEDBACK')} className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap ${activeTab==='FEEDBACK'?'bg-blue-600 text-white':'text-slate-600'}`}>Feedback</button>
            <button onClick={()=>setActiveTab('PROFILE')} className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap ${activeTab==='PROFILE'?'bg-blue-600 text-white':'text-slate-600'}`}>Profile</button>
          </div>
        </div>

        {vendorData.admin_message && (
          <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex gap-3">
              <Shield className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <h3 className="font-bold text-amber-800">Message from Super Admin</h3>
                <p className="text-amber-700 mt-1">{vendorData.admin_message}</p>
              </div>
            </div>
            <button onClick={handleReplyAdmin} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors shadow-sm">Reply</button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* TAB 1: LIVE QUEUE */}
          {activeTab === 'LIVE_QUEUE' && (
            <motion.div key="LIVE_QUEUE" initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-20}} transition={{ duration: 0.2 }}>
              <header className="mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900">Live Queue</h2>
                <p className="text-slate-500 mt-1 font-medium">Manage your active customers.</p>
              </div>
              <div className="flex gap-4">
                <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <div><p className="text-xs text-slate-400 font-semibold uppercase">Waiting</p><p className="text-xl font-bold text-slate-900">{queue.length}</p></div>
                </div>
              </div>
            </header>

            <div className="mb-6">
              <button onClick={() => setShowManualEntry(true)} className="py-3 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-sm flex items-center gap-2">
                <UserPlus className="w-5 h-5" /> Add Customer
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Serving Card */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Currently Serving</h3>
                  {currentServing ? (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
                      {currentServing.photo_url ? (
                        <img src={currentServing.photo_url} alt="Customer" className="w-20 h-20 rounded-full mx-auto mb-3 object-cover border-4 border-white shadow-sm" />
                      ) : (
                        <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold border-4 border-white">#{currentServing.token_number || currentServing.position}</div>
                      )}
                      <h4 className="text-xl font-bold text-slate-900 mb-1 flex items-center justify-center gap-2">
                        {currentServing.customer_name}
                      </h4>
                      <p className="text-sm text-blue-600 font-medium mb-1">Service: {currentServing.service_booked || 'None'}</p>
                      <p className="text-xs text-slate-500 mb-6">Phone: {currentServing.customer_phone || 'N/A'}</p>
                      
                      <button onClick={handleComplete} className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-sm mb-3 flex items-center justify-center gap-2"><CheckCircle className="w-5 h-5" /> Done</button>
                      <div className="flex gap-2">
                        <button onClick={handleSkip} className="flex-1 py-3 bg-amber-100 text-amber-700 hover:bg-amber-200 font-bold rounded-xl flex justify-center gap-2"><SkipForward className="w-4 h-4"/> Push</button>
                        <button onClick={() => handleRing(currentServing.id, currentServing.strikes)} className="flex-1 py-3 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-bold rounded-xl flex justify-center gap-2"><BellRing className="w-4 h-4"/> Ring</button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4"><Users className="w-8 h-8" /></div>
                      <p className="text-slate-500 font-medium">No one is currently being served.</p>
                    </div>
                  )}
                </div>
                <button onClick={handleCallNext} disabled={queue.length === 0 || currentServing !== null} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-sm disabled:opacity-50 text-lg flex items-center justify-center gap-2">
                  Call Next <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              {/* Waiting List */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-full min-h-[400px]">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Waiting List</h3>
                  {queue.length > 0 ? (
                    <DragDropContext onDragEnd={handleDragEnd}>
                      <Droppable droppableId="waiting-list">
                        {(provided) => (
                          <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                              {queue.map((customer, idx) => (
                                <Draggable key={customer.id} draggableId={customer.id.toString()} index={idx}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white transition-colors rounded-xl border shadow-sm gap-4 ${snapshot.isDragging ? 'shadow-lg border-blue-400 bg-blue-50/50 scale-[1.02] z-50' : 'border-slate-100 hover:bg-slate-50'}`}
                                      style={provided.draggableProps.style}
                                    >
                                      <div className="flex items-center gap-4">
                                        <div {...provided.dragHandleProps} style={{ touchAction: 'none' }} className="p-2 text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing">
                                          <GripVertical className="w-5 h-5" />
                                        </div>
                                        <div className="w-10 h-10 font-black rounded-xl flex items-center justify-center shadow-inner bg-blue-50 border border-blue-100 text-blue-700">{customer.position}</div>
                                        {customer.photo_url ? (
                                           <img src={customer.photo_url} alt="Cust" className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" />
                                        ) : (
                                           <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 border-2 border-white shadow-sm"><UserPlus className="w-5 h-5"/></div>
                                        )}
                                        <div>
                                          <p className="font-bold text-slate-900 flex items-center gap-1">
                                            {customer.customer_name}
                                          </p>
                                          <p className="text-xs text-slate-500 font-medium">{customer.service_booked || 'General'} <span className="mx-1">•</span> <span className="text-blue-600 font-bold">#{customer.token_number || customer.position}</span></p>
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <button onClick={() => handleRing(customer.id, customer.strikes)} className="p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors shadow-sm" title="Ring"><BellRing className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(customer.id)} className="p-2.5 bg-red-50 border border-red-100 text-red-600 rounded-xl hover:bg-red-100 transition-colors shadow-sm" title="Remove"><Trash2 className="w-4 h-4" /></button>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  ) : (<div className="text-center py-16"><p className="text-slate-500 font-medium">The queue is empty.</p></div>)}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB: ANALYTICS */}
        {activeTab === 'ANALYTICS' && (
           <motion.div key="ANALYTICS" initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-20}} transition={{ duration: 0.2 }}>
             <header className="mb-8">
               <h2 className="text-3xl font-extrabold text-slate-900">Analytics</h2>
               <p className="text-slate-500 mt-1 font-medium">Business insights and performance.</p>
             </header>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
               <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center gap-4">
                 <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center"><Users className="w-8 h-8"/></div>
                 <div>
                   <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Served</p>
                   <p className="text-4xl font-black text-slate-900">{history.length}</p>
                 </div>
               </div>
               <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center gap-4">
                 <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><Clock className="w-8 h-8"/></div>
                 <div>
                   <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Avg Wait Time</p>
                   <p className="text-4xl font-black text-slate-900">{avgWaitResult} <span className="text-xl text-slate-500">mins</span></p>
                 </div>
               </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                 <h3 className="font-bold text-slate-900 mb-6">Daily Customer Volume</h3>
                 <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={chartData}>
                       <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                       <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                       <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                       <Bar dataKey="customers" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
               </div>
               <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                 <h3 className="font-bold text-slate-900 mb-6">Service Popularity</h3>
                 <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                         {pieData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                         ))}
                       </Pie>
                       <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                     </PieChart>
                   </ResponsiveContainer>
                 </div>
                 <div className="flex flex-wrap gap-3 mt-4 justify-center">
                    {pieData.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm font-medium text-slate-600"><div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>{d.name}</div>
                    ))}
                 </div>
               </div>
             </div>
           </motion.div>
        )}

        {/* TAB 4: FEEDBACK & AI */}
          {activeTab === 'FEEDBACK' && (
            <motion.div key="FEEDBACK" initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-20}} transition={{ duration: 0.2 }}>
              <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900">Feedback & AI Insights</h2>
                <p className="text-slate-500 mt-1 font-medium">Understand what customers are saying.</p>
              </div>
              <button onClick={generateAIInsights} disabled={aiLoading || feedbacks.length === 0} className="py-3 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50 transition-all">
                {aiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                Generate AI Summary
              </button>
            </header>

            {aiInsights && (
              <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="mb-8 p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-indigo-500"></div>
                <h3 className="text-lg font-bold text-indigo-900 mb-3 flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-600"/> Gemini AI Summary</h3>
                <div className="text-indigo-800 text-sm whitespace-pre-wrap leading-relaxed">
                  {aiInsights}
                </div>
              </motion.div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {feedbacks.length > 0 ? feedbacks.map(f => (
                <div key={f.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-slate-900">{f.customer_name || 'Anonymous'}</h4>
                      <p className="text-xs text-slate-400">{new Date(f.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < f.rating ? 'fill-current' : 'text-slate-200'}`} />
                      ))}
                    </div>
                  </div>
                  {f.comment && <p className="text-slate-600 italic bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm">"{f.comment}"</p>}
                </div>
              )) : (
                <div className="col-span-full py-16 text-center text-slate-500 font-medium">No feedback collected yet.</div>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB: HISTORY & PROFILE (Keeping basic structure for brevity) */}
        {activeTab === 'HISTORY' && (
             <motion.div key="HISTORY" initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-20}} transition={{ duration: 0.2 }}>
               <header className="mb-8"><h2 className="text-3xl font-extrabold text-slate-900">History Register</h2></header>
               <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                 <table className="w-full text-left border-collapse">
                   <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                       <th className="p-4">#</th><th className="p-4">Token</th><th className="p-4">Name</th><th className="p-4">Service</th><th className="p-4">Completed</th>
                   </tr></thead>
                   <tbody>
                     {history.length > 0 ? history.map((h, idx) => (
                       <tr key={h.id} className="border-b border-slate-100 hover:bg-slate-50">
                         <td className="p-4 font-bold text-slate-400">{history.length - idx}</td>
                         <td className="p-4 font-bold text-slate-900">#{h.token_number || h.position}</td>
                         <td className="p-4 font-medium text-slate-700">{h.customer_name}</td>
                         <td className="p-4 text-blue-600 font-medium truncate max-w-[150px]">{h.service_booked || '-'}</td>
                         <td className="p-4 text-slate-500 text-sm">{new Date(h.completed_at).toLocaleTimeString()}</td>
                       </tr>
                     )) : (<tr><td colSpan="5" className="p-8 text-center text-slate-500">No history found.</td></tr>)}
                   </tbody>
                 </table>
               </div>
             </motion.div>
          )}

        {activeTab === 'PROFILE' && (
             <motion.div key="PROFILE" initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-20}} transition={{ duration: 0.2 }}>
               <header className="mb-8"><h2 className="text-3xl font-extrabold text-slate-900">Profile & Services</h2></header>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="space-y-8">
                   <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
                     <QRCode value={`https://frontend-lovat-seven-87.vercel.app/v/${vendorData.id}`} size={150} className="mb-4" />
                     <p className="text-sm font-medium text-slate-500 text-center">Customers scan this to join.</p>
                   </div>
                 </div>
                 <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-xl font-bold text-slate-900 mb-6">Add New Service</h3>
                    <form onSubmit={handleAddService} className="space-y-4">
                      <input type="text" value={newServiceName} onChange={e=>setNewServiceName(e.target.value)} required placeholder="Service Name" className="w-full px-4 py-3 bg-slate-50 border rounded-xl" />
                      <input type="number" value={newServiceDuration} onChange={e=>setNewServiceDuration(e.target.value)} required placeholder="Duration (Mins)" className="w-full px-4 py-3 bg-slate-50 border rounded-xl" />
                      <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl">Add Service</button>
                    </form>
                 </div>
               </div>
             </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Manual Entry Modal */}
      <AnimatePresence>
        {showManualEntry && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div initial={{scale:0.9, y: 20}} animate={{scale:1, y: 0}} exit={{scale:0.9, y: 20}} transition={{ type: "spring", duration: 0.4 }} className="bg-white/90 backdrop-blur-xl border border-white rounded-3xl shadow-2xl p-8 max-w-sm w-full relative my-8">
              <button onClick={() => setShowManualEntry(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors"><X className="w-5 h-5"/></button>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Manual Entry</h2>
              <form onSubmit={handleManualAdd} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
                  <input type="text" autoFocus value={manualName} onChange={e=>setManualName(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Mobile Number</label>
                  <input type="tel" value={manualPhone} onChange={e=>setManualPhone(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
                </div>
                


                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Service Booked</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-3">
                    {services.length > 0 ? (
                      services.map(s => (
                        <label key={s.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                          <input type="checkbox" checked={manualServices.includes(s.name)} onChange={() => { setManualServices(prev => prev.includes(s.name) ? prev.filter(x => x !== s.name) : [...prev, s.name]) }} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
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
                
                <button type="submit" disabled={isAdding} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl mt-4 flex items-center justify-center">
                  {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add to Queue'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
