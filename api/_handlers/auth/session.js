const crypto = require('crypto');
const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { requireStudent } = require('../../_lib/student-auth');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const session = await requireStudent(req, res);
  if (!session) return;

  const includeParent = String(req.query?.include_parent || '') === '1';
  const { data: student, error } = await supabase
    .from('students')
    .select('id, first_name, last_name, phone, email, avatar_url, phone_verified, parent_token')
    .eq('id', session.id)
    .maybeSingle();
  if (error || !student) return res.status(404).json({ error: 'الحساب مش موجود' });
  if (!student.parent_token) {
    const parentToken = crypto.randomBytes(24).toString('base64url');
    const { data: updated } = await supabase
      .from('students')
      .update({ parent_token: parentToken })
      .eq('id', session.id)
      .select('id, first_name, last_name, phone, email, avatar_url, phone_verified, parent_token')
      .single();
    if (updated) {
      if (!includeParent) delete updated.parent_token;
      return res.status(200).json({ student: updated });
    }
  }
  if (!includeParent) delete student.parent_token;
  return res.status(200).json({ student });
};
