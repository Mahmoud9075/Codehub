const { applyCors } = require('../../_lib/cors');
const { clearStudentSession } = require('../../_lib/student-auth');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  clearStudentSession(res);
  return res.status(200).json({ ok: true });
};
