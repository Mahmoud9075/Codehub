/* CODE HUB UI RELEASE 15.0 - quiz + typography stability pass */
/* --- extracted script 1 --- */
// ============================================================
  // 🔧 مكان واحد بس تحطّ فيه رابط الباك إند بتاعك (نفس الرابط في الحالتين)
  // مثال: 'https://codehub-backend-xxxx.vercel.app'
  // ============================================================
  window.CH_SITE_API_BASE = window.location.origin;

/* --- first-screen initializer v12 --- */
document.addEventListener('DOMContentLoaded', function(){
  var accountButton=document.getElementById('jl-student-btn');
  if(accountButton){
    accountButton.setAttribute('aria-label','فتح الحساب الشخصي أو تسجيل الدخول');
    accountButton.title='الحساب الشخصي أو تسجيل الدخول';
  }
  var register=document.getElementById('jl-register-nav-btn');
  if(register){
    register.setAttribute('role','link');
    register.setAttribute('aria-label','إنشاء حساب جديد');
  }
  var langButton=document.getElementById('jl-lang-pill');
  if(langButton){
    langButton.setAttribute('aria-label','تغيير لغة الموقع بين العربية والإنجليزية');
    langButton.title='العربية / English';
  }
});

/* --- extracted script 7 --- */
(function(){
  var htmlEl = document.documentElement;
  var lightBtn = document.querySelector('[data-theme-btn="light"]');
  var darkBtn = document.querySelector('[data-theme-btn="dark"]');
  function setTheme(mode){
    if(mode === 'dark'){
      htmlEl.setAttribute('data-theme','dark');
      darkBtn && darkBtn.classList.add('active');
      lightBtn && lightBtn.classList.remove('active');
    } else {
      htmlEl.removeAttribute('data-theme');
      lightBtn && lightBtn.classList.add('active');
      darkBtn && darkBtn.classList.remove('active');
    }
  }
  lightBtn && lightBtn.addEventListener('click', function(){ setTheme('light'); });
  darkBtn && darkBtn.addEventListener('click', function(){ setTheme('dark'); });

})();

