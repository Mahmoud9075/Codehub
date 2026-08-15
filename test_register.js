const handler = require('./api/auth');
const req = { method: 'POST', url: '/register', query: {}, body: { first_name: 'ibrahim', last_name: 'mahmoud', phone: '01023514568', email: 'mahmoudibrahim9075@gmail.com', password: 'Mm@12345' } };
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
    console.error('handler threw:', e);
  }
})();
