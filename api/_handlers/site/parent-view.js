const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { getClientIp, tooManyAttempts, recordAttempt } = require('../../_lib/request-security');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = String(req.query.token || '').trim();
  if (!token || token.length < 8 || token.length > 200 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return res.status(400).json({ error: 'اللينك غير صحيح' });
  }

  const ip = getClientIp(req);
  if (await tooManyAttempts({ ip, context: 'parent_view', windowMs: 15 * 60 * 1000, limit: 60 })) {
    return res.status(429).json({ error: 'محاولات كتير. حاول تاني بعد شوية.' });
  }
  await recordAttempt(ip, 'parent_view').catch(() => {});

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, first_name, last_name')
    .eq('parent_token', token)
    .maybeSingle();
  if (studentError || !student) return res.status(404).json({ error: 'اللينك غير صحيح أو منتهي' });

  const { data: results, error: resultsError } = await supabase
    .from('results')
    .select('score, total, completed_at, quizzes ( title, months ( name, order_index ) )')
    .eq('student_id', student.id)
    .order('completed_at', { ascending: false });
  if (resultsError) return res.status(500).json({ error: 'تعذر تحميل النتائج' });

  const rows = (results || []).map((result) => ({
    month: result.quizzes?.months?.name || '',
    quiz: result.quizzes?.title || '',
    score: Number(result.score) || 0,
    total: Number(result.total) || 0,
    completed_at: result.completed_at,
  }));
  const totalScore = rows.reduce((sum, row) => sum + row.score, 0);
  const totalMax = rows.reduce((sum, row) => sum + row.total, 0);

  return res.status(200).json({
    student: { first_name: student.first_name, last_name: student.last_name },
    quizzes_completed: rows.length,
    average_percent: totalMax ? Math.round((totalScore / totalMax) * 100) : null,
    results: rows,
  });
};
