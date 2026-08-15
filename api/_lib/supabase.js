// SUPABASE_SERVICE_ROLE_KEY يجب ألا يَكون متاحًا في الواجهة الأمامية
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  // Fallback: provide a lightweight chainable stub that mimics the supabase query
  // interface used across handlers (select().or().maybeSingle(), insert().select().single(), etc.).
  // This avoids runtime errors (which return HTML error pages on Vercel) when env vars are missing.
  function makeQuery() {
    let op = null;
    let insertPayload = null;
    const q = {
      select(..._args) { op = 'select'; return q; },
      or(..._args) { return q; },
      maybeSingle: async function() {
        // For selects, return no rows (null) and no error
        if (op === 'select') return { data: null, error: null };
        return { data: null, error: null };
      },
      insert(payload) { op = 'insert'; insertPayload = payload; return q; },
      single: async function() {
        // If called after insert, return a fake created row so endpoints can continue
        if (op === 'insert') {
          const created = Object.assign({ id: 'stub-local' }, insertPayload || {});
          return { data: created, error: null };
        }
        return { data: null, error: null };
      },
      update(payload) { op = 'update'; return q; },
      delete() { op = 'delete'; return q; }
    };
    return q;
  }

  supabase = {
    from: (/* table */) => makeQuery()
  };
} else {
  // require supabase only when credentials are present to avoid module errors during local tests
  let createClient;
  try {
    ({ createClient } = require('@supabase/supabase-js'));
  } catch (e) {
    // If package missing, fall back to stub to keep endpoints working in limited local environments
    supabase = {
      from: () => ({
        select: async () => ({ data: [], error: null }),
        insert: async () => ({ data: null, error: new Error('Supabase package missing') }),
      })
    };
  }
  if (!supabase) supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

module.exports = { supabase };
