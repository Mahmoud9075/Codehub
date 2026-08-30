const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { applyCors } = require('../../_lib/cors');

// GET /api/admin/results
// ده اللي هيوريك "اسم الطالب + نتيجته" في كل الكويزات اللي خلصها.
// محمي بنفس نظام دخول الأدمن (PIN أو جوجل).
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data, error } = await supabase
    .from('results')
    .select(`
      score,
      total,
      completed_at,
      students ( first_name, last_name, phone ),
      quizzes ( title, week_number, quiz_number_in_week, months ( name ) )
    `)
    .order('completed_at', { ascending: false })
    .limit(2000);

  if (error) return res.status(500).json({ error: 'تعذر تحميل النتائج' });

  const rows = (data || []).map((r) => ({
    student_name: r.students ? `${r.students.first_name} ${r.students.last_name}` : null,
    student_phone: r.students?.phone,
    month: r.quizzes?.months?.name,
    quiz: r.quizzes?.title,
    score: r.score,
    total: r.total,
    completed_at: r.completed_at,
  }));

  return res.status(200).json({ results: rows });
};