/* --- extracted script 8 --- */
(function(){
  var CH_API_BASE_MP = window.CH_SITE_API_BASE || ''; // 👈 محتاجش تعدّل هنا، بس حط الرابط فوق أول الملف

  function getLoggedInStudent(){
    var raw = localStorage.getItem('ch_student');
    if (!raw) return null;
    try {
      var wrapper = JSON.parse(raw);
      if (!wrapper.expiresAt || Date.now() > wrapper.expiresAt) return null;
      return wrapper.student;
    } catch (e) { return null; }
  }

  function mpEsc(value){ return String(value == null ? '' : value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];}); }

  var PASS_PERCENT = 70;
  var monthsCache = [];
  var expandedMonthId = null;
  var quizzesCache = {}; // month_id -> { weekly: [...], final: {...} }
  var quizSessionActive = false;
  var activeQuizCleanup = null;

  var monthsEl = document.getElementById('jl-mp-months');
  var panelEl = document.getElementById('jl-mp-panel');
  if (!monthsEl || !panelEl) return;
  panelEl.style.display = 'none';

  function mpApi(path){
    if (!CH_API_BASE_MP) return Promise.reject(new Error('الموقع لسه مش متربط بالباك إند'));
    return fetch(CH_API_BASE_MP + path, { credentials: 'same-origin' }).then(function(r){
      return r.json().then(function(data){
        if (r.status === 401){ localStorage.removeItem('ch_student'); window.dispatchEvent(new Event('ch-auth-changed')); }
        if (!r.ok) throw new Error(data.error || 'حصل خطأ');
        return data;
      });
    });
  }

  function renderLoginPrompt(){
    monthsEl.innerHTML =
      '<div class="jl-mp-login-prompt">' +
        '<p>لازم تسجّل دخول الأول عشان تدخل على المسار الشهري وتاخد كويزاتك الحقيقية.</p>' +
        '<button type="button" class="jl-reg" id="jl-mp-login-btn">تسجيل الدخول</button>' +
      '</div>';
    document.getElementById('jl-mp-login-btn').addEventListener('click', function(){
      document.getElementById('jl-mp-overlay').classList.remove('open');
      document.getElementById('jl-student-btn').click();
    });
  }

  function renderLoadError(msg){
    monthsEl.innerHTML = '<p class="jl-mp-error-msg">⚠️ ' + mpEsc(msg) + '</p>';
  }

  function loadMonths(){
    var student = getLoggedInStudent();
    if (!student){ renderLoginPrompt(); return; }

    monthsEl.innerHTML = '<div class="jl-skeleton" style="height:60px;margin-bottom:10px;"></div><div class="jl-skeleton" style="height:60px;margin-bottom:10px;"></div><div class="jl-skeleton" style="height:60px;"></div>';

    mpApi('/api/months?mine=1').then(function(data){
      monthsCache = data.months;
      if (data.pass_percent != null) PASS_PERCENT = Number(data.pass_percent) || PASS_PERCENT;
      renderMonths();
    }).catch(function(err){
      renderLoadError(err.message);
    });
  }

  function renderMonths(){
    monthsEl.innerHTML = '';
    monthsCache.forEach(function(month){
      var locked = month.status === 'locked';
      var isExpanded = expandedMonthId === month.id;
      var passed = month.status === 'completed';

      var row = document.createElement('div');
      row.className = 'jl-mp-accordion-item' + (locked ? ' locked' : '') + (isExpanded ? ' expanded' : '');

      var headerHtml =
        '<button type="button" class="jl-mp-accordion-head" ' + (locked ? 'disabled' : '') + '>' +
          '<span class="jl-mp-lock-icon">' + (locked ? '🔒' : (passed ? '✅' : '📖')) + '</span>' +
          '<span class="jl-mp-month-title">' + mpEsc(month.name) + '</span>' +
          '<span class="jl-mp-chevron">' + (isExpanded ? '▲' : '▼') + '</span>' +
        '</button>';

      var bodyHtml = isExpanded && !locked ? '<div class="jl-mp-accordion-body" id="jl-mp-body-' + month.id + '"><div class="jl-skeleton" style="height:40px;"></div></div>' : '';

      row.innerHTML = headerHtml + bodyHtml;

      var headBtn = row.querySelector('.jl-mp-accordion-head');
      headBtn.addEventListener('click', function(){
        if (locked) return;
        expandedMonthId = isExpanded ? null : month.id;
        renderMonths();
        if (expandedMonthId) loadQuizzesForMonth(month.id);
      });

      monthsEl.appendChild(row);
    });
  }

  function loadQuizzesForMonth(monthId){
    var student = getLoggedInStudent();
    if (!student) return;

    mpApi('/api/quizzes?month_id=' + monthId).then(function(data){
      if (data.pass_percent != null) PASS_PERCENT = Number(data.pass_percent) || PASS_PERCENT;
      quizzesCache[monthId] = { weekly: data.quizzes, final: data.final_exam };
      renderMonthBody(monthId);
    }).catch(function(err){
      var body = document.getElementById('jl-mp-body-' + monthId);
      if (body) body.innerHTML = '<p class="jl-mp-error-msg">⚠️ ' + mpEsc(err.message) + '</p>';
    });
  }

  function renderMonthBody(monthId){
    var body = document.getElementById('jl-mp-body-' + monthId);
    if (!body) return;
    var cache = quizzesCache[monthId];
    if (!cache) return;

    var weeksHtml = '';
    for (var w = 1; w <= 4; w++){
      var rows = '';
      cache.weekly.forEach(function(quiz){
        if (quiz.week_number !== w) return;
        var status = quiz.status;
        var hasQuestions = quiz.has_questions !== false;
        var icon = status === 'completed' ? '✓' : (status === 'unlocked' ? (hasQuestions ? '▶' : '⏳') : '🔒');
        var btnLabel = status === 'completed' ? 'خلصته' : (status === 'unlocked' ? (hasQuestions ? 'ابدأ' : 'لسه منزلش') : 'مقفول');
        var scoreHtml = quiz.result ? '<span class="jl-mp-quiz-score">' + quiz.result.score + '/' + quiz.result.total + '</span>' : '';
        var shareBtnHtml = quiz.result ? '<button class="jl-mp-share-btn" data-quiz-title="' + mpEsc(quiz.title) + '" data-score="' + quiz.result.score + '" data-total="' + quiz.result.total + '" title="شارك نتيجتك" aria-label="شارك نتيجتك">📤</button>' : '';
        rows +=
          '<div class="jl-mp-quiz-row ' + status + (hasQuestions ? '' : ' no-questions') + '" data-quiz-id="' + quiz.id + '" data-month-id="' + monthId + '">' +
            '<span class="jl-mp-quiz-name"><span class="jl-mp-quiz-icon">' + icon + '</span>' + mpEsc(quiz.title) + '</span>' +
            '<span>' + scoreHtml + shareBtnHtml + '<button class="jl-mp-quiz-btn" ' + (status !== 'unlocked' || !hasQuestions ? 'disabled' : '') + '>' + btnLabel + '</button></span>' +
          '</div>';
      });
      weeksHtml += '<div class="jl-mp-week"><div class="jl-mp-week-label">الأسبوع ' + w + '</div>' + rows + '</div>';
    }

    var fe = cache.final;
    var finalHtml = '';
    if (fe){
      var feIcon = fe.status === 'completed' ? '✓' : (fe.status === 'unlocked' ? '🎯' : '🔒');
      var feScoreHtml = fe.result ? '<span class="jl-mp-quiz-score">' + fe.result.score + '/' + fe.result.total + '</span>' : '';
      var feBtnLabel, feBtnDisabled = true;
      if (fe.status === 'completed'){ feBtnLabel = 'خلصته'; }
      else if (fe.status === 'locked'){ feBtnLabel = 'مقفول'; }
      else if (!fe.has_questions){ feBtnLabel = 'لسه الاختبار منزلش'; }
      else { feBtnLabel = 'ابدأ الاختبار'; feBtnDisabled = false; }

      finalHtml =
        '<div class="jl-mp-final-exam">' +
          '<div class="jl-mp-final-label">🎯 الاختبار النهائي — لازم ' + PASS_PERCENT + '% عشان الشهر اللي بعده يتفتح</div>' +
          '<div class="jl-mp-quiz-row ' + fe.status + '" data-quiz-id="' + fe.id + '" data-month-id="' + monthId + '" data-final="1">' +
            '<span class="jl-mp-quiz-name"><span class="jl-mp-quiz-icon">' + feIcon + '</span>' + mpEsc(fe.title) + '</span>' +
            '<span>' + feScoreHtml + '<button class="jl-mp-quiz-btn jl-mp-final-btn" ' + (feBtnDisabled ? 'disabled' : '') + '>' + feBtnLabel + '</button></span>' +
          '</div>';

      if (fe.status === 'completed'){
        finalHtml += '<div class="jl-mp-final-result ' + (fe.passed ? 'pass' : 'fail') + '">' +
          (fe.passed ? '🎉 مبروك! نجحت في الاختبار والشهر اللي بعده اتفتح.' : '😕 للأسف أقل من ' + PASS_PERCENT + '%. لازم تعيد اختبارات الشهر ده الأول قبل ما تكمل.') +
        '</div>';
      }
      finalHtml += '</div>';
    }

    body.innerHTML = weeksHtml + finalHtml;

    body.querySelectorAll('.jl-mp-quiz-row.unlocked .jl-mp-quiz-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        var row = btn.closest('.jl-mp-quiz-row');
        var isFinal = row.hasAttribute('data-final');
        startQuiz(row.getAttribute('data-quiz-id'), row.getAttribute('data-month-id'), row.querySelector('.jl-mp-quiz-name').textContent.trim(), isFinal);
      });
    });
  }

  // ---------- شاشة أخذ الكويز الحقيقية ----------
  function startQuiz(quizId, monthId, quizTitle, isFinal){
    var student = getLoggedInStudent();
    if (!student) return;

    monthsEl.innerHTML = '<div class="jl-skeleton" style="height:200px;"></div>';

    mpApi('/api/quiz-questions?quiz_id=' + quizId).then(function(data){
      if (!data.questions.length){
        monthsEl.innerHTML = '<p class="jl-mp-error-msg">لسه مفيش أسئلة للكويز ده.</p><button type="button" class="jl-reg" id="jl-mp-back-btn">← رجوع</button>';
        document.getElementById('jl-mp-back-btn').addEventListener('click', function(){ renderMonths(); if (expandedMonthId) renderMonthBody(expandedMonthId); });
        return;
      }
      renderQuizTaking(quizId, monthId, quizTitle, data.questions, student.id, isFinal);
    }).catch(function(err){
      monthsEl.innerHTML = '<p class="jl-mp-error-msg">⚠️ ' + mpEsc(err.message) + '</p>';
    });
  }

  function renderQuizTaking(quizId, monthId, quizTitle, questions, studentId, isFinal){
    var savedKey = 'ch_quiz_progress_' + studentId + '_' + quizId;
    var questionFingerprint = questions.map(function(q){ return String(q.id); }).join('|');
    var currentIndex = 0;
    var answers = {}; // question_id -> selected_index or text answer
    var examExitWarningOn = false;
    function quizEsc(value){ return String(value == null ? '' : value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];}); }

    // 18) استرجاع تقدّم محفوظ لو حصل قطع نت أو قفل الصفحة غلط
    try {
      var saved = JSON.parse(localStorage.getItem(savedKey) || 'null');
      // نحافظ على تقدّم الطالب حتى لو المدرس عدّل أسئلة الكويز بعد ذلك.
      // الإجابات المرتبطة بأسئلة ما زالت موجودة تفضل محفوظة، والأسئلة الجديدة تبدأ بدون إجابة.
      if (saved && saved.answers) {
        answers = saved.answers;
        currentIndex = Math.min(Math.max(saved.currentIndex || 0, 0), questions.length - 1);
      }
    } catch (e) {}

    function saveProgress(){
      try { localStorage.setItem(savedKey, JSON.stringify({ answers: answers, currentIndex: currentIndex, fingerprint: questionFingerprint, savedAt: Date.now() })); } catch (e) {}
    }
    function clearProgress(){
      try { localStorage.removeItem(savedKey); } catch (e) {}
    }

    // 17) تحذير لو الطالب حاول يقفل الصفحة في نص الامتحان
    function beforeUnloadHandler(e){ e.preventDefault(); e.returnValue = ''; }
    function startExitWarning(){
      if (examExitWarningOn) return;
      examExitWarningOn = true;
      window.addEventListener('beforeunload', beforeUnloadHandler);
    }
    function stopExitWarning(){
      examExitWarningOn = false;
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    }
    startExitWarning();
    quizSessionActive = true;
    activeQuizCleanup = function(){
      stopExitWarning();
      quizSessionActive = false;
      activeQuizCleanup = null;
    };
    var submittingQuiz = false;

    function renderQuestion(){
      var q = questions[currentIndex];
      var progress = Math.round(((currentIndex + 1) / questions.length) * 100);
      var isLast = currentIndex === questions.length - 1;

      var answerMode = q.answer_mode || 'choice';
      var currentAnswer = answers[q.id];
      var hasAnswer = answerMode === 'choice' ? currentAnswer != null : String(currentAnswer || '').trim().length > 0;
      var answerHtml = answerMode === 'choice'
        ? '<div class="jl-quiz-take-options">' + (q.options || []).map(function(opt, idx){
            var checked = currentAnswer === idx ? ' selected' : '';
            return '<button type="button" class="jl-quiz-option' + checked + '" data-idx="' + idx + '">' + quizEsc(opt) + '</button>';
          }).join('') + '</div>'
        : (q.question_type === 'essay'
            ? '<textarea id="jl-quiz-text-answer" maxlength="4000" rows="7" placeholder="اكتب إجابتك بالتفصيل..." style="width:100%;border:1px solid #b6913b66;border-radius:14px;padding:14px;background:#fff;color:#1a2142;font:600 15px Cairo,sans-serif;resize:vertical">' + quizEsc(currentAnswer || '') + '</textarea>'
            : '<input id="jl-quiz-text-answer" maxlength="1000" placeholder="اكتب الإجابة هنا" value="' + quizEsc(currentAnswer || '') + '" style="width:100%;border:1px solid #b6913b66;border-radius:14px;padding:14px;background:#fff;color:#1a2142;font:600 15px Cairo,sans-serif">');

      monthsEl.innerHTML =
        '<div class="jl-quiz-take">' +
          '<div class="jl-quiz-take-head"><span>' + quizEsc(quizTitle) + '</span><span>سؤال ' + (currentIndex + 1) + ' من ' + questions.length + '</span></div>' +
          '<div class="jl-quiz-take-progress"><div class="jl-quiz-take-progress-fill" style="width:' + progress + '%"></div></div>' +
          '<div style="display:inline-flex;background:#b6913b1f;color:#80631f;border-radius:999px;padding:5px 11px;font-weight:800;font-size:12px;margin-bottom:10px">' + quizEsc(q.type_label || 'اختياري') + '</div>' +
          '<div class="jl-quiz-take-question">' + quizEsc(q.question_text) + '</div>' + answerHtml +
          '<div class="jl-quiz-save-note">✓ إجاباتك بتتحفظ تلقائيًا على الجهاز</div>' +
          '<div class="jl-quiz-nav-actions">' +
            '<button type="button" class="jl-quiz-prev-btn" id="jl-quiz-prev-btn" ' + (currentIndex === 0 ? 'disabled' : '') + '>السابق</button>' +
            '<button type="button" class="jl-reg jl-quiz-next-main" id="jl-quiz-next-btn" ' + (!hasAnswer ? 'disabled' : '') + '>' + (isLast ? 'إنهاء وتسليم' : 'التالي') + '</button>' +
          '</div>' +
        '</div>';

      monthsEl.querySelectorAll('.jl-quiz-option').forEach(function(btn){
        btn.addEventListener('click', function(){
          monthsEl.querySelectorAll('.jl-quiz-option').forEach(function(b){ b.classList.remove('selected'); });
          btn.classList.add('selected');
          answers[q.id] = parseInt(btn.getAttribute('data-idx'), 10);
          document.getElementById('jl-quiz-next-btn').disabled = false;
          saveProgress();
        });
      });

      var textAnswer = document.getElementById('jl-quiz-text-answer');
      if (textAnswer) textAnswer.addEventListener('input', function(){
        answers[q.id] = textAnswer.value;
        document.getElementById('jl-quiz-next-btn').disabled = !textAnswer.value.trim();
        saveProgress();
      });

      var prevBtn = document.getElementById('jl-quiz-prev-btn');
      if (prevBtn) prevBtn.addEventListener('click', function(){
        if (currentIndex > 0){ currentIndex--; saveProgress(); renderQuestion(); }
      });

      document.getElementById('jl-quiz-next-btn').addEventListener('click', function(){
        if (isLast){
          if (window.confirm('متأكد إنك جاوبت كل الأسئلة وعايز تسلّم الاختبار؟')) submitQuiz();
        } else {
          currentIndex++;
          saveProgress();
          renderQuestion();
        }
      });
    }

    function submitQuiz(){
      if (submittingQuiz) return;
      submittingQuiz = true;
      stopExitWarning();
      monthsEl.innerHTML = '<div class="jl-skeleton" style="height:120px;"></div>';
      var payload = {
        quiz_id: quizId,
        // نرسل فقط إجابات الأسئلة الموجودة حاليًا في الكويز، مع الاحتفاظ بالتقدم القديم محليًا.
        answers: questions.filter(function(q){ return Object.prototype.hasOwnProperty.call(answers, q.id); }).map(function(q){
          var qId = q.id;
          return typeof answers[qId] === 'number'
            ? { question_id: qId, selected_index: answers[qId] }
            : { question_id: qId, text_answer: String(answers[qId] || '') };
        })
      };
      fetch(CH_API_BASE_MP + '/api/submit-result', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function(r){ return r.json().then(function(data){ if (!r.ok) throw new Error(data.error); return data; }); })
        .then(function(data){
          submittingQuiz = false;
          clearProgress();
          if (activeQuizCleanup) activeQuizCleanup();
          if (window.jlConfetti) window.jlConfetti();
          var pct = Math.round((data.result.score / data.result.total) * 100);

          // 20) مراجعة الإجابات الصح والغلط
          var reviewHtml = (data.breakdown || []).map(function(b, i){
            var status = b.is_correct ? 'correct' : 'wrong';
            var yourAnswer = b.answer_mode === 'text' ? (b.student_answer || 'من غير إجابة') : (b.selected_index != null ? b.options[b.selected_index] : 'من غير إجابة');
            var correctAnswer = b.answer_mode === 'text' ? b.correct_answer : b.options[b.correct_index];
            var similarityText = b.similarity != null ? ' — نسبة التشابه: ' + b.similarity + '%' : '';
            return '<div class="jl-review-answer ' + status + '">' +
              '<strong>' + (i + 1) + '. ' + quizEsc(b.question_text) + '</strong><br>' +
              (b.is_correct ? '✓ إجابتك صح: ' + quizEsc(yourAnswer) : '✗ إجابتك: ' + quizEsc(yourAnswer) + ' — الإجابة النموذجية: ' + quizEsc(correctAnswer)) + similarityText +
            '</div>';
          }).join('');

          monthsEl.innerHTML =
            '<div class="jl-quiz-result">' +
              '<div class="jl-quiz-result-score">' + data.result.score + ' / ' + data.result.total + '</div>' +
              '<div class="jl-quiz-result-pct">' + pct + '%</div>' +
              '<div class="jl-quiz-result-note ' + (data.review_locked ? 'fail' : 'ok') + '">' +
                (data.review_locked ? 'النهائي محتاج ' + (data.pass_percent || PASS_PERCENT) + '% للنجاح. راجع وحاول تاني.' : 'تم حفظ نتيجتك وتحديث المسار بنجاح.') +
              '</div>' +
              '<button type="button" class="jl-reg" id="jl-quiz-back-btn">← رجوع للمسار</button>' +
              (data.review_locked ? '' : '<button type="button" class="jl-student-link" id="jl-quiz-review-btn" style="margin-top:12px;">مراجعة الإجابات</button>') +
              (data.review_locked ? '' : '<div id="jl-quiz-review-list" style="display:none;text-align:start;margin-top:16px;">' + reviewHtml + '</div>') +
            '</div>';
          document.getElementById('jl-quiz-back-btn').addEventListener('click', function(){
            delete quizzesCache[monthId];
            loadMonths();
            expandedMonthId = monthId;
          });
          var reviewBtn = document.getElementById('jl-quiz-review-btn');
          if (reviewBtn) reviewBtn.addEventListener('click', function(){
            var list = document.getElementById('jl-quiz-review-list');
            if (list) list.style.display = list.style.display === 'none' ? 'block' : 'none';
          });
        }).catch(function(err){
          submittingQuiz = false;
          startExitWarning();
          quizSessionActive = true;
          monthsEl.innerHTML =
            '<div class="jl-quiz-submit-error">' +
              '<p class="jl-mp-error-msg">⚠️ ' + mpEsc(err.message || 'تعذر إرسال النتيجة') + '</p>' +
              '<p>إجاباتك محفوظة. تقدر تعيد الإرسال من غير ما تبدأ من الأول.</p>' +
              '<div class="jl-quiz-nav-actions">' +
                '<button type="button" class="jl-quiz-prev-btn" id="jl-quiz-return-btn">راجع الإجابات</button>' +
                '<button type="button" class="jl-reg jl-quiz-next-main" id="jl-quiz-retry-btn">إعادة الإرسال</button>' +
              '</div>' +
            '</div>';
          document.getElementById('jl-quiz-return-btn').addEventListener('click', renderQuestion);
          document.getElementById('jl-quiz-retry-btn').addEventListener('click', submitQuiz);
        });
    }

    renderQuestion();
  }

  loadMonths();
  var mpAlreadyOpenedOnce = false;
  document.querySelectorAll('.jl-open-mp').forEach(function(btn){
    btn.addEventListener('click', function(){
      if (mpAlreadyOpenedOnce) loadMonths(); // نحدّث البيانات كل مرة يفتح فيها الطالب المودال
      mpAlreadyOpenedOnce = true;
    });
  });

  // ---------- مشاركة النتيجة (كارت فيه لوجو Code Hub + الاسم + الدرجة) ----------
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('.jl-mp-share-btn');
    if (!btn) return;

    var quizTitle = btn.getAttribute('data-quiz-title');
    var score = btn.getAttribute('data-score');
    var total = btn.getAttribute('data-total') || '10';
    var logoImg = document.querySelector('img[alt="Code Hub"]');

    var canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 500;
    var ctx = canvas.getContext('2d');

    function drawCard(){
      // خلفية متدرجة
      var grad = ctx.createLinearGradient(0, 0, 800, 500);
      grad.addColorStop(0, '#1a2142');
      grad.addColorStop(1, '#2a1512');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 800, 500);

      // إطار دهبي
      ctx.strokeStyle = '#b6913b';
      ctx.lineWidth = 6;
      ctx.strokeRect(16, 16, 768, 468);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#f3eee1';
      ctx.font = 'bold 30px Arial';
      ctx.fillText('Code Hub', 400, 100);

      ctx.fillStyle = '#c9a85c';
      ctx.font = '22px Arial';
      ctx.fillText(quizTitle, 400, 230);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 90px Arial';
      ctx.fillText(score + ' / ' + total, 400, 340);

      ctx.fillStyle = '#f3eee1aa';
      ctx.font = '18px Arial';
      ctx.fillText('codehub-blue-kappa.vercel.app', 400, 440);

      canvas.toBlob(function(blob){
        var file = new File([blob], 'codehub-result.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })){
          navigator.share({ files: [file], title: 'Code Hub', text: 'خلصت ' + quizTitle + ' بدرجة ' + score + '/' + total + ' في Code Hub! 🎉' }).catch(function(){});
        } else {
          var link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'codehub-result.png';
          link.click();
        }
      });
    }

    if (logoImg && logoImg.complete){
      var logo = new Image();
      logo.onload = function(){
        drawCard();
        ctx.drawImage(logo, 360, 20, 80, 80); // اللوجو فوق الكارت (اختياري، الكارت شغال حتى لو الصورة اتأخرت)
      };
      logo.src = logoImg.src;
    }
    drawCard();
  });

  // Open/close the Monthly Path modal from the nav/footer links
  var mpOverlay = document.getElementById('jl-mp-overlay');
  var mpClose = document.getElementById('jl-mp-modal-close');
  document.querySelectorAll('.jl-open-mp').forEach(function(btn){
    btn.addEventListener('click', function(){
      mpOverlay.classList.add('open');
    });
  });
  function closeMonthlyPath(){
    if (quizSessionActive){
      var leave = window.confirm('أنت في منتصف اختبار. إجاباتك محفوظة، لكن هل تريد إغلاق الاختبار الآن؟');
      if (!leave) return;
      if (activeQuizCleanup) activeQuizCleanup();
    }
    mpOverlay.classList.remove('open');
  }
  mpClose && mpClose.addEventListener('click', closeMonthlyPath);
  mpOverlay && mpOverlay.addEventListener('click', function(e){
    if (e.target === mpOverlay) closeMonthlyPath();
  });
})();

