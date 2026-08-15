const { supabase } = require('../../_lib/supabase');
const { applyCors } = require('../../_lib/cors');

// POST /api/admin/login-pin   body: { pin }
// بيتأكد إن الرقم السري صح. لو صح، الفرونت إند بيحفظه ويبعته في كل طلب بعد كده
// جوه هيدر x-admin-pin (زي ما بنعمل مع أي endpoint أدمن تاني).
// محمي كمان من التخمين العشوائي: بعد 5 محاولات غلط من نفس الـ IP خلال 10 دقايق بيترفض أي محاولة جديدة.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 1342-1368 omitted */
  return res.status(200).json({ ok: true });
};
