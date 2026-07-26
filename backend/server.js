import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// --- VENDOR ROUTES ---

// Get Vendor Details and their Services
app.get('/api/vendor/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch vendor
    const { data: vendor, error: vendorErr } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', id)
      .single();
      
    if (vendorErr && vendorErr.code !== 'PGRST116') throw vendorErr;
    
    // Fetch services
    const { data: services, error: servErr } = await supabase
      .from('vendor_services')
      .select('*')
      .eq('vendor_id', id);
      
    if (servErr) throw servErr;

    res.json({ vendor, services: services || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create or Update Vendor (Login/Register mock)
app.post('/api/vendor', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vendors')
      .upsert([req.body])
      .select();
    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a Custom Service
app.post('/api/vendor/:id/services', async (req, res) => {
  try {
    const { id } = req.params;
    const { service_name, duration_mins, icon, price } = req.body;
    
    const { data, error } = await supabase
      .from('vendor_services')
      .insert([{ vendor_id: id, service_name, duration_mins, icon, price }])
      .select();
      
    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- QUEUE ROUTES ---

// Get Live Queue for a Vendor (Excluding COMPLETED/DELETED)
app.get('/api/queue/:vendorId', async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { data, error } = await supabase
      .from('queue_tokens')
      .select('*')
      .eq('vendor_id', vendorId)
      .in('status', ['WAITING', 'SERVING'])
      .order('position', { ascending: true });
      
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get History for a Vendor (Only COMPLETED)
app.get('/api/queue/:vendorId/history', async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { data, error } = await supabase
      .from('queue_tokens')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('status', 'COMPLETED')
      .order('completed_at', { ascending: false });
      
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Join Queue (Customer or Manual Entry)
app.post('/api/queue/join', async (req, res) => {
  try {
    const { vendor_id, customer_name, customer_phone, service_booked, photo_url } = req.body;
    
    // Get current max position to append to end of queue
    const { data: currentQueue } = await supabase
      .from('queue_tokens')
      .select('position')
      .eq('vendor_id', vendor_id)
      .in('status', ['WAITING', 'SERVING'])
      .order('position', { ascending: false })
      .limit(1);
      
    const nextPosition = (currentQueue && currentQueue.length > 0) ? currentQueue[0].position + 1 : 1;

    const { data, error } = await supabase
      .from('queue_tokens')
      .insert([{
        vendor_id,
        customer_name,
        customer_phone,
        service_booked,
        photo_url,
        position: nextPosition
      }])
      .select();
      
    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Queue Status (Ring, Complete, Push Back, Delete)
app.patch('/api/queue/:ticketId/status', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { action } = req.body; // 'CALL', 'COMPLETE', 'PUSH_BACK', 'DELETE'
    
    // Fetch the ticket first to get vendor_id
    const { data: ticket } = await supabase
      .from('queue_tokens')
      .select('*')
      .eq('id', ticketId)
      .single();
      
    if (!ticket) return res.status(404).json({error: 'Ticket not found'});

    if (action === 'CALL') {
      await supabase.from('queue_tokens').update({ status: 'SERVING' }).eq('id', ticketId);
    } 
    else if (action === 'COMPLETE') {
      await supabase.from('queue_tokens').update({ status: 'COMPLETED', completed_at: new Date() }).eq('id', ticketId);
      // Re-index remaining queue
      await reindexQueue(ticket.vendor_id);
    } 
    else if (action === 'DELETE') {
      await supabase.from('queue_tokens').update({ status: 'CANCELLED' }).eq('id', ticketId);
      await reindexQueue(ticket.vendor_id);
    }
    else if (action === 'PUSH_BACK') {
      // Move this ticket's position + 2, and shift others up
      await supabase.from('queue_tokens').update({ position: ticket.position + 2, status: 'WAITING' }).eq('id', ticketId);
      await reindexQueue(ticket.vendor_id);
    }
    
    res.json({ success: true, action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to fix positions so they are perfectly sequential (1,2,3,4) after a deletion or push back
async function reindexQueue(vendorId) {
  const { data: activeQueue } = await supabase
    .from('queue_tokens')
    .select('id, position')
    .eq('vendor_id', vendorId)
    .in('status', ['WAITING', 'SERVING'])
    .order('position', { ascending: true });
    
  if (activeQueue) {
    for (let i = 0; i < activeQueue.length; i++) {
      await supabase.from('queue_tokens').update({ position: i + 1 }).eq('id', activeQueue[i].id);
    }
  }
}

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
