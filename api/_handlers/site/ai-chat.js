const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

// POST /api/ai-chat   body: { student_id, question, history: [{role, content}, ...] }
//
// إزاي بيشتغل:
// 1. بيجيب كل محتوى المنهج المتاح (من جدول ai_knowledge اللي بتضيفه من اللوحة).
// 2. بيبعت سؤال الطالب + المنهج لموديل الذكاء الاصطناعي (Gemini من Google).
// 3. لو السؤال جوه المنهج، بيجاوب منه ويقول المصدر (اسم الدرس).
// 4. لو السؤال برّه المنهج تمامًا، بيجاوب من معرفته العامة (مش هيقول "معرفش").
// 5. بيسجّل كل سؤال في ai_chat_log عشان تشوف في اللوحة أكتر الأسئلة تكرارًا.
//
// ⚠️ عشان الجزء ده يشتغل، لازم تحط مفتاح API من Google AI Studio في متغير GEMINI_API_KEY
// (Environment Variables على Vercel). المفتاح مجاني من aistudio.google.com/apikey
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

  if (!process.env.GEMINI_API_KEY) {
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

  // شكل الرسائل الداخلي (بيتخزن في قاعدة البيانات وبيستخدمه الفرونت إند)
  // فاضل زي ما هو: { role: 'user' | 'assistant', content: '...' }
  const messages = [
    ...(Array.isArray(history) ? history.slice(-10) : []),
    { role: 'user', content: question },
  ];

  // Gemini محتاج شكل مختلف شوية: role لازم يكون 'user' أو 'model' (مش 'assistant'),
  // وكل رسالة بتتحط جوه array اسمه parts. التحويل ده بيحصل هنا بس، وقت الاتصال بالـ API،
  // من غير ما يأثر على شكل التخزين أو الفرونت إند.
  const geminiContents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const GEMINI_MODEL = 'gemini-2.5-flash'; // موديل مجاني (Tier مجاني بحد أقصى يومي)

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: geminiContents,
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            maxOutputTokens: 700,
          },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'حصل خطأ في المساعد الذكي' });
    }

    // شكل رد Gemini: data.candidates[0].content.parts[0].text
    const candidate = (data.candidates || [])[0];
    const answerText = candidate
      ? (candidate.content?.parts || []).map((p) => p.text || '').join('')
      : '';

    if (!answerText) {
      return res.status(500).json({ error: 'المساعد الذكي مايقدرش يجاوب دلوقتي، جرب تاني بعد شوية' });
    }

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
