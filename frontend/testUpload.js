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

async function testUpload() {
  console.log("Creating a dummy image...");
  // Create a tiny 1x1 base64 GIF image
  const base64Img = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
  
  const base64Res = await fetch(base64Img);
  const blob = await base64Res.blob();
  
  const fileName = `test_upload_${Date.now()}.jpg`;
  console.log("Uploading file:", fileName);
  
  const { data, error: uploadErr } = await supabase.storage.from('live_photos').upload(fileName, blob);
  
  if (uploadErr) {
    console.error("❌ UPLOAD FAILED:", uploadErr.message);
  } else {
    console.log("✅ UPLOAD SUCCESS:", data);
    const pubUrl = supabase.storage.from('live_photos').getPublicUrl(fileName).data.publicUrl;
    console.log("✅ PUBLIC URL:", pubUrl);
  }
}

testUpload();
