import { createClient } from '@supabase/supabase-js';
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

async function addTestCustomerWithPhoto() {
  const { data: vendors } = await supabase.from('vendors').select('id').limit(1);
  const vendorId = vendors[0].id;

  const { data: currentQueue } = await supabase.from('queue_tokens')
    .select('position').eq('vendor_id', vendorId).in('status', ['WAITING', 'SERVING'])
    .order('position', { ascending: false }).limit(1);
    
  const nextPos = (currentQueue && currentQueue.length > 0) ? currentQueue[0].position + 1 : 1;

  const payload = {
    vendor_id: vendorId, 
    customer_name: `AI Photo Test`, 
    customer_phone: '9999999999', 
    service_booked: 'VIP Check-in', 
    photo_url: 'https://rcwcohgftnrkhbnwwebs.supabase.co/storage/v1/object/public/live_photos/test_upload_1785098419563.jpg',
    position: nextPos,
    token_number: nextPos,
    status: 'WAITING',
    is_scheduled: false
  };

  await supabase.from('queue_tokens').insert([payload]);
  console.log("Added customer with photo! Position:", nextPos);
}

addTestCustomerWithPhoto();
