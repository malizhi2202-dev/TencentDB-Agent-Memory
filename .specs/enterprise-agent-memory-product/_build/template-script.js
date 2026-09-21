// 目录高亮：取「最后一个越过参考线的锚点」。
// 不用 IntersectionObserver 的 intersectionRatio 比较——threshold 为离散值
// [0,.25,.5,1]，回调里读到的 ratio 只是「越过某个阈值那一刻」的快照而非当前值，
// 于是短小节（§8/§9/§10 等）会把高亮让给相邻小节。按参考线判定是确定性的。
(function(){
  var links = Array.prototype.slice.call(document.querySelectorAll('.doc-nav a[href^="#"]'));
  if (!links.length) return;
  // 目录顺序即文档顺序（构建期已校验），故可直接按数组顺序取「最后一个已越过」
  var items = links.map(function(a){
    return { a: a, el: document.getElementById(a.getAttribute('href').slice(1)) };
  }).filter(function(x){ return x.el; });
  if (!items.length) return;
  var current = null;
  function refLine(){
    var top = document.querySelector('.doc-top');
    var h = top ? top.getBoundingClientRect().height : 56;
    return h + 24;
  }
  function update(){
    var line = refLine(), best = items[0];
    for (var i = 0; i < items.length; i++){
      if (items[i].el.getBoundingClientRect().top <= line) best = items[i];
    }
    // 触底时最后一条未必越过参考线，强制高亮它
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2){
      best = items[items.length - 1];
    }
    if (best !== current){
      current = best;
      links.forEach(function(a){ a.classList.remove('active'); });
      best.a.classList.add('active');
    }
  }
  var queued = false;
  function onScroll(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(function(){ queued = false; update(); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();

// 原型里的标签页：只切换展示，不发请求
function activateTab(btn){
  var bar = btn.closest('[data-tabs]');
  Array.prototype.forEach.call(bar.querySelectorAll('button[data-tab]'), function(b){
    b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
  });
  var scope = bar.parentElement;
  var panels = scope ? scope.querySelectorAll('[data-panel]') : [];
  Array.prototype.forEach.call(panels, function(p){
    p.hidden = p.getAttribute('data-panel') !== btn.getAttribute('data-tab');
  });
}
document.addEventListener('click', function(ev){
  var btn = ev.target.closest('[data-tabs] button[data-tab]');
  if (btn) activateTab(btn);
});
// 左右方向键在页签间漫游（WAI-ARIA tabs 键盘约定）
document.addEventListener('keydown', function(ev){
  if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
  var btn = ev.target.closest('[data-tabs] button[data-tab]');
  if (!btn) return;
  ev.preventDefault();
  var all = Array.prototype.slice.call(btn.closest('[data-tabs]').querySelectorAll('button[data-tab]'));
  var i = all.indexOf(btn) + (ev.key === 'ArrowRight' ? 1 : -1);
  var next = all[(i + all.length) % all.length];
  next.focus(); activateTab(next);
});