/* --- extracted script 9 --- */
(function(){
  // ---------- Language toggle (AR <-> EN) ----------
  var translations = {
    "nav-home": {ar:"الرئيسية", en:"Home"},
    "nav-benefits": {ar:"✨ المميزات", en:"✨ Features"},
    "nav-cta": {ar:"💳 الاشتراك", en:"💳 Join"},
    "nav-about": {ar:"ℹ️ عن المنصّة", en:"ℹ️ About"},
    "nav-path": {ar:"🗓️ المسار الشهري", en:"🗓️ Monthly Path"},
    "btn-join": {ar:"ابدأ رحلتك", en:"Start Your Journey"},
    "btn-subscribe": {ar:"انضم لـ CODE HUB", en:"Join CODE HUB"},
    "hero-h1": {ar:"مستقبلك في البرمجة", en:"Your Future in Programming"},
    "hero-h1-mark": {ar:"يبدأ من هنا", en:"Starts Here"},
    "hero-sub": {ar:"اتعلّم، طبّق، اختبر نفسك وتابع تقدمك خطوة بخطوة.", en:"Learn, practice, test yourself, and track your progress step by step."},
    "benefits-h": {ar:"إيه اللي هتاخده", en:"What You'll"},
    "benefits-h-mark": {ar:"معانا؟", en:"Get With Us"},
    "benefits-sub": {ar:"كل اللي محتاجه عشان تفهم، تطبّق، وتحقّق أعلى الدرجات — في مكان واحد.", en:"Everything you need to understand, practice, and score higher — all in one place."},
    "audience-h": {ar:"CODE HUB مناسبة لمين؟", en:"Who Is CODE HUB For?"},
    "path-h": {ar:"المسار", en:"Monthly"},
    "path-h-mark": {ar:"الشهري", en:"Path"},
    "path-sub": {ar:"افتح الشهر وابدأ اختباراتك بالترتيب — كل ما تخلّص كويز، اللي بعده يفتح تلقائي.", en:"Open a month and take your quizzes in order — finish one, the next unlocks automatically."},
    "cta-eyebrow": {ar:"ابدأ النهارده · تقدر تلغي في أي وقت ———", en:"Start today · Cancel anytime ———"},
    "cta-h": {ar:'جاهز تبدأ؟', en:'Ready to Start?'},
    "about-tag": {ar:"عن Code Hub", en:"About Code Hub"},
    "about-h": {ar:"ليه CODE HUB؟", en:"Why CODE HUB?"},
    "about-tagline": {ar:"مستقبل التعليم يبدأ من هنا", en:"The future of education starts here"},
    "why-1-h": {ar:"شرح يخليك تفهم مش تحفظ", en:"Understand, Don’t Memorize"},
    "why-1-p": {ar:"شرح مبسّط وتطبيقي لمادة البرمجة والذكاء الاصطناعي لطلاب أولى وثانية ثانوي.", en:"Clear, practical Programming & AI lessons for first- and second-year secondary students."},
    "why-2-h": {ar:"اختبارات تتابع مستواك", en:"Tests That Track Your Level"},
    "why-2-p": {ar:"اختبارات بعد كل حصة، أسبوعية وشهرية، عشان تعرف مستواك ونقاط ضعفك أول بأول.", en:"Session, weekly, and monthly tests help you track your level and weak points continuously."},
    "why-3-h": {ar:"مهارات للمستقبل", en:"Skills for the Future"},
    "why-3-p": {ar:"مش هدفنا الامتحان بس؛ هدفنا إنك تفهم، تطبّق، تحل المشكلات وتبني أساس قوي للجامعة وسوق العمل.", en:"Our goal goes beyond exams: understand, apply, solve problems, and build a strong foundation for university and work."},
    "faq-h": {ar:"عندك سؤال؟", en:"Have a Question?"},
    "faq-sub": {ar:"كل اللي محتاج تعرفه عن CODE HUB قبل ما تبدأ.", en:"Everything you need to know about CODE HUB before you start."},
    "faq-q1": {ar:"الاشتراك شهري ولا سنوي؟", en:"Is the subscription monthly or yearly?"},
    "faq-a1": {ar:"الاشتراك بيكون حسب نظام الدراسة المتاح، وهتلاقي كل التفاصيل والأسعار موضحة قبل الاشتراك.", en:"Subscriptions follow the available study plan, with all details and prices shown clearly before you subscribe."},
    "faq-q2": {ar:"هل الدروس شرح بس ولا فيها تطبيق واختبارات؟", en:"Are lessons explanation only, or do they include practice and tests?"},
    "faq-a2": {ar:"لأ، الشرح بيكون عملي ونظري، ومعاه تطبيق أثناء الدرس واختبارات تساعدك تتأكد إنك فهمت وتتابع مستواك.", en:"Lessons combine theory and hands-on practice, with tests that confirm understanding and track progress."},
    "faq-q3": {ar:"إزاي المحتوى متوافق مع منهج المدرسة؟", en:"How does the content match the school curriculum?"},
    "faq-a3": {ar:"المحتوى مترتب بما يتناسب مع منهج البرمجة والذكاء الاصطناعي لطلاب أولى وثانية ثانوي، مع شرح وتدريبات على كل جزء.", en:"Content is organized around the Programming & AI curriculum for first- and second-year secondary students, with explanations and practice for every part."},
    "faq-q4": {ar:"هل الشرح مناسب لو أنا مبتدئ ومليش أي خلفية في البرمجة؟", en:"Is it suitable if I’m a complete beginner in programming?"},
    "faq-a4": {ar:"أيوه، بنبدأ من الأساسيات خطوة بخطوة، فمش محتاج تكون عندك خبرة سابقة في البرمجة.", en:"Yes. We start from the basics step by step, so no previous programming experience is required."},
    "faq-q5": {ar:"إزاي أتابع مستوايا وتقدمي؟", en:"How can I track my level and progress?"},
    "faq-a5": {ar:"من خلال الاختبارات والنتائج داخل حسابك، تقدر تعرف مستواك وتتابع تقدمك باستمرار.", en:"Your account shows tests and results so you can continuously monitor your level and progress."},
    "faq-q6": {ar:"لو واجهت مشكلة، هل فيه دعم فني؟", en:"Is technical support available if I have a problem?"},
    "faq-a6": {ar:"أيوه، لو واجهتك أي مشكلة في الحساب أو استخدام المنصة، تقدر تتواصل مع الدعم ونساعدك في حلها.", en:"Yes. If you have any account or platform issue, contact support and we’ll help you solve it."},
    "footer-info-h": {ar:"تواصل معنا", en:"Contact Us"},
    "footer-tagline": {ar:"بنعلّم البرمجة والذكاء الاصطناعي بشغف.", en:"We teach programming and AI with passion."},
    "footer-address": {ar:"شارع 10 - سنتر كيان - الدور التاني - أمام مكتبة الروضة وبجوار سوبر ماركت الشعب", en:"10th St. - Kayan Center - 2nd Floor - opposite Al-Rawda Library, next to Al-Shaab Supermarket"},
    "b-offline-h": {ar:"محاضرات أوف لاين", en:"Offline Lectures"},
    "b-offline-p": {ar:"شرح مسجل بجودة عالية تقدر تتفرج عليه في وقتك المناسب، وترجع له وقت ما تحتاج تراجع أي جزء.", en:"High-quality recorded lessons you can watch whenever suits you, and revisit any part when you need to review."},
    "b-quiz-h": {ar:"اختبارات إلكترونية ذكية كل حصة", en:"Smart Quizzes After Every Session"},
    "b-quiz-p": {ar:"اختبر مستواك بعد كل حصة مع تصحيح فوري وتحليل مفصل للأداء.", en:"Test your level after every session with instant grading and detailed performance analysis."},
    "b-content-h": {ar:"محتوى تعليمي متكامل", en:"Complete Learning Content"},
    "b-content-p": {ar:"شرح مبسط، وأمثلة عملية، وتمارين تغطي جميع أجزاء المنهج.", en:"Simplified explanations, practical examples, and exercises covering every part of the curriculum."},
    "b-projects-h": {ar:"واجبات ومشروعات عملية", en:"Assignments & Practical Projects"},
    "b-projects-p": {ar:"تطبيق عملي يساعدك على اكتساب مهارات البرمجة وحل المشكلات.", en:"Hands-on practice that helps you build programming and problem-solving skills."},
    "b-ai-h": {ar:"مساعد ذكي بالذكاء الاصطناعي", en:"Smart AI Assistant"},
    "b-ai-p": {ar:"اسأل في المنهج أو أي موضوع عام، واكتب سؤالك أو ارفع صورة ليحللها ويشرحها لك بوضوح.", en:"Ask about the curriculum or any general topic, type your question or upload an image for clear analysis and explanation."},
    "b-track-h": {ar:"متابعة مستمرة", en:"Continuous Progress Tracking"},
    "b-track-p": {ar:"تقارير توضح تقدمك، ونقاط القوة، والموضوعات التي تحتاج إلى مراجعة.", en:"Reports showing your progress, strengths, and topics that need review."},
    "b-errors-h": {ar:"سجل الأخطاء البرمجية", en:"Coding Mistakes Log"},
    "b-errors-p": {ar:"تحتفظ المنصة بأخطائك البرمجية لمساعدتك على التعلم منها وعدم تكرارها.", en:"The platform keeps a record of your coding mistakes to help you learn from them and avoid repeating them."},
    "b-support-h": {ar:"دعم فني وتعليمي", en:"Technical & Educational Support"},
    "b-support-p": {ar:"فريق متخصص جاهز لمساعدتك والإجابة عن استفساراتك.", en:"A dedicated team ready to help you and answer your questions."},
    "aud-1": {ar:"طلاب الصف الأول والثاني الثانوي.", en:"1st and 2nd year secondary school students."},
    "aud-2": {ar:"الطلاب الذين يرغبون في تحقيق أعلى الدرجات في مادة البرمجة والذكاء الاصطناعي.", en:"Students aiming for top grades in Programming & AI."},
    "aud-3": {ar:"الطلاب الذين يريدون تعلم البرمجة بطريقة عملية وحديثة.", en:"Students who want to learn programming in a practical, modern way."},
    "aud-4": {ar:"أولياء الأمور الباحثون عن تعليم احترافي يجمع بين الجودة والمتابعة.", en:"Parents looking for professional education that combines quality and follow-up."},
    "aud-5": {ar:"الطلاب المهتمين بمجال الذكاء الاصطناعي واستخداماته العملية من سن مبكرة.", en:"Students interested in AI and its practical applications from an early age."},
    "aud-6": {ar:"الطلاب اللي عايزين يبنوا سيرة ذاتية قوية ومشاريع حقيقية قبل الجامعة.", en:"Students who want to build a strong resume and real projects before university."},
    "about-p1": {ar:"Code Hub هي أول منصة تعليمية متخصصة في تدريس مادة البرمجة والذكاء الاصطناعي لطلاب الصف الأول والثاني الثانوي في مصر، برؤية تجمع بين جودة التعليم، والتكنولوجيا الحديثة، والذكاء الاصطناعي، لتقديم تجربة تعليمية تفاعلية تساعد الطالب على تحقيق التفوق الحقيقي.", en:"Code Hub is the first educational platform dedicated to teaching Programming & AI to 1st and 2nd year secondary school students in Egypt, with a vision that combines quality education, modern technology, and AI to deliver an interactive learning experience that helps students achieve real excellence."},
    "about-p2": {ar:"نحن لا نقدم مجرد شرح للمنهج، بل نبني بيئة تعليمية متكاملة تجعل الطالب يفهم، ويطبق، ويحل المشكلات، ويكتسب المهارات التي يحتاجها في الجامعة وسوق العمل.", en:"We don't just explain the curriculum — we build a complete learning environment where students understand, apply, solve problems, and gain the skills they need for university and the job market."},
    "about-p3": {ar:"وعشان كده بنينا داخل المنصة قسم خاص بالامتحانات والاختبارات الإلكترونية لكل حصة، بتصحيح فوري وتحليل دقيق لأداء الطالب — علشان تعرف بالظبط انت قوي في إيه ومحتاج تراجع إيه، قبل ما تدخل امتحان المدرسة الحقيقي وانت واثق من نفسك. مفيش مفاجآت، ومفيش مذاكرة عشوائية؛ كل كويز بيقولك مكانك بالظبط وبيجهزك للخطوة اللي بعدها.", en:"That's why we built a dedicated exams section inside the platform, with instant grading and detailed performance analysis — so you know exactly what you're strong at and what needs review, before you walk into your real school exam with confidence. No surprises, no random studying; every quiz tells you exactly where you stand and prepares you for the next step."},
    "vision-h": {ar:"رؤيتنا", en:"Our Vision"},
    "vision-p": {ar:"أن تصبح Code Hub المنصة التعليمية المرجعية في مصر والعالم العربي لتعليم البرمجة والذكاء الاصطناعي، وأن تساهم في إعداد جيل يمتلك المعرفة والمهارات الرقمية اللازمة للمستقبل.", en:"For Code Hub to become the go-to educational platform in Egypt and the Arab world for teaching Programming & AI, and to help prepare a generation equipped with the digital knowledge and skills the future demands."},
    "mission-h": {ar:"رسالتنا", en:"Our Mission"},
    "mission-p": {ar:"تقديم تعليم رقمي احترافي يجمع بين جودة المحتوى، والتفاعل المستمر، والتطبيق العملي، والذكاء الاصطناعي، بما يساعد كل طالب على تحقيق أعلى مستوى من الفهم والتفوق والثقة.", en:"To deliver professional digital education that combines quality content, continuous interaction, hands-on practice, and AI — helping every student reach their highest level of understanding, excellence, and confidence."},
    "values-h": {ar:"قيمنا", en:"Our Values"},
    "val-1": {ar:"الجودة والاحترافية.", en:"Quality & professionalism."},
    "val-2": {ar:"الابتكار المستمر.", en:"Continuous innovation."},
    "val-3": {ar:"التعلم القائم على التطبيق.", en:"Application-based learning."},
    "val-4": {ar:"الشفافية والالتزام.", en:"Transparency & commitment."},
    "val-5": {ar:"دعم الطالب في كل مرحلة من رحلته التعليمية.", en:"Supporting students at every stage of their learning journey."},
    "groups-tag": {ar:"اختر الصف الدراسي", en:"Choose your grade"},
    "groups-h": {ar:"💬 انضم إلى مجموعة واتساب", en:"💬 Join Your WhatsApp Group"},
    "groups-p": {ar:"اختر صفك الدراسي وسيتم تحويلك مباشرة إلى مجموعة واتساب.", en:"Choose your grade and you'll be taken directly to the WhatsApp group."},
    "groups-g1": {ar:"💡 أولى ثانوي | البرمجة من الصفر", en:"💡 First Secondary | Programming from Zero"},
    "groups-g2": {ar:"🚀 ثانية ثانوي | مستقبل البكالوريا", en:"🚀 Second Secondary | Baccalaureate Future"},
    "footer-links-h2": {ar:"روابط سريعة", en:"Quick Links"},
    "footer-nav-audience": {ar:"لمن المنصة", en:"Who It's For"},
    "nav-reviews": {ar:"⭐ التقييمات", en:"⭐ Reviews"},
    "reviews-h": {ar:"طلابنا قالوا", en:"What Our Students"},
    "reviews-h-mark": {ar:"إيه؟", en:"Say"},
    "reviews-sub": {ar:"تقييمات حقيقية من الطلاب وأولياء الأمور والزوار. أي حد يقدر يشارك تجربته.", en:"Real reviews from students, parents, and visitors. Anyone can share their experience."},
    "review-form-h": {ar:"شاركنا تقييمك", en:"Share Your Review"},
    "review-submit": {ar:"أضف تقييمك", en:"Submit Review"},
    "review-name-ph": {ar:"اسمك", en:"Your name"},
    "review-course-ph": {ar:"اختار صفتك", en:"Choose who you are"},
    "review-parent": {ar:"ولي أمر", en:"Parent"},
    "review-guest": {ar:"زائر", en:"Visitor"},
    "review-moderation-note": {ar:"التقييم بيتحفظ عندنا ويظهر للزوار بعد المراجعة.", en:"Your review is saved and becomes public after moderation."},
    "review-comment-ph": {ar:"اكتب رأيك هنا...", en:"Write your review here..."},
    "grade-1": {ar:"طالب أولى ثانوي", en:"1st Year Secondary Student"},
    "grade-2": {ar:"طالب ثانية ثانوي", en:"2nd Year Secondary Student"},
    "free-badge": {ar:"أول حصتين مجانًا تمامًا لكل الطلاب", en:"First 2 sessions completely free for all students"},
    "prize-badge": {ar:"جوائز شهرية للطلاب المتفوقين", en:"Monthly prizes for top students"},
    "mp-teaser-h": {ar:"رحلتك خلال الشهر", en:"Your Monthly Journey"},
    "mp-teaser-p": {ar:"كويزاتك مرتبة شهر شهر، كل ما تخلّص كويز اللي بعده يفتح تلقائي.", en:"Your quizzes organized month by month — finish one, the next unlocks automatically."},
    "mp-teaser-btn": {ar:"الدخول الشهري ←", en:"Monthly Access →"},
    "countdown-label": {ar:"الترم الجديد يبدأ خلال", en:"New term starts in"},
    "nav-aboutme": {ar:"👨‍🏫 المدرسين", en:"👨‍🏫 Instructors"},
    "am-h": {ar:"فريق CODE HUB", en:"CODE HUB Team"},
    "am-sub": {ar:"تعرف على المدرسين المسؤولين عن شرح ومتابعة مادة البرمجة والذكاء الاصطناعي.", en:"Meet the instructors responsible for teaching and supporting Programming & AI."},
    "am-name-mabrouk": {ar:"المهندس محمد مبروك", en:"Eng. Mohamed Mabrouk"},
    "am-name-ibrahim": {ar:"المهندس محمود إبراهيم", en:"Eng. Mahmoud Ibrahim"},
    "am-qualification": {ar:"خريج هندسة - تقدير امتياز", en:"Engineering graduate - Excellent grade"},
    "am-specialty": {ar:"متخصص في تطوير الويب والذكاء الاصطناعي.", en:"Specialized in web development and AI."},
    "am-specialty2": {ar:"متخصص في تطوير الويب والذكاء الاصطناعي.", en:"Specialized in web development and AI."},
    "am-bio-mabrouk": {ar:"يعمل فريلانسر منذ أكتر من سنتين، وشغوف بتبسيط البرمجة والذكاء الاصطناعي للطلاب.", en:"Has been working as a freelancer for over two years, passionate about simplifying programming and AI for students."},
    "am-bio-ibrahim": {ar:"يعمل فريلانسر منذ أكتر من سنتين، وشغوف بتبسيط البرمجة والذكاء الاصطناعي للطلاب.", en:"Has been working as a freelancer for over two years, passionate about simplifying programming and AI for students."}
  };

  var htmlEl = document.documentElement;
  var langPill = document.getElementById('jl-lang-pill');
  var langLabel = document.getElementById('jl-lang-pill-label');
  var currentLang = 'ar';

  function applyLang(lang){
    currentLang = lang;
    htmlEl.setAttribute('lang', lang);
    htmlEl.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
    if (langLabel) langLabel.textContent = lang === 'en' ? 'AR' : 'EN';
    if (langPill){ langPill.setAttribute('aria-label', lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'); langPill.title = lang === 'ar' ? 'English' : 'العربية'; }

    document.querySelectorAll('[data-i18n]').forEach(function(el){
      var entry = translations[el.getAttribute('data-i18n')];
      if (entry) el.innerHTML = entry[lang];
    });
    document.querySelectorAll('[data-i18n-inner]').forEach(function(el){
      var entry = translations[el.getAttribute('data-i18n-inner')];
      if (entry) el.textContent = entry[lang];
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function(el){
      var entry = translations[el.getAttribute('data-i18n-ph')];
      if (entry) el.setAttribute('placeholder', entry[lang]);
    });
  }

  // Navbar menu is wired once in the final stability controller below.
  // Keeping one owner prevents double-toggle bugs after repeated UI updates.

  langPill && langPill.addEventListener('click', function(){
    applyLang(currentLang === 'ar' ? 'en' : 'ar');
  });

  // ---------- WhatsApp groups picker modal (replaces the old register page) ----------
  var overlay = document.getElementById('jl-groups-overlay');
  var closeBtn = document.getElementById('jl-groups-close');
  document.querySelectorAll('.jl-open-groups').forEach(function(btn){
    btn.addEventListener('click', function(){
      if (overlay) overlay.classList.add('open');
    });
  });
  closeBtn && closeBtn.addEventListener('click', function(){
    overlay.classList.remove('open');
  });
  overlay && overlay.addEventListener('click', function(e){
    if (e.target === overlay) overlay.classList.remove('open');
  });
})();

/* --- extracted script 10 --- */
(function(){
  // ---------- تقييمات عامة محفوظة في قاعدة البيانات ----------
  var listEl = document.getElementById('jl-reviews-list');
  var formEl = document.getElementById('jl-review-form');
  var starsEl = document.getElementById('jl-rv-stars');
  var statsEl = document.getElementById('jl-reviews-stats');
  var selectedStars = 0;
  if (!listEl || !formEl || !starsEl) return;

  var rvCommentEl = document.getElementById('jl-rv-comment');
  var rvCommentCount = document.getElementById('jl-rv-comment-count');
  if (rvCommentEl && rvCommentCount){
    rvCommentEl.addEventListener('input', function(){
      rvCommentCount.textContent = rvCommentEl.value.length + ' / 400';
    });
  }

  function escapeHtml(str){
    var div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
  }

  function reviewApi(path, opts){
    opts = opts || {};
    opts.credentials = 'same-origin';
    opts.headers = Object.assign({'Content-Type':'application/json'}, opts.headers || {});
    return fetch((window.CH_SITE_API_BASE || window.location.origin) + path, opts).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(data){
        if (!r.ok) throw new Error(data.error || 'حصل خطأ');
        return data;
      });
    });
  }

  function renderStats(data){
    if (!statsEl) return;
    var count = Number(data.count || 0);
    var average = Number(data.average || 0);
    if (!count){ statsEl.textContent = ''; return; }
    statsEl.textContent = average.toFixed(1).replace('.0','') + ' / 5  ·  ' + count + ' تقييم منشور';
  }

  function renderReviews(reviews){
    if (!reviews.length){
      listEl.innerHTML = '<p class="jl-reviews-empty">لسه مفيش تقييمات منشورة — شاركنا تجربتك.</p>';
      return;
    }
    listEl.innerHTML = reviews.map(function(r){
      var starsHtml = '';
      for (var i = 1; i <= 5; i++) starsHtml += (i <= Number(r.stars) ? '★' : '☆');
      return '<article class="jl-review-card">' +
        '<div class="jl-review-card-stars" aria-label="' + Number(r.stars) + ' من 5">' + starsHtml + '</div>' +
        '<p>' + escapeHtml(r.comment) + '</p>' +
        '<span class="jl-review-card-name">' + escapeHtml(r.name) + '</span>' +
        '<span class="jl-review-card-course">' + escapeHtml(r.audience || 'زائر') + '</span>' +
        '</article>';
    }).join('');
  }

  function loadReviews(){
    listEl.innerHTML = '<p class="jl-reviews-empty">جاري تحميل التقييمات...</p>';
    reviewApi('/api/reviews').then(function(data){
      renderReviews(data.reviews || []);
      renderStats(data);
    }).catch(function(err){
      listEl.innerHTML = '<p class="jl-reviews-empty">' + escapeHtml(err.message) + '</p>';
    });
  }

  var starSpans = starsEl.querySelectorAll('span');
  starSpans.forEach(function(span){
    span.addEventListener('click', function(){
      selectedStars = parseInt(span.getAttribute('data-star'), 10);
      starSpans.forEach(function(s){
        s.classList.toggle('active', parseInt(s.getAttribute('data-star'), 10) <= selectedStars);
      });
    });
  });

  formEl.addEventListener('submit', function(e){
    e.preventDefault();
    var submit = formEl.querySelector('button[type="submit"]');
    var name = document.getElementById('jl-rv-name').value.trim();
    var audience = document.getElementById('jl-rv-course').value.trim();
    var comment = document.getElementById('jl-rv-comment').value.trim();
    var website = document.getElementById('jl-rv-website');
    if (!name || !audience || !comment || selectedStars === 0){
      alert('من فضلك املأ البيانات واختار تقييم بالنجوم');
      return;
    }

    if (submit){ submit.disabled = true; submit.textContent = 'جاري الإرسال...'; }
    reviewApi('/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ name:name, audience:audience, comment:comment, stars:selectedStars, website:website ? website.value : '' })
    }).then(function(){
      formEl.reset();
      selectedStars = 0;
      starSpans.forEach(function(s){ s.classList.remove('active'); });
      if (rvCommentCount) rvCommentCount.textContent = '0 / 400';
      if (window.jlConfetti) window.jlConfetti();
      var toast = document.getElementById('jl-toast');
      if (toast){
        toast.textContent = 'شكرًا ليك ✅ تقييمك اتحفظ وهيظهر بعد المراجعة.';
        toast.classList.add('show');
        setTimeout(function(){ toast.classList.remove('show'); }, 3800);
      }
    }).catch(function(err){
      alert(err.message);
    }).finally(function(){
      if (submit){ submit.disabled = false; submit.textContent = 'أضف تقييمك'; }
    });
  });

  loadReviews();
})();

