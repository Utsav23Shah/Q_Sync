const fs = require('fs');
const path = require('path');
const db = require('./db');

async function migrate() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Connecting to Supabase Database...');
    console.log('Executing schema.sql...');
    
    await db.query(schemaSql);
    
    console.log('Migration successful! All tables created.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}

migrate();
