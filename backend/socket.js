const db = require('./db');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Vendor/Customer connected:', socket.id);

    // Vendor calls the next customer in the queue
    socket.on('call_next', async ({ vendorId, unitId }) => {
      try {
        // Find the oldest WAITING token for this vendor
        const result = await db.query(
          `UPDATE queue_tokens 
           SET status = 'SERVING', assigned_unit = $1, service_start_time = CURRENT_TIMESTAMP 
           WHERE id = (
             SELECT id FROM queue_tokens 
             WHERE vendor_id = $2 AND status = 'WAITING' 
             ORDER BY booked_at ASC LIMIT 1
           ) RETURNING *`,
          [unitId, vendorId]
        );

        if (result.rows.length > 0) {
          const calledToken = result.rows[0];
          // Broadcast to everyone (including customers) that the queue updated
          io.emit(`queue_update_${vendorId}`, { message: 'Queue updated' });
          // Alert the specific customer their token is called
          io.emit(`token_called_${calledToken.id}`, calledToken);
        }
      } catch (err) {
        console.error('Error calling next:', err);
      }
    });

    // Vendor triggers "Penalty Shift" (Customer No-Show)
    socket.on('penalty_shift', async ({ tokenId, vendorId }) => {
      try {
        // Add a strike. If strikes reach 3, cancel them. Otherwise, push them back to WAITING.
        const tokenData = await db.query(`SELECT strikes FROM queue_tokens WHERE id = $1`, [tokenId]);
        
        if (tokenData.rows.length > 0) {
          const currentStrikes = tokenData.rows[0].strikes;

          if (currentStrikes >= 2) {
            await db.query(`UPDATE queue_tokens SET status = 'CANCELLED', strikes = 3 WHERE id = $1`, [tokenId]);
          } else {
            // Push back to WAITING and reset their booked_at time so they fall to the back of the line
            await db.query(
              `UPDATE queue_tokens SET status = 'WAITING', strikes = strikes + 1, booked_at = CURRENT_TIMESTAMP WHERE id = $1`, 
              [tokenId]
            );
          }
          
          io.emit(`queue_update_${vendorId}`, { message: 'Queue updated due to penalty shift' });
        }
      } catch (err) {
        console.error('Error in penalty shift:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};
