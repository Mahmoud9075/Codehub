/* --- extracted script 1 --- */
(function(){
'use strict';
var API = window.location.origin;
var state = { students:[], results:[], months:[], currentMonth:null, currentQuiz:null, questions:[], expandedMonthId:null, monthQuizzes:{} };
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmtDate(v){if(!v)return '—';var d=new Date(v);return isNaN(d)?'—':d.toLocaleString('ar-EG');}
function setMsg(id,text,type){var el=document.getElementById(id);if(!el)return;el.textContent=text||'';el.className='msg '+(type||'');}
function api(path,opts){opts=opts||{};opts.credentials='same-origin';opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});return fetch(API+path,opts).then(function(r){return r.json().catch(function(){return {};}).then(function(data){if(r.status===401){showLogin();throw new Error(data.error||'انتهت جلسة الإدارة');}if(!r.ok)throw new Error(data.error||'حصل خطأ');return data;});});}
function adminGet(route){return api('/api/admin/'+route);}
function showLogin(){document.getElementById('admin-view').classList.add('hidden');document.getElementById('login-view').classList.remove('hidden');}
function showAdmin(session){document.getElementById('login-view').classList.add('hidden');document.getElementById('admin-view').classList.remove('hidden');document.getElementById('admin-identity').textContent=(session.identity||'Admin')+' — '+(session.via||'session');var adminsNav=document.getElementById('admins-nav-btn');if(adminsNav)adminsNav.classList.toggle('hidden',session.via!=='super_admin');loadPanel('dashboard');}
function checkSession(){adminGet('session').then(showAdmin).catch(function(){showLogin();});}

// Login
var pinForm=document.getElementById('pin-form'),superBox=document.getElementById('super-box');
document.getElementById('show-pin').onclick=function(){pinForm.classList.remove('hidden');superBox.classList.add('hidden');this.className='btn';document.getElementById('show-super').className='btn secondary';};
document.getElementById('show-super').onclick=function(){pinForm.classList.add('hidden');superBox.classList.remove('hidden');this.className='btn';document.getElementById('show-pin').className='btn secondary';};
pinForm.addEventListener('submit',function(e){e.preventDefault();setMsg('login-msg','جاري الدخول...');api('/api/admin/login-pin',{method:'POST',body:JSON.stringify({pin:document.getElementById('pin').value})}).then(function(){document.getElementById('pin').value='';return adminGet('session');}).then(showAdmin).catch(function(err){setMsg('login-msg',err.message,'error');});});
document.getElementById('super-request-form').addEventListener('submit',function(e){e.preventDefault();setMsg('login-msg','جاري إرسال الكود...');api('/api/admin/super-login-request',{method:'POST',body:JSON.stringify({email:document.getElementById('super-email').value})}).then(function(data){document.getElementById('super-verify-form').classList.remove('hidden');setMsg('login-msg',data.message||'تم إرسال الكود','ok');}).catch(function(err){setMsg('login-msg',err.message,'error');});});
document.getElementById('super-verify-form').addEventListener('submit',function(e){e.preventDefault();api('/api/admin/super-login-verify',{method:'POST',body:JSON.stringify({email:document.getElementById('super-email').value,code:document.getElementById('super-code').value})}).then(function(){return adminGet('session');}).then(showAdmin).catch(function(err){setMsg('login-msg',err.message,'error');});});
document.getElementById('logout-btn').onclick=function(){api('/api/admin/logout',{method:'POST',body:'{}'}).catch(function(){}).finally(showLogin);};

