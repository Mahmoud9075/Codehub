const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { applyCors } = require('../../_lib/cors');

// GET /api/admin/dashboard-stats
// بيرجع أرقام صفحة "الرئيسية" في اللوحة، محسوبة فعليًا من قاعدة البيانات:
// - إجمالي الطلاب، متوسط الأداء العام، عدد الكويزات المكتملة
// - عدد الطلاب "المتأخرين" (تعريفنا هنا: مفيش نشاط ليهم في آخر 14 يوم — يشمل اللي لسه ما بدأوش خالص)
// - آخر 5 تسجيلات فعلية
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { count: totalStudents, error: sErr } = await supabase
    .from('students')
    .select('id', { count: 'exact', head: true });
  if (sErr) return res.status(500).json({ error: sErr.message });

  const { data: allResults, error: rErr } = await supabase
    .from('results')
    .select('student_id, score, total, completed_at');
  if (rErr) return res.status(500).json({ error: rErr.message });

  const quizzesCompleted = (allResults || []).length;

  let avgPerformancePercent = null;
  if (quizzesCompleted > 0) {
    const sumPercent = allResults.reduce((acc, r) => acc + (r.total ? (r.score / r.total) * 100 : 0), 0);
    avgPerformancePercent = Math.round(sumPercent / quizzesCompleted);
  }

  // آخر نشاط لكل طالب — عشان نحسب "المتأخرين" (مفيش نشاط آخر 14 يوم)
  const lastActivityByStudent = {};
  (allResults || []).forEach((r) => {
    const t = new Date(r.completed_at).getTime();
    if (!lastActivityByStudent[r.student_id] || t > lastActivityByStudent[r.student_id]) {
      lastActivityByStudent[r.student_id] = t;
    }
  });

  const { data: allStudentIds } = await supabase.from('students').select('id');
  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  let studentsBehind = 0;
  (allStudentIds || []).forEach((s) => {
    const last = lastActivityByStudent[s.id];
    if (!last || last < fourteenDaysAgo) studentsBehind++;
  });

  const { data: recentStudents, error: recErr } = await supabase
    .from('students')
    .select('id, first_name, last_name, phone, phone_verified, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  if (recErr) return res.status(500).json({ error: recErr.message });

  return res.status(200).json({
    total_students: totalStudents || 0,
    avg_performance_percent: avgPerformancePercent,
    quizzes_completed: quizzesCompleted,
    students_behind: studentsBehind,
    recent_registrations: recentStudents || [],
  });
};
