import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://rcwcohgftnrkhbnwwebs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd2NvaGdmdG5ya2hibnd3ZWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4Mjg5MjIsImV4cCI6MjEwMDQwNDkyMn0.ZoJVbHa1XQ7xC8NLCMb3IFI1m_UCkvzA1TL0yMlQPmI'
);

async function test() {
  console.log('Testing feedback insert...');
  const { data: vendors } = await supabase.from('vendors').select('id').limit(1);
  if (!vendors || vendors.length === 0) {
    console.log('No vendors found');
    return;
  }
  const vid = vendors[0].id;

  const { data, error } = await supabase.from('feedbacks').insert([{
    vendor_id: vid,
    customer_name: 'Test Customer',
    rating: 5,
    comment: 'Testing from script'
  }]);

  if (error) {
    console.log('Error inserting feedback:', error);
  } else {
    console.log("Success:", data);
  }
}

test();