// Navigation
Array.prototype.forEach.call(document.querySelectorAll('#nav button'),function(btn){btn.addEventListener('click',function(){Array.prototype.forEach.call(document.querySelectorAll('#nav button'),function(b){b.classList.toggle('active',b===btn);});loadPanel(btn.getAttribute('data-panel'));});});
function loadPanel(name){Array.prototype.forEach.call(document.querySelectorAll('.panel'),function(p){p.classList.toggle('active',p.id==='panel-'+name);});var loaders={dashboard:loadDashboard,students:loadStudents,results:loadResults,reviews:loadReviewsAdmin,exams:loadMonths,content:loadContent,ai:loadAI,settings:loadSettings,admins:loadAdmins,audit:loadAudit,analytics:loadAnalytics};if(loaders[name])loaders[name]();}
function table(headers,rows){if(!rows.length)return '<div class="empty">مفيش بيانات.</div>';return '<div class="table-wrap"><table class="table"><thead><tr>'+headers.map(function(h){return '<th>'+esc(h)+'</th>';}).join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';}

function loadDashboard(){
  adminGet('dashboard-stats').then(function(d){
    var cards=[['إجمالي الطلاب',d.total_students],['أولى ثانوي',d.first_secondary_students||0],['ثانية ثانوي',d.second_secondary_students||0],['متوسط الأداء',d.avg_performance_percent==null?'—':d.avg_performance_percent+'%'],['الكويزات المكتملة',d.quizzes_completed],['محتاجين متابعة',d.students_behind]];
    document.getElementById('stats-grid').innerHTML=cards.map(function(x){return '<div class="stat"><strong>'+esc(x[1])+'</strong><span class="muted">'+esc(x[0])+'</span></div>';}).join('');
    var rows=(d.recent_registrations||[]).map(function(s){return '<tr><td>'+esc((s.first_name||'')+' '+(s.last_name||''))+'</td><td>'+esc(gradeLabel(s.grade_level))+'</td><td>'+esc(s.phone||'')+'</td><td>'+(s.phone_verified?'<span class="badge good">مؤكد</span>':'<span class="badge bad">غير مؤكد</span>')+'</td><td>'+esc(fmtDate(s.created_at))+'</td></tr>';});
    document.getElementById('recent-box').innerHTML=table(['الطالب','الصف','الموبايل','التحقق','التسجيل'],rows);
    renderDashboardAlerts(d.alerts||[]);
  }).catch(function(e){document.getElementById('recent-box').textContent=e.message;var a=document.getElementById('admin-alerts-box');if(a)a.textContent=e.message;});
}
function renderDashboardAlerts(alerts){
  var box=document.getElementById('admin-alerts-box');if(!box)return;
  if(!alerts.length){box.innerHTML='<div class="empty">مفيش تنبيهات محتاجة تدخل دلوقتي ✅</div>';return;}
  box.innerHTML=alerts.map(function(a){
    var cls=a.type==='critical'?'critical':(a.type==='warning'?'warning':'info');
    var icon=a.type==='critical'?'🔴':(a.type==='warning'?'🟠':'🔵');
    return '<div class="admin-alert '+cls+'"><div class="admin-alert-icon">'+icon+'</div><div class="admin-alert-body"><strong>'+esc(a.title||'تنبيه')+'</strong><p>'+esc(a.message||'')+'</p><span class="muted">'+esc(fmtDate(a.created_at))+'</span></div>'+(a.student_id?'<button class="btn small secondary" data-alert-student="'+esc(a.student_id)+'">فتح الطالب</button>':'')+'</div>';
  }).join('');
  box.querySelectorAll('[data-alert-student]').forEach(function(b){b.onclick=function(){goToStudentDetails(b.getAttribute('data-alert-student'));};});
}
function goToStudentDetails(id){
  var navBtn=document.querySelector('#nav button[data-panel="students"]');
  if(navBtn){Array.prototype.forEach.call(document.querySelectorAll('#nav button'),function(b){b.classList.toggle('active',b===navBtn);});}
  Array.prototype.forEach.call(document.querySelectorAll('.panel'),function(p){p.classList.toggle('active',p.id==='panel-students');});
  if(state.students&&state.students.length){openStudentDetails(id);}else{adminGet('students').then(function(d){state.students=d.students||[];renderStudents();openStudentDetails(id);}).catch(function(e){alert(e.message);});}
}

function gradeLabel(v){return v==='first_secondary'?'أولى ثانوي':(v==='second_secondary'?'ثانية ثانوي':'غير محدد');}
function loadStudents(){adminGet('students').then(function(d){state.students=d.students||[];renderStudents();}).catch(function(e){document.getElementById('students-box').textContent=e.message;});}
function filteredStudents(){
  var q=document.getElementById('student-search').value.trim().toLowerCase();
  var grade=document.getElementById('student-grade-filter').value;
  var status=document.getElementById('student-status-filter').value;
  return state.students.filter(function(s){
    var hay=[(s.first_name||'')+' '+(s.last_name||''),s.phone,s.parent_phone,s.email,gradeLabel(s.grade_level)].join(' ').toLowerCase();
    var gradeOk=!grade||(grade==='unassigned'?!s.grade_level:s.grade_level===grade);
    var statusOk=!status||(status==='active'?s.is_active!==false:s.is_active===false);
    return (!q||hay.indexOf(q)>=0)&&gradeOk&&statusOk;
  });
}
function renderStudentStats(){
  var all=state.students||[];
  var first=all.filter(function(s){return s.grade_level==='first_secondary';}).length;
  var second=all.filter(function(s){return s.grade_level==='second_secondary';}).length;
  var unassigned=all.filter(function(s){return !s.grade_level;}).length;
  document.getElementById('student-stats').innerHTML=[['إجمالي الطلاب',all.length],['أولى ثانوي',first],['ثانية ثانوي',second],['غير محدد',unassigned]].map(function(x){return '<div class="stat"><strong>'+esc(x[1])+'</strong><span class="muted">'+esc(x[0])+'</span></div>';}).join('');
}
function renderStudents(){
  renderStudentStats();
  var rows=filteredStudents().map(function(s){
    var status=s.is_active===false?'<span class="badge bad">موقوف</span>':'<span class="badge good">نشط</span>';
    var grade=s.grade_level?'<span class="badge">'+esc(gradeLabel(s.grade_level))+'</span>':'<span class="badge bad">غير محدد</span>';
    var action=s.is_active===false?'<button class="btn small good" data-student-reactivate="'+esc(s.id)+'">تفعيل</button>':'<button class="btn small danger" data-student-deactivate="'+esc(s.id)+'">تعطيل</button>';
    return '<tr><td>'+esc((s.first_name||'')+' '+(s.last_name||''))+'</td><td>'+grade+'</td><td>'+esc(s.phone||'—')+'</td><td>'+esc(s.parent_phone||'—')+'</td><td>'+esc(s.email||'—')+'</td><td>'+status+'</td><td>'+esc(fmtDate(s.created_at))+'</td><td><div class="toolbar" style="margin:0"><button class="btn small" data-student-details="'+esc(s.id)+'">تفاصيل</button><button class="btn small secondary" data-student-edit="'+esc(s.id)+'">تعديل</button>'+action+'</div></td></tr>';
  });
  var box=document.getElementById('students-box');
  box.innerHTML=table(['الاسم','الصف','رقم الطالب','رقم ولي الأمر','الإيميل','الحالة','التسجيل','إدارة'],rows);
  box.querySelectorAll('[data-student-details]').forEach(function(b){b.onclick=function(){openStudentDetails(b.getAttribute('data-student-details'));};});
  box.querySelectorAll('[data-student-edit]').forEach(function(b){b.onclick=function(){openStudentEditor(b.getAttribute('data-student-edit'));};});
  box.querySelectorAll('[data-student-deactivate]').forEach(function(b){b.onclick=function(){if(!confirm('تعطيل حساب الطالب؟ النتائج هتفضل محفوظة ويمكن تفعيله تاني.'))return;api('/api/admin/students?id='+encodeURIComponent(b.getAttribute('data-student-deactivate')),{method:'DELETE'}).then(loadStudents).catch(function(e){alert(e.message);});};});
  box.querySelectorAll('[data-student-reactivate]').forEach(function(b){b.onclick=function(){api('/api/admin/students',{method:'PUT',body:JSON.stringify({id:b.getAttribute('data-student-reactivate'),is_active:true})}).then(loadStudents).catch(function(e){alert(e.message);});};});
}
function openStudentDetails(id){
  var card=document.getElementById('student-details');
  var box=document.getElementById('student-details-body');
  if(!card||!box)return;
  card.classList.remove('hidden');
  box.innerHTML='<div class="empty">جاري تحميل كل بيانات الطالب...</div>';
  card.scrollIntoView({behavior:'smooth',block:'start'});
  adminGet('students?id='+encodeURIComponent(id)).then(function(d){renderStudentDetails(d);}).catch(function(e){box.innerHTML='<div class="msg error">'+esc(e.message)+'</div>';});
}
function renderStudentDetails(d){
  var s=d.student||{},st=d.stats||{},results=d.results||[],alerts=d.alerts||[];
  var box=document.getElementById('student-details-body');if(!box)return;
  var fullName=((s.first_name||'')+' '+(s.last_name||'')).trim()||'طالب';
  var avatar=s.avatar_url?'<img class="student-profile-avatar" src="'+esc(s.avatar_url)+'" alt="صورة الطالب">':'<div class="student-profile-avatar placeholder">'+esc((s.first_name||'ط').charAt(0))+'</div>';
  var status=s.is_active===false?'<span class="badge bad">موقوف</span>':'<span class="badge good">نشط</span>';
  var verified=s.phone_verified?'<span class="badge good">رقم مؤكد</span>':'<span class="badge bad">رقم غير مؤكد</span>';
  var statsHtml=[['الاختبارات المكتملة',st.completed_quizzes||0],['متوسط المستوى',st.average_percent==null?'—':st.average_percent+'%'],['75% فأعلى',st.passed_quizzes||0],['أقل من 75%',st.needs_follow_up||0],['أقل من 50%',st.critical_results||0]].map(function(x){return '<div class="student-mini-stat"><strong>'+esc(x[1])+'</strong><span>'+esc(x[0])+'</span></div>';}).join('');
  var alertsHtml=alerts.length?alerts.map(function(a){var cls=a.severity==='critical'?'critical':(a.severity==='info'?'info':'warning');var label=a.severity==='critical'?'🔴 متابعة مهمة':(a.severity==='info'?'🔵 معلومة':'🟠 محتاج متابعة');return '<div class="student-detail-alert '+cls+'"><strong>'+label+'</strong><span>'+esc(a.message)+'</span><small>'+esc(fmtDate(a.completed_at))+'</small></div>';}).join(''):'<div class="empty">مفيش تنبيهات خاصة بالطالب حاليًا ✅</div>';
  var resultRows=results.map(function(r){var cls=r.percent>=75?'good':(r.percent<50?'bad':'');return '<tr><td>'+esc(r.month||'—')+'</td><td>'+esc(r.quiz||'—')+'</td><td><span class="badge '+cls+'">'+esc(r.score)+'/'+esc(r.total)+' ('+esc(r.percent)+'%)</span></td><td>'+esc(fmtDate(r.completed_at))+'</td></tr>';});
  box.innerHTML='<div class="student-profile-head">'+avatar+'<div><h3>'+esc(fullName)+'</h3><div class="student-profile-badges">'+status+verified+'<span class="badge">'+esc(gradeLabel(s.grade_level))+'</span></div></div></div>'+ 
    '<div class="student-data-grid"><div><span>رقم الطالب</span><strong>'+esc(s.phone||'—')+'</strong></div><div><span>رقم ولي الأمر</span><strong>'+esc(s.parent_phone||'—')+'</strong></div><div><span>الإيميل</span><strong>'+esc(s.email||'—')+'</strong></div><div><span>تاريخ التسجيل</span><strong>'+esc(fmtDate(s.created_at))+'</strong></div><div><span>آخر تعديل</span><strong>'+esc(fmtDate(s.updated_at))+'</strong></div><div><span>حالة التحقق</span><strong>'+(s.phone_verified?'مؤكد':'غير مؤكد')+'</strong></div></div>'+ 
    '<div class="student-mini-stats">'+statsHtml+'</div>'+ 
    '<div class="student-detail-section"><h3>تنبيهات الطالب</h3>'+alertsHtml+'</div>'+ 
    '<div class="student-detail-section"><h3>سجل الاختبارات والنتائج</h3>'+table(['الشهر','الاختبار','النتيجة','التاريخ'],resultRows)+'</div>';
}
function openStudentEditor(id){
  var s=state.students.find(function(x){return String(x.id)===String(id);});if(!s)return;
  document.getElementById('student-edit-id').value=s.id;
  document.getElementById('student-edit-first').value=s.first_name||'';
  document.getElementById('student-edit-last').value=s.last_name||'';
  document.getElementById('student-edit-phone').value=s.phone||'';
  document.getElementById('student-edit-parent-phone').value=s.parent_phone||'';
  document.getElementById('student-edit-email').value=s.email||'';
  document.getElementById('student-edit-grade').value=s.grade_level||'';
  document.getElementById('student-edit-active').checked=s.is_active!==false;
  document.getElementById('student-editor').classList.remove('hidden');
  setMsg('student-edit-msg','');
  document.getElementById('student-editor').scrollIntoView({behavior:'smooth',block:'start'});
}
function downloadBlob(blob,name){var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1500);}
function xmlEsc(v){return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function exportStudentsExcel(){
  var rows=filteredStudents();if(!rows.length){alert('مفيش طلاب مطابقين للفلتر الحالي.');return;}
  var headers=['الاسم','الصف','رقم الطالب','رقم ولي الأمر','الإيميل','الحالة','تاريخ التسجيل'];
  var body=[headers].concat(rows.map(function(s){return [(s.first_name||'')+' '+(s.last_name||''),gradeLabel(s.grade_level),s.phone||'',s.parent_phone||'',s.email||'',s.is_active===false?'موقوف':'نشط',fmtDate(s.created_at)];}));
  var tableXml=body.map(function(row){return '<Row>'+row.map(function(cell){return '<Cell><Data ss:Type="String">'+xmlEsc(cell)+'</Data></Cell>';}).join('')+'</Row>';}).join('');
  var xml='<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Students"><Table>'+tableXml+'</Table></Worksheet></Workbook>';
  downloadBlob(new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8'}),'codehub-students.xls');
}
function exportStudentsPdf(){
  var rows=filteredStudents();if(!rows.length){alert('مفيش طلاب مطابقين للفلتر الحالي.');return;}
  var html='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>طلاب Code Hub</title><style>body{font-family:Arial,Tahoma,sans-serif;padding:24px;color:#222}h1{color:#1a2142}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #bbb;padding:7px;text-align:right}th{background:#f0eadf}@page{size:A4 landscape;margin:10mm}</style></head><body><h1>بيانات طلاب Code Hub</h1><p>عدد السجلات: '+rows.length+'</p><table><thead><tr><th>الاسم</th><th>الصف</th><th>رقم الطالب</th><th>رقم ولي الأمر</th><th>الإيميل</th><th>الحالة</th><th>التسجيل</th></tr></thead><tbody>'+rows.map(function(s){return '<tr><td>'+esc((s.first_name||'')+' '+(s.last_name||''))+'</td><td>'+esc(gradeLabel(s.grade_level))+'</td><td>'+esc(s.phone||'—')+'</td><td>'+esc(s.parent_phone||'—')+'</td><td>'+esc(s.email||'—')+'</td><td>'+esc(s.is_active===false?'موقوف':'نشط')+'</td><td>'+esc(fmtDate(s.created_at))+'</td></tr>';}).join('')+'</tbody></table></body></html>';
  var url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
  var w=window.open(url,'_blank');
  if(!w){URL.revokeObjectURL(url);alert('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة وحاول تاني.');return;}
  w.onload=function(){try{w.focus();w.print();}finally{setTimeout(function(){URL.revokeObjectURL(url);},3000);}};
}
document.getElementById('student-search').addEventListener('input',renderStudents);
document.getElementById('student-grade-filter').addEventListener('change',renderStudents);
document.getElementById('student-status-filter').addEventListener('change',renderStudents);
document.getElementById('students-export-excel').addEventListener('click',exportStudentsExcel);
document.getElementById('students-export-pdf').addEventListener('click',exportStudentsPdf);
document.getElementById('student-details-close').addEventListener('click',function(){document.getElementById('student-details').classList.add('hidden');});
document.getElementById('student-edit-cancel').addEventListener('click',function(){document.getElementById('student-editor').classList.add('hidden');});
document.getElementById('student-edit-form').addEventListener('submit',function(e){
  e.preventDefault();setMsg('student-edit-msg','جاري الحفظ...');
  var payload={id:document.getElementById('student-edit-id').value,first_name:document.getElementById('student-edit-first').value.trim(),last_name:document.getElementById('student-edit-last').value.trim(),phone:document.getElementById('student-edit-phone').value.trim(),parent_phone:document.getElementById('student-edit-parent-phone').value.trim(),email:document.getElementById('student-edit-email').value.trim(),grade_level:document.getElementById('student-edit-grade').value,is_active:document.getElementById('student-edit-active').checked};
  api('/api/admin/students',{method:'PUT',body:JSON.stringify(payload)}).then(function(){setMsg('student-edit-msg','تم الحفظ ✓','ok');document.getElementById('student-editor').classList.add('hidden');loadStudents();}).catch(function(err){setMsg('student-edit-msg',err.message,'error');});
});

function loadResults(){adminGet('results').then(function(d){state.results=d.results||[];renderResults();}).catch(function(e){document.getElementById('results-box').textContent=e.message;});}
function renderResults(){var q=document.getElementById('result-search').value.trim().toLowerCase();var rows=state.results.filter(function(r){return !q||[r.student_name,r.student_phone,gradeLabel(r.grade_level),r.month,r.quiz].join(' ').toLowerCase().indexOf(q)>=0;}).map(function(r){var pct=r.total?Math.round(r.score/r.total*100):0;return '<tr><td>'+esc(r.student_name||'—')+'</td><td>'+esc(gradeLabel(r.grade_level))+'</td><td>'+esc(r.student_phone||'—')+'</td><td>'+esc(r.month||'—')+'</td><td>'+esc(r.quiz||'—')+'</td><td>'+esc(r.score)+'/'+esc(r.total)+' ('+pct+'%)</td><td>'+esc(fmtDate(r.completed_at))+'</td></tr>';});document.getElementById('results-box').innerHTML=table(['الطالب','الصف','الموبايل','الشهر','الاختبار','النتيجة','التاريخ'],rows);}
document.getElementById('result-search').addEventListener('input',renderResults);

function loadReviewsAdmin(){
  adminGet('reviews').then(function(d){
    var list=d.reviews||[];
    var counts={pending:0,approved:0,hidden:0};
    list.forEach(function(r){if(counts[r.status]!=null)counts[r.status]++;});
    document.getElementById('reviews-admin-stats').innerHTML=[
      ['معلّق',counts.pending],['منشور',counts.approved],['مخفي',counts.hidden],['الإجمالي',list.length]
    ].map(function(x){return '<div class="stat"><strong>'+esc(x[1])+'</strong><span class="muted">'+esc(x[0])+'</span></div>';}).join('');

    var box=document.getElementById('reviews-admin-box');
    if(!list.length){box.innerHTML='<div class="empty">مفيش تقييمات لسه.</div>';return;}
    box.innerHTML=list.map(function(r){
      var statusLabel=r.status==='approved'?'منشور':(r.status==='hidden'?'مخفي':'معلّق');
      var statusClass=r.status==='approved'?'good':(r.status==='hidden'?'bad':'');
      var stars='';for(var i=1;i<=5;i++)stars+=i<=Number(r.stars)?'★':'☆';
      return '<div class="item" data-review-id="'+esc(r.id)+'">'+
        '<div class="toolbar" style="justify-content:space-between;margin-bottom:6px"><div class="item-title">'+esc(r.name)+' <span class="muted">— '+esc(r.audience||'زائر')+'</span></div><span class="badge '+statusClass+'">'+statusLabel+'</span></div>'+
        '<div style="color:#b6913b;font-weight:800;margin-bottom:5px">'+stars+'</div>'+
        '<div>'+esc(r.comment)+'</div><div class="muted" style="margin-top:6px">'+esc(fmtDate(r.created_at))+'</div>'+
        '<div class="item-actions">'+
          (r.status!=='approved'?'<button class="btn good small" data-review-status="approved">نشر</button>':'')+
          (r.status!=='hidden'?'<button class="btn secondary small" data-review-status="hidden">إخفاء</button>':'')+
          (r.status!=='pending'?'<button class="btn secondary small" data-review-status="pending">إرجاع للمراجعة</button>':'')+
          '<button class="btn danger small" data-review-delete>حذف</button></div></div>';
    }).join('');

    box.querySelectorAll('[data-review-id]').forEach(function(item){
      var id=item.getAttribute('data-review-id');
      item.querySelectorAll('[data-review-status]').forEach(function(btn){
        btn.onclick=function(){api('/api/admin/reviews',{method:'POST',body:JSON.stringify({id:id,status:btn.getAttribute('data-review-status')})}).then(loadReviewsAdmin).catch(function(e){alert(e.message);});};
      });
      var del=item.querySelector('[data-review-delete]');
      if(del)del.onclick=function(){if(!confirm('حذف التقييم نهائيًا؟'))return;api('/api/admin/reviews?id='+encodeURIComponent(id),{method:'DELETE'}).then(loadReviewsAdmin).catch(function(e){alert(e.message);});};
    });
  }).catch(function(e){document.getElementById('reviews-admin-box').textContent=e.message;});
}

// Months / quizzes / questions
function loadMonths(){
  api('/api/months').then(function(d){
    state.months=d.months||[];
    if(state.expandedMonthId&&!state.months.some(function(m){return String(m.id)===String(state.expandedMonthId);})){state.expandedMonthId=null;state.currentMonth=null;}
    renderMonths();
  }).catch(function(e){document.getElementById('months-box').textContent=e.message;});
}
function filteredMonths(){
  var filter=document.getElementById('month-list-filter')?document.getElementById('month-list-filter').value:'';
  return (state.months||[]).filter(function(m){
    if(!filter)return true;
    if(filter==='unassigned')return !m.grade_level;
    return m.grade_level===filter;
  });
}
function monthGradeBadge(m){
  return '<span class="month-grade-badge '+(!m.grade_level?'unassigned':'')+'">'+esc(gradeLabel(m.grade_level))+'</span>';
}
function renderMonths(){
  var box=document.getElementById('months-box');
  var months=filteredMonths();
  if(!months.length){box.innerHTML='<div class="empty">مفيش شهور مطابقة للفلتر.</div>';return;}
  box.innerHTML=months.map(function(m){
    var expanded=String(state.expandedMonthId||'')===String(m.id);
    return '<article class="month-card '+(expanded?'expanded':'')+'" data-month-item="'+esc(m.id)+'">'+
      '<button type="button" class="month-card-toggle" data-month-toggle="'+esc(m.id)+'" aria-expanded="'+(expanded?'true':'false')+'">'+
        '<span class="month-card-main"><span class="month-card-title">'+esc(m.name)+'</span><span class="month-card-meta">'+monthGradeBadge(m)+'<span class="month-order">الترتيب: '+esc(m.order_index)+'</span></span></span>'+
        '<span class="month-chevron">⌄</span>'+
      '</button>'+
      (expanded?'<div class="month-card-body">'+
        '<div class="month-card-controls"><strong>إعداد الشهر</strong><select class="search" data-month-grade-select><option value="">اختر الصف</option><option value="first_secondary" '+(m.grade_level==='first_secondary'?'selected':'')+'>أولى ثانوي</option><option value="second_secondary" '+(m.grade_level==='second_secondary'?'selected':'')+'>ثانية ثانوي</option></select><button class="btn small secondary" data-month-grade-save>حفظ الصف</button></div>'+
        '<div data-month-quizzes="'+esc(m.id)+'"><div class="quiz-empty">جاري تحميل الاختبارات...</div></div>'+
      '</div>':'')+
    '</article>';
  }).join('');

  box.querySelectorAll('[data-month-toggle]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-month-toggle');
      if(String(state.expandedMonthId||'')===String(id)){
        state.expandedMonthId=null;state.currentMonth=null;state.currentQuiz=null;document.getElementById('question-manager').classList.add('hidden');renderMonths();return;
      }
      state.expandedMonthId=id;
      state.currentMonth=state.months.find(function(x){return String(x.id)===String(id);})||null;
      state.currentQuiz=null;document.getElementById('question-manager').classList.add('hidden');
      renderMonths();
      loadQuizzes(id);
    };
  });
  box.querySelectorAll('[data-month-item]').forEach(function(item){
    var save=item.querySelector('[data-month-grade-save]');
    if(save)save.onclick=function(){
      var id=item.getAttribute('data-month-item');
      var grade=item.querySelector('[data-month-grade-select]').value;
      if(!grade){alert('اختار الصف الأول.');return;}
      api('/api/admin/add-month',{method:'PUT',body:JSON.stringify({id:id,grade_level:grade})}).then(function(){return loadMonths();}).catch(function(e){alert(e.message);});
    };
  });

  if(state.expandedMonthId){
    var expandedVisible=months.some(function(m){return String(m.id)===String(state.expandedMonthId);});
    if(expandedVisible)loadQuizzes(state.expandedMonthId);
  }
}
document.getElementById('month-list-filter').addEventListener('change',function(){state.currentQuiz=null;document.getElementById('question-manager').classList.add('hidden');renderMonths();});
document.getElementById('month-form').addEventListener('submit',function(e){
  e.preventDefault();
  var name=document.getElementById('month-name').value.trim();
  var grade=document.getElementById('month-grade').value;
  if(!name||!grade)return;
  api('/api/admin/add-month',{method:'POST',body:JSON.stringify({name:name,grade_level:grade})}).then(function(data){
    document.getElementById('month-name').value='';document.getElementById('month-grade').value='';
    state.expandedMonthId=data.month&&data.month.id?data.month.id:null;
    return loadMonths();
  }).catch(function(err){alert(err.message);});
});
function quizCardHtml(q){
  var final=q.type==='final';
  var meta=(final?'اختبار نهائي':'محاضرة/كويز '+(q.quiz_number_in_week||''))+' — '+esc(q.question_count)+' سؤال';
  return '<div class="quiz-mini-card '+(final?'final':'')+'" data-quiz-card="'+esc(q.id)+'">'+
    '<div class="quiz-mini-title">'+esc(q.title)+'</div><div class="quiz-mini-meta">'+meta+'</div>'+
    '<div class="quiz-mini-actions"><button class="btn small" data-quiz="'+esc(q.id)+'">إدارة الأسئلة</button><button class="btn small secondary" data-quiz-rename="'+esc(q.id)+'">تغيير الاسم</button>'+(final?'':'<button class="btn small danger" data-quiz-delete="'+esc(q.id)+'">حذف</button>')+'</div></div>';
}
function renderQuizzesInMonth(monthId,qs){
  var slot=document.querySelector('[data-month-quizzes="'+String(monthId).replace(/"/g,'')+'"]');
  if(!slot)return;
  state.monthQuizzes[String(monthId)]=qs||[];
  var weekly=(qs||[]).filter(function(q){return q.type!=='final';});
  var finalQuiz=(qs||[]).filter(function(q){return q.type==='final';});
  var groups='';
  for(var w=1;w<=4;w++){
    var list=weekly.filter(function(q){return Number(q.week_number)===w;});
    if(!list.length)continue;
    groups+='<div class="quiz-week-group"><div class="quiz-week-title">الأسبوع '+w+'</div><div class="quiz-week-items">'+list.map(quizCardHtml).join('')+'</div></div>';
  }
  var ungrouped=weekly.filter(function(q){var w=Number(q.week_number);return !(w>=1&&w<=4);});
  if(ungrouped.length)groups+='<div class="quiz-week-group"><div class="quiz-week-title">اختبارات إضافية</div><div class="quiz-week-items">'+ungrouped.map(quizCardHtml).join('')+'</div></div>';
  if(finalQuiz.length)groups+='<div class="quiz-week-group"><div class="quiz-week-title">الاختبار النهائي</div><div class="quiz-week-items">'+finalQuiz.map(quizCardHtml).join('')+'</div></div>';
  if(!groups)groups='<div class="quiz-empty">لسه مفيش اختبارات في الشهر ده.</div>';
  slot.innerHTML='<div class="month-quizzes-grid">'+groups+'</div>'+
    '<div class="quiz-add-box"><h4>إضافة اختبار مستقل لمحاضرة</h4><form class="quiz-add-form" data-quiz-add-form="'+esc(monthId)+'"><input class="search" data-quiz-new-title maxlength="120" placeholder="مثال: اختبار المحاضرة الثالثة" required><select class="search" data-quiz-new-week required><option value="">اختر الأسبوع</option><option value="1">الأسبوع 1</option><option value="2">الأسبوع 2</option><option value="3">الأسبوع 3</option><option value="4">الأسبوع 4</option></select><button class="btn" type="submit">إضافة منفصل</button></form><div class="section-note" style="margin:8px 0 0">استخدمها لو عندك 3 محاضرات أو أكثر وعايز كل محاضرة يبقى لها اختبار مستقل.</div></div>';

  slot.querySelectorAll('[data-quiz]').forEach(function(b){b.onclick=function(){
    var id=b.getAttribute('data-quiz');state.currentQuiz=(qs||[]).find(function(x){return String(x.id)===String(id);});loadQuestions(id);
  };});
  slot.querySelectorAll('[data-quiz-rename]').forEach(function(b){b.onclick=function(){
    var id=b.getAttribute('data-quiz-rename');var q=(qs||[]).find(function(x){return String(x.id)===String(id);});if(!q)return;
    var title=prompt('اكتب الاسم الجديد للاختبار:',q.title||'');if(title===null)return;title=title.trim();if(!title)return;
    api('/api/admin/quizzes',{method:'PUT',body:JSON.stringify({id:id,title:title})}).then(function(){loadQuizzes(monthId);}).catch(function(e){alert(e.message);});
  };});
  slot.querySelectorAll('[data-quiz-delete]').forEach(function(b){b.onclick=function(){
    var id=b.getAttribute('data-quiz-delete');var q=(qs||[]).find(function(x){return String(x.id)===String(id);});
    if(!confirm('حذف "'+(q?q.title:'الاختبار')+'"؟ سيتم حذف أسئلته ونتائجه المرتبطة به نهائيًا.'))return;
    api('/api/admin/quizzes?id='+encodeURIComponent(id),{method:'DELETE'}).then(function(){loadQuizzes(monthId);}).catch(function(e){alert(e.message);});
  };});
  var form=slot.querySelector('[data-quiz-add-form]');
  if(form)form.addEventListener('submit',function(e){
    e.preventDefault();
    var title=form.querySelector('[data-quiz-new-title]').value.trim();var week=Number(form.querySelector('[data-quiz-new-week]').value);
    if(!title||week<1||week>4)return;
    api('/api/admin/quizzes',{method:'POST',body:JSON.stringify({month_id:monthId,title:title,week_number:week})}).then(function(){loadQuizzes(monthId);}).catch(function(err){alert(err.message);});
  });
}
function loadQuizzes(monthId){
  var slot=document.querySelector('[data-month-quizzes="'+String(monthId).replace(/"/g,'')+'"]');
  if(slot)slot.innerHTML='<div class="quiz-empty">جاري تحميل الاختبارات...</div>';
  adminGet('quizzes?month_id='+encodeURIComponent(monthId)).then(function(d){
    var qs=d.quizzes||[];renderQuizzesInMonth(monthId,qs);
  }).catch(function(e){var current=document.querySelector('[data-month-quizzes="'+String(monthId).replace(/"/g,'')+'"]');if(current)current.textContent=e.message;});
}
function loadQuestions(quizId){adminGet('questions?quiz_id='+encodeURIComponent(quizId)).then(function(d){state.questions=d.questions||[];document.getElementById('question-manager').classList.remove('hidden');document.getElementById('question-manager-title').textContent='أسئلة '+(state.currentQuiz?state.currentQuiz.title:'الاختبار');resetQuestionForm();renderQuestions();}).catch(function(e){document.getElementById('questions-box').textContent=e.message;});}
function renderQuestions(){var box=document.getElementById('questions-box');if(!state.questions.length){box.innerHTML='<div class="empty">لسه مفيش أسئلة.</div>';return;}box.innerHTML=state.questions.map(function(q,i){return '<div class="item"><div class="muted">#'+(i+1)+' — '+esc(q.type_label||q.question_type)+'</div><div class="item-title">'+esc(q.question_text)+'</div><div class="muted">الإجابة: '+esc(q.correct_answer||'—')+'</div><div class="item-actions"><button class="btn small secondary" data-edit="'+esc(q.id)+'">تعديل</button><button class="btn small danger" data-delete="'+esc(q.id)+'">حذف</button></div></div>';}).join('');box.querySelectorAll('[data-edit]').forEach(function(b){b.onclick=function(){editQuestion(b.getAttribute('data-edit'));};});box.querySelectorAll('[data-delete]').forEach(function(b){b.onclick=function(){if(!confirm('حذف السؤال؟'))return;api('/api/admin/questions?id='+encodeURIComponent(b.getAttribute('data-delete')),{method:'DELETE'}).then(function(){loadQuestions(state.currentQuiz.id);}).catch(function(e){alert(e.message);});};});}
function questionMode(){var type=document.getElementById('question-type').value;var custom=type==='custom';document.getElementById('custom-type-field').classList.toggle('hidden',!custom);document.getElementById('answer-mode-field').classList.toggle('hidden',!custom);var mode=custom?document.getElementById('answer-mode').value:((type==='multiple_choice'||type==='true_false')?'choice':'text');var choice=mode==='choice';document.getElementById('options-field').classList.toggle('hidden',!choice||type==='true_false');document.getElementById('correct-index-field').classList.toggle('hidden',!choice);document.getElementById('correct-answer-field').classList.toggle('hidden',choice);document.getElementById('threshold-field').classList.toggle('hidden',choice);}
document.getElementById('question-type').onchange=questionMode;document.getElementById('answer-mode').onchange=questionMode;
function resetQuestionForm(){document.getElementById('question-form').reset();document.getElementById('question-id').value='';document.getElementById('correct-index').value='1';document.getElementById('threshold').value='0.7';document.getElementById('question-order').value=String((state.questions||[]).length+1);document.getElementById('question-submit').textContent='إضافة السؤال';document.getElementById('question-cancel').classList.add('hidden');questionMode();}
document.getElementById('question-cancel').onclick=resetQuestionForm;
function editQuestion(id){var q=state.questions.find(function(x){return String(x.id)===String(id);});if(!q)return;document.getElementById('question-id').value=q.id;document.getElementById('question-type').value=q.question_type||'multiple_choice';document.getElementById('custom-type-name').value=q.custom_type_name||'';document.getElementById('answer-mode').value=q.answer_mode||'choice';document.getElementById('question-text').value=q.question_text||'';document.getElementById('question-options').value=(q.options||[]).join('\n');document.getElementById('correct-index').value=String((Number(q.correct_index)||0)+1);document.getElementById('correct-answer').value=q.correct_answer||'';document.getElementById('threshold').value=String(q.similarity_threshold||0.7);document.getElementById('question-order').value=String(q.order_index||1);document.getElementById('question-submit').textContent='حفظ التعديل';document.getElementById('question-cancel').classList.remove('hidden');questionMode();window.scrollTo({top:document.getElementById('question-manager').offsetTop-15,behavior:'smooth'});}
document.getElementById('question-form').addEventListener('submit',function(e){e.preventDefault();if(!state.currentQuiz)return;var id=document.getElementById('question-id').value;var payload={id:id||undefined,quiz_id:state.currentQuiz.id,question_type:document.getElementById('question-type').value,custom_type_name:document.getElementById('custom-type-name').value,answer_mode:document.getElementById('answer-mode').value,question_text:document.getElementById('question-text').value,options:document.getElementById('question-options').value.split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean),correct_index:Math.max(0,Number(document.getElementById('correct-index').value||1)-1),correct_answer:document.getElementById('correct-answer').value,similarity_threshold:Number(document.getElementById('threshold').value||0.7),order_index:Number(document.getElementById('question-order').value||1)};api('/api/admin/questions',{method:id?'PUT':'POST',body:JSON.stringify(payload)}).then(function(){loadQuestions(state.currentQuiz.id);}).catch(function(err){alert(err.message);});});

function loadContent(){adminGet('content').then(function(d){var rows=d.content||[];var box=document.getElementById('content-box');if(!rows.length){box.innerHTML='<div class="empty">مفيش نصوص قابلة للتعديل في قاعدة البيانات.</div>';return;}box.innerHTML=rows.map(function(r){return '<div class="item" data-content-item="'+esc(r.key)+'"><div class="item-title">'+esc(r.section||'عام')+' — '+esc(r.key)+'</div><textarea class="search" rows="3" data-value>'+esc(r.value||'')+'</textarea><div class="item-actions"><button class="btn small" data-save>حفظ</button><button class="btn small secondary" data-rollback>رجوع لآخر نسخة</button></div></div>';}).join('');box.querySelectorAll('[data-content-item]').forEach(function(item){var key=item.getAttribute('data-content-item');item.querySelector('[data-save]').onclick=function(){api('/api/admin/content',{method:'POST',body:JSON.stringify({key:key,value:item.querySelector('[data-value]').value})}).then(loadContent).catch(function(e){alert(e.message);});};item.querySelector('[data-rollback]').onclick=function(){if(!confirm('ترجع لآخر قيمة محفوظة؟'))return;api('/api/admin/content',{method:'POST',body:JSON.stringify({key:key,rollback:true})}).then(loadContent).catch(function(e){alert(e.message);});};});}).catch(function(e){document.getElementById('content-box').textContent=e.message;});}

function loadAI(){Promise.all([adminGet('ai-questions'),adminGet('ai-knowledge')]).then(function(all){var a=all[0],k=all[1];var top=a.top_questions||[];document.getElementById('ai-questions-box').innerHTML='<div class="muted">إجمالي الأسئلة المسجلة: '+esc(a.total_questions||0)+'</div>'+(top.length?top.slice(0,50).map(function(q){return '<div class="item"><div class="item-title">'+esc(q.question)+'</div><div class="muted">التكرار: '+esc(q.count)+' — إجابات عامة: '+esc(q.general)+'</div></div>';}).join(''):'<div class="empty">مفيش بيانات.</div>');var list=k.knowledge||[];var kb=document.getElementById('knowledge-box');kb.innerHTML=list.length?list.map(function(x){return '<div class="item"><div class="item-title">'+esc(x.title)+'</div><div class="muted">'+esc(String(x.content||'').slice(0,260))+(String(x.content||'').length>260?'…':'')+'</div><div class="item-actions"><button class="btn danger small" data-kdel="'+esc(x.id)+'">حذف</button></div></div>';}).join(''):'<div class="empty">مفيش محتوى مضاف.</div>';kb.querySelectorAll('[data-kdel]').forEach(function(b){b.onclick=function(){if(!confirm('حذف المحتوى؟'))return;api('/api/admin/ai-knowledge?id='+encodeURIComponent(b.getAttribute('data-kdel')),{method:'DELETE'}).then(loadAI).catch(function(e){alert(e.message);});};});}).catch(function(e){document.getElementById('ai-questions-box').textContent=e.message;});}
document.getElementById('knowledge-form').addEventListener('submit',function(e){e.preventDefault();api('/api/admin/ai-knowledge',{method:'POST',body:JSON.stringify({title:document.getElementById('knowledge-title').value,content:document.getElementById('knowledge-content').value})}).then(function(){e.target.reset();loadAI();}).catch(function(err){alert(err.message);});});

function loadSettings(){adminGet('settings').then(function(d){var s=d.settings||{};document.getElementById('maintenance-mode').checked=!!s.maintenance_mode;document.getElementById('hidden-sections').value=(s.hidden_sections||[]).join(', ');document.getElementById('pass-percent').value=s.final_exam_pass_percent==null?75:s.final_exam_pass_percent;}).catch(function(e){setMsg('settings-msg',e.message,'error');});}
document.getElementById('settings-form').addEventListener('submit',function(e){e.preventDefault();var sections=document.getElementById('hidden-sections').value.split(',').map(function(x){return x.trim();}).filter(Boolean);api('/api/admin/settings',{method:'POST',body:JSON.stringify({maintenance_mode:document.getElementById('maintenance-mode').checked,hidden_sections:sections,final_exam_pass_percent:Number(document.getElementById('pass-percent').value)})}).then(function(){setMsg('settings-msg','تم الحفظ','ok');}).catch(function(err){setMsg('settings-msg',err.message,'error');});});

function loadAdmins(){adminGet('admins').then(function(d){var list=d.admins||[];var box=document.getElementById('admins-box');box.innerHTML=list.length?list.map(function(a){return '<div class="item"><div class="item-title" dir="ltr">'+esc(a.email)+'</div><div class="muted">'+esc(fmtDate(a.added_at))+'</div><div class="item-actions"><button class="btn danger small" data-adel="'+esc(a.email)+'">حذف</button></div></div>';}).join(''):'<div class="empty">مفيش أدمنز إضافيين.</div>';box.querySelectorAll('[data-adel]').forEach(function(b){b.onclick=function(){if(!confirm('حذف الأدمن؟'))return;api('/api/admin/admins?email='+encodeURIComponent(b.getAttribute('data-adel')),{method:'DELETE'}).then(loadAdmins).catch(function(e){alert(e.message);});};});}).catch(function(e){document.getElementById('admins-box').textContent=e.message;});}
document.getElementById('admin-add-form').addEventListener('submit',function(e){e.preventDefault();api('/api/admin/admins',{method:'POST',body:JSON.stringify({email:document.getElementById('admin-email').value})}).then(function(){e.target.reset();loadAdmins();}).catch(function(err){alert(err.message);});});

function loadAudit(){adminGet('audit-log').then(function(d){var rows=(d.log||[]).map(function(x){return '<tr><td>'+esc(fmtDate(x.created_at))+'</td><td>'+esc(x.admin_identity||x.admin||'—')+'</td><td>'+esc(x.action||'—')+'</td><td><div class="code">'+esc(JSON.stringify(x.details||{},null,2))+'</div></td></tr>';});document.getElementById('audit-box').innerHTML=table(['التاريخ','الأدمن','الحركة','التفاصيل'],rows);}).catch(function(e){document.getElementById('audit-box').textContent=e.message;});}
function loadAnalytics(){adminGet('analytics').then(function(d){var by=Object.keys(d.by_page||{}).sort(function(a,b){return d.by_page[b]-d.by_page[a];});var days=Object.keys(d.last_7_days||{}).sort();document.getElementById('analytics-box').innerHTML='<div class="grid"><div class="stat"><strong>'+esc(d.total||0)+'</strong><span class="muted">إجمالي الزيارات المسجلة</span></div></div><h3>حسب الصفحة</h3>'+table(['الصفحة','الزيارات'],by.map(function(k){return '<tr><td>'+esc(k)+'</td><td>'+esc(d.by_page[k])+'</td></tr>';}))+'<h3>آخر 7 أيام</h3>'+table(['اليوم','الزيارات'],days.map(function(k){return '<tr><td>'+esc(k)+'</td><td>'+esc(d.last_7_days[k])+'</td></tr>';}));}).catch(function(e){document.getElementById('analytics-box').textContent=e.message;});}

questionMode();checkSession();
})();
