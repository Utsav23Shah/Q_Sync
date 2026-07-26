import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcwcohgftnrkhbnwwebs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd2NvaGdmdG5ya2hibnd3ZWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4Mjg5MjIsImV4cCI6MjEwMDQwNDkyMn0.ZoJVbHa1XQ7xC8NLCMb3IFI1m_UCkvzA1TL0yMlQPmI';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testJoinQueue() {
  console.log("Fetching a vendor to join their queue...");
  const { data: vendors, error: vErr } = await supabase.from('vendors').select('*').limit(1);
  
  if (vErr || !vendors || vendors.length === 0) {
    console.log("No vendors found or error:", vErr);
    return;
  }
  
  const vendorId = vendors[0].id;
  console.log("Joining queue for vendor:", vendorId);

  const payload = {
    vendor_id: vendorId,
    customer_name: 'Test Customer',
    customer_phone: '9999999999',
    service_booked: 'General Check-in',
    position: 1
  };

  const { data, error } = await supabase.from('queue_tokens').insert([payload]).select();
  
  if (error) {
    console.error("Error inserting into queue_tokens:", JSON.stringify(error, null, 2));
  } else {
    console.log("Successfully joined queue:", data);
  }
}

testJoinQueue();