/* --- extracted script 11 --- */
(function(){
  // ============ ربط اختياري بالباك إند (وضع الصيانة + إخفاء أقسام + تتبع الزيارات) ============
  // سيبها فاضية لو لسه مش رافع الباك إند — الموقع هيشتغل عادي من غيرها.
  var CH_API_BASE = window.CH_SITE_API_BASE || ''; // 👈 محتاجش تعدّل هنا، بس حط الرابط فوق أول الملف

  if (!CH_API_BASE) return;

  // تسجيل الزيارة (صامت، ما بيأثرش على الصفحة لو فشل)
  // لو الرابط فيه ?src=street (اللي هيكون مكتوب في كود QR باللافتة)، بنسجّلها منفصلة عن باقي الزيارات
  // عشان تعرف بالظبط كام حد دخل من كود الـQR في الشارع.
  try {
    var qrSource = new URLSearchParams(location.search).get('src');
    var pageLabel = (location.hash ? location.hash.replace('#','') : 'home') + (qrSource ? '-' + qrSource : '');
    fetch(CH_API_BASE + '/api/track-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: pageLabel })
    }).catch(function(){});
  } catch (e) {}

  // التحقق من وضع الصيانة + الأقسام المخفية
  fetch(CH_API_BASE + '/api/settings')
    .then(function(r){ return r.json(); })
    .then(function(data){
      var settings = data.settings;
      if (!settings) return;

      if (settings.maintenance_mode) {
        document.body.innerHTML =
          '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;font-family:Cairo,sans-serif;text-align:center;padding:20px;">' +
          '<div style="font-size:50px;">🛠️</div>' +
          '<h1 style="margin:0;">الموقع تحت الصيانة حاليًا</h1>' +
          '<p style="color:#7a7460;">هنرجع قريب، شكرًا لصبرك 🙏</p>' +
          '</div>';
        return;
      }

      (settings.hidden_sections || []).forEach(function(id){
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    })
    .catch(function(){});

  // تطبيق النصوص التي يعدلها الأدمن مباشرة على العناصر المربوطة بمفاتيح المحتوى.
  fetch(CH_API_BASE + '/api/content', { credentials: 'same-origin' })
    .then(function(r){ if (!r.ok) throw new Error('content'); return r.json(); })
    .then(function(data){
      var content = data && data.content;
      if (!content || typeof content !== 'object') return;
      document.querySelectorAll('[data-content-key],[data-i18n],[data-i18n-inner]').forEach(function(el){
        var key = el.getAttribute('data-content-key') || el.getAttribute('data-i18n') || el.getAttribute('data-i18n-inner');
        if (!key || !Object.prototype.hasOwnProperty.call(content, key)) return;
        var value = content[key];
        if (value == null || typeof value === 'object') return;
        if (el.hasAttribute('data-i18n-inner')) el.textContent = String(value);
        else if (el.matches('input,textarea')) el.setAttribute('placeholder', String(value));
        else el.textContent = String(value);
      });
    })
    .catch(function(){});
})();

/* --- extracted script 12 --- */
(function(){
  // ---------- زرار "ارجع لفوق" ----------
  var backTop = document.getElementById('jl-back-top');
  window.addEventListener('scroll', function(){
    backTop.classList.toggle('show', window.scrollY > 500);
  });
  backTop.addEventListener('click', function(){
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ---------- نسخ الأرقام بلمسة واحدة ----------
  document.querySelectorAll('.jl-copy-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var text = btn.getAttribute('data-copy');
      var done = function(){
        var original = btn.textContent;
        btn.textContent = '✅';
        setTimeout(function(){ btn.textContent = original; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function(){});
      } else {
        var tmp = document.createElement('textarea');
        tmp.value = text;
        document.body.appendChild(tmp);
        tmp.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        document.body.removeChild(tmp);
      }
    });
  });

  // ---------- تذكّر اختيار الوضع الفاتح/الغامق ----------
  var savedTheme = localStorage.getItem('ch_theme');
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    var darkBtn = document.querySelector('[data-theme-btn="dark"]');
    var lightBtn = document.querySelector('[data-theme-btn="light"]');
    darkBtn && darkBtn.classList.add('active');
    lightBtn && lightBtn.classList.remove('active');
  }
  document.querySelectorAll('[data-theme-btn]').forEach(function(btn){
    btn.addEventListener('click', function(){
      localStorage.setItem('ch_theme', btn.getAttribute('data-theme-btn'));
    });
  });

  // ---------- عداد بداية الترم الجديد ----------
  // 👈 غيّر التاريخ ده لتاريخ بداية الترم الفعلي عندك
  var NEXT_TERM_DATE = new Date('2026-09-15T00:00:00');
  var countdownEl = document.getElementById('jl-countdown-value');
  function updateCountdown(){
    if (!countdownEl) return;
    var diff = NEXT_TERM_DATE - new Date();
    if (diff <= 0){
      countdownEl.textContent = 'دلوقتي!';
      return;
    }
    var days = Math.floor(diff / 86400000);
    countdownEl.textContent = days + ' يوم';
  }
  updateCountdown();
  setInterval(updateCountdown, 3600000);

  // ---------- احتفال بسيط (كونفيتي) لما تبعت تقييم ----------
  window.jlConfetti = function(){
    var colors = ['#b6913b', '#c9a85c', '#6fcf97', '#3b82f6', '#e63946'];
    var shapes = ['2px', '50%']; // بعضها مربع دائري وبعضها دائرة كاملة
    for (var i = 0; i < 34; i++){
      var piece = document.createElement('span');
      var size = 6 + Math.random() * 8;
      var isCircle = Math.random() > 0.5;
      piece.style.cssText = 'position:fixed;top:-10px;left:' + (Math.random()*100) + 'vw;' +
        'width:' + size + 'px;height:' + size + 'px;' +
        'background:' + colors[i % colors.length] + ';' +
        'z-index:2000;border-radius:' + (isCircle ? '50%' : '2px') + ';' +
        'pointer-events:none;opacity:.9;';
      var duration = (1.6 + Math.random() * 1.6);
      var rotate = Math.random() > 0.5 ? 'jlConfettiFall' : 'jlConfettiFallSpin';
      piece.style.animation = rotate + ' ' + duration + 's ease-in forwards';
      document.body.appendChild(piece);
      (function(p){ setTimeout(function(){ p.remove(); }, 3200); })(piece);
    }
  };

  // اهتزاز خفيف لأي فورم فيه خطأ تحقق
  window.jlShakeInvalid = function(el){
    if (!el) return;
    el.classList.remove('jl-shake');
    void el.offsetWidth;
    el.classList.add('jl-shake');
  };
})();

