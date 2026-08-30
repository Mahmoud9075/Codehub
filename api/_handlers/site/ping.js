const { applyCors } = require('../../_lib/cors');

module.exports = (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.status(200).json({ ok: true, now: new Date().toISOString() });
};
