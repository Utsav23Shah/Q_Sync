import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'YOUR_URL';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_KEY';

// We need to parse .env.local to get the actual keys
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

let url = '';
let key = '';

envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function runTest() {
  console.log("Fetching a vendor...");
  const { data: vendors, error: vErr } = await supabase.from('vendors').select('id, shop_name').limit(1);
  if (vErr || !vendors.length) {
    console.error("No vendors found", vErr);
    return;
  }
  const vendor = vendors[0];
  console.log("Using vendor:", vendor);

  console.log("Adding 3 test customers...");
  for (let i = 1; i <= 3; i++) {
    const { data: currentQueue } = await supabase.from('queue_tokens')
      .select('position').eq('vendor_id', vendor.id).in('status', ['WAITING', 'SERVING'])
      .order('position', { ascending: false }).limit(1);
    
    const nextPos = (currentQueue && currentQueue.length > 0) ? currentQueue[0].position + 1 : 1;

    const payload = {
      vendor_id: vendor.id, 
      customer_name: `Test Customer ${i}`, 
      customer_phone: '1234567890', 
      service_booked: 'General Check-in', 
      position: nextPos,
      token_number: nextPos,
      status: 'WAITING',
      is_scheduled: false
    };

    const { data, error } = await supabase.from('queue_tokens').insert([payload]).select().single();
    if (error) {
      console.error("Error adding customer", error);
    } else {
      console.log(`Added customer ${i} at position ${nextPos}`);
    }
  }

  console.log("Verifying queue length...");
  const { data: queue, error: qErr } = await supabase.from('queue_tokens').select('*').eq('vendor_id', vendor.id).in('status', ['WAITING', 'SERVING']);
  console.log(`Queue currently has ${queue.length} customers.`);

  console.log("Test completed. Vendor ID to check on Vercel is:", vendor.id);
  console.log(`Go to: https://frontend-lovat-seven-87.vercel.app/dashboard`);
}

runTest();
