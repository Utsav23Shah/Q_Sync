import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rcwcohgftnrkhbnwwebs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd2NvaGdmdG5ya2hibnd3ZWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4Mjg5MjIsImV4cCI6MjEwMDQwNDkyMn0.ZoJVbHa1XQ7xC8NLCMb3IFI1m_UCkvzA1TL0yMlQPmI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testInsert() {
  console.log("Testing insert...");
  const payload = {
    id: 'VENDOR_TEST_' + Math.floor(Math.random() * 100000),
    shop_name: 'Test Shop',
    contact_number: '1234567890',
    password: 'password123',
    address: 'Test Address',
    category: 'SALON',
    servicing_units: 1,
    latitude: 20.0,
    longitude: 78.0
  };

  const { data, error } = await supabase.from('vendors').insert([payload]).select();
  if (error) {
    console.error("Error inserting:", error);
  } else {
    console.log("Success:", data);
  }
}

testInsert();
