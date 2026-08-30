const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { retrieveBookContext } = require('../../_lib/book-knowledge');
const { requireStudent } = require('../../_lib/student-auth');
const { getClientIp, shortHash, tooManyAttempts, recordAttempt } = require('../../_lib/request-security');

function validImageBuffer(buffer, mime) {
  if (!buffer || buffer.length < 12) return false;
  if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/png') return buffer.slice(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (mime === 'image/webp') return buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';
  if (mime === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.slice(0, 6).toString('ascii'));
  return false;
}

// POST /api/ai-chat   body: { student_id, question, history, image_data?, image_mime? }
//
// إزاي بيشتغل:
// 1. بيبحث في الكتب الوزارية المرفقة وفي محتوى ai_knowledge.
// 2. بيبعت أقرب صفحات للسؤال فقط، عشان الرد يبقى أدق وأسرع.
// 3. لو السؤال جوه الكتب، بيجاوب منها من غير إظهار أرقام الصفحات للطالب.
// 4. لو السؤال برّه الكتب، Gemini يقدر يستخدم Google Search ويتحقق من المصدر.
// 5. بيسجّل كل سؤال في ai_chat_log عشان تشوف في اللوحة أكتر الأسئلة تكرارًا.
//
// ⚠️ عشان الجزء ده يشتغل، لازم تحط مفتاح API من Google AI Studio في متغير GEMINI_API_KEY
// (Environment Variables على Vercel). المفتاح مجاني من aistudio.google.com/apikey
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await requireStudent(req, res);
  if (!session) return;
  const student_id = session.id;

  const { question, history, conversation_id, image_data, image_mime } = req.body || {};
  const cleanQuestion = typeof question === 'string' ? question.trim() : '';
  const hasImage = typeof image_data === 'string' && image_data.length > 0;
  const safeQuestion = cleanQuestion || 'اشرح محتوى الصورة بالتفصيل.';
  const allowedImageMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  const safeImageMime = allowedImageMimes.has(image_mime) ? image_mime : null;

  if (!cleanQuestion && !hasImage) {
    return res.status(400).json({ error: 'السؤال مطلوب' });
  }
  if (cleanQuestion.length > 2500) {
    return res.status(400).json({ error: 'السؤال طويل قوي' });
  }

  if (history !== undefined && !Array.isArray(history)) {
    return res.status(400).json({ error: 'سجل المحادثة غير صحيح' });
  }
  const safeHistory = (Array.isArray(history) ? history : []).slice(-10).map((message) => ({
    role: message?.role === 'assistant' ? 'assistant' : 'user',
    content: String(message?.content || '').trim().slice(0, 4000),
  })).filter((message) => message.content);
  if (safeHistory.reduce((sum, message) => sum + message.content.length, 0) > 16000) {
    return res.status(400).json({ error: 'سجل المحادثة طويل قوي' });
  }

  if (hasImage) {
    if (!safeImageMime || !/^[A-Za-z0-9+/=\r\n]+$/.test(image_data)) return res.status(400).json({ error: 'بيانات الصورة غير صحيحة' });
    const imageBuffer = Buffer.from(image_data, 'base64');
    if (imageBuffer.length > 1_500_000) return res.status(413).json({ error: 'حجم الصورة كبير. جرّب صورة أصغر' });
    if (!validImageBuffer(imageBuffer, safeImageMime)) return res.status(400).json({ error: 'ملف الصورة غير صالح' });
  }

  const ip = getClientIp(req);
  const aiContext = `ai_${shortHash(student_id)}`;
  const aiAccountContext = `ai_account_${shortHash(student_id)}`;
  if (await tooManyAttempts({ ip, context: aiContext, windowMs: 10 * 60 * 1000, limit: 30 }) ||
      await tooManyAttempts({ ip: 'account', context: aiAccountContext, windowMs: 10 * 60 * 1000, limit: 60 })) {
    return res.status(429).json({ error: 'طلبات كتير للمساعد. جرّب تاني بعد شوية.' });
  }
  await Promise.allSettled([recordAttempt(ip, aiContext), recordAttempt('account', aiAccountContext)]);

  let storedConversation = null;
  if (conversation_id) {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('id, messages')
      .eq('id', String(conversation_id))
      .eq('student_id', student_id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: 'تعذر تحميل المحادثة' });
    if (!data) return res.status(404).json({ error: 'المحادثة مش موجودة' });
    storedConversation = data;
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

  const storedHistory = storedConversation && Array.isArray(storedConversation.messages)
    ? storedConversation.messages.slice(-10).map((message) => ({
        role: message?.role === 'assistant' ? 'assistant' : 'user',
        content: String(message?.content || '').trim().slice(0, 4000),
      })).filter((message) => message.content)
    : null;
  const retrievalHistory = storedHistory || safeHistory;
  const bookResult = retrieveBookContext(safeQuestion, retrievalHistory, 8);
  const bookContext = bookResult.context;

  const systemPrompt = `أنت مساعد Code Hub الذكي: مساعد عام وتعليمي لطلاب المرحلة الثانوية، وليس مقيدًا بالمنهج فقط. تقدر تساعد في البرمجة والذكاء الاصطناعي والمواد الدراسية واللغات والترجمة والعلوم والتكنولوجيا والأسئلة العامة، وتشرح الصور المرفوعة داخل الشات. هدفك أن يفهم الطالب الإجابة فعلًا وأن يحصل على رد دقيق وواضح على سؤاله نفسه.

قواعد مهمة جدًا:
1. افهم سؤال الطالب وسياق المحادثة، وجاوب على المطلوب مباشرة بدون ردود محفوظة.
2. لو السؤال متعلق بمنهج البرمجة والذكاء الاصطناعي، استخدم صفحات الكتب ومحتوى المدرس المرفقين أدناه كأولوية أولى.
3. لو السؤال عام أو خارج المنهج، جاوب من معرفتك العامة. ولو المعلومة حديثة أو متغيرة أو تحتاج تحقق، استخدم Google Search من مصدر موثوق وحديث.
4. تقدر تساعد في الترجمة، تبسيط النصوص، حل الأسئلة، شرح الأكواد، الرياضيات الأساسية، العلوم، التكنولوجيا، والمعلومات العامة.
5. اكتب بالعربي المصري البسيط افتراضيًا، لكن لو الطالب طلب لغة أخرى أو كتب بلغة أخرى جاوبه باللغة المناسبة.
6. طول الإجابة يكون مناسبًا للسؤال. لو الطالب طلب شرحًا مفصلًا، نظمه خطوة بخطوة مع أمثلة عند الحاجة.
7. في أسئلة الاختيار والصح والخطأ والمسائل: اذكر الإجابة الصحيحة ثم السبب أو الحل بوضوح.
8. في البرمجة: قدّم كودًا صحيحًا قابلًا للتنفيذ واشرح الأجزاء المهمة ونبّه على الأخطاء الشائعة.
9. لو الطالب أرسل صورة، حلل الصورة نفسها واقرأ النص والعناصر الظاهرة فيها، ثم جاوب على السؤال المرتبط بها. لو أرسل صورة بدون سؤال، اشرح محتواها وأبرز ما يمكن فهمه منها.
10. لا تخترع معلومة أو اسم درس أو رقم صفحة. لا تعرض أرقام صفحات الكتب أو أسماء المصادر الداخلية للطالب.
11. لا تستخدم Markdown ثقيل مثل ### أو جداول معقدة؛ خلي الرد سهل القراءة داخل الشات.
12. لا تكرر ترحيبًا في كل رسالة، ولا تحوّل كل رد إلى محاضرة طويلة.
13. لو طلب الطالب شيئًا مؤذيًا أو غير قانوني أو غير آمن، لا تساعد في الجزء الضار، وقدّم بديلًا آمنًا ومفيدًا.

أقرب صفحات من الكتب الوزارية المرفقة لسؤال الطالب:
${bookContext || '(لم يتم العثور على مقتطف قريب بما يكفي من الكتب لهذا السؤال)'}

محتوى إضافي أضافه المدرس من لوحة الإدارة:
${knowledgeText || '(لا يوجد محتوى إضافي حاليًا)'}`

  // شكل الرسائل الداخلي (بيتخزن في قاعدة البيانات وبيستخدمه الفرونت إند)
  // فاضل زي ما هو: { role: 'user' | 'assistant', content: '...' }
  const conversationHistory = storedHistory || safeHistory;

  const messages = [
    ...conversationHistory,
    { role: 'user', content: safeQuestion },
  ];

  // Gemini محتاج شكل مختلف شوية: role لازم يكون 'user' أو 'model' (مش 'assistant'),
  // وكل رسالة بتتحط جوه array اسمه parts. التحويل ده بيحصل هنا بس، وقت الاتصال بالـ API،
  // من غير ما يأثر على شكل التخزين أو الفرونت إند.
  const geminiContents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  // صور الطلب الحالي فقط تُرسل كرؤية متعددة الوسائط ولا تُخزّن Base64 في السجل.
  if (hasImage && geminiContents.length) {
    geminiContents[geminiContents.length - 1].parts.push({
      inline_data: {
        mime_type: safeImageMime,
        data: image_data,
      },
    });
  }

  const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const requestBody = {
      contents: geminiContents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 1800,
      },
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    };

    let response;
    try {
      response = await fetch(apiUrl, requestOptions);
    } finally {
      clearTimeout(timeout);
    }
    let data = await response.json();

    // لو البحث غير متاح للحساب أو الحصة خلصت، خلى الشات يفضل شغال من الكتب والموديل.
    if (!response.ok && [400, 403, 429].includes(response.status)) {
      const fallbackBody = { ...requestBody };
      delete fallbackBody.tools;
      const fallbackController = new AbortController();
      const fallbackTimeout = setTimeout(() => fallbackController.abort(), 25000);
      try {
        response = await fetch(apiUrl, { ...requestOptions, signal: fallbackController.signal, body: JSON.stringify(fallbackBody) });
        data = await response.json();
      } finally {
        clearTimeout(fallbackTimeout);
      }
    }
    if (!response.ok) {
      return res.status(502).json({ error: 'المساعد الذكي غير متاح دلوقتي. جرّب تاني بعد شوية.' });
    }

    // شكل رد Gemini: data.candidates[0].content.parts[0].text
    const candidate = (data.candidates || [])[0];
    let answerText = candidate
      ? (candidate.content?.parts || []).map((p) => p.text || '').join('')
      : '';

    if (!answerText) {
      return res.status(500).json({ error: 'المساعد الذكي مايقدرش يجاوب دلوقتي، جرب تاني بعد شوية' });
    }

    // لا نظهر للطالب ترقيم الصفحات أو وسم المصدر الداخلي حتى لو أعاده النموذج.
    // تظل بيانات الكتب مستخدمة داخليًا للتحقق وصياغة الإجابة الصحيحة.
    answerText = answerText
      .replace(/^\s*\[(?:المصدر:[^\]]+|معلومة عامة|مصدر خارجي موثوق)\]\s*/u, '')
      .replace(/^\s*المصدر\s*:\s*[^\n]*(?:صفحة|ص)\s*\d+[^\n]*\n?/gmu, '')
      .trim();

    const groundingMetadata = candidate?.groundingMetadata || {};
    const externalSources = (groundingMetadata.groundingChunks || [])
      .map((chunk) => chunk?.web)
      .filter((web) => web?.uri)
      .filter((web, index, all) => all.findIndex((item) => item.uri === web.uri) === index)
      .slice(0, 4);

    if (externalSources.length) {
      const sourceLines = externalSources.map((web, index) => `${index + 1}. ${web.title || 'مصدر'}: ${web.uri}`);
      answerText = `${answerText.trim()}\n\nالمصادر الخارجية:\n${sourceLines.join('\n')}`;
    }

    const source = externalSources.length
      ? 'google_search'
      : bookResult.matches?.length
        ? 'knowledge_base'
        : 'general_knowledge';

    // سجّل السؤال (صامت، ما بيأثرش على الرد لو فشل) — لسجل الأسئلة الشائعة في اللوحة
    supabase.from('ai_chat_log').insert({ student_id, question: safeQuestion, answer_source: source }).then(() => {});

    // احفظ المحادثة كاملة عشان الطالب يقدر يرجعلها تاني بعدين
    let savedConversationId = storedConversation?.id || null;
    {
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
        const title = safeQuestion.slice(0, 50);
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
