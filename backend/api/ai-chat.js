const { supabase } = require('./_supabase');
const { applyCors } = require('./_cors');

// POST /api/ai-chat   body: { student_id, question, history: [{role, content}, ...] }
//
// إزاي بيشتغل:
// 1. بيجيب كل محتوى المنهج المتاح (من جدول ai_knowledge اللي بتضيفه من اللوحة).
// 2. بيبعت سؤال الطالب + المنهج لموديل الذكاء الاصطناعي (Claude من Anthropic).
// 3. لو السؤال جوه المنهج، بيجاوب منه ويقول المصدر (اسم الدرس).
// 4. لو السؤال برّه المنهج تمامًا، بيجاوب من معرفته العامة (مش هيقول "معرفش").
// 5. بيسجّل كل سؤال في ai_chat_log عشان تشوف في اللوحة أكتر الأسئلة تكرارًا.
//
// ⚠️ عشان الجزء ده يشتغل، لازم تحط مفتاح API من Anthropic في متغير ANTHROPIC_API_KEY
// (التفاصيل خطوة بخطوة في backend/README.md).
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id, question, history, conversation_id } = req.body || {};
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'السؤال مطلوب' });
  }
  if (question.length > 1000) {
    return res.status(400).json({ error: 'السؤال طويل قوي' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({
      answer: 'المساعد الذكي لسه مش متفعّل من صاحب الموقع. تواصل معاه لتفعيل الخدمة دي.',
      source: 'not_configured',
    });
  }

  // 1) هات كل محتوى المنهج المتاح
  const { data: knowledgeRows } = await supabase
    .from('ai_knowledge')
    .select('title, content')
    .order('order_index', { ascending: true });

  const knowledgeText = (knowledgeRows || [])
    .map((k) => `### ${k.title}\n${k.content}`)
    .join('\n\n');

  const systemPrompt = `أنت مساعد تعليمي ذكي اسمه "مساعد Code Hub"، بتساعد طلاب المرحلة الثانوية في مادة البرمجة والذكاء الاصطناعي.

قواعد مهمة جدًا لازم تتبعها بالظبط:
1. لو سؤال الطالب إجابته موجودة في "محتوى المنهج" اللي تحت، جاوب منه بالظبط، وابدأ إجابتك بذكر اسم الدرس اللي الإجابة منه بالشكل ده: [المصدر: اسم الدرس].
2. لو السؤال برّه محتوى المنهج المتاح (حتى لو خارج المادة تمامًا)، جاوب عليه بمعرفتك العامة بشكل واضح ومباشر ومفيد — **ممنوع تقول "المعلومة دي مش متاحة عندي" أو أي رفض مشابه**. جاوب دايمًا بإجابة حقيقية ومفيدة. لو الإجابة من معرفتك العامة (مش من المنهج)، ابدأها بـ [معلومة عامة] بدل ذكر مصدر درس.
3. اكتب بالعربي المصري البسيط، جمل قصيرة، من غير تعقيد. الطالب في المرحلة الثانوية.
4. لو الطالب طلب منك تلخيص أو تبسيط حاجة، اعمل كده بس خليك مختصر وواضح.
5. لو الطالب طلب "اشرحهالي أبسط"، اشرح نفس المعلومة تاني بس بكلام أبسط وأمثلة يومية.
6. متكتبش مقدمات طويلة، روح على الإجابة على طول.
7. في آخر إجابتك، اقترح سؤال متابعة واحد بسيط مرتبط بالموضوع، مكتوب في سطر لوحده يبدأ بـ [سؤال مقترح]: ...

محتوى المنهج المتاح حاليًا:
${knowledgeText || '(لسه معرفش أي محتوى منهج، جاوب من معرفتك العامة بس)'}`;

  const messages = [
    ...(Array.isArray(history) ? history.slice(-10) : []),
    { role: 'user', content: question },
  ];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 700,
        system: systemPrompt,
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'حصل خطأ في المساعد الذكي' });
    }

    const answerText = (data.content || []).map((c) => c.text || '').join('');
    const source = answerText.includes('[المصدر:') ? 'knowledge_base' : 'general_knowledge';

    // سجّل السؤال (صامت، ما بيأثرش على الرد لو فشل) — لسجل الأسئلة الشائعة في اللوحة
    supabase.from('ai_chat_log').insert({ student_id: student_id || null, question, answer_source: source }).then(() => {});

    // احفظ المحادثة كاملة عشان الطالب يقدر يرجعلها تاني بعدين
    let savedConversationId = conversation_id || null;
    if (student_id) {
      const newMessages = [
        ...messages,
        { role: 'assistant', content: answerText },
      ];

      if (savedConversationId) {
        await supabase
          .from('ai_conversations')
          .update({ messages: newMessages, updated_at: new Date().toISOString() })
          .eq('id', savedConversationId)
          .eq('student_id', student_id);
      } else {
        const title = question.trim().slice(0, 50);
        const { data: created } = await supabase
          .from('ai_conversations')
          .insert({ student_id, title, messages: newMessages })
          .select('id')
          .single();
        savedConversationId = created?.id || null;
      }
    }

    return res.status(200).json({ answer: answerText, source, conversation_id: savedConversationId });
  } catch (e) {
    return res.status(500).json({ error: 'حصل خطأ في الاتصال بالمساعد الذكي' });
  }
};
