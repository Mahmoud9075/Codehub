const { supabase } = require('../_supabase');
const { isAuthorized } = require('./_auth');
const { logAdminAction } = require('./_audit');
const { applyCors } = require('../_cors');

// POST /api/admin/add-month   body: { name }
// بيضيف شهر جديد في آخر الترتيب، وبيولّدله تلقائيًا 8 كويزات أسبوعية + اختبار نهائي واحد
// (زي بالظبط اللي بيحصل في schema.sql، بس ده بيخليك تضيف شهر من غير ما تدخل SQL خالص).
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'اسم الشهر مطلوب' });

  const { data: existingMonths } = await supabase.from('months').select('order_index').order('order_index', { ascending: false }).limit(1);
  const nextOrder = existingMonths && existingMonths.length ? existingMonths[0].order_index + 1 : 1;

  const { data: month, error: monthErr } = await supabase
    .from('months')
    .insert({ name, order_index: nextOrder })
    .select()
    .single();

  if (monthErr) return res.status(500).json({ error: monthErr.message });

  const quizRows = [];
  let ord = 1;
  for (let w = 1; w <= 4; w++) {
    for (let q = 1; q <= 2; q++) {
      quizRows.push({
        month_id: month.id,
        type: 'weekly',
        week_number: w,
        quiz_number_in_week: q,
        title: `كويز الأسبوع ${w} - رقم ${q} (${name})`,
        order_index: ord,
      });
      ord++;
    }
  }
  quizRows.push({ month_id: month.id, type: 'final', title: `الاختبار النهائي - ${name}`, order_index: 99 });

  const { error: quizErr } = await supabase.from('quizzes').insert(quizRows);
  if (quizErr) return res.status(500).json({ error: quizErr.message });

  await logAdminAction(auth.identity, 'add_month', { name });

  return res.status(201).json({ month });
};