/* --- extracted script 13 --- */
(function(){
  var CH_API_BASE_STUDENT = window.CH_SITE_API_BASE || ''; // 👈 محتاجش تعدّل هنا، بس حط الرابط فوق أول الملف
  var overlay = document.getElementById('jl-student-overlay');
  var studentBtn = document.getElementById('jl-student-btn');
  var closeBtn = document.getElementById('jl-student-close');
  var authView = document.getElementById('jl-student-auth-view');
  var profileView = document.getElementById('jl-student-profile-view');
  if (!overlay || !studentBtn || !authView || !profileView) return;

  function api(path, opts){
    opts = opts || {};
    opts.credentials = 'same-origin';
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    return fetch(CH_API_BASE_STUDENT + path, opts).then(function(r){
      return r.json().then(function(data){
        if (r.status === 401){ localStorage.removeItem('ch_student'); window.dispatchEvent(new Event('ch-auth-changed')); }
        if (!r.ok) throw new Error(data.error || 'حصل خطأ، حاول تاني');
        return data;
      });
    });
  }

  var SESSION_DAYS = 7; // مدة صلاحية الجلسة قبل ما تسجّل دخول تاني

  function getStudent(){
    var raw = localStorage.getItem('ch_student');
    if (!raw) return null;
    var wrapper = JSON.parse(raw);
    if (!wrapper.expiresAt || Date.now() > wrapper.expiresAt){
      localStorage.removeItem('ch_student'); // الجلسة انتهت
      return null;
    }
    return wrapper.student;
  }
  function setStudent(s){
    // localStorage مجرد cache للواجهة، مش مصدر صلاحية. ما نخزنش فيه توكن ولي الأمر.
    var safeStudent = Object.assign({}, s || {});
    delete safeStudent.parent_token;
    localStorage.setItem('ch_student', JSON.stringify({
      student: safeStudent,
      expiresAt: Date.now() + SESSION_DAYS * 86400000
    }));
    window.dispatchEvent(new Event('ch-auth-changed'));
  }

  var PV_ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  var PV_WEEK_LABELS = ['س','ح','ن','ث','ر','خ','ج']; // السبت للجمعة، حرف واحد لكل مربع

  function renderProfile(){
    var s = getStudent();
    if (!s) return;
    document.getElementById('jl-profile-name').textContent = s.first_name + ' ' + s.last_name;
    document.getElementById('jl-profile-phone').textContent = s.phone;
    document.getElementById('jl-profile-email').textContent = s.email || '—';
    document.getElementById('jl-profile-avatar').src = s.avatar_url || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="110" height="110"><rect width="110" height="110" fill="%23e5ded0"/></svg>';

    var badge = document.getElementById('jl-verify-badge');
    var requestBtn = document.getElementById('jl-request-otp-btn');
    var verifyTick = document.getElementById('jl-pv-verify-tick');
    var verifyBlock = document.getElementById('jl-profile-verify');
    if (s.phone_verified){
      badge.textContent = '✅ الرقم متحقق منه';
      badge.classList.add('verified');
      requestBtn.style.display = 'none';
      verifyTick.classList.add('show');
      verifyBlock.style.display = 'none';
    } else {
      badge.textContent = '📱 غير متحقق منه';
      badge.classList.remove('verified');
      requestBtn.style.display = 'inline';
      verifyTick.classList.remove('show');
      verifyBlock.style.display = 'block';
    }

    loadProfileStats();
  }

  function loadProfileStats(){
    api('/api/profile-stats')
      .then(function(stats){ renderProfileStats(stats); })
      .catch(function(){ /* لو فشل الطلب، الكارت يفضل شغال من غير الإحصائيات */ });
  }

  function renderProfileStats(stats){
    // عضو منذ
    var memberSinceEl = document.getElementById('jl-pv-member-since');
    if (stats.member_since){
      var d = new Date(stats.member_since);
      memberSinceEl.textContent = 'عضو منذ ' + PV_ARABIC_MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    } else {
      memberSinceEl.textContent = '';
    }

    // تاجات: الأيام المتتالية + الترتيب
    var streakTag = document.getElementById('jl-pv-streak-tag');
    if (stats.streak_days && stats.streak_days > 0){
      document.getElementById('jl-pv-streak-value').textContent = stats.streak_days;
      streakTag.style.display = 'inline-flex';
    } else {
      streakTag.style.display = 'none';
    }

    var rankTag = document.getElementById('jl-pv-rank-tag');
    var rankCard = document.getElementById('jl-pv-stat-rank-card');
    var statsGrid = document.getElementById('jl-pv-stats');
    if (stats.percentile != null){
      document.getElementById('jl-pv-rank-value').textContent = stats.percentile;
      document.getElementById('jl-pv-stat-rank').textContent = 'أفضل ' + stats.percentile + '٪';
      rankTag.style.display = 'inline-flex';
      rankCard.style.display = 'block';
      statsGrid.classList.remove('jl-pv-stats-2');
    } else {
      rankTag.style.display = 'none';
      rankCard.style.display = 'none';
      statsGrid.classList.add('jl-pv-stats-2');
    }

    // نشاط الأسبوع
    var weekWrap = document.getElementById('jl-pv-week-days');
    weekWrap.innerHTML = '';
    (stats.weekly_activity || []).forEach(function(day){
      var d = new Date(day.date);
      var box = document.createElement('div');
      box.className = 'jl-pv-day' + (day.active ? ' active' : '');
      box.title = day.date;
      weekWrap.appendChild(box);
    });

    // كروت الإحصائيات
    document.getElementById('jl-pv-stat-completed').textContent = stats.quizzes_completed || 0;
    document.getElementById('jl-pv-stat-avg').textContent = (stats.avg_score_percent != null) ? (stats.avg_score_percent + '٪') : '—';

    // صندوق التلميح
    var tipBox = document.getElementById('jl-pv-tip');
    var tipText = document.getElementById('jl-pv-tip-text');
    if (stats.all_months_done){
      tipText.textContent = 'مبروك! خلّصت كل شهور المسار 🎉';
      tipBox.style.display = 'flex';
    } else if (stats.current_month_title && stats.remaining_quizzes_this_month > 0){
      tipText.textContent = 'باقي ' + stats.remaining_quizzes_this_month + ' كويز بس تخلّص ' + stats.current_month_title;
      tipBox.style.display = 'flex';
    } else {
      tipBox.style.display = 'none';
    }
  }

  // ---------- تحقق رقم الموبايل ----------
  document.getElementById('jl-request-otp-btn').addEventListener('click', function(){
    var s = getStudent();
    api('/api/auth/request-phone-otp', { method: 'POST', body: '{}' })
      .then(function(data){
        document.getElementById('jl-otp-form').style.display = 'block';
        document.getElementById('profile-msg').textContent = data.message;
        document.getElementById('profile-msg').className = 'jl-student-msg ok';
      }).catch(function(err){
        document.getElementById('profile-msg').textContent = err.message;
        document.getElementById('profile-msg').className = 'jl-student-msg err';
      });
  });

  document.getElementById('jl-verify-otp-btn').addEventListener('click', function(){
    var s = getStudent();
    var code = document.getElementById('jl-otp-code').value.trim();
    api('/api/auth/verify-phone-otp', { method: 'POST', body: JSON.stringify({ code: code }) })
      .then(function(data){
        setStudent(data.student);
        renderProfile();
        document.getElementById('jl-otp-form').style.display = 'none';
        document.getElementById('profile-msg').textContent = 'تم التحقق من رقمك ✓';
        document.getElementById('profile-msg').className = 'jl-student-msg ok';
      }).catch(function(err){
        document.getElementById('profile-msg').textContent = err.message;
        document.getElementById('profile-msg').className = 'jl-student-msg err';
      });
  });

  // ---------- لينك متابعة ولي الأمر ----------
  document.getElementById('jl-parent-link-btn').addEventListener('click', function(){
    api('/api/auth/session?include_parent=1').then(function(data){
      var token = data && data.student && data.student.parent_token;
      if (!token) throw new Error('تعذر إنشاء لينك المتابعة');
      var link = location.origin + location.pathname.replace(/[^/]*$/, '') + 'parent.html?token=' + encodeURIComponent(token);
      var done = function(){
        document.getElementById('profile-msg').textContent = 'اتنسخ اللينك ✓ ابعته لولي أمرك';
        document.getElementById('profile-msg').className = 'jl-student-msg ok';
      };
      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(link).then(done).catch(function(){
          document.getElementById('profile-msg').textContent = 'تعذر نسخ اللينك تلقائيًا';
          document.getElementById('profile-msg').className = 'jl-student-msg err';
        });
      } else {
        var tmp = document.createElement('textarea');
        tmp.value = link;
        document.body.appendChild(tmp);
        tmp.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        document.body.removeChild(tmp);
      }
    }).catch(function(err){
      document.getElementById('profile-msg').textContent = err.message;
      document.getElementById('profile-msg').className = 'jl-student-msg err';
    });
  });

  function showProfileOrAuth(){
    var s = getStudent();
    var modal = document.getElementById('jl-student-modal');
    if (s){
      authView.style.display = 'none';
      profileView.style.display = 'block';
      modal && modal.classList.add('jl-pv-mode');
      renderProfile();
    } else {
      authView.style.display = 'block';
      profileView.style.display = 'none';
      modal && modal.classList.remove('jl-pv-mode');
    }
  }

  studentBtn && studentBtn.addEventListener('click', function(){
    overlay.classList.add('open');
    showProfileOrAuth();
  });
  closeBtn && closeBtn.addEventListener('click', function(){ overlay.classList.remove('open'); });
  overlay && overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.classList.remove('open'); });

  // تبديل بين دخول / حساب جديد
  document.querySelectorAll('.jl-student-tab').forEach(function(tab){
    tab.addEventListener('click', function(){
      document.querySelectorAll('.jl-student-tab').forEach(function(t){ t.classList.remove('active'); });
      tab.classList.add('active');
      document.getElementById('jl-login-form').style.display = tab.getAttribute('data-form') === 'login' ? 'block' : 'none';
      document.getElementById('jl-register-form').style.display = tab.getAttribute('data-form') === 'register' ? 'block' : 'none';
      document.getElementById('jl-forgot-form').style.display = 'none';
    });
  });

  document.getElementById('jl-forgot-link').addEventListener('click', function(){
    document.getElementById('jl-login-form').style.display = 'none';
    document.getElementById('jl-register-form').style.display = 'none';
    document.getElementById('jl-forgot-form').style.display = 'block';
  });

  // دخول
  document.getElementById('jl-login-form').addEventListener('submit', function(e){
    e.preventDefault();
    var msg = document.getElementById('li-msg');
    msg.textContent = '...جاري الدخول';
    msg.className = 'jl-student-msg';
    api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('li-email').value.trim(),
        password: document.getElementById('li-password').value
      })
    }).then(function(data){
      setStudent(data.student);
      showProfileOrAuth();
    }).catch(function(err){
      msg.textContent = err.message;
      msg.className = 'jl-student-msg err'; if (window.jlShakeInvalid) window.jlShakeInvalid(msg);
    });
  });

  // ---------- مؤشر قوة الباسورد الحي ----------
  function wirePasswordChecklist(inputId, checklistId){
    var input = document.getElementById(inputId);
    var checklist = document.getElementById(checklistId);
    if (!input || !checklist) return;
    var bar = input.closest('.jl-student-form').querySelector('#' + checklistId).previousElementSibling.querySelector('span');

    input.addEventListener('input', function(){
      var v = input.value;
      var rules = {
        len: v.length >= 8,
        upper: /[A-Z]/.test(v),
        lower: /[a-z]/.test(v),
        num: /\d/.test(v),
        sym: /[^A-Za-z0-9]/.test(v)
      };
      var passCount = 0;
      checklist.querySelectorAll('li').forEach(function(li){
        var ok = rules[li.getAttribute('data-rule')];
        li.classList.toggle('ok', ok);
        if (ok) passCount++;
      });
      var pct = (passCount / 5) * 100;
      bar.style.width = pct + '%';
      bar.style.background = pct < 40 ? '#c0392b' : (pct < 100 ? '#e2a53a' : '#2e7d4f');
    });
  }
  wirePasswordChecklist('rg-password', 'rg-pass-checklist');
  wirePasswordChecklist('fp-newpass', 'fp-pass-checklist');

  // ---------- زرار إظهار/إخفاء الباسورد ----------
  document.querySelectorAll('.jl-pass-eye').forEach(function(btn){
    btn.addEventListener('click', function(){
      var target = document.getElementById(btn.getAttribute('data-target'));
      if (!target) return;
      var isHidden = target.type === 'password';
      target.type = isHidden ? 'text' : 'password';
      btn.textContent = isHidden ? '🙈' : '👁️';
    });
  });

  // ---------- قواعد التحقق (بنفس الشروط اللي في السيرفر) ----------
  var NAME_RE = /^[A-Za-z\u0600-\u06FF\s]{2,}$/;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  var PHONE_RE = /^01[0125]\d{8}$/; // رقم مصري: 01 + رقم شبكة (0/1/2/5) + 8 أرقام = 11 رقم بالظبط
  var DISPOSABLE_DOMAINS = ['tempmail.com','10minutemail.com','guerrillamail.com','mailinator.com','yopmail.com','trashmail.com'];

  function validateName(v){ return NAME_RE.test(v.trim()); }
  function validateEmail(v){ return EMAIL_RE.test(v.trim()); }
  function validatePassword(v){ return PASSWORD_RE.test(v); }
  function validatePhone(v){ return PHONE_RE.test(v.trim()); }
  function normalizeEmail(v){ return v.trim().toLowerCase(); }
  function isDisposableEmail(v){
    var domain = normalizeEmail(v).split('@')[1] || '';
    return DISPOSABLE_DOMAINS.indexOf(domain) !== -1;
  }

  // تسجيل حساب جديد
  var rgSubmitBtn = document.querySelector('#jl-register-form button[type="submit"]');

  function checkRegisterFormValid(){
    var pass1 = document.getElementById('rg-password').value;
    var pass2 = document.getElementById('rg-password2').value;
    var ok = validateName(document.getElementById('rg-first').value) &&
             validateName(document.getElementById('rg-last').value) &&
             validatePhone(document.getElementById('rg-phone').value) &&
             validateEmail(document.getElementById('rg-email').value) &&
             validatePassword(pass1) &&
             pass1 === pass2 && pass1 !== '';
    rgSubmitBtn.disabled = !ok;
    rgSubmitBtn.style.opacity = ok ? '1' : '.5';
    rgSubmitBtn.style.cursor = ok ? 'pointer' : 'not-allowed';
    return ok;
  }
  ['rg-first','rg-last','rg-phone','rg-email','rg-password','rg-password2'].forEach(function(id){
    document.getElementById(id).addEventListener('input', checkRegisterFormValid);
  });
  checkRegisterFormValid();

  document.getElementById('jl-register-form').addEventListener('submit', function(e){
    e.preventDefault();
    var msg = document.getElementById('rg-msg');
    var first = document.getElementById('rg-first').value.trim();
    var last = document.getElementById('rg-last').value.trim();
    var phone = document.getElementById('rg-phone').value.trim();
    var email = normalizeEmail(document.getElementById('rg-email').value);
    var pass1 = document.getElementById('rg-password').value;
    var pass2 = document.getElementById('rg-password2').value;

    if (!validateName(first) || !validateName(last)){
      msg.textContent = 'الاسم يقبل حروف عربي أو إنجليزي بس، من غير أرقام أو رموز.';
      msg.className = 'jl-student-msg err'; if (window.jlShakeInvalid) window.jlShakeInvalid(msg);
      return;
    }
    if (!validatePhone(phone)){
      msg.textContent = 'اكتب رقم موبايل مصري صحيح (11 رقم، يبدأ بـ 010 أو 011 أو 012 أو 015).';
      msg.className = 'jl-student-msg err'; if (window.jlShakeInvalid) window.jlShakeInvalid(msg);
      return;
    }
    if (!validateEmail(email)){
      msg.textContent = 'اكتب إيميل صحيح (مثال: name@gmail.com).';
      msg.className = 'jl-student-msg err'; if (window.jlShakeInvalid) window.jlShakeInvalid(msg);
      return;
    }
    if (isDisposableEmail(email)){
      msg.textContent = 'من فضلك استخدم إيميل حقيقي (Gmail أو مشابه)، مش إيميل مؤقت.';
      msg.className = 'jl-student-msg err'; if (window.jlShakeInvalid) window.jlShakeInvalid(msg);
      return;
    }
    if (!validatePassword(pass1)){
      msg.textContent = 'الباسورد لازم 8 حروف على الأقل، وفيه حرف كابيتال وحرف سمول ورقم ورمز.';
      msg.className = 'jl-student-msg err'; if (window.jlShakeInvalid) window.jlShakeInvalid(msg);
      return;
    }
    if (pass1 !== pass2){
      msg.textContent = 'الباسورد وتأكيد الباسورد مش متطابقين.';
      msg.className = 'jl-student-msg err'; if (window.jlShakeInvalid) window.jlShakeInvalid(msg);
      return;
    }

    msg.textContent = '...جاري إنشاء الحساب';
    msg.className = 'jl-student-msg';
    api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        first_name: first,
        last_name: last,
        phone: phone,
        email: email,
        password: pass1
      })
    }).then(function(data){
      setStudent(data.student);
      showProfileOrAuth();
    }).catch(function(err){
      msg.textContent = err.message;
      msg.className = 'jl-student-msg err'; if (window.jlShakeInvalid) window.jlShakeInvalid(msg);
    });
  });

  // نسيت الباسورد
  document.getElementById('jl-forgot-form').addEventListener('submit', function(e){
    e.preventDefault();
    var msg = document.getElementById('fp-msg');
    api('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: document.getElementById('fp-email').value.trim() })
    }).then(function(data){
      msg.textContent = data.message;
      msg.className = 'jl-student-msg ok';
    }).catch(function(err){
      msg.textContent = err.message;
      msg.className = 'jl-student-msg err'; if (window.jlShakeInvalid) window.jlShakeInvalid(msg);
    });
  });
  var fpResetBtn = document.getElementById('fp-reset-btn');
  function checkResetFormValid(){
    var p1 = document.getElementById('fp-newpass').value;
    var p2 = document.getElementById('fp-newpass2').value;
    var ok = validatePassword(p1) && p1 === p2 && p1 !== '';
    fpResetBtn.disabled = !ok;
    fpResetBtn.style.opacity = ok ? '1' : '.5';
    fpResetBtn.style.cursor = ok ? 'pointer' : 'not-allowed';
  }
  ['fp-newpass','fp-newpass2'].forEach(function(id){
    document.getElementById(id).addEventListener('input', checkResetFormValid);
  });
  checkResetFormValid();

  document.getElementById('fp-reset-btn').addEventListener('click', function(){
    var msg = document.getElementById('fp-msg');
    var newPass1 = document.getElementById('fp-newpass').value;
    var newPass2 = document.getElementById('fp-newpass2').value;

    if (!validatePassword(newPass1)){
      msg.textContent = 'الباسورد لازم 8 حروف على الأقل، وفيه حرف كابيتال وحرف سمول ورقم ورمز.';
      msg.className = 'jl-student-msg err'; if (window.jlShakeInvalid) window.jlShakeInvalid(msg);
      return;
    }
    if (newPass1 !== newPass2){
      msg.textContent = 'الباسورد وتأكيد الباسورد مش متطابقين.';
      msg.className = 'jl-student-msg err'; if (window.jlShakeInvalid) window.jlShakeInvalid(msg);
      return;
    }

    api('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('fp-email').value.trim(),
        code: document.getElementById('fp-code').value.trim(),
        new_password: newPass1
      })
    }).then(function(){
      msg.textContent = 'اتغيّر الباسورد بنجاح ✓ ادخل تاني';
      msg.className = 'jl-student-msg ok';
      document.querySelector('.jl-student-tab[data-form="login"]').click();
    }).catch(function(err){
      msg.textContent = err.message;
      msg.className = 'jl-student-msg err'; if (window.jlShakeInvalid) window.jlShakeInvalid(msg);
    });
  });

  // تعديل الاسم
  document.getElementById('jl-edit-name-btn').addEventListener('click', function(){
    var s = getStudent();
    document.getElementById('ed-first').value = s.first_name;
    document.getElementById('ed-last').value = s.last_name;
    document.getElementById('jl-edit-name-form').style.display = 'block';
  });
  document.getElementById('jl-save-name-btn').addEventListener('click', function(){
    var s = getStudent();
    api('/api/auth/update-profile', {
      method: 'POST',
      body: JSON.stringify({
        first_name: document.getElementById('ed-first').value.trim(),
        last_name: document.getElementById('ed-last').value.trim()
      })
    }).then(function(data){
      setStudent(data.student);
      renderProfile();
      document.getElementById('jl-edit-name-form').style.display = 'none';
      document.getElementById('profile-msg').textContent = 'تم الحفظ ✓';
      document.getElementById('profile-msg').className = 'jl-student-msg ok';
    }).catch(function(err){
      document.getElementById('profile-msg').textContent = err.message;
      document.getElementById('profile-msg').className = 'jl-student-msg err';
    });
  });

  // رفع صورة البروفايل — بتفضل محفوظة (بتستبدل القديمة، وما بتتمسحش لوحدها)
  // دالة تصغير الصورة قبل الرفع — بتحل مشكلة "الصورة كبيرة أوي" (413 error)
  function resizeImageForUpload(file, maxSize, quality) {
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(e){
        var img = new Image();
        img.onload = function(){
          var w = img.width, h = img.height;
          if (w > h && w > maxSize) { h = Math.round(h * (maxSize / w)); w = maxSize; }
          else if (h > maxSize) { w = Math.round(w * (maxSize / h)); h = maxSize; }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  document.getElementById('jl-avatar-input').addEventListener('change', function(e){
    var file = e.target.files[0];
    if (!file) return;
    var s = getStudent();
    resizeImageForUpload(file, 500, 0.75).then(function(resizedDataUrl){
      api('/api/auth/update-profile', {
        method: 'POST',
        body: JSON.stringify({ avatar_base64: resizedDataUrl })
      }).then(function(data){
        setStudent(data.student);
        renderProfile();
        document.getElementById('profile-msg').textContent = 'اتغيّرت الصورة ✓';
        document.getElementById('profile-msg').className = 'jl-student-msg ok';
      }).catch(function(err){
        document.getElementById('profile-msg').textContent = err.message;
        document.getElementById('profile-msg').className = 'jl-student-msg err';
      });
    }).catch(function(){
      document.getElementById('profile-msg').textContent = 'حصلت مشكلة في معالجة الصورة، جرّب صورة تانية';
      document.getElementById('profile-msg').className = 'jl-student-msg err';
    });
  });

  // خروج
  document.getElementById('jl-student-logout').addEventListener('click', function(){
    api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(function(){}).finally(function(){
      localStorage.removeItem('ch_student');
      window.dispatchEvent(new Event('ch-auth-changed'));
      showProfileOrAuth();
    });
  });

  // مزامنة بيانات الحساب مع جلسة السيرفر الآمنة عند فتح الصفحة.
  api('/api/auth/session').then(function(data){
    if (data && data.student) setStudent(data.student);
  }).catch(function(){
    localStorage.removeItem('ch_student');
    window.dispatchEvent(new Event('ch-auth-changed'));
  });

  // زرار "الصورة" في أسفل الكارت — بيفتح نفس مربع رفع الصورة الأصلي
  var pvPhotoBtn = document.getElementById('jl-pv-photo-btn');
  pvPhotoBtn && pvPhotoBtn.addEventListener('click', function(){
    document.getElementById('jl-avatar-input').click();
  });

  // نسخ رقم التليفون للكليبورد
  var pvCopyPhoneBtn = document.getElementById('jl-pv-copy-phone');
  pvCopyPhoneBtn && pvCopyPhoneBtn.addEventListener('click', function(){
    var s = getStudent();
    if (!s) return;
    var done = function(){
      document.getElementById('profile-msg').textContent = 'اتنسخ رقم التليفون ✓';
      document.getElementById('profile-msg').className = 'jl-student-msg ok';
    };
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(s.phone).then(done).catch(function(){});
    } else {
      var tmp = document.createElement('textarea');
      tmp.value = s.phone;
      document.body.appendChild(tmp);
      tmp.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      document.body.removeChild(tmp);
    }
  });
})();

