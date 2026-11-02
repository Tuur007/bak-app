// Gedeelde interactie voor de mockups. Geen echte opslag: alles is demo.
(function(){
  var scrs=[].slice.call(document.querySelectorAll('.scr'));
  var tabs=[].slice.call(document.querySelectorAll('.tabbar button'));
  var jumps=[].slice.call(document.querySelectorAll('.jump button'));
  window.go=function(n){
    scrs.forEach(function(s,i){s.classList.toggle('on',i===n)});
    tabs.forEach(function(t){t.classList.toggle('on',+t.dataset.s===n)});
    jumps.forEach(function(t,i){t.classList.toggle('on',i===n)});
  };
  document.querySelectorAll('[data-s]').forEach(function(b){b.addEventListener('click',function(){go(+b.dataset.s)})});
  jumps.forEach(function(b,i){b.addEventListener('click',function(){go(i)})});
  go(0);

  // Stap afvinken
  document.querySelectorAll('[data-step]').forEach(function(el){
    el.addEventListener('click',function(){el.classList.toggle('done')});
  });

  // Live ratio's in het bak-formulier (bakkerspercentages)
  function g(id){var e=document.getElementById(id);return e?parseFloat(String(e.value).replace(',','.'))||0:0}
  function set(id,t){var e=document.getElementById(id);if(e)e.textContent=t}
  function f1(x){return (Math.round(x*10)/10).toString().replace('.',',')}
  function calc(){
    var meel=g('f-meel'),water=g('f-water'),st=g('f-starter'),sh=g('f-sthyd')||100,zout=g('f-zout');
    var sf=st/(1+sh/100),sw=st-sf;           // meel/water in de starter
    var tf=meel+sf,tw=water+sw;               // totaal meel en water
    set('o-hyd',tf?f1(tw/tf*100)+'%':'-');
    set('o-st',tf?f1(st/tf*100)+'%':'-');
    set('o-zout',tf?f1(zout/tf*100)+'%':'-');
    set('o-tot',Math.round(meel+water+st+zout)+' g');
    set('o-meel2',Math.round(tf)+' g');
  }
  document.querySelectorAll('.calc').forEach(function(i){i.addEventListener('input',calc)});
  calc();

  // Countdown (demo): elementen met data-sec tellen af; tik = pauze/hervat
  var cds=[].slice.call(document.querySelectorAll('[data-sec]'));
  cds.forEach(function(e){e._t=+e.dataset.sec;e._run=true;
    e.addEventListener('click',function(){e._run=!e._run;e.style.opacity=e._run?1:.55})});
  function fmt(s){var h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;
    return (h?h+':':'')+('0'+m).slice(-2)+':'+('0'+x).slice(-2)}
  setInterval(function(){cds.forEach(function(e){if(e._run&&e._t>0)e._t--;e.textContent=fmt(e._t)})},1000);
  cds.forEach(function(e){e.textContent=fmt(e._t)});

  document.querySelectorAll('[data-bump]').forEach(function(b){b.addEventListener('click',function(){cds.forEach(function(e){e._t+=+b.dataset.bump;e.textContent=fmt(e._t)})})});

  // Sterren / korstkleur kiezen
  document.querySelectorAll('[data-pick]').forEach(function(grp){
    [].slice.call(grp.children).forEach(function(c,i){c.addEventListener('click',function(){
      [].slice.call(grp.children).forEach(function(x,j){x.classList.toggle('sel',j<=i&&grp.dataset.pick==='rate'||j===i&&grp.dataset.pick==='one')});
    })});
  });
})();
