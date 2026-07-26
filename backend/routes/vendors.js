const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Fetch vendor profile (Used by Customer UI)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const vendorRes = await db.query('SELECT shop_name, address, contact_number, category FROM vendors WHERE id = $1', [id]);
    if (vendorRes.rows.length === 0) return res.status(404).json({ error: 'Vendor not found' });
    
    const servicesRes = await db.query('SELECT id, name, estimated_time_mins FROM vendor_services WHERE vendor_id = $1 AND is_active = true', [id]);
    
    res.json({
      vendor: vendorRes.rows[0],
      services: servicesRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Register a new vendor
router.post('/register', async (req, res) => {
  const { shop_name, address, contact_number, category, servicing_units, operating_hours } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO vendors 
      (shop_name, address, contact_number, category, servicing_units, operating_hours, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [shop_name, address, contact_number, category, servicing_units, operating_hours, 'ACTIVE']
    );
    res.status(201).json({ message: 'Vendor registered successfully', vendor: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.constraint === 'vendors_contact_number_key') {
      return res.status(400).json({ error: 'Contact number already exists.' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Add services for a vendor
router.post('/:id/services', async (req, res) => {
  const { id } = req.params;
  const { services } = req.body; // array of { name, estimated_time_mins }
  
  if (!services || services.length === 0) {
    return res.status(400).json({ error: 'Services array is required' });
  }

  try {
    // Basic bulk insert construct for pg
    const values = [];
    let queryStr = 'INSERT INTO vendor_services (vendor_id, name, estimated_time_mins) VALUES ';
    let paramIndex = 1;

    services.forEach((service, idx) => {
      queryStr += `($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`;
      if (idx !== services.length - 1) queryStr += ', ';
      values.push(id, service.name, service.estimated_time_mins);
    });
    
    queryStr += ' RETURNING *';
    
    const result = await db.query(queryStr, values);
    res.status(201).json({ message: 'Services added', services: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Inject manual Walk-in Customer
router.post('/:id/walk-in', async (req, res) => {
  const { id } = req.params; // Vendor ID
  const { customer_name, customer_phone, service_id } = req.body;

  try {
    // 1. Get the current maximum token number for the vendor today
    // For simplicity right now, just counting total tokens, in a real system we'd reset at midnight
    const tokenResult = await db.query(
      `SELECT COALESCE(MAX(token_number), 0) + 1 AS next_token 
       FROM queue_tokens 
       WHERE vendor_id = $1 AND booked_at::date = CURRENT_DATE`,
      [id]
    );
    const nextToken = tokenResult.rows[0].next_token;

    // 2. Insert the token
    const result = await db.query(
      `INSERT INTO queue_tokens 
      (vendor_id, service_id, token_number, customer_name, customer_phone, is_walk_in, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, service_id, nextToken, customer_name, customer_phone, true, 'WAITING']
    );
    
    // Note: Once we add Socket.io, we will broadcast an event here to update the vendor UI
    
    res.status(201).json({ message: 'Walk-in added', token: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
