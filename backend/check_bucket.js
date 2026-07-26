require('dotenv').config({ path: '../frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  console.log("Checking buckets...");
  const { data, error } = await supabase.storage.listBuckets();
  if (error) console.error("Error listing buckets:", error);
  else console.log("Buckets:", data.map(b => b.name));

  console.log("Trying to insert into queue_tokens to see if it fails due to RLS...");
  // test inserting a token
  const { data: v } = await supabase.from('vendors').select('id').limit(1).single();
  if (v) {
      const { error: qErr } = await supabase.from('queue_tokens').insert([{
         vendor_id: v.id,
         customer_name: 'Test',
         status: 'WAITING',
         position: 999,
         token_number: '999',
         is_scheduled: false
      }]);
      console.log("Insert queue token error:", qErr ? qErr.message : "Success");
  }
}
check();
