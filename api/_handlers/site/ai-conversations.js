const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { requireStudent } = require('../../_lib/student-auth');

// GET /api/ai-conversations?student_id=...              -> قايمة كل محادثات الطالب (للسايد بار)
// GET /api/ai-conversations?student_id=...&id=...        -> محادثة واحدة كاملة (لما يدوس عليها يفتحها)
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await requireStudent(req, res);
  if (!session) return;
  const student_id = session.id;
  const id = String(req.query?.id || '').trim();
  if (id && (id.length > 100 || !/^[A-Za-z0-9_-]+$/.test(id))) return res.status(400).json({ error: 'معرف المحادثة غير صحيح' });

  if (id) {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('id, title, messages, updated_at')
      .eq('id', id)
      .eq('student_id', student_id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: 'تعذر تحميل المحادثة' });
    if (!data) return res.status(404).json({ error: 'المحادثة مش موجودة' });
    const messages = (Array.isArray(data.messages) ? data.messages : []).slice(-50).map((message) => ({
      role: message?.role === 'assistant' ? 'assistant' : 'user',
      content: String(message?.content || '').slice(0, 8000),
    })).filter((message) => message.content);
    return res.status(200).json({ conversation: { id: data.id, title: String(data.title || '').slice(0, 200), updated_at: data.updated_at, messages } });
  }

  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, title, updated_at')
    .eq('student_id', student_id)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: 'تعذر تحميل المحادثات' });
  return res.status(200).json({ conversations: data });
};
