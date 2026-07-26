import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rcwcohgftnrkhbnwwebs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd2NvaGdmdG5ya2hibnd3ZWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4Mjg5MjIsImV4cCI6MjEwMDQwNDkyMn0.ZoJVbHa1XQ7xC8NLCMb3IFI1m_UCkvzA1TL0yMlQPmI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAll() {
  const { data: vendor } = await supabase.from('vendors').select('*').limit(1).single();
  const schedPayload = {
    vendor_id: vendor.id, customer_name: 'Test Sched 2', customer_phone: '222', 
    service_booked: 'General', photo_url: null,
    position: null,
    token_number: 'SCH',
    status: 'WAITING',
    is_scheduled: true,
    scheduled_time: '14:30'
  };
  const { data: t2, error: t2Err } = await supabase.from('queue_tokens').insert([schedPayload]).select().single();
  console.log(t2Err ? "Token 2 Error: " + t2Err.message : "Token 2 OK: " + (t2 ? t2.id : 'none'));
}
testAll();
