const { supabase } = require('./_supabase');
const { applyCors } = require('./_cors');

// GET /api/ai-conversations?student_id=...              -> قايمة كل محادثات الطالب (للسايد بار)
// GET /api/ai-conversations?student_id=...&id=...        -> محادثة واحدة كاملة (لما يدوس عليها يفتحها)
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id, id } = req.query;
  if (!student_id) return res.status(400).json({ error: 'student_id مطلوب' });

  if (id) {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('id', id)
      .eq('student_id', student_id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'المحادثة مش موجودة' });
    return res.status(200).json({ conversation: data });
  }

  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, title, updated_at')
    .eq('student_id', student_id)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ conversations: data });
};
