const { createClient } = require('@supabase/supabase-js');

// SUPABASE_SERVICE_ROLE_KEY لازم يفضل سيرفر فقط (متتحطش في الفرونت إند خالص)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = { supabase };
