const db = require('./db');

async function seed() {
  try {
    console.log('Seeding fake vendor...');
    
    // Insert Vendor
    const vendorRes = await db.query(
      `INSERT INTO vendors (shop_name, address, contact_number, category, servicing_units) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['Premium Salon & Spa', '123 Fake Street, Tech City', '555-0199', 'SALON', 2]
    );
    const vendorId = vendorRes.rows[0].id;

    // Insert Services
    await db.query(
      `INSERT INTO vendor_services (vendor_id, name, estimated_time_mins) VALUES 
       ($1, $2, $3), ($1, $4, $5)`,
      [vendorId, 'Haircut', 20, 'Massage', 45]
    );

    console.log('--------------------------------------------------');
    console.log('SUCCESS! Fake vendor created.');
    console.log(`TEST URL: http://localhost:5173/v/${vendorId}`);
    console.log('--------------------------------------------------');

  } catch (err) {
    if (err.constraint === 'vendors_contact_number_key') {
      console.log('Fake vendor already exists in the database. Fetching their ID...');
      const v = await db.query(`SELECT id FROM vendors WHERE contact_number = '555-0199'`);
      console.log(`TEST URL: http://localhost:5173/v/${v.rows[0].id}`);
    } else {
      console.error(err);
    }
  } finally {
    process.exit(0);
  }
}

seed();