/* --- extracted script 14 --- */
(function(){
  // ---------- 1) تفعيل الأقسام تظهر تدريجيًا وقت السكرول ----------
  var revealTargets = document.querySelectorAll(
    '.jl-benefits-head, .jl-benefit, .jl-audience>h2, .jl-audience-item, .jl-mp-teaser-card, ' +
    '.jl-am-head, .jl-am-card, .jl-cta-card, .jl-about-main, .jl-about-card, .jl-reviews-head, ' +
    '.jl-review-card, .jl-review-form-wrap, .jl-footer-col, .jl-hero-text, .jl-hw-scene, ' +
    '.jl-cta-copy, .jl-cta-action'
  );
  revealTargets.forEach(function(el){ el.classList.add('jl-reveal'); });

  // Grids get staggered-children reveal
  var staggerTargets = document.querySelectorAll('.jl-benefits-grid, .jl-audience-grid, .jl-about-cards');
  staggerTargets.forEach(function(el){ el.classList.add('jl-reveal', 'jl-stagger'); });

  if ('IntersectionObserver' in window){
    var observer = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting){
          entry.target.classList.add('jl-revealed', 'jl-reveal-visible');
        } else {
          entry.target.classList.remove('jl-revealed', 'jl-reveal-visible');
        }
      });
    }, { threshold: 0.12 });
    revealTargets.forEach(function(el){ observer.observe(el); });
    staggerTargets.forEach(function(el){ observer.observe(el); });
  } else {
    revealTargets.forEach(function(el){ el.classList.add('jl-revealed', 'jl-reveal-visible'); });
    staggerTargets.forEach(function(el){ el.classList.add('jl-revealed', 'jl-reveal-visible'); });
  }

  // ---------- 2) تأثير الموجة (Ripple) على الأزرار ----------
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('.jl-reg, .jl-mp-quiz-btn, .jl-student-tab, .jl-lang-pill');
    if (!btn || btn.disabled) return;
    var rect = btn.getBoundingClientRect();
    var ripple = document.createElement('span');
    var size = Math.max(rect.width, rect.height);
    ripple.className = 'jl-ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    setTimeout(function(){ ripple.remove(); }, 550);
  });

  // ---------- 3) النافبار يبان أوضح لما تنزل تحت ----------
  var navEl = document.querySelector('.jl-nav');
  if (navEl){
    window.addEventListener('scroll', function(){
      navEl.classList.toggle('jl-scrolled', window.scrollY > 30);
    });
  }

  // Hamburger state is handled by the final stability controller.

  // ---------- 5) نبضة على عداد الترم لما يتغيّر ----------
  var lastCountdownText = '';
  var countdownObserverEl = document.getElementById('jl-countdown-value');
  if (countdownObserverEl){
    var pulseCountdown = new MutationObserver(function(){
      if (countdownObserverEl.textContent !== lastCountdownText){
        lastCountdownText = countdownObserverEl.textContent;
        countdownObserverEl.classList.remove('jl-pulse');
        void countdownObserverEl.offsetWidth; // إعادة تشغيل الأنيميشن
        countdownObserverEl.classList.add('jl-pulse');
      }
    });
    pulseCountdown.observe(countdownObserverEl, { childList: true, characterData: true, subtree: true });
  }
})();

