const { createClient } = require('@supabase/supabase-js');

// SUPABASE_SERVICE_ROLE_KEY يجب ألا يَكون متاحًا في الواجهة الأمامية
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  // Fallback: return a safe stub that resolves to empty data so endpoints return JSON instead of crashing
  supabase = {
    from: (/* table */) => ({
      select: async () => ({ data: [], error: null }),
      insert: async () => ({ data: null, error: new Error('Supabase not configured') }),
      update: async () => ({ data: null, error: new Error('Supabase not configured') }),
      delete: async () => ({ data: null, error: new Error('Supabase not configured') })
    })
  };
} else {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

module.exports = { supabase };
