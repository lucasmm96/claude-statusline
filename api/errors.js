// GET /api/errors
// Returns recent error log entries. Query params: limit (default 100, max 1000), since (ISO timestamp)

const { initDb, initSchema } = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const { handleCors } = require('./lib/cors');

const handler = handleCors(requireAuth(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = await initDb();
    await initSchema(sql);

    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
    const since = req.query.since || null;

    const rows = since
      ? await sql`SELECT * FROM log_errors WHERE occurred_at >= ${since} ORDER BY occurred_at DESC LIMIT ${limit}`
      : await sql`SELECT * FROM log_errors ORDER BY occurred_at DESC LIMIT ${limit}`;

    res.status(200).json({ errors: rows, count: rows.length });
  } catch (error) {
    console.error('[errors] Unhandled error:', error.message);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}));

module.exports = handler;