/* --- extracted script 15 --- */
(function(){
  // ---------- نظام نقط زخرفية عشوائية على مستوى الصفحة كلها (30 نقطة بس، بعيدة عن بعض) ----------
  var TOTAL_DOTS = 100;
  var sectionIds = ['home', 'benefits', 'audience', 'about', 'cta', 'reviews', 'monthly-path'];
  var containers = [];
  sectionIds.forEach(function(id){
    var el = document.getElementById(id);
    if (el) containers.push(el);
  });
  if (!containers.length) return;

  // وزّع الـ30 نقطة على الأقسام المتاحة بالتساوي تقريبًا
  var base = Math.floor(TOTAL_DOTS / containers.length);
  var extra = TOTAL_DOTS % containers.length;
  var minDistPct = 12; // أقل مسافة مسموحة بين نقطتين (بالنسبة المئوية) عشان محدش يبقى جنب التاني

  containers.forEach(function(container, idx){
    var count = base + (idx < extra ? 1 : 0);
    if (count <= 0) return;

    var fieldEl = document.createElement('div');
    fieldEl.className = 'jl-dots-field';
    fieldEl.setAttribute('aria-hidden', 'true');

    var placed = [];
    var attempts = 0;
    while (placed.length < count && attempts < count * 40){
      attempts++;
      var x = Math.random() * 100;
      var y = Math.random() * 100;
      var ok = true;
      for (var p = 0; p < placed.length; p++){
        var dx = placed[p].x - x, dy = placed[p].y - y;
        if (Math.sqrt(dx * dx + dy * dy) < minDistPct){ ok = false; break; }
      }
      if (ok) placed.push({x: x, y: y});
    }
    // لو مش لاقي أماكن كفاية بالمسافة المطلوبة، كمّل الباقي عشوائي عادي
    while (placed.length < count){
      placed.push({x: Math.random() * 100, y: Math.random() * 100});
    }

    placed.forEach(function(pos){
      var dot = document.createElement('span');
      dot.style.left = pos.x + '%';
      dot.style.top = pos.y + '%';
      dot.style.animationDuration = (1.5 + Math.random() * 2.5) + 's';
      dot.style.animationDelay = (Math.random() * 4) + 's';
      fieldEl.appendChild(dot);
    });

    container.insertBefore(fieldEl, container.firstChild);
  });

  // شهب (نيازك) بنفسجية موزّعة على أكتر من قسم زي المرجع
  var meteorHosts = [document.getElementById('jl-stars-field')];
  ['benefits','audience','cta','reviews'].forEach(function(id){
    var sec = document.getElementById(id);
    if (sec){
      var mf = document.createElement('div');
      mf.className = 'jl-dots-field';
      mf.setAttribute('aria-hidden', 'true');
      sec.appendChild(mf);
      meteorHosts.push(mf);
    }
  });
  meteorHosts.forEach(function(host){
    if (!host) return;
    var frag = document.createDocumentFragment();
    var n = host.id === 'jl-stars-field' ? 5 : 2;
    for (var m = 0; m < n; m++){
      var meteor = document.createElement('span');
      meteor.className = 'jl-meteor';
      meteor.style.top = (Math.random() * 50) + '%';
      meteor.style.left = (40 + Math.random() * 55) + '%';
      meteor.style.animationDuration = (5 + Math.random() * 5) + 's';
      meteor.style.animationDelay = (Math.random() * 8) + 's';
      frag.appendChild(meteor);
    }
    host.appendChild(frag);
  });
})();

