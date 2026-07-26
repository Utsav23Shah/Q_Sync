import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcwcohgftnrkhbnwwebs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd2NvaGdmdG5ya2hibnd3ZWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4Mjg5MjIsImV4cCI6MjEwMDQwNDkyMn0.ZoJVbHa1XQ7xC8NLCMb3IFI1m_UCkvzA1TL0yMlQPmI';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testButtons() {
  // Find a ticket in WAITING or SERVING state
  const { data: q, error: err1 } = await supabase.from('queue_tokens').select('*').in('status', ['WAITING', 'SERVING']).limit(1);
  
  if (err1 || !q || q.length === 0) {
    console.log("No queue tokens found to test. Error:", err1);
    return;
  }
  
  const ticketId = q[0].id;
  console.log("Testing UPDATE on ticket:", ticketId);
  
  // Try to update it to COMPLETED
  const { data, error } = await supabase.from('queue_tokens').update({ status: 'SERVING' }).eq('id', ticketId).select();
  
  if (error) {
    console.error("Error updating ticket:", JSON.stringify(error, null, 2));
  } else {
    console.log("Successfully updated ticket:", data);
  }
}

testButtons();
