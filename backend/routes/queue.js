const express = require('express');
const router = express.Router();
const db = require('../db');

// Customer Joins the Queue
router.post('/join', async (req, res) => {
  const { vendor_id, service_id, customer_name, customer_phone, gps_lat, gps_lng, photo_url, schedule_time } = req.body;

  try {
    // If they want to schedule for later (Phase 2 feature)
    if (schedule_time) {
      const result = await db.query(
        `INSERT INTO scheduled_tokens 
        (vendor_id, customer_data, scheduled_time) 
        VALUES ($1, $2, $3) RETURNING *`,
        [vendor_id, JSON.stringify(req.body), schedule_time]
      );
      return res.status(201).json({ message: 'Scheduled for later', type: 'SCHEDULED', data: result.rows[0] });
    }

    // Join Immediate Live Queue
    const tokenResult = await db.query(
      `SELECT COALESCE(MAX(token_number), 0) + 1 AS next_token 
       FROM queue_tokens 
       WHERE vendor_id = $1 AND booked_at::date = CURRENT_DATE`,
      [vendor_id]
    );
    const nextToken = tokenResult.rows[0].next_token;

    const result = await db.query(
      `INSERT INTO queue_tokens 
      (vendor_id, service_id, token_number, customer_name, customer_phone, gps_lat, gps_lng, photo_url) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [vendor_id, service_id, nextToken, customer_name, customer_phone, gps_lat, gps_lng, photo_url]
    );

    res.status(201).json({ message: 'Joined live queue successfully', type: 'LIVE', token: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Customer Self-Cancel
router.post('/cancel', async (req, res) => {
  const { token_id } = req.body;
  try {
    await db.query(`UPDATE queue_tokens SET status = 'CANCELLED' WHERE id = $1`, [token_id]);
    res.json({ message: 'Queue abandoned' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