/* --- extracted script 16 --- */
(function(){
  // ---------- عدّ تصاعدي للأرقام لما تظهر على الشاشة ----------
  var statEls = document.querySelectorAll('.jl-stat-num');
  if (!statEls.length) return;

  function animateCount(el){
    var target = parseInt(el.getAttribute('data-target'), 10);
    var duration = 1400;
    var startTime = null;
    function step(ts){
      if (!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  if ('IntersectionObserver' in window){
    var statsObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting){
          animateCount(entry.target);
          statsObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    statEls.forEach(function(el){ statsObserver.observe(el); });
  } else {
    statEls.forEach(function(el){ animateCount(el); });
  }
})();

/* --- extracted script 17 --- */
(function(){
  // ---------- كود "Code Hub" بيتكتب لايف مع تلوين ----------
  var codeEl = document.getElementById('jl-hw-code');
  var fileEl = document.querySelector('.jl-hw-tab.active');
  if (!codeEl) return;

  var snippets = [
    { file: 'codehub.py', lines: [
      "<span class='jl-hw-kw'>class</span> <span class='jl-hw-fn'>CodeHub</span>:",
      "    <span class='jl-hw-kw'>def</span> <span class='jl-hw-fn'>start</span>(self):",
      "        <span class='jl-hw-kw'>print</span>(<span class='jl-hw-str'>'من الصفر للاحتراف 🚀'</span>)",
      "        <span class='jl-hw-kw'>return</span> <span class='jl-hw-str'>'جاهز!'</span>",
      "",
      "<span class='jl-hw-com'># ابدأ رحلتك دلوقتي</span>",
      "CodeHub().start()"
    ]},
    { file: 'student.js', lines: [
      "<span class='jl-hw-kw'>const</span> student = {",
      "  name: <span class='jl-hw-str'>'أنت'</span>,",
      "  goal: <span class='jl-hw-str'>'احتراف البرمجة'</span>",
      "};",
      "",
      "<span class='jl-hw-com'>// Code Hub بيوصلك لهدفك</span>",
      "<span class='jl-hw-fn'>joinCodeHub</span>(student);"
    ]}
  ];

  var snippetIndex = 0;

  function typeSnippet(){
    var snippet = snippets[snippetIndex];
    if (fileEl) fileEl.textContent = snippet.file;
    var fullHtml = snippet.lines.join('\n');
    var plain = fullHtml.replace(/<[^>]+>/g, '');
    var i = 0;
    codeEl.innerHTML = '';

    function typeChar(){
      i++;
      var htmlSoFar = '';
      var plainCount = 0;
      var j = 0;
      while (j < fullHtml.length && plainCount < i){
        if (fullHtml[j] === '<'){
          var closeIdx = fullHtml.indexOf('>', j);
          htmlSoFar += fullHtml.substring(j, closeIdx + 1);
          j = closeIdx + 1;
        } else {
          htmlSoFar += fullHtml[j];
          plainCount++;
          j++;
        }
      }
      codeEl.innerHTML = htmlSoFar;
      if (i < plain.length){
        setTimeout(typeChar, 22 + Math.random() * 28);
      } else {
        setTimeout(function(){
          snippetIndex = (snippetIndex + 1) % snippets.length;
          typeSnippet();
        }, 2600);
      }
    }
    typeChar();
  }

  typeSnippet();
})();

/* --- extracted script 18 --- */
(function(){
  // ---------- مساعد Code Hub الذكي: شات كامل بسجل محادثات ----------
  var openBtn = document.getElementById('jl-chat-open-btn');
  var heroOpenBtn = document.getElementById('jl-hero-chat-btn');
  var overlay = document.getElementById('jl-ai-overlay');
  if (!openBtn || !overlay) return;

  var closeBtn = document.getElementById('jl-ai-close-btn');
  var hamburger = document.getElementById('jl-ai-hamburger');
  var backBtn = document.getElementById('jl-ai-back-btn');
  var sidebar = document.getElementById('jl-ai-sidebar');
  var convList = document.getElementById('jl-ai-conv-list');
  var newBtn = document.getElementById('jl-ai-new-btn');
  var thread = document.getElementById('jl-ai-thread');
  var emptyState = document.getElementById('jl-ai-empty-state');
  var form = document.getElementById('jl-ai-input-form');
  var input = document.getElementById('jl-ai-input');
  var sendBtn = document.getElementById('jl-ai-send-btn');
  var plusBtn = document.getElementById('jl-ai-plus-btn');
  var fileInput = document.getElementById('jl-ai-file-input');
  var filePreview = document.getElementById('jl-ai-file-preview');

  var currentConversationId = null;
  var currentMessages = [];
  var pendingImage = null;
  var pendingImageMime = null;

  function getLoggedInStudentAI(){
    var raw = localStorage.getItem('ch_student');
    if (!raw) return null;
    try {
      var wrapper = JSON.parse(raw);
      if (!wrapper.expiresAt || Date.now() > wrapper.expiresAt) return null;
      return wrapper.student;
    } catch (e) { return null; }
  }

  function aiApi(path, opts){
    if (!CH_SITE_API_BASE) return Promise.reject(new Error('الموقع لسه مش متربط بالباك إند'));
    opts = opts || {};
    opts.credentials = 'same-origin';
    return fetch(CH_SITE_API_BASE + path, opts).then(function(r){
      return r.text().then(function(raw){
        var data = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch (e) { data = {}; }
        if (r.status === 401){ localStorage.removeItem('ch_student'); window.dispatchEvent(new Event('ch-auth-changed')); }
        if (!r.ok) throw new Error(data.error || ('حصل خطأ في الاتصال (' + r.status + ')'));
        return data;
      });
    });
  }

  function openModal(){
    var student = getLoggedInStudentAI();
    if (!student){
      var toast = document.getElementById('jl-toast');
      if (toast){
        toast.textContent = 'سجّل دخول كطالب الأول عشان تستخدم المساعد الذكي.';
        toast.classList.add('show');
        setTimeout(function(){ toast.classList.remove('show'); }, 3200);
      }
      var loginBtn = document.getElementById('jl-student-btn');
      if (loginBtn) loginBtn.click();
      return;
    }
    overlay.classList.add('open');
    document.body.classList.add('jl-ai-open');
    sidebar.classList.remove('open');
    window.setTimeout(function(){
      if (input) input.focus({ preventScroll:true });
    }, 120);
    loadConversationList(student.id);
  }
  function closeModal(){
    overlay.classList.remove('open');
    sidebar.classList.remove('open');
    document.body.classList.remove('jl-ai-open');
  }

  openBtn.addEventListener('click', openModal);
  if (heroOpenBtn) heroOpenBtn.addEventListener('click', openModal);
  closeBtn && closeBtn.addEventListener('click', closeModal);
  var exitBtn = document.getElementById('jl-ai-exit-btn');
  if (exitBtn) exitBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function(e){ if (e.target === overlay) closeModal(); });

  hamburger && hamburger.addEventListener('click', function(){ sidebar && sidebar.classList.toggle('open'); });
  backBtn && backBtn.addEventListener('click', function(){ sidebar && sidebar.classList.add('open'); });

  function loadConversationList(studentId){
    aiApi('/api/ai-conversations').then(function(data){
      renderConversationList(data.conversations || []);
    }).catch(function(){ convList.innerHTML = '<div class="jl-ai-conv-empty">مفيش محادثات لسه</div>'; });
  }

  function renderConversationList(conversations){
    if (!conversations.length){
      convList.innerHTML = '<div class="jl-ai-conv-empty">مفيش محادثات لسه</div>';
      return;
    }
    convList.innerHTML = conversations.map(function(c){
      var active = c.id === currentConversationId ? ' active' : '';
      return '<div class="jl-ai-conv-item' + active + '" data-id="' + escapeHtmlAI(c.id) + '">' + escapeHtmlAI(c.title || 'محادثة') + '</div>';
    }).join('');
    convList.querySelectorAll('.jl-ai-conv-item').forEach(function(item){
      item.addEventListener('click', function(){
        openConversation(item.getAttribute('data-id'));
        sidebar.classList.remove('open');
      });
    });
  }

  function openConversation(id){
    var student = getLoggedInStudentAI();
    if (!student) return;
    aiApi('/api/ai-conversations?id=' + encodeURIComponent(id)).then(function(data){
      currentConversationId = data.conversation.id;
      currentMessages = data.conversation.messages || [];
      renderThread();
      loadConversationList(student.id);
    });
  }

  function startNewConversation(){
    currentConversationId = null;
    currentMessages = [];
    renderThread();
    sidebar.classList.remove('open');
  }
  newBtn && newBtn.addEventListener('click', startNewConversation);

  function escapeHtmlAI(s){
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function formatAnswerAI(s){
    return escapeHtmlAI(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  function renderThread(){
    if (!currentMessages.length){
      thread.innerHTML = '';
      thread.appendChild(emptyState);
      return;
    }
    thread.innerHTML = currentMessages.map(function(m){
      var cls = m.role === 'user' ? 'user' : 'assistant';
      var text = m.content || '';
      var sourceMatch = text.match(/^\[(المصدر:[^\]]+|معلومة عامة|مصدر خارجي موثوق)\]\s*/);
      if (sourceMatch) text = text.slice(sourceMatch[0].length);
      var body = formatAnswerAI(text);
      body = body.replace(/\[سؤال مقترح\]:?\s*(.*)/, '<br><br><em>💡 $1</em>');
      var safeImage = typeof m.image === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(m.image) ? m.image : '';
      var imageHtml = safeImage ? '<img class="jl-ai-msg-img" src="' + safeImage + '" alt="الصورة المرسلة">' : '';
      return '<div class="jl-ai-msg ' + cls + '">' + imageHtml + body + '</div>';
    }).join('');
    thread.scrollTop = thread.scrollHeight;
  }

  // ---------- رفع صورة ----------
  plusBtn.addEventListener('click', function(){ fileInput.click(); });
  fileInput.addEventListener('change', function(){
    var file = fileInput.files[0];
    if (!file) return;
    if (!file.type || file.type.indexOf('image/') !== 0){
      alert('من فضلك اختار صورة فقط');
      fileInput.value = '';
      return;
    }
    if (file.size > 12 * 1024 * 1024){
      alert('حجم الصورة كبير. اختار صورة أقل من 12 ميجابايت');
      fileInput.value = '';
      return;
    }
    var reader = new FileReader();
    reader.onload = function(){
      var image = new Image();
      image.onload = function(){
        var maxSide = 1280;
        var scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        var context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        pendingImage = canvas.toDataURL('image/jpeg', .82);
        pendingImageMime = 'image/jpeg';
        filePreview.style.display = 'flex';
        filePreview.innerHTML = '<img src="' + pendingImage + '" alt="معاينة الصورة"><span>الصورة جاهزة للتحليل مع سؤالك</span><button type="button" class="jl-ai-file-remove" id="jl-ai-file-remove" aria-label="حذف الصورة">✕</button>';
        document.getElementById('jl-ai-file-remove').addEventListener('click', function(){
          pendingImage = null;
          pendingImageMime = null;
          filePreview.style.display = 'none';
          fileInput.value = '';
        });
      };
      image.onerror = function(){
        alert('الصورة دي مش قابلة للقراءة. جرّب صورة تانية');
        fileInput.value = '';
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  // ---------- إرسال سؤال ----------
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var question = input.value.trim();
    if (!question && !pendingImage) return;
    if (!question) question = 'اشرح محتوى الصورة بالتفصيل.';

    var student = getLoggedInStudentAI();
    if (!student){
      currentMessages.push({ role: 'assistant', content: 'لازم تسجّل دخول الأول عشان تستخدم المساعد الذكي.' });
      renderThread();
      return;
    }

    var imageToSend = pendingImage;
    var imageMimeToSend = pendingImageMime;
    currentMessages.push({ role: 'user', content: question, image: imageToSend });
    input.value = '';
    pendingImage = null;
    pendingImageMime = null;
    filePreview.style.display = 'none';
    fileInput.value = '';

    renderThread();
    sendBtn.disabled = true;

    // فقاعة "بيكتب..."
    var typingEl = document.createElement('div');
    typingEl.className = 'jl-ai-typing';
    typingEl.innerHTML = '<span></span><span></span><span></span>';
    thread.appendChild(typingEl);
    thread.scrollTop = thread.scrollHeight;

    var historyForApi = currentMessages.slice(0, -1).map(function(m){ return { role: m.role, content: m.content }; });

    aiApi('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question,
        history: historyForApi,
        conversation_id: currentConversationId,
        image_data: imageToSend ? imageToSend.split(',')[1] : null,
        image_mime: imageToSend ? (imageMimeToSend || 'image/jpeg') : null
      })
    }).then(function(data){
      typingEl.remove();
      currentMessages.push({ role: 'assistant', content: data.answer });
      currentConversationId = data.conversation_id || currentConversationId;
      renderThread();
      loadConversationList(student.id);
    }).catch(function(err){
      typingEl.remove();
      currentMessages.push({ role: 'assistant', content: '⚠️ ' + err.message });
      renderThread();
    }).finally(function(){
      sendBtn.disabled = false;
    });
  });
})();

/* --- extracted script 19 --- */
(function(){
  // ---------- أكورديون الأسئلة الشائعة ----------
  var items = document.querySelectorAll('.jl-faq-item');
  items.forEach(function(item){
    var q = item.querySelector('.jl-faq-q');
    if (!q) return;
    q.addEventListener('click', function(){
      var wasOpen = item.classList.contains('open');
      items.forEach(function(i){ i.classList.remove('open'); });
      if (!wasOpen) item.classList.add('open');
    });
  });
})();

/* --- extracted script 21 --- */
(function(){
  var menuButton = document.getElementById('jl-nav-hamburger');
  var menu = document.getElementById('jl-nav-links');
  var scrollBar = document.getElementById('jl-nav-scroll-bar');
  var loginButton = document.getElementById('jl-student-btn');
  var registerButton = document.getElementById('jl-register-nav-btn');

  function closeMenu(){
    if (!menu || !menuButton) return;
    menu.classList.remove('open');
    menuButton.classList.remove('jl-open');
    menuButton.setAttribute('aria-expanded','false');
    menuButton.setAttribute('aria-label','فتح القائمة');
  }
  menuButton && menuButton.addEventListener('click', function(event){
    event.preventDefault();
    event.stopPropagation();
    if (!menu) return;
    var shouldOpen = !menu.classList.contains('open');
    menu.classList.toggle('open', shouldOpen);
    menuButton.classList.toggle('jl-open', shouldOpen);
    menuButton.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    menuButton.setAttribute('aria-label', shouldOpen ? 'إغلاق القائمة' : 'فتح القائمة');
  });
  menu && menu.querySelectorAll('a[href]').forEach(function(link){
    link.addEventListener('click', function(){ closeMenu(); });
  });
  document.addEventListener('click', function(event){
    if (menu && menu.classList.contains('open') && !event.target.closest('.jl-nav')) closeMenu();
  });
  document.addEventListener('keydown', function(event){ if (event.key === 'Escape') closeMenu(); });

  function updateScrollProgress(){
    if (!scrollBar) return;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var percent = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
    scrollBar.style.width = percent + '%';
  }
  updateScrollProgress();
  window.addEventListener('scroll', updateScrollProgress, { passive:true });
  window.addEventListener('resize', updateScrollProgress);

  function savedStudent(){
    try {
      var value = JSON.parse(localStorage.getItem('ch_student') || 'null');
      return value && value.student && value.expiresAt > Date.now() ? value.student : null;
    } catch (error) { return null; }
  }
  function updateAuthButtons(){
    var loggedIn = !!savedStudent();
    if (registerButton) registerButton.style.display = loggedIn ? 'none' : '';
    if (loginButton){
      loginButton.textContent = loggedIn ? 'حسابي' : 'تسجيل الدخول';
      loginButton.setAttribute('data-auth-target', loggedIn ? 'profile' : 'login');
    }
  }
  registerButton && registerButton.addEventListener('click', function(){
    loginButton && loginButton.click();
    window.setTimeout(function(){
      var tab = document.querySelector('.jl-student-tab[data-form="register"]');
      tab && tab.click();
    }, 0);
  });
  loginButton && loginButton.addEventListener('click', function(){
    if (loginButton.getAttribute('data-auth-target') !== 'profile'){
      window.setTimeout(function(){
        var tab = document.querySelector('.jl-student-tab[data-form="login"]');
        tab && tab.click();
      }, 0);
    }
  });
  window.addEventListener('ch-auth-changed', updateAuthButtons);
  window.addEventListener('storage', updateAuthButtons);
  updateAuthButtons();
})();

/* Hero pointer-light polish. Keeps the visual responsive without changing content. */
document.addEventListener('DOMContentLoaded', function(){
  var scene = document.querySelector('.jl-hw-scene');
  if (!scene || !window.matchMedia('(pointer:fine)').matches || window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  scene.addEventListener('pointermove', function(event){
    var rect = scene.getBoundingClientRect();
    var x = ((event.clientX - rect.left) / rect.width * 100).toFixed(1) + '%';
    var y = ((event.clientY - rect.top) / rect.height * 100).toFixed(1) + '%';
    scene.style.setProperty('--jl-hero-light-x', x);
    scene.style.setProperty('--jl-hero-light-y', y);
  }, {passive:true});
  scene.addEventListener('pointerleave', function(){
    scene.style.setProperty('--jl-hero-light-x', '72%');
    scene.style.setProperty('--jl-hero-light-y', '34%');
  }, {passive:true});
});
