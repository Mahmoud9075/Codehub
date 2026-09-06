document.addEventListener('DOMContentLoaded', function(){
  var navButtons = Array.prototype.slice.call(document.querySelectorAll('#nav [data-panel]'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.panel'));
  function activatePanel(name){
    navButtons.forEach(function(btn){ btn.classList.toggle('active', btn.getAttribute('data-panel') === name); });
    panels.forEach(function(panel){ panel.classList.toggle('active', panel.id === 'panel-' + name); });
  }
  navButtons.forEach(function(btn){
    btn.addEventListener('click', function(){ activatePanel(btn.getAttribute('data-panel')); });
  });

  var showPin = document.getElementById('show-pin');
  var showSuper = document.getElementById('show-super');
  var pinForm = document.getElementById('pin-form');
  var superBox = document.getElementById('super-box');
  function setLoginMode(mode){
    var pinMode = mode === 'pin';
    if (pinForm) pinForm.classList.toggle('hidden', !pinMode);
    if (superBox) superBox.classList.toggle('hidden', pinMode);
    if (showPin) showPin.className = 'btn' + (pinMode ? '' : ' secondary');
    if (showSuper) showSuper.className = 'btn' + (pinMode ? ' secondary' : '');
  }
  if (showPin) showPin.addEventListener('click', function(){ setLoginMode('pin'); });
  if (showSuper) showSuper.addEventListener('click', function(){ setLoginMode('super'); });
  setLoginMode('pin');

  function decorateBox(boxId, fallbackText){
    var box = document.getElementById(boxId);
    if (!box) return;
    function apply(){
      if (!box.children.length && !box.textContent.trim()){
        box.innerHTML = '<div class="empty">' + fallbackText + '</div>';
        return;
      }
      Array.prototype.slice.call(box.children).forEach(function(el){
        if (!el.classList.contains('item') && !el.classList.contains('empty') && !el.classList.contains('table-wrap')){
          el.classList.add('item');
        }
      });
    }
    apply();
    new MutationObserver(apply).observe(box, {childList:true, subtree:false});
  }
  decorateBox('months-box','أضف أول شهر من فوق، وبعدها هتظهر هنا قائمة الشهور بشكل أبسط.');
  decorateBox('quizzes-box','اختر شهر أولاً، وبعدها هتظهر الاختبارات هنا.');
  decorateBox('questions-box','اختر اختبار أولاً، وبعدها هتظهر الأسئلة هنا.');
  decorateBox('reviews-admin-box','التقييمات هتظهر هنا أول ما توصل من الموقع.');
});
