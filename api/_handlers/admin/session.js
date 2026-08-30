const { applyCors } = require('../../_lib/cors');
const { isAuthorized } = require('../../_lib/admin-auth');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });
  return res.status(200).json({ ok: true, identity: auth.identity, via: auth.via });
};
