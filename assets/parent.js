/* --- extracted script 1 --- */
(function(){
  var API_BASE = window.location.origin;

  var params = new URLSearchParams(location.search);
  var token = params.get('token');

  // نخفي توكن المتابعة من شريط العنوان بعد قراءته حتى لا يتسرّب مع نسخ الرابط أو الـ Referrer.
  if (token && window.history && history.replaceState) {
    history.replaceState(null, '', location.pathname);
  }

  function setMessage(text){
    var list = document.getElementById('results-list');
    list.textContent = '';
    var p = document.createElement('p');
    p.className = 'msg';
    p.textContent = text;
    list.appendChild(p);
  }

  if (!token){
    document.getElementById('student-name').textContent = 'اللينك غير صحيح';
    setMessage('تأكد إنك فاتح اللينك اللي بعته لك الطالب بالظبط.');
    return;
  }

  fetch(API_BASE + '/api/parent-view?token=' + encodeURIComponent(token), { credentials: 'same-origin' })
    .then(function(r){ return r.json().then(function(data){ if (!r.ok) throw new Error(data.error || 'حصل خطأ'); return data; }); })
    .then(function(data){
      var student = data.student || {};
      document.getElementById('student-name').textContent = [student.first_name, student.last_name].filter(Boolean).join(' ') || 'الطالب';

      var grid = document.getElementById('stat-grid');
      grid.textContent = '';
      [
        { num: Number(data.quizzes_completed) || 0, label: 'كويزات مكتملة' },
        { num: data.average_percent != null ? String(data.average_percent) + '%' : '—', label: 'المعدل العام' }
      ].forEach(function(item){
        var box = document.createElement('div');
        box.className = 'stat-box';
        var num = document.createElement('div'); num.className = 'num'; num.textContent = item.num;
        var lbl = document.createElement('div'); lbl.className = 'lbl'; lbl.textContent = item.label;
        box.appendChild(num); box.appendChild(lbl); grid.appendChild(box);
      });

      var list = document.getElementById('results-list');
      list.textContent = '';
      if (!Array.isArray(data.results) || !data.results.length){
        setMessage('لسه مفيش نتائج مسجّلة.');
        return;
      }
      data.results.forEach(function(r){
        var row = document.createElement('div'); row.className = 'row';
        var label = document.createElement('span');
        label.textContent = [r.month || '', r.quiz || ''].filter(Boolean).join(' — ');
        var score = document.createElement('span'); score.className = 'score';
        score.textContent = (Number(r.score) || 0) + '/' + (Number(r.total) || 0);
        row.appendChild(label); row.appendChild(score); list.appendChild(row);
      });
    })
    .catch(function(err){
      document.getElementById('student-name').textContent = 'حصل خطأ';
      setMessage(err && err.message ? err.message : 'تعذر تحميل البيانات.');
    });
})();
