import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcwcohgftnrkhbnwwebs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd2NvaGdmdG5ya2hibnd3ZWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4Mjg5MjIsImV4cCI6MjEwMDQwNDkyMn0.ZoJVbHa1XQ7xC8NLCMb3IFI1m_UCkvzA1TL0yMlQPmI';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('vendors').select('*').limit(1);
  console.log("Error:", error);
  console.log("Data:", data);
}

check();
