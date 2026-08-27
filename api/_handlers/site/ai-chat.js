const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');
const { retrieveBookContext } = require('../../_lib/book-knowledge');

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

  const { student_id, question, history, conversation_id, image_data, image_mime } = req.body || {};
  const cleanQuestion = typeof question === 'string' ? question.trim() : '';
  const hasImage = typeof image_data === 'string' && image_data.length > 0;
  const safeQuestion = cleanQuestion || 'اشرح محتوى الصورة بالتفصيل.';
  const allowedImageMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  const safeImageMime = allowedImageMimes.has(image_mime) ? image_mime : 'image/jpeg';

  if (!cleanQuestion && !hasImage) {
    return res.status(400).json({ error: 'السؤال مطلوب' });
  }
  if (cleanQuestion.length > 1000) {
    return res.status(400).json({ error: 'السؤال طويل قوي' });
  }
  // قرابة 1.5MB بعد فك Base64. الواجهة تصغّر الصورة قبل الإرسال أصلًا.
  if (hasImage && image_data.length > 2_000_000) {
    return res.status(413).json({ error: 'حجم الصورة كبير. جرّب صورة أصغر' });
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

  const bookResult = retrieveBookContext(safeQuestion, history, 8);
  const bookContext = bookResult.context;

  const systemPrompt = `أنت مساعد تعليمي مصري لطلاب المرحلة الثانوية، متخصص في البرمجة والذكاء الاصطناعي. هدفك أن يفهم الطالب الإجابة فعلًا، وليس مجرد إعطائه ردًا قصيرًا أو عامًا.

قواعد مهمة جدًا لازم تتبعها بالظبط:
1. اقرأ سؤال الطالب وسياق المحادثة كويس، وجاوب على المطلوب نفسه. ممنوع الرد بكلام محفوظ أو إجابة لا تخص السؤال.
2. استخدم صفحات الكتب ومحتوى المنهج المرفقين أدناه أولًا. لو الإجابة موجودة فيهم، لا تستخدم بحث الإنترنت ولا تغيّر المعلومة.
3. لو المقتطفات لا تكفي فعلًا أو السؤال خارج الكتب، استخدم Google Search للتحقق من المعلومة من مصدر موثوق وحديث. لا تدّعي أنك بحثت إذا لم تظهر لك نتيجة بحث.
4. اكتب بالعربي المصري البسيط والواضح. اشرح المصطلح، وبعده الفكرة خطوة بخطوة، وبعدها مثال صغير عندما يفيد.
5. طول الإجابة يكون مناسبًا للسؤال: لا تختصر لدرجة تضيّع المعنى، ولا تطوّل بلا فائدة. لو الطالب قال "وسّع" أو "اشرح بالتفصيل" قدّم شرحًا كاملًا ومنظمًا.
6. لو السؤال يحتمل أكثر من معنى ولا يمكن تحديد المقصود من السياق، اسأل سؤال توضيح واحد بدل التخمين.
7. في المسائل وأسئلة الاختيار والصح والخطأ: اذكر الإجابة الصحيحة أولًا، ثم سببها باختصار واضح.
8. في البرمجة: اشرح الكود سطرًا سطرًا عند الحاجة، واستخدم مثالًا صحيحًا قابلًا للتنفيذ، ونبّه على الأخطاء الشائعة.
9. لو الطالب أرسل صورة: افحص الصورة نفسها، واقرأ النص الظاهر فيها، وحدد ما يسأل عنه ثم اشرح له بوضوح. لا تقل إن الصورة غير ظاهرة طالما وصلت لك صورة في الطلب.
10. ممنوع اختراع معلومة أو اسم درس أو رقم صفحة. لا تعرض للطالب اسم الكتاب أو رقم الصفحة أو عبارة "المصدر"؛ استخدم هذه البيانات داخليًا للتأكد فقط. لو مقتطف الكتاب غير كافٍ، انتقل للمصدر الخارجي الموثوق.
11. لا تستخدم رموز Markdown مثل ** أو ### في الرد. استخدم عناوين نصية بسيطة وترقيمًا عاديًا، لأن الواجهة تعرض النص كما هو.
12. لا تكرر مقدمة ترحيبية في كل رسالة، ولا تضف سؤالًا مقترحًا إلا لو كان مفيدًا فعلًا للسياق.

أقرب صفحات من الكتب الوزارية المرفقة لسؤال الطالب:
${bookContext || '(لم يتم العثور على مقتطف قريب بما يكفي من الكتب لهذا السؤال)'}

محتوى إضافي أضافه المدرس من لوحة الإدارة:
${knowledgeText || '(لا يوجد محتوى إضافي حاليًا)'}`;

  // شكل الرسائل الداخلي (بيتخزن في قاعدة البيانات وبيستخدمه الفرونت إند)
  // فاضل زي ما هو: { role: 'user' | 'assistant', content: '...' }
  const messages = [
    ...(Array.isArray(history) ? history.slice(-10) : []),
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
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify(requestBody),
    };

    let response = await fetch(apiUrl, requestOptions);
    let data = await response.json();

    // لو البحث غير متاح للحساب أو الحصة خلصت، خلى الشات يفضل شغال من الكتب والموديل.
    if (!response.ok && [400, 403, 429].includes(response.status)) {
      const fallbackBody = { ...requestBody };
      delete fallbackBody.tools;
      response = await fetch(apiUrl, { ...requestOptions, body: JSON.stringify(fallbackBody) });
      data = await response.json();
    }
    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'حصل خطأ في المساعد الذكي' });
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
    supabase.from('ai_chat_log').insert({ student_id: student_id || null, question: safeQuestion, answer_source: source }).then(() => {});

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
