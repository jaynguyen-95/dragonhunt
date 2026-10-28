(() => {
  const DP = "M108.5 0C118 122 150 181 217 207 150 233 118 292 108.5 414 99 292 67 233 0 207 67 181 99 122 108.5 0Z";
  const SCHEMES = {
    CUR:{lad:{6:68,7:88,8:138,9:188,10:288}, slay:6, name:'Original rules'},
    A:  {lad:{6:68,7:88,8:138,9:188,10:288}, slay:8, name:'Plan A'},
    AB: {lad:{6:68,7:68,8:88,9:138,10:288}, slay:8, name:'Plan A + B'}
  };
  const SLAY = 68, CAP = 5000, TABLES = ['BC1','BC2'], SIDE = {B:'BANKER', P:'PLAYER', T:'TIE'};
  const $ = id => document.getElementById(id);
  const fmt = n => '$' + Math.round(n||0).toLocaleString('en-US');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mask = mb => mb ? 'MB ••' + String(mb).slice(-4) : '';
  const clock = () => new Date().toTimeString().slice(0,5);
  const rnd = a => a[Math.floor(Math.random()*a.length)];
  const dmd = (fill='url(#gGold)', cls='') => `<svg class="dmd ${cls}" viewBox="0 0 217 414" aria-hidden="true"><path fill="${fill}" d="${DP}"/></svg>`;
  const UP = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2l4 6H2z" fill="currentColor"/></svg>';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- mode from link: #host-bc1, #display-bc2 ... ---------- */
  const H = (location.hash || '').slice(1).toLowerCase();
  const mm = H.match(/^(host|display)(?:-(bc1|bc2))?$/);
  const ROLE = mm ? mm[1] : 'demo';
  const LOCK = mm && mm[2] ? mm[2].toUpperCase() : (ROLE === 'display' ? 'BC1' : null);
  document.documentElement.classList.add('mode-' + ROLE);
  const OWN = ROLE === 'display' ? [] : (LOCK ? [LOCK] : TABLES.slice());

  let S, curT = LOCK || 'BC1', prompt = null, queue = [], playing = false, sound = false, autoRun = 0;
  const undo = {BC1:[], BC2:[]};
  const mkT = n => ({name:n, phase:'idle', scheme:'AB', res:[], side:null, len:0, paid:0, dstyle:'gold3d', fx:'video', feed:'green', stats:{}, ticker:[], hist:[], awards:[], st:[1,2,3,4,5].map(i => ({n:i, on:false, mb:''}))});
  function fresh(list){ if(!S) S = {T:{BC1:mkT('BC1'), BC2:mkT('BC2')}, log:[]}; (list || TABLES).forEach(t => { S.T[t] = mkT(t); undo[t] = []; }); prompt = null; queue = []; }
  const sch = t => SCHEMES[S.T[t].scheme] || SCHEMES.AB;

  /* ---------- sound ---------- */
  let ctx = null;
  function ac(){ if(!ctx){ try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ ctx = null; } } return ctx; }
  function tone(f,t0,d,type='triangle',v=.14){ const c = ac(); if(!c || !sound) return; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; o.connect(g); g.connect(c.destination); const t = c.currentTime + t0; g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.001,t+d); o.start(t); o.stop(t+d+.05); }
  function whoosh(d=1.2, v=.12){ const c = ac(); if(!c || !sound) return; const b = c.createBuffer(1, c.sampleRate*d, c.sampleRate), a = b.getChannelData(0); for(let i=0;i<a.length;i++) a[i] = (Math.random()*2-1); const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; s.buffer = b; s.connect(f); f.connect(g); g.connect(c.destination); const t = c.currentTime; f.frequency.setValueAtTime(300,t); f.frequency.exponentialRampToValueAtTime(2400,t+d*.6); f.frequency.exponentialRampToValueAtTime(400,t+d); g.gain.setValueAtTime(.001,t); g.gain.exponentialRampToValueAtTime(v,t+d*.5); g.gain.exponentialRampToValueAtTime(.001,t+d); s.start(); }
  const sfx = {
    tap(){ tone(600,0,.05,'sine',.05); },
    beat(){ [0,.18,.9,1.08].forEach(t => tone(70,t,.16,'sine',.4)); },
    roar(){ whoosh(1.4,.16); for(let i=0;i<14;i++) tone(90+i*28, .9+i*.04, .5, 'sawtooth', .05); [523,659,784,1047,1319].forEach((f,i) => tone(f, 1.5+i*.11, .6, 'triangle', .16)); },
    slain(){ whoosh(.6,.1); tone(2200,.9,.25,'square',.06); [784,659,523,392].forEach((f,i) => tone(f, 1.1+i*.12, .35, 'square', .07)); tone(1047,1.7,.7,'triangle',.14); },
    alert(){ whoosh(1,.08); [0,.18,.9,1.08].forEach(t => tone(70,t,.16,'sine',.4)); }
  };

  /* ---------- helpers ---------- */
  const stamp = () => { const d = new Date(), p = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
  function log(m){ S.log.unshift({t:clock(), ts:stamp(), m}); S.log = S.log.slice(0,80); renderLog(); }
  function tick(t,k,v){ const T = S.T[t]; T.ticker.unshift({k,v}); T.ticker = T.ticker.slice(0,6); }
  const totalPaid = () => TABLES.reduce((a,t) => a + (S.T[t].paid||0), 0);
  function ranking(){
    const m = {};
    TABLES.forEach(t => Object.entries(S.T[t].stats||{}).forEach(([k,v]) => {
      const r = m[k] || (m[k] = {key:k, mb:v.mb, label:v.label, won:0, dragons:0, slays:0, table:v.table, at:0});
      r.won += v.won; r.dragons += v.dragons; r.slays += v.slays; if(v.at > r.at){ r.at = v.at; r.table = v.table; }
    }));
    return Object.values(m).sort((a,b) => b.won - a.won || b.dragons - a.dragons || a.at - b.at);
  }
  const seatLabel = (t,s) => s.mb ? `ST${s.n} · ${mask(s.mb)}` : `ST${s.n}`;

  /* ---------- dealer actions ---------- */
  function goLive(){
    const T = S.T[curT], on = T.phase === 'idle';
    OWN.filter(t => !LOCK || t === LOCK).forEach(t => S.T[t].phase = on ? 'live' : 'idle');
    log(on ? 'LED live · Dragon Hunt started' : 'LED back to standby'); render();
  }
  function toggleSeat(t,n){
    const s = S.T[t].st[n-1];
    if(prompt && prompt.t === t){ if(!s.on) return; prompt.sel.has(n) ? prompt.sel.delete(n) : prompt.sel.add(n); sfx.tap(); render(); return; }
    s.on = !s.on; if(!s.on) s.mb = '';
    log(`${t} ST${n} ${s.on ? 'seated' : 'cleared'}`); render(true);
  }
  function setMb(t,n,val){
    const v = String(val||'').replace(/[^0-9A-Za-z]/g,'').slice(0,12), s = S.T[t].st[n-1];
    if(!s.on || s.mb === v) return; s.mb = v; log(`${t} ST${n} MB ${v ? mask(v) : 'cleared'}`); render(true);
  }
  function result(t,r){
    const T = S.T[t]; if(T.phase !== 'live' || prompt) return;
    undo[t].push(JSON.stringify(T)); undo[t] = undo[t].slice(-12);
    const L = sch(t).lad; T.res.push(r); sfx.tap();
    const H = {n:T.res.length, ts:stamp(), r:SIDE[r], ev:'', paid:''}; (T.hist = T.hist || []).push(H);
    if(r === 'T'){
      H.side = T.side ? SIDE[T.side] : ''; H.len = T.len; if(T.len >= 4) H.ev = `Tie · ${SIDE[T.side]} ×${T.len} still alive`;
      log(`${t} hand ${T.res.length}: TIE${T.len >= 4 ? ' · ' + SIDE[T.side] + ' ×' + T.len + ' still alive' : ''}`);
      if(T.len >= 4) tick(t,'TIE',`${SIDE[T.side]} ×${T.len} still alive`);
      render(); return;
    }
    if(r === T.side){
      T.len++; log(`${t} hand ${T.res.length}: ${SIDE[r]} · streak ${T.len}`);
      if(T.len === 4){ enqueue({k:'alert', t, side:r, len:4}); tick(t,'DRAGON ALERT',`${SIDE[r]} wins 4 in a row`); }
      if(T.len === 5){ enqueue({k:'alert', t, side:r, len:5}); tick(t,'ONE MORE',`${SIDE[r]} ×5 · one more for a dragon`); }
      H.ev = T.len === 4 ? 'Dragon alert' : T.len === 5 ? 'One more for a dragon' : T.len >= 10 ? (T.len === 10 ? 'King Dragon' : `Dragon ${T.len} (past top prize)`) : T.len >= 6 ? `Dragon ${T.len}` : '';
      if(T.len >= 6){
        if(T.len <= 10) prompt = {t, kind:'follow', side:r, len:T.len, amt:L[T.len], sel:new Set()};
        else enqueue({k:'dragon', t, side:r, len:T.len, who:[], amt:0, over:true});
      }
    } else {
      const ps = T.side, pl = T.len; T.side = r; T.len = 1;
      if(pl >= 6) H.ev = `${SIDE[ps]} dragon ${pl} slain` + (pl < sch(t).slay ? ` (slayer prize starts at ${sch(t).slay})` : '');
      log(`${t} hand ${T.res.length}: ${SIDE[r]}${pl >= 6 ? ' · ' + SIDE[ps] + ' DRAGON ' + pl + ' BROKEN' : ''}`);
      if(pl >= 6){
        if(pl >= sch(t).slay) prompt = {t, kind:'slay', side:r, len:pl, prevSide:ps, amt:SLAY, sel:new Set()};
        else { enqueue({k:'slain', t, side:r, len:pl, prevSide:ps, who:[], amt:0, noReward:true, from:sch(t).slay}); tick(t,'DRAGON SLAIN',`Dragon ${pl} broken`); }
      }
    }
    H.side = SIDE[T.side]; H.len = T.len;
    render();
  }
  function doUndo(){
    const t = curT; if(!undo[t].length || !OWN.includes(t)) return;
    const prev = JSON.parse(undo[t].pop()), T = S.T[t];
    const lastRes = T.res[T.res.length-1];
    S.T[t] = prev; if(prompt && prompt.t === t) prompt = null;
    log(`${t} UNDO: removed ${SIDE[lastRes] || ''} result of hand ${T.res.length}`); render(true);
  }
  function confirm(none){
    if(!prompt) return;
    const p = prompt, T = S.T[p.t], nums = none ? [] : [...p.sel].sort((a,b) => a-b);
    const ok = [];
    nums.forEach(n => {
      if(totalPaid() + p.amt > CAP) return;
      const s = T.st[n-1], key = s.mb ? 'MB' + s.mb : `${p.t}-ST${n}`;
      const r = T.stats[key] || (T.stats[key] = {mb:s.mb, label:s.mb ? mask(s.mb) : `${p.t} · ST${n}`, won:0, dragons:0, slays:0, table:p.t, at:0});
      r.won += p.amt; r.at = Date.now(); r.table = p.t; p.kind === 'follow' ? r.dragons++ : r.slays++;
      T.paid += p.amt; ok.push(n);
      (T.awards = T.awards || []).push({ts:stamp(), table:p.t, hand:T.res.length, kind:p.kind === 'follow' ? 'Follow the dragon' : 'Slay the dragon', len:p.len, side:SIDE[p.side], seat:'ST ' + n, mb:s.mb || '', amount:p.amt, handover:p.amt >= 138 ? 'CMS + Supervisor approval' : 'Voucher at table'});
    });
    { const lh = (T.hist || [])[T.hist.length - 1]; if(lh) lh.paid = ok.length ? `${ok.length} × ${fmt(p.amt)} (${ok.map(n => 'ST ' + n).join(', ')})` : 'No qualifying station'; }
    if(ok.length < nums.length) log(`CAP ${fmt(CAP)} reached · ${nums.length - ok.length} station(s) not paid`);
    const who = ok.map(n => seatLabel(p.t, T.st[n-1]));
    if(p.kind === 'follow'){
      log(`${p.t} DRAGON ${SIDE[p.side]} ${p.len} · ${ok.length ? who.join(', ') + ' · ' + fmt(p.amt) + ' ×' + ok.length : 'no qualifying station'}`);
      tick(p.t, p.len >= 10 ? 'KING DRAGON' : 'DRAGON ' + p.len, ok.length ? who.join(' · ') + ' · ' + fmt(p.amt) : 'No qualifying hunters');
      enqueue({k:'dragon', t:p.t, side:p.side, len:p.len, who, amt:p.amt, next:sch(p.t).lad[Math.min(p.len+1,10)]});
    } else {
      log(`${p.t} DRAGON SLAIN (${p.len}) · ${ok.length ? who.join(', ') + ' · ' + fmt(SLAY) + ' ×' + ok.length : 'no qualifying station'}`);
      tick(p.t,'DRAGON SLAIN', ok.length ? who.join(' · ') + ' · ' + fmt(SLAY) : `Dragon ${p.len} broken`);
      enqueue({k:'slain', t:p.t, side:p.side, len:p.len, prevSide:p.prevSide, who, amt:SLAY});
    }
    prompt = null; render();
  }

  /* ================= LED ================= */
  const ledT = () => LOCK || curT;
  function fit(){
    const box = $('ledbox'), w = box.clientWidth, h = box.clientHeight; if(!w || !h) return;
    const s = Math.min(w/1920, h/1080);
    $('stage').style.transform = `translate(${(w-1920*s)/2}px,${(h-1080*s)/2}px) scale(${s})`;
    const c = $('bg'); c.width = w; c.height = h;
  }
  new ResizeObserver(fit).observe($('ledbox')); addEventListener('resize', fit);

  // ambient embers
  const bg = $('bg').getContext('2d');
  const dots = Array.from({length:42}, () => ({x:Math.random(), y:Math.random(), r:1+Math.random()*3, v:.0002+Math.random()*.0006, a:Math.random()*.5+.1, p:Math.random()*6}));
  let bgT = 0;
  (function bgLoop(t){
    if(t - bgT > 45){ bgT = t; const W = bg.canvas.width, Hh = bg.canvas.height; bg.clearRect(0,0,W,Hh);
      dots.forEach(d => { d.y -= d.v; if(d.y < -.02) d.y = 1.02; const a = d.a*(.6+.4*Math.sin(t/900+d.p)); bg.beginPath(); bg.fillStyle = `rgba(248,221,147,${a*.5})`; bg.arc(d.x*W, d.y*Hh, d.r*W/1920*1.4, 0, 7); bg.fill(); }); }
    if(!RM) requestAnimationFrame(bgLoop);
  })(0);

  // particles (gold diamonds)
  const fx = $('fx').getContext('2d'), DPATH = new Path2D(DP); let PT = [], praf = 0;
  const GOLDS = ['#fbe4a2','#f8dd93','#e2b24b','#ffffff','#fff3c4'];
  function burst(x,y,n,sp=18){ if(RM) return; for(let i=0;i<n;i++){ const a = Math.random()*Math.PI*2, v = 4+Math.random()*sp; PT.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-4,g:.3,life:1,dec:.006+Math.random()*.012,s:10+Math.random()*16,r:Math.random()*6,vr:(Math.random()-.5)*.3,c:rnd(GOLDS)}); } if(!praf) praf = requestAnimationFrame(pstep); }
  function rain(n){ if(RM) return; for(let i=0;i<n;i++) PT.push({x:Math.random()*1920,y:-30-Math.random()*500,vx:(Math.random()-.5)*2,vy:3+Math.random()*5,g:.06,life:1,dec:.004+Math.random()*.004,s:10+Math.random()*14,r:Math.random()*6,vr:(Math.random()-.5)*.15,c:rnd(GOLDS)}); if(!praf) praf = requestAnimationFrame(pstep); }
  function pstep(){
    fx.clearRect(0,0,1920,1080); PT = PT.filter(p => p.life > 0 && p.y < 1140);
    PT.forEach(p => { p.vy += p.g; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= p.dec;
      fx.globalAlpha = Math.max(0, Math.min(1, p.life*1.4)); fx.save(); fx.translate(p.x,p.y); fx.rotate(p.r); const k = p.s/414; fx.scale(k,k); fx.translate(-108.5,-207); fx.fillStyle = p.c; fx.fill(DPATH); fx.restore(); });
    fx.globalAlpha = 1; praf = PT.length ? requestAnimationFrame(pstep) : 0;
  }
  function shake(){ if(RM) return; const g = $('game'); g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake'); }

  /* ---------- the dragon flight (procedural) ---------- */
  function flight(cv, mode, dur){
    const c = cv.getContext('2d'), king = mode === 'king';
    let D;
    let ds = (S.T[ledT()] && S.T[ledT()].dstyle) || 'gold3d'; if(ds === 'gold3d') ds = 'papercut';
    if(mode === 'alert') D = new DragonKit.Dragon({x:2350, y:600, angle:Math.PI, scale:.95, speed:1900, turn:1.4, flip:true, style:ds});
    else if(mode === 'slain') D = new DragonKit.Dragon({x:2400, y:260, angle:Math.PI + .35, scale:1.15, speed:1300, turn:3.2, flip:true, style:ds});
    else D = new DragonKit.Dragon({x:-650, y:1250, angle:-.6, scale:king ? 1.38 : 1.22, speed:1600, turn:3.4, style:ds});
    if(king) cv.style.filter = 'drop-shadow(0 0 22px rgba(248,221,147,.75)) drop-shadow(0 0 40px rgba(237,28,36,.5))';
    if(RM){ D.update(0); c.clearRect(0,0,1920,1080); D.draw(c); return; }
    let last = performance.now(), t = 0, slain = false;
    function frame(now){
      const dt = Math.min(.05, (now - last)/1000); last = now; t += dt;
      if(mode === 'alert') D.update(dt, -2400, 560 + Math.sin(t*2)*140, 1900);
      else if(mode === 'slain'){
        if(t < 1){ D.update(dt, 1450 + Math.sin(t*2)*60, 540, lerpN(1300, 600, t)); }
        else { if(!slain){ slain = true; D.slay(.46); } const gy = Math.min(1, (t-1)*1.2); cv.style.filter = `grayscale(${gy.toFixed(2)}) brightness(${(1 - gy*.3).toFixed(2)})`; D.update(dt); }
      } else {
        const h = t - 1.4;
        if(t < 1.4) D.update(dt, 1700, 230, 1600);
        else D.update(dt, 1440 + Math.sin(h*.85)*230, 560 + Math.sin(h*1.7)*170, lerpN(1100, king ? 620 : 540, Math.min(1, h)));
        D.breath = (t > 2 && t < 3.3) || (t > 4.1 && t < 4.9); D.jawT = D.breath ? .5 : (t > 1.6 && t < 2 ? .25 : 0);
        D.glow = king ? 1.4 : 1;
      }
      D.alpha = 1 - Math.max(0, Math.min(1, (t - (dur/1000 - .6))/.6));
      c.clearRect(0,0,1920,1080);
      if(mode === 'slain' && t > .95 && t < 1.45){ const k = Math.min(1,(t-.95)/.15); c.save(); c.globalAlpha = 1 - Math.max(0,(t-1.15)/.3); c.strokeStyle = '#fff'; c.lineWidth = 12; c.shadowColor = '#f8dd93'; c.shadowBlur = 40; c.beginPath(); c.moveTo(1150,220); c.lineTo(1150 + 700*k, 220 + 640*k); c.stroke(); c.restore(); }
      D.draw(c);
      if(t*1000 < dur) requestAnimationFrame(frame); else c.clearRect(0,0,1920,1080);
    }
    requestAnimationFrame(frame);
  }
  const lerpN = (a,b,t) => a + (b-a)*t;

  /* ---------- the reveal dragon: swims in place, lights up tail → head as the streak grows ---------- */
  const curStyle = () => (S && S.T[ledT()] && S.T[ledT()].dstyle) || 'gold3d';
  function makeReveal(o){
    const D = new DragonKit.Dragon({x:o.hx, y:o.cy, angle:0, scale:o.scale, N:o.N});
    const R = {D, shown:0};
    R.draw = (c, dt, target, t, prizes) => {
      const st = curStyle();
      R.shown += (target - R.shown)*Math.min(1, dt*(target < R.shown ? 6 : 2.6));
      let tail, span;
      if(st === 'gold3d' && GOLD.naturalWidth){ [tail, span] = drawGold(c, t, target, o); }
      else {
      D.style = st === 'gold3d' ? 'papercut' : st;
      D.jawT = target >= 10 ? .45 + Math.sin(t*3)*.1 : target >= 6 ? .2 : 0;
      D.glow = target >= 6 ? 1.3 : 1;
      const S = D.seg, pts = [];
      for(let i=0;i<D.N;i++){ const k = i/D.N; pts.push({x:o.hx - i*S*.985, y:o.cy + Math.sin(i*o.freq - t*2.1)*o.amp*(.35 + k*.9) + Math.sin(t*1.2)*o.amp*.2}); }
      D.setPose(pts, dt);
      c.clearRect(0,0,o.W,o.H); D.draw(c);
      const P = D.pts; tail = P[P.length-1].x - 46*D.S/.72; span = P[0].x + 108*D.HS - tail;
      }
      const bx = tail + (R.shown/10)*span;
      c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(52,68,94,.9)'; c.fillRect(bx, 0, o.W - bx, o.H); c.restore();
      if(R.shown > .03 && R.shown < 9.97){
        c.save(); c.globalCompositeOperation = 'source-atop';
        const g = c.createLinearGradient(bx - 40*o.k, 0, bx + 6, 0); g.addColorStop(0, 'rgba(248,221,147,0)'); g.addColorStop(1, 'rgba(255,243,196,.85)');
        c.fillStyle = g; c.fillRect(bx - 40*o.k, 0, 46*o.k, o.H); c.restore();
      }
      c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
      for(let k=1;k<=10;k++){
        const x = tail + (k - .5)/10*span, on = k <= target, cur = k === target;
        c.font = `${cur ? 900 : 700} ${Math.round((cur ? 26 : 17)*o.k)}px Montserrat, Arial, sans-serif`;
        c.fillStyle = on ? '#f8dd93' : 'rgba(255,255,255,.28)';
        c.fillText(k, x, o.labelY);
        if(prizes && k >= 6){ c.font = `900 ${Math.round(15*o.k)}px Montserrat, Arial, sans-serif`; c.fillStyle = on ? '#fff3c4' : 'rgba(255,255,255,.45)'; c.fillText('$' + prizes[k], x, o.labelY + 26*o.k); }
        else if(k === 6 || k === 10){ c.font = `800 ${Math.round(10*o.k)}px Montserrat, Arial, sans-serif`; c.fillStyle = on ? '#f8dd93' : 'rgba(255,255,255,.3)'; c.fillText(k === 6 ? 'DRAGON' : 'KING', x, o.labelY + 18*o.k); }
      }
      c.restore();
    };
    return R;
  }
  /* 3D gold dragon still (keyed from the client's render), swimming in place by a travelling wave across vertical strips */
  const GOLD = new Image(); GOLD.src = 'assets/gold-dragon.webp';
  function drawGold(c, t, target, o){
    const iw = GOLD.naturalWidth, ih = GOLD.naturalHeight, sc = Math.min((o.W - o.gpad*2)/iw, o.gmaxH/ih);
    const dw = iw*sc, dh = ih*sc, x0 = (o.W - dw)/2, y0 = o.gcy - dh/2, SW = 5, A = o.gamp;
    c.clearRect(0,0,o.W,o.H);
    const roar = target >= 10 ? Math.sin(t*5)*.6 : 0;
    for(let sx=0; sx<iw; sx+=SW){
      const w = Math.min(SW + 1, iw - sx), k = sx/iw, amp = A*Math.pow(1 - k, 1.25) + A*.12;
      const dy = Math.sin(k*Math.PI*3.4 - t*2.3)*amp + Math.sin(t*1.1)*A*.18 + (k > .85 ? roar*A*.25*(k - .85)/.15 : 0);
      c.drawImage(GOLD, sx, 0, w, ih, x0 + sx*sc, y0 + dy, w*sc + .6, dh);
    }
    // light sweep along the revealed part
    if(target > 0){
      const lit = x0 + (Math.min(target,10)/10)*dw, p = (t*.32) % 1.5 - .25, gx = x0 + p*dw;
      c.save(); c.globalCompositeOperation = 'source-atop';
      const g = c.createLinearGradient(gx - 90*o.k, 0, gx + 90*o.k, 0); g.addColorStop(0, 'rgba(255,250,225,0)'); g.addColorStop(.5, `rgba(255,250,225,${target >= 6 ? .55 : .35})`); g.addColorStop(1, 'rgba(255,250,225,0)');
      c.fillStyle = g; c.fillRect(x0, 0, Math.max(0, lit - x0), o.H); c.restore();
    }
    return [x0, dw];
  }
  const meterR = makeReveal({W:860, H:231, scale:.76, N:66, hx:745, cy:90, amp:18, freq:.1, labelY:192, k:1.05, gpad:30, gmaxH:168, gcy:86, gamp:10});
  const idleR = makeReveal({W:1824, H:410, scale:1.34, N:70, hx:1452, cy:150, amp:34, freq:.095, labelY:352, k:1.45, gpad:160, gmaxH:330, gcy:160, gamp:18});
  let heroLv = 0, meterPrizes = null, mTarget = 0, idlePrizes = null, ambLast = performance.now(), ambT = 0;
  requestAnimationFrame(function amb(now){
    const dt = Math.min(.05, (now - ambLast)/1000); ambLast = now; ambT += dt;
    if($('vIdle').classList.contains('on')){
      // standby loop teaches the mechanic: one section per hand, full dragon at 10, then reset
      const p = ambT % 11, tg = p < 6.6 ? Math.min(10, Math.floor(p/.6)) : p < 10 ? 10 : 0;
      idleR.draw($('idleCv').getContext('2d'), dt, tg, ambT, idlePrizes);
    }
    if($('vLive').classList.contains('on')) meterR.draw($('meterCv').getContext('2d'), dt, mTarget, ambT, meterPrizes);
    if(!RM) requestAnimationFrame(amb);
  });

  /* ---------- 3D gold dragon videos (background keyed out) ---------- */
  // 1 fly-by (Dragon Alert / One more) · 4 arrives and faces camera (Dragon 6–7) · 3 close pass (Dragon 8–9) · 2 head-on charge (King Dragon)
  const VDUR = {1:4360, 2:8040, 3:6040, 4:5760};
  const vidFor = o => o.k === 'alert' ? 1 : o.k === 'dragon' ? (o.over ? 0 : o.len >= 10 ? 2 : o.len >= 8 ? 3 : 4) : 0;
  const SAFARI = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);   // no VP9 alpha: use the black-ground mp4 with screen blend
  const vids = {}, vPark = document.createElement('div'); vPark.hidden = true; document.body.appendChild(vPark);
  if(ROLE !== 'host') [1,2,3,4].forEach(n => {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.className = 'ov-vid' + (SAFARI ? ' screen' : '');
    v.src = SAFARI ? `media/dragon-${n}.mp4` : `media/dragon-${n}.webm`; v.dataset.ok = '0';
    v.addEventListener('canplay', () => v.dataset.ok = '1', {once:true}); v.addEventListener('error', () => v.dataset.ok = 'x');
    vids[n] = v; vPark.appendChild(v); try{ v.load(); }catch(e){}
  });
  function playVid(n){
    const v = vids[n]; if(!v || v.dataset.ok === 'x' || RM) return null;
    try{ v.currentTime = 0; const p = v.play(); if(p && p.catch) p.catch(() => {}); }catch(e){ return null; }
    return v;
  }
  function parkVid(v){ try{ v.pause(); }catch(e){} vPark.appendChild(v); }

  /* ---------- overlays ---------- */
  function enqueue(o){ queue.push(o); if(!playing) next(); }
  function next(){
    const o = queue.shift(); if(!o){ playing = false; return; }
    if(o.t !== ledT() || ROLE === 'host'){ return next(); }
    playing = true;
    const d = document.createElement('div'), who = (o.who||[]).map(w => `<span>${esc(w)}</span>`).join('');
    let dur = 2600, mode = null, cls = '', html = '';
    const useVid = (S.T[ledT()] && S.T[ledT()].fx || 'video') === 'video', vn = useVid ? vidFor(o) : 0;
    if(o.k === 'alert'){
      cls = 'alert'; mode = 'alert'; dur = vn ? VDUR[vn] : 2600; sfx.alert();
      html = `<div class="ov-k">${dmd()}${o.t} · ${SIDE[o.side]} ×${o.len}${dmd()}</div><div class="ov-m gold mid">${o.len === 4 ? 'DRAGON ALERT' : 'ONE MORE!'}</div><div class="ov-s">${o.len === 4 ? 'Two more wins for a <b>dragon</b>' : 'Follow <b>' + SIDE[o.side] + '</b> or slay with <b>' + SIDE[o.side === 'B' ? 'P' : 'B'] + '</b>?'}</div>`;
    } else if(o.k === 'dragon'){
      const king = o.len >= 10; cls = 'dragon'; mode = king ? 'king' : 'dragon'; dur = vn ? Math.max(6000, VDUR[vn]) : 6400; sfx.roar();
      html = `<div class="ov-k">${dmd()}${o.t} · ${SIDE[o.side]} DRAGON${dmd()}</div><div class="ov-m gold${king ? ' king' : ''}">${king ? 'KING DRAGON' : 'DRAGON ' + o.len}</div>` +
        (o.over ? `<div class="none">DRAGON ${o.len} · PAST KING DRAGON</div>` : o.who.length ? `<div class="wins">${who}</div><div class="prize">${fmt(o.amt)} <small>${o.who.length > 1 ? 'EACH STATION' : 'VOUCHER'}</small></div>` : `<div class="none">NO HUNTERS ON THIS ONE · NEXT HAND ${fmt(o.next)}</div>`);
      setTimeout(() => { shake(); burst(1000, 470, 130, 22); }, 1400); setTimeout(() => rain(king ? 240 : 120), 1800);
    } else if(o.k === 'slain'){
      cls = 'slain'; mode = 'slain'; dur = 5600; sfx.slain();
      html = `<div class="ov-k">${dmd()}${o.t} · ${SIDE[o.prevSide]} DRAGON ${o.len} BROKEN${dmd()}</div><div class="ov-m silver">DRAGON SLAIN</div>` +
        (o.noReward ? `<div class="none">SLAYER PRIZE STARTS AT DRAGON ${o.from}</div>` : o.who.length ? `<div class="ov-s">${SIDE[o.side]} slays the dragon</div><div class="wins">${who}</div><div class="prize">${fmt(o.amt)} <small>${o.who.length > 1 ? 'EACH STATION' : 'VOUCHER'}</small></div>` : `<div class="none">NO QUALIFYING SLAYERS</div>`);
      setTimeout(() => { shake(); burst(1460, 560, 90, 16); }, 1000);
    }
    d.className = 'ov ' + cls;
    d.innerHTML = `<div class="ov-bg"></div>${cls === 'alert' ? '<div class="ov-band"></div>' : '<div class="ov-rays"></div>'}<canvas class="ov-cv" width="1920" height="1080"></canvas>${cls !== 'alert' ? '<div class="ov-ring"></div><div class="ov-ring r2"></div>' : ''}<div class="ov-flare"></div><div class="ov-c">${html}</div>`;
    $('ovs').appendChild(d);
    requestAnimationFrame(() => d.classList.add('play'));
    const cv = d.querySelector('.ov-cv'); let vEl = null;
    if(vn && (vEl = playVid(vn))){ cv.replaceWith(vEl); } else flight(cv, mode, dur);
    setTimeout(() => { d.classList.add('fade'); setTimeout(() => { if(vEl) parkVid(vEl); d.remove(); next(); }, 500); }, dur);
  }

  /* ---------- LED render ---------- */
  let prevPos = {};
  const ROWH = 74, TOPN = 11;
  function renderRank(T){
    const box = $('rlist'), rk = ranking();
    if(!rk.length){ box.innerHTML = `<div class="empty">${dmd()}CATCH A DRAGON TO GET ON THE BOARD</div>`; prevPos = {}; return; }
    box.querySelector('.empty')?.remove();
    const here = new Set(T.st.filter(s => s.on && s.mb).map(s => 'MB' + s.mb));
    const shown = rk.slice(0, TOPN), keep = new Set(shown.map(r => r.key));
    box.querySelectorAll('.row').forEach(el => { if(!keep.has(el.dataset.k)) el.remove(); });
    shown.forEach((r,i) => {
      let el = box.querySelector(`.row[data-k="${CSS.escape(r.key)}"]`), nw = false;
      if(!el){ el = document.createElement('div'); el.dataset.k = r.key; box.appendChild(el); nw = true; }
      const prev = prevPos[r.key], up = prev != null && prev > i;
      el.className = 'row' + (nw ? ' enter' : '') + (i < 3 ? ' r' + (i+1) : '') + (here.has(r.key) ? ' here' : '');
      if(up){ void el.offsetWidth; el.classList.add('climb'); setTimeout(() => el.classList.remove('climb'), 2400); }
      const meta = [r.table, r.dragons ? r.dragons + ' DRAGONS' : '', r.slays ? r.slays + ' SLAYS' : ''].filter(Boolean).join(' · ');
      el.innerHTML = `<span class="rk">${i+1}</span><span class="nm"><b>${esc(r.label)}</b><small>${meta}</small></span><span class="amt">${fmt(r.won)}</span><span class="mv${up ? ' up' : ''}">${up ? UP + (prev - i) : prev == null ? 'NEW' : '–'}</span>`;
      el.style.transform = `translateY(${i*ROWH}px)`;
    });
    prevPos = {}; rk.forEach((r,i) => prevPos[r.key] = i);
  }

  let lastLen = -1;
  function renderLed(){
    const t = ledT(), T = S.T[t], L = sch(t).lad;
    $('ledCap').textContent = `LED 16:9 · ${t}`;
    $('vIdle').classList.toggle('on', T.phase === 'idle'); $('vLive').classList.toggle('on', T.phase !== 'idle');
    $('idRules').innerHTML = `<div class="glass">${dmd()}<b>FOLLOW THE DRAGON</b><span>${fmt(L[6])} → ${fmt(L[10])} per station</span></div><div class="glass">${dmd()}<b>SLAY THE DRAGON</b><span>${fmt(SLAY)} when it reaches ${sch(t).slay}+</span></div><div class="glass">${dmd()}<b>QUALIFYING BET</b><span>$100 + $15 side bet, every hand</span></div>`;
    idlePrizes = L;
    const len = T.len, S2 = T.side; heroLv = T.phase === 'idle' ? 0 : len;
    const hero = $('hero'); hero.className = 'hero glass' + (len >= 6 ? ' drag lv6 lv4' : len >= 4 ? ' alert lv4' : '');
    $('heroCap').textContent = `CURRENT STREAK · ${t}`;
    $('sk').innerHTML = S2 ? `<span class="s ${S2}">${SIDE[S2]}</span><span class="n${len !== lastLen ? ' bump' : ''}">×${len}</span>` : `<span class="w">WAITING FOR THE FIRST HAND</span>`;
    lastLen = len;
    const m = $('skMsg'); m.textContent = !S2 ? 'Dragon = 6 in a row' : len >= 10 ? 'King Dragon!' : len >= 6 ? 'The dragon is flying · Follow or slay?' : len === 5 ? 'One more for a dragon' : len === 4 ? 'Dragon alert' : 'Dragon = 6 in a row';
    m.className = 'sk-msg' + (len >= 4 ? ' hot' : '');
    mTarget = T.phase === 'idle' ? 0 : Math.min(len, 10);
    meterPrizes = L; renderRank(T); document.documentElement.classList.toggle('gold3d', curStyle() === 'gold3d');
    const fm = T.feed || 'green'; if($('feed').dataset.mode !== fm) $('feed').dataset.mode = fm;
    $('feedTag').textContent = `SYSTEM SCREEN · ${t} · SAMPLE`;
    const tk = T.ticker.length ? T.ticker : [{k:'LIVE', v:'Banker or Player wins 6 in a row = DRAGON · Qualifying bet: $100 + $15 side bet on every hand of the streak'}];
    const items = tk.map(x => `<span><b>${esc(x.k)}</b>${esc(x.v)}</span>`).join('');
    $('tk').innerHTML = items + items; $('tk').style.setProperty('--dur', Math.max(26, tk.length*10) + 's');
  }

  /* ================= dealer render ================= */
  function renderLog(){ $('log').innerHTML = S.log.length ? S.log.slice(0,50).map(l => `<div><time>${l.t}</time><span>${esc(l.m)}</span></div>`).join('') : '<div><time>—</time><span>No events yet</span></div>'; }
  let mbSig = '';
  function renderMbs(force){
    const T = S.T[curT], box = $('mbs'), act = T.st.filter(s => s.on);
    const sig = curT + '|' + act.map(s => s.n + ':' + s.mb).join(',');
    if(!force && (sig === mbSig || box.contains(document.activeElement))) return; mbSig = sig;
    box.innerHTML = act.length ? act.map(s => `<div class="mbrow"><label for="mb-${curT}-${s.n}">ST ${s.n}</label><input id="mb-${curT}-${s.n}" data-n="${s.n}" inputmode="numeric" autocomplete="off" placeholder="Enter guest MB#" value="${esc(s.mb)}"><span class="ok">${s.mb ? '✓ ' + esc(mask(s.mb)) : ''}</span></div>`).join('') + '<div class="hint">Read the last 4 digits back to the guest. The LED shows only MB ••1234.</div>' : '<div class="hint">Tap a seat above to seat a guest, then enter their MB#.</div>';
  }
  function render(forceMb){
    const T = S.T[curT], sc = sch(curT);
    $('tabs').hidden = !!LOCK;
    $('tabBC1').setAttribute('aria-pressed', curT === 'BC1'); $('tabBC2').setAttribute('aria-pressed', curT === 'BC2');
    $('hTitle').textContent = `DRAGON HUNT · ${curT}`;
    $('btnLive').textContent = T.phase === 'idle' ? 'Turn on LED · Start Dragon Hunt' : 'Return LED to standby';
    $('btnLive').className = 'pbtn wide' + (T.phase === 'idle' ? ' gold' : '');
    const paid = totalPaid(); $('capTxt').textContent = `${fmt(paid)} / ${fmt(CAP)}`; $('capBar').style.width = Math.min(100, paid/CAP*100) + '%';
    $('scheme').value = T.scheme; $('dstyle').value = T.dstyle || 'gold3d'; $('feedMode').value = T.feed || 'green'; $('fxMode').value = T.fx || 'video';
    $('handTxt').textContent = 'Hand ' + T.res.length;
    $('stTxt').textContent = T.side ? `${SIDE[T.side]} ×${T.len}` : '—'; $('stTxt').className = T.side || '';
    const ch = $('stChip'); ch.className = 'chipst' + (T.len >= 6 ? ' dragon' : T.len >= 4 ? ' hot' : '');
    ch.textContent = T.len >= 10 ? 'KING DRAGON' : T.len >= 6 ? 'DRAGON ' + T.len : T.len >= 4 ? 'DRAGON ALERT · check the roadmap' : 'NORMAL';
    const pk = prompt && prompt.t === curT;
    $('seats').innerHTML = T.st.map(s => `<button type="button" class="seat${s.on ? ' on' : ''}${pk && prompt.sel.has(s.n) ? ' pick' : ''}${pk && s.on && !prompt.sel.has(s.n) ? ' choosable' : ''}" id="seat-${curT}-${s.n}" data-n="${s.n}" aria-pressed="${pk ? prompt.sel.has(s.n) : s.on}"><span>ST ${s.n}</span><b>${pk && prompt.sel.has(s.n) ? '✓' : s.on ? '●' : '–'}</b><span>${s.on ? (s.mb ? esc(mask(s.mb).replace('MB ','')) : 'seated') : 'open'}</span></button>`).join('');
    renderMbs(forceMb);
    const can = T.phase === 'live' && !prompt && OWN.includes(curT);
    ['rB','rP','rT'].forEach(id => $(id).disabled = !can);
    $('btnUndo').disabled = !undo[curT].length || !OWN.includes(curT);
    $('prompt').hidden = !prompt;
    if(prompt){
      if(prompt.t !== curT){ curT = prompt.t; return render(true); }
      const ps = SIDE[prompt.side];
      $('pTitle').textContent = prompt.kind === 'follow' ? `${ps} DRAGON ${prompt.len} · ${fmt(prompt.amt)} / station` : `DRAGON SLAIN (${prompt.len}) · ${fmt(SLAY)} / station`;
      $('pTxt').innerHTML = `Open each seat's bet history on the table. Tap the seats that <b>bet ${ps} this hand</b> and placed a <b>qualifying bet ($100 + $15 side bet) on every hand of the streak</b>. Guests who joined mid-streak do not count.<br>Selected: <b>${prompt.sel.size ? [...prompt.sel].sort().map(n => 'ST ' + n).join(', ') : 'none yet'}</b>`;
      const w = $('pWarn'); w.hidden = prompt.amt < 138; w.textContent = 'Prizes of $138 or more: record in CMS and get Supervisor approval before handing over.';
    }
    $('demoCard').hidden = ROLE !== 'demo';
    renderLed(); renderLog();
  }

  /* ---------- wiring ---------- */
  $('btnLive').onclick = goLive;
  $('tabBC1').onclick = () => { if(!prompt && !LOCK){ curT = 'BC1'; queue = []; render(true); } };
  $('tabBC2').onclick = () => { if(!prompt && !LOCK){ curT = 'BC2'; queue = []; render(true); } };
  $('seats').addEventListener('click', e => { const b = e.target.closest('.seat'); if(b && OWN.includes(curT)) toggleSeat(curT, +b.dataset.n); });
  $('mbs').addEventListener('change', e => { const i = e.target.closest('input'); if(i) setMb(curT, +i.dataset.n, i.value); });
  $('mbs').addEventListener('keydown', e => { if(e.key === 'Enter'){ const i = e.target.closest('input'); if(i){ setMb(curT, +i.dataset.n, i.value); i.blur(); } } });
  document.querySelectorAll('.rbtn').forEach(b => b.onclick = () => result(curT, b.dataset.r));
  $('btnUndo').onclick = doUndo;
  $('btnConfirm').onclick = () => confirm(false);
  $('btnNone').onclick = () => confirm(true);
  $('fxMode').onchange = () => { OWN.forEach(t => S.T[t].fx = $('fxMode').value); log('Dragon moments: ' + $('fxMode').value); render(); };
  $('feedMode').onchange = () => { OWN.forEach(t => S.T[t].feed = $('feedMode').value); log('System screen window: ' + $('feedMode').value); render(); };
  $('dstyle').onchange = () => { OWN.forEach(t => S.T[t].dstyle = $('dstyle').value); log('Dragon style: ' + $('dstyle').value); render(); };
  $('scheme').onchange = () => { OWN.forEach(t => S.T[t].scheme = $('scheme').value); log('Prize plan: ' + SCHEMES[$('scheme').value].name); render(); };
  $('btnSound').onclick = () => { sound = !sound; ac(); if(ctx && ctx.state === 'suspended') ctx.resume(); $('btnSound').textContent = 'Sound: ' + (sound ? 'on' : 'off'); $('btnSound').setAttribute('aria-pressed', sound); };
  $('btnFs').onclick = () => { try{ const p = $('ledbox').requestFullscreen && $('ledbox').requestFullscreen(); if(p && p.catch) p.catch(() => {}); }catch(e){} };
  $('btnReset').onclick = () => { autoRun++; fresh(OWN); $('ovs').innerHTML = ''; playing = false; narrate('Reset. Press “Run auto demo” or operate it yourself.'); $('btnAuto').disabled = false; render(true); };

  /* ---------- export to Excel ---------- */
  // Outside claude.ai there is no `downloads` capability: fall back to a normal browser download.
  const localDownloads = {save:async ({filename, data}) => { const u = URL.createObjectURL(new Blob([data])); const a = document.createElement('a'); a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); return {status:'saved'}; }};
  function loadXLSX(){
    if(window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = () => res(window.XLSX); s.onerror = () => rej(new Error('load')); document.head.appendChild(s); });
  }
  async function exportXlsx(){
    const msg = $('expMsg'), btn = $('btnExport'); btn.disabled = true; msg.textContent = 'Preparing the workbook…';
    try{
      let dl = null; try{ dl = window.claude ? await claude.use('downloads') : localDownloads; }catch(e){ dl = null; }
      if(!dl){ msg.textContent = 'Saving files isn’t available in this view. Open the link in claude.ai while signed in.'; return; }
      const X = await loadXLSX();
      const day = stamp().slice(0,10), wb = X.utils.book_new();
      const sheet = (name, rows, widths) => { const ws = X.utils.aoa_to_sheet(rows); ws['!cols'] = widths.map(w => ({wch:w})); X.utils.book_append_sheet(wb, ws, name); };
      const hands = [], prizes = [];
      TABLES.forEach(t => { (S.T[t].hist || []).forEach(x => hands.push([t, x.n, x.ts, x.r, x.side ? `${x.side} ×${x.len}` : '', x.ev, x.paid])); (S.T[t].awards || []).forEach(a => prizes.push([a.ts, a.table, a.hand, a.kind, a.len, a.side, a.seat, a.mb, a.amount, a.handover])); });
      hands.sort((a,b) => a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0); prizes.sort((a,b) => a[0] < b[0] ? -1 : 1);
      const rk = ranking();
      const sum = [['Dragon Hunt · session export'], ['Exported', stamp()], ['Prize plan', TABLES.map(t => `${t}: ${sch(t).name}`).join(' · ')], ['Session cap', CAP], ['Total paid', totalPaid()], [],
        ['Table', 'Hands', 'Banker', 'Player', 'Tie', 'Dragon hands (6+)', 'Prizes paid', 'Paid ($)']];
      TABLES.forEach(t => { const T = S.T[t], n = {B:0,P:0,T:0}; T.res.forEach(r => n[r]++);
        sum.push([t, T.res.length, n.B, n.P, n.T, (T.hist || []).filter(x => /^Dragon \d|^King/.test(x.ev)).length, (T.awards || []).length, T.paid || 0]); });
      sheet('Summary', sum, [18, 22, 12, 12, 10, 14, 13, 12]);
      sheet('Hands', [['Table', 'Hand', 'Time', 'Result', 'Streak after hand', 'Event', 'Prizes this hand'], ...hands], [8, 7, 20, 10, 18, 34, 34]);
      sheet('Prizes', [['Time', 'Table', 'Hand', 'Type', 'Dragon length', 'Dragon side', 'Seat', 'MB#', 'Amount ($)', 'Handover'], ...prizes], [20, 8, 7, 18, 14, 12, 8, 14, 11, 26]);
      sheet('Top Hunters', [['Rank', 'Member', 'MB#', 'Last table', 'Dragons followed', 'Dragons slain', 'Total won ($)'], ...rk.map((r,i) => [i+1, r.label, r.mb || '', r.table, r.dragons, r.slays, r.won])], [7, 16, 14, 11, 16, 14, 14]);
      sheet('Audit log', [['Time', 'Event'], ...S.log.slice().reverse().map(l => [l.ts || l.t, l.m])], [20, 80]);
      const buf = X.write(wb, {bookType:'xlsx', type:'array'});
      await dl.save({filename:`dragon-hunt-${day}.xlsx`, data:buf});
      msg.textContent = `Saved dragon-hunt-${day}.xlsx · ${hands.length} hands, ${prizes.length} prizes.`; log('History exported to Excel');
    }catch(e){
      const c = e && e.code;
      msg.textContent = c === 'declined' ? 'Export cancelled.' : c === 'rate_limited' ? 'A save prompt is already open. Finish it, then try again.' : e && e.message === 'load' ? 'The Excel library didn’t load. Check the connection and try again.' : 'Export isn’t available here (' + (c || 'error') + ').';
    }finally{ btn.disabled = false; }
  }
  $('btnExport').onclick = exportXlsx;
  async function exportWinners(){
    const msg = $('expMsg'), btn = $('btnWinners'); btn.disabled = true; msg.textContent = 'Preparing the winners file…';
    try{
      let dl = null; try{ dl = window.claude ? await claude.use('downloads') : localDownloads; }catch(e){ dl = null; }
      if(!dl){ msg.textContent = 'Saving files isn’t available in this view. Open the link in claude.ai while signed in.'; return; }
      const wins = []; TABLES.forEach(t => (S.T[t].awards || []).forEach(a => wins.push(a)));
      if(!wins.length){ msg.textContent = 'No prizes have been paid yet this session, so there is nothing to export.'; return; }
      wins.sort((a,b) => a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0);
      const X = await loadXLSX(), wb = X.utils.book_new(), day = stamp().slice(0,10);
      const sheet = (name, rows, widths) => { const ws = X.utils.aoa_to_sheet(rows); ws['!cols'] = widths.map(w => ({wch:w})); X.utils.book_append_sheet(wb, ws, name); };
      const memberOf = a => a.mb || `${a.table} ${a.seat} (no MB#)`;
      sheet('Win history', [['#', 'Time', 'Table', 'Hand', 'Member MB#', 'Seat', 'Prize type', 'Dragon', 'Dragon side', 'Amount ($)', 'Handover'],
        ...wins.map((a,i) => [i+1, a.ts, a.table, a.hand, memberOf(a), a.seat, a.kind, a.len >= 10 ? 'King Dragon (10)' : 'Dragon ' + a.len, a.side, a.amount, a.handover]),
        [], ['', '', '', '', '', '', '', '', 'Total', wins.reduce((s,a) => s + a.amount, 0), '']], [5, 20, 7, 7, 18, 7, 18, 16, 12, 11, 26]);
      const m = {};
      wins.forEach(a => { const k = memberOf(a), r = m[k] || (m[k] = {mb:k, n:0, f:0, s:0, tot:0, tables:new Set(), first:a.ts, last:a.ts});
        r.n++; a.kind.startsWith('Follow') ? r.f++ : r.s++; r.tot += a.amount; r.tables.add(a.table); r.last = a.ts; });
      const ms = Object.values(m).sort((a,b) => b.tot - a.tot || b.n - a.n);
      sheet('Members', [['Rank', 'Member MB#', 'Prizes won', 'Dragons followed', 'Dragons slain', 'Total ($)', 'Tables', 'First win', 'Last win'],
        ...ms.map((r,i) => [i+1, r.mb, r.n, r.f, r.s, r.tot, [...r.tables].join(', '), r.first, r.last])], [6, 18, 11, 16, 14, 11, 10, 20, 20]);
      await dl.save({filename:`dragon-hunt-winners-${day}.xlsx`, data:X.write(wb, {bookType:'xlsx', type:'array'})});
      msg.textContent = `Saved dragon-hunt-winners-${day}.xlsx · ${wins.length} prizes, ${ms.length} members.`; log('Winners exported to Excel');
    }catch(e){
      const c = e && e.code;
      msg.textContent = c === 'declined' ? 'Export cancelled.' : c === 'rate_limited' ? 'A save prompt is already open. Finish it, then try again.' : e && e.message === 'load' ? 'The Excel library didn’t load. Check the connection and try again.' : 'Export isn’t available here (' + (c || 'error') + ').';
    }finally{ btn.disabled = false; }
  }
  $('btnWinners').onclick = exportWinners;

  /* ---------- auto demo ---------- */
  function narrate(t){ $('narr').textContent = t; }
  function flash(id){ const el = $(id); if(el){ el.animate([{boxShadow:'0 0 0 0 rgba(248,221,147,0)'},{boxShadow:'0 0 0 5px rgba(248,221,147,.9)'},{boxShadow:'0 0 0 0 rgba(248,221,147,0)'}], {duration:600}); } }
  async function auto(){
    const run = ++autoRun; fresh(OWN); render(true); $('btnAuto').disabled = true;
    if(!sound){ $('btnSound').click(); }
    const wait = ms => new Promise((res,rej) => setTimeout(() => run === autoRun ? res() : rej('stop'), ms));
    const idle = async () => { while(playing || queue.length) await wait(250); await wait(300); };
    const seat = async (n,mb) => { flash(`seat-BC1-${n}`); await wait(300); toggleSeat('BC1',n); await wait(250); setMb('BC1',n,mb); await wait(250); };
    const hand = async (r,ms=550) => { flash('r'+r); await wait(200); result('BC1',r); await wait(ms); };
    const choose = async (nums, txt) => { narrate(txt); await wait(1600); for(const n of nums){ flash(`seat-BC1-${n}`); await wait(220); toggleSeat('BC1',n); await wait(200); } await wait(400); flash(nums.length ? 'btnConfirm' : 'btnNone'); await wait(300); confirm(!nums.length); await idle(); };
    try{
      curT = 'BC1'; narrate('The LED is on standby: three-line rules, the Plan A + B prize ladder and the dragon.'); await wait(3000);
      flash('btnLive'); goLive(); await wait(800);
      narrate('Check-in: the dealer taps each occupied seat and enters the MB#. The LED shows only the last 4 digits on Top Hunters.');
      await seat(1,'10234567'); await seat(2,'10558812'); await seat(3,'10773390'); await seat(4,'10419021');
      narrate('The dealer enters each result from the table roadmap. The Big Road on the LED follows.');
      await hand('P'); await hand('B'); await hand('B'); await hand('B');
      narrate('Banker wins a 4th in a row: DRAGON ALERT. The dragon flies across the LED.'); await hand('B'); await idle();
      narrate('Banker 5: ONE MORE! Guests choose to follow or slay the dragon.'); await hand('B'); await idle();
      narrate('A Tie does not break the streak.'); await hand('T',900);
      narrate('Banker 6: DRAGON! The dealer opens the bet history on the table to pick the seats.'); await hand('B',400);
      await choose([1,3], 'Seats 1 and 3 bet Banker with $100 + side bet on every hand → select and confirm. The dragon flies onto the LED with the winners.');
      await hand('B',400); await choose([1,3], 'Dragon 7: seats 1 and 3 keep following → $68 each, climbing the Top Hunters board.');
      await hand('B',400); await choose([1,3,4], 'Dragon 8: seat 4 switched to Banker and bet every hand → 3 seats win $88.');
      narrate('Player wins: dragon 8 is broken. Seat 2 bet Player through the streak → Slay $68.');
      await hand('P',400); await choose([2], 'DRAGON SLAIN · seat 2 wins $68. A new streak begins.');
      narrate(`Demo finished: ${fmt(totalPaid())} paid against the ${fmt(CAP)} cap. Keep entering results, or try “Undo last result”.`);
    }catch(e){}
    if(run === autoRun) $('btnAuto').disabled = false;
  }
  $('btnAuto').onclick = auto;

  /* ================= 2-device sync: live/BC1, live/BC2 ================= */
  const evLog = {BC1:[], BC2:[]}, lastSeen = {BC1:0, BC2:0}, refs = {}, lastPushed = {}, writing = {}, dirty = {};
  let applying = false, pushTimer = null, syncChip = null;
  if(ROLE !== 'demo'){
    syncChip = document.createElement('span'); syncChip.className = 'sync'; syncChip.textContent = 'Connecting…';
    if(ROLE === 'host') document.querySelector('.hcard .hrow').appendChild(syncChip); else document.body.appendChild(syncChip);
  }
  function setSync(t, ok){ if(syncChip){ syncChip.textContent = t; syncChip.className = 'sync ' + (ok ? 'ok' : 'bad'); } }
  const payload = t => ({T:S.T[t], events:evLog[t].slice(-12)});
  async function push(t){
    if(!refs[t]) return; const body = JSON.stringify(payload(t)); if(body === lastPushed[t]) return;
    if(writing[t]){ dirty[t] = true; return; } writing[t] = true;
    try{ await refs[t].set(JSON.parse(body)); lastPushed[t] = body; setSync('Synced ✓', true); }
    catch(e){ setSync('Sync error (' + ((e && e.code) || 'unknown') + ')', false); }
    writing[t] = false; if(dirty[t]){ dirty[t] = false; push(t); }
  }
  function schedule(){ if(ROLE !== 'host' || applying) return; clearTimeout(pushTimer); pushTimer = setTimeout(() => OWN.forEach(push), 200); }
  const baseRender = render; render = function(){ const r = baseRender.apply(this, arguments); schedule(); return r; };
  const baseEnqueue = enqueue;
  enqueue = function(o){ if(ROLE === 'host' && OWN.includes(o.t)){ evLog[o.t].push({seq:Date.now()*1000 + (evLog[o.t].length % 1000), o}); evLog[o.t] = evLog[o.t].slice(-12); schedule(); } return baseEnqueue(o); };
  function applyRemote(t, d, play){
    applying = true; S.T[t] = JSON.parse(JSON.stringify(d.T || mkT(t))); baseRender(t === curT); applying = false;
    if(!play) return; const evs = d.events || [];
    if(!lastSeen[t]){ lastSeen[t] = evs.length ? evs[evs.length-1].seq : 1; return; }
    evs.forEach(e => { if(e.seq > lastSeen[t]){ lastSeen[t] = e.seq; if(t === ledT()) baseEnqueue(JSON.parse(JSON.stringify(e.o))); } });
  }
  async function syncInit(){
    if(ROLE === 'demo') return;
    if(ROLE === 'display'){
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tapstart';
      b.innerHTML = `TAP TO START THE ${LOCK} LED<small>Turns on sound and full screen. This screen follows the dealer iPad automatically.</small>`;
      b.onclick = () => { sound = true; ac(); if(ctx && ctx.state === 'suspended') ctx.resume(); try{ const el = document.documentElement; const p = el.requestFullscreen ? el.requestFullscreen() : (el.webkitRequestFullscreen && el.webkitRequestFullscreen()); if(p && p.catch) p.catch(() => {}); }catch(e){} b.remove(); };
      document.body.appendChild(b);
    }
    let db = null; try{ db = await claude.use('db'); }catch(e){ db = null; }
    if(!db){ setSync('Cannot sync · open this link signed in to claude.ai', false); return; }
    TABLES.forEach(t => refs[t] = db.doc('live/' + t));
    for(const t of OWN){
      try{ const snap = await refs[t].get();
        if(snap.exists){ const d = snap.data(); evLog[t] = JSON.parse(JSON.stringify(d.events || [])); applyRemote(t, d, false); lastPushed[t] = JSON.stringify(payload(t)); }
        else await push(t);
        setSync('Synced ✓', true);
      }catch(e){ setSync('Read error (' + ((e && e.code) || 'unknown') + ')', false); }
    }
    TABLES.filter(t => !OWN.includes(t)).forEach(t => {
      refs[t].onSnapshot(s => { if(s.exists) applyRemote(t, s.data(), ROLE === 'display'); if(ROLE === 'display') setSync('● LIVE', true); },
        e => setSync('Connection lost (' + ((e && e.code) || '') + ') · reload the page', false));
    });
  }

  if(ROLE === 'display') document.title = `Dragon Hunt LED ${LOCK}`;
  fresh();
  if(ROLE === 'demo'){
    // example rows from BC2 so the board opens populated (demo only)
    S.T.BC2.stats = {MB10661177:{mb:'10661177', label:'MB ••1177', won:136, dragons:2, slays:0, table:'BC2', at:1}, MB10328840:{mb:'10328840', label:'MB ••8840', won:68, dragons:1, slays:0, table:'BC2', at:2}};
    S.T.BC2.paid = 204; S.T.BC1.feed = S.T.BC2.feed = 'preview';
  }
  fit(); render(true); renderLog();
  syncInit();
})();
