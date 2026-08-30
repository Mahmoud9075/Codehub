const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { logAdminAction } = require('../../_lib/admin-audit');
const { applyCors } = require('../../_lib/cors');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'اسم الشهر مطلوب' });
  if (name.length > 80) return res.status(400).json({ error: 'اسم الشهر طويل قوي' });

  const { data: duplicate } = await supabase.from('months').select('id').ilike('name', name).limit(1).maybeSingle();
  if (duplicate) return res.status(409).json({ error: 'الشهر ده موجود بالفعل' });

  const { data: existingMonths, error: orderError } = await supabase
    .from('months')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1);
  if (orderError) return res.status(500).json({ error: 'تعذر تحديد ترتيب الشهر' });
  const nextOrder = existingMonths?.length ? Number(existingMonths[0].order_index || 0) + 1 : 1;

  const { data: month, error: monthErr } = await supabase
    .from('months')
    .insert({ name, order_index: nextOrder })
    .select()
    .single();
  if (monthErr) return res.status(500).json({ error: 'تعذر إضافة الشهر' });

  const quizRows = [];
  let ord = 1;
  for (let week = 1; week <= 4; week++) {
    for (let quizNumber = 1; quizNumber <= 2; quizNumber++) {
      quizRows.push({
        month_id: month.id,
        type: 'weekly',
        week_number: week,
        quiz_number_in_week: quizNumber,
        title: `كويز الأسبوع ${week} - رقم ${quizNumber} (${name})`,
        order_index: ord++,
      });
    }
  }
  quizRows.push({ month_id: month.id, type: 'final', title: `الاختبار النهائي - ${name}`, order_index: 99 });

  const { error: quizErr } = await supabase.from('quizzes').insert(quizRows);
  if (quizErr) {
    await supabase.from('months').delete().eq('id', month.id);
    return res.status(500).json({ error: 'تعذر إنشاء اختبارات الشهر' });
  }

  await logAdminAction(auth.identity, 'add_month', { name, month_id: month.id });
  return res.status(201).json({ month });
};
