const handler = require('./api/site');
const req = { method: 'GET', url: '/months', query: { student_id: 'stub-local' }, body: {} };
const res = {
  _status: 200,
  headers: {},
  status(code) { this._status = code; return this; },
  json(obj) { console.log('RESPONSE_STATUS:', this._status); console.log('RESPONSE_BODY:', JSON.stringify(obj, null, 2)); },
  setHeader(k,v) { this.headers[k]=v; },
  end() { console.log('res.end called'); }
};

(async () => {
  try {
    await handler(req, res);
    console.log('handler finished');
  } catch (e) {
    console.error('handler threw:', e && e.stack ? e.stack : e);
  }
})();
