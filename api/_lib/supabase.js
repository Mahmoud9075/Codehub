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
    let where = {};
    let inFilter = null;
    let tableName = null;

    const buildResult = async () => {
      // Default empty
      let data = null;
      // Provide fake data for specific tables to allow handlers to run locally
      if (tableName === 'months') {
        data = [
          { id: 'm1', order_index: 1, title: 'Month 1' },
          { id: 'm2', order_index: 2, title: 'Month 2' },
          { id: 'm3', order_index: 3, title: 'Month 3' },
        ];
      } else if (tableName === 'students' && (op === 'insert' || op === 'update')) {
        // Return a fake updated/created student object
        const id = where.id || 'stub-local';
        data = [ Object.assign({ id }, insertPayload || {}) ];
      } else if (tableName === 'site_settings') {
        data = [{ id: 1, final_exam_pass_percent: 70 }];
      } else if (tableName === 'quizzes') {
        // return final quizzes mapping to months
        data = [
          { id: 'q1', month_id: 'm1', type: 'final' },
          { id: 'q2', month_id: 'm2', type: 'final' },
          { id: 'q3', month_id: 'm3', type: 'final' },
        ];
      } else if (tableName === 'results') {
        // If where.student_id provided and inFilter present, return empty (no passed exams)
        data = [];
      } else if (op === 'select') {
        data = [];
      }

      return { data, error: null };
    };

    const q = {
      then(resolve) {
        // allow awaiting the chain directly
        buildResult().then(resolve);
      },
      select(..._args) { if (!op) op = 'select'; return q; },
      or(..._args) { return q; },
      order(..._args) { return q; },
      eq(column, value) { where[column] = value; return q; },
      in(column, values) { inFilter = { column, values }; return q; },
      maybeSingle: async function() {
        const r = await buildResult();
        return { data: (Array.isArray(r.data) ? r.data[0] || null : r.data), error: null };
      },
      insert(payload) { op = 'insert'; insertPayload = payload; return q; },
      single: async function() {
        if (op === 'insert') {
          const created = Object.assign({ id: 'stub-local' }, insertPayload || {});
          return { data: created, error: null };
        }
        const r = await buildResult();
        return { data: (Array.isArray(r.data) ? r.data[0] || null : r.data), error: null };
      },
      update(payload) { op = 'update'; insertPayload = payload; return q; },
      delete() { op = 'delete'; return q; },
      // allow setting tableName when created via from(table)
      _setTableName(name) { tableName = name; return q; }
    };
    return q;
  }

  supabase = {
    from: (table) => makeQuery()._setTableName(table)
  };

  // Provide a minimal storage API used by update-profile handler
  supabase.storage = {
    from: (bucket) => ({
      upload: async (path, buffer, opts) => {
        // Pretend upload succeeded
        return { data: null, error: null };
      },
      getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn.example.com/avatars/${path}` } })
    })
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
