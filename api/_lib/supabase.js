const { createClient } = require('@supabase/supabase-js');

// SUPABASE_SERVICE_ROLE_KEY يجب ألا يَكون متاحًا في الواجهة الأمامية أبدًا.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // مهم: مفيش أي fallback لداتا وهمية هنا عن قصد.
  // لو الإعداد ناقص، لازم السيرفر يقع بوضوح بدل ما يشتغل بصمت على بيانات مزيفة
  // (اللي كانت المشكلة قبل كده — الموقع بيدّي نتايج تبان شغالة بس مش حقيقية).
  throw new Error(
    'إعداد Supabase ناقص: لازم تحطي SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في Environment Variables على Vercel.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

module.exports = { supabase };
