/* ===== Procedural dragon: path-following serpent body, verlet whiskers & tail fur, swimming legs, fire ===== */
const DragonKit = (() => {
  const TAU = Math.PI * 2;
  const PAL = {
    classic:{deep:'#5e0714', base:'#a5122b', mid:'#cf2238', hi:'#ff6b5e', rim:'#ffb199',
      belly1:'#f8e3b0', belly2:'#d9a94f', bellyLine:'rgba(120,70,20,.55)',
      fin1:'#fff1c2', fin2:'#f1ca6d', fin3:'#e0602a', fin4:'#a5122b',
      horn1:'#fff6dc', horn2:'#d9b26a', claw:'#fff1cf', eye:'#ffe27a', gold:'#f1ca6d', goldHi:'#fff1c2'},
    papercut:{deep:'#6b0616', base:'#b0122c', mid:'#b8162f', hi:'#c8243a', rim:'#f8dd93',
      belly1:'#fbe4a2', belly2:'#f1ca6d', bellyLine:'rgba(110,6,22,.75)',
      fin1:'#f8dd93', fin2:'#f1ca6d', fin3:'#b0122c', fin4:'#8a0b20',
      horn1:'#fbe4a2', horn2:'#c99a3e', claw:'#f8dd93', eye:'#ffe27a', gold:'#f4cf72', goldHi:'#fff3c4'}
  };
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  const lerp = (a,b,t) => a + (b-a)*t;

  function rope(n, len, x, y){ const p = []; for(let i=0;i<n;i++) p.push({x:x - i*len, y, px:x - i*len, py:y}); return {p, len}; }
  function stepRope(r, ax, ay, drag, gx, gy){
    const p = r.p; p[0].x = ax; p[0].y = ay; p[0].px = ax; p[0].py = ay;
    for(let i=1;i<p.length;i++){ const q = p[i], vx = (q.x - q.px)*drag, vy = (q.y - q.py)*drag; q.px = q.x; q.py = q.y; q.x += vx + gx; q.y += vy + gy; }
    for(let k=0;k<3;k++) for(let i=1;i<p.length;i++){ const a = p[i-1], b = p[i]; let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx,dy) || 1; const f = (d - r.len)/d; b.x -= dx*f; b.y -= dy*f; }
  }

  class Dragon {
    get C(){ return PAL[this.style] || PAL.classic; }
    constructor(o = {}){
      this.S = o.scale || 1; this.N = o.N || 92; this.seg = 13*this.S; this.W = 68*this.S;
      this.flip = o.flip ? -1 : 1; this.style = o.style || 'papercut'; this.HS = 1.32*this.S; this.speed = o.speed || 520; this.turn = o.turn || 4.2;
      const x = o.x ?? 0, y = o.y ?? 0, a = o.angle ?? 0;
      this.hx = x; this.hy = y; this.vx = Math.cos(a)*this.speed; this.vy = Math.sin(a)*this.speed;
      this.hist = []; for(let i=0;i<=this.N*this.seg/3+20;i++) this.hist.push({x:x - Math.cos(a)*i*3, y:y - Math.sin(a)*i*3});
      this.pts = []; this.t = 0; this.jaw = 0; this.jawT = 0; this.fire = []; this.breath = false; this.alpha = 1; this.gray = 0; this.glow = 1;
      this.whisk = [rope(26, 11*this.S, x, y), rope(20, 10*this.S, x, y)];
      this.tuft = [0,1,2,3,4,5,6].map(() => rope(10, 10*this.S, x, y));
      this.mane = [0,1,2,3,4,5,6,7,8].map(() => rope(11, 11*this.S, x, y));
      this.rag = null;
      this.sample();
    }
    prof(t){ // body half-width factor along length (0 head … 1 tail)
      if(t < .05) return .58 + t/.05*.2;
      if(t < .38) return .78 + (t-.05)/.33*.22;
      return Math.max(.1, Math.pow(1 - (t-.38)/.62, .75));
    }
    steer(tx, ty, dt, speed){
      const sp = speed ?? this.speed, dx = tx - this.hx, dy = ty - this.hy, d = Math.hypot(dx,dy) || 1;
      const v = lerp(Math.hypot(this.vx,this.vy), sp*clamp(d/220, .6, 1), clamp(dt*2, 0, 1));
      const maxT = Math.min(this.turn, v/(this.W*2.6));               // minimum turning radius: never folds the body
      const want = Math.atan2(dy, dx); let cur = Math.atan2(this.vy, this.vx);
      let da = ((want - cur + Math.PI*3) % TAU) - Math.PI;
      let w = clamp(da*2.2, -maxT, maxT) + Math.sin(this.t*2.3)*.3*maxT; // desired turn rate + gentle weave
      w = clamp(w, -maxT, maxT);
      this.av = lerp(this.av || 0, w, clamp(dt*3.5, 0, 1));             // eased angular velocity = no jerks
      cur += this.av*dt;
      this.vx = Math.cos(cur)*v; this.vy = Math.sin(cur)*v;
    }
    setPose(pts, dt){ this.t += dt; this.pts = pts; this.hx = pts[0].x; this.hy = pts[0].y; this.vx = 0; this.vy = 0; this.secondary(dt); }
    update(dt, tx, ty, speed){
      this.t += dt;
      if(this.rag){ this.stepRag(dt); this.secondary(dt); return; }
      if(tx != null) this.steer(tx, ty, dt, speed);
      this.hx += this.vx*dt; this.hy += this.vy*dt;
      const h0 = this.hist[0];
      if(Math.hypot(this.hx - h0.x, this.hy - h0.y) > 2) this.hist.unshift({x:this.hx, y:this.hy}); else { h0.x = this.hx; h0.y = this.hy; }
      this.sample();
      this.secondary(dt);
    }
    sample(){ // place body points along the head's path at equal arc length
      const H = this.hist, out = [{x:this.hx, y:this.hy}]; let need = this.seg, acc = 0, j = 0;
      let ax = this.hx, ay = this.hy;
      while(out.length < this.N && j < H.length - 1){
        const b = H[j+1], sx = b.x - ax, sy = b.y - ay, L = Math.hypot(sx, sy);
        if(acc + L >= need){ const f = (need - acc)/L; ax += sx*f; ay += sy*f; out.push({x:ax, y:ay}); acc = 0; need = this.seg; }
        else { acc += L; ax = b.x; ay = b.y; j++; }
      }
      while(out.length < this.N){ const a = out[out.length-1], b = out[out.length-2] || {x:a.x+1, y:a.y}; out.push({x:a.x*2 - b.x, y:a.y*2 - b.y}); }
      for(let k=0;k<3;k++) for(let i=1;i<out.length-1;i++){ const a = out[i-1], b = out[i+1], q = out[i]; q.x = q.x*.5 + (a.x + b.x)*.25; q.y = q.y*.5 + (a.y + b.y)*.25; }
      this.pts = out;
      const keep = Math.ceil(this.N*this.seg/2) + 40; if(H.length > keep) H.length = keep;
    }
    frame(i, P){ // tangent (toward head) and back-normal at point i
      P = P || this.pts; const a = P[Math.max(0, i-1)], b = P[Math.min(P.length-1, i+1)];
      let tx = a.x - b.x, ty = a.y - b.y; const l = Math.hypot(tx,ty) || 1; tx /= l; ty /= l;
      return {tx, ty, nx:ty*this.flip, ny:-tx*this.flip};
    }
    secondary(dt){
      const P = this.pts, f0 = this.frame(0, P), S = this.S;
      this.jaw = lerp(this.jaw, this.jawT, clamp(dt*8, 0, 1));
      const HS = this.HS, loc = (lx, ly) => [P[0].x + f0.tx*lx*HS - f0.nx*ly*HS, P[0].y + f0.ty*lx*HS - f0.ny*ly*HS];
      const w1 = loc(100, -12), w2 = loc(97, -4);
      stepRope(this.whisk[0], w1[0], w1[1], .9, (-f0.tx*.4 - f0.nx*.06)*S + Math.sin(this.t*2)*.12*S, (-f0.ty*.4 - f0.ny*.06)*S);
      stepRope(this.whisk[1], w2[0], w2[1], .9, (-f0.tx*.36 - f0.nx*.16)*S, (-f0.ty*.36 - f0.ny*.16)*S + Math.sin(this.t*2.6)*.1*S);
      this.mane.forEach((r, k) => { const a = loc(4 - k*7, -36 + k*3.2); stepRope(r, a[0], a[1], .88, -f0.tx*.45*S + Math.sin(this.t*3 + k)*.12*S, -f0.ty*.45*S - .06*S); });
      const L = P.length - 1, fl = this.frame(L-1, P);
      this.tuft.forEach((r, k) => { const o = k - 3, s = o*3*S; stepRope(r, P[L].x + fl.nx*s, P[L].y + fl.ny*s, .9, -fl.tx*.45*S + fl.nx*o*.22*S, -fl.ty*.45*S + fl.ny*o*.22*S); });
      // fire
      if(this.breath && !this.rag){
        const m = loc(106, 6 + this.jaw*18), dir = Math.atan2(f0.ty, f0.tx) + this.jaw*.35*this.flip;
        for(let k=0;k<7;k++){ const a = dir + (Math.random()-.5)*.42, sp = (700 + Math.random()*600)*S; this.fire.push({x:m[0], y:m[1], vx:Math.cos(a)*sp + this.vx*.6, vy:Math.sin(a)*sp + this.vy*.6, life:1, r:(7 + Math.random()*9)*S}); }
      }
      for(let i=this.fire.length-1;i>=0;i--){ const f = this.fire[i]; f.x += f.vx*dt; f.y += f.vy*dt; f.vx *= .965; f.vy = f.vy*.965 - 40*dt; f.life -= dt*2; f.r *= 1 + dt*1.7; if(f.life <= 0) this.fire.splice(i,1); }
    }
    /* --- ragdoll: the body becomes two falling ropes cut at `at` --- */
    slay(at = .45){
      const cut = Math.floor(this.N*at);
      this.rag = {cut, p:this.pts.map(q => ({x:q.x, y:q.y, px:q.x - this.vx/60*.4, py:q.y - this.vy/60*.4}))};
      const r = this.rag.p; for(let i=cut-6;i<cut+6;i++){ const q = r[i]; if(q){ const s = i < cut ? -1 : 1; q.px -= s*6; q.py += 4; } }
    }
    stepRag(dt){
      const p = this.rag.p, g = 620*dt*dt, cut = this.rag.cut;
      p.forEach(q => { const vx = (q.x - q.px)*.995, vy = (q.y - q.py)*.995; q.px = q.x; q.py = q.y; q.x += vx; q.y += vy + g; });
      for(let k=0;k<4;k++) for(let i=1;i<p.length;i++){ if(i === cut) continue; const a = p[i-1], b = p[i]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx,dy) || 1, f = (d - this.seg)/d/2; a.x += dx*f; a.y += dy*f; b.x -= dx*f; b.y -= dy*f; }
      this.pts = p.map(q => ({x:q.x, y:q.y})); this.hx = p[0].x; this.hy = p[0].y;
    }

    /* ================= drawing ================= */
    draw(c){
      c.save(); c.globalAlpha = this.alpha;
      const P = this.pts;
      if(this.rag){ const k = this.rag.cut; this.drawPiece(c, 0, k, true, false); this.drawPiece(c, k, P.length, false, true); }
      else this.drawPiece(c, 0, P.length, true, true);
      c.restore();
      this.drawFire(c);
    }
    drawPiece(c, s, e, head, tail){
      const P = this.pts, N = this.N, W = this.W;
      const E = [];
      for(let i=s;i<e;i++){ const f = this.frame(i, P), hw = W*.5*this.prof(i/N); E.push({i, x:P[i].x, y:P[i].y, ...f, hw}); }
      if(E.length < 3) return;
      if(tail) this.drawTuft(c);
      this.drawLegs(c, E, false);
      const pc = this.style === 'papercut';
      pc ? this.drawFinsPC(c, E) : this.drawFins(c, E);
      if(head) this.drawMane(c);
      pc ? this.drawBodyPC(c, E) : this.drawBody(c, E);
      this.drawLegs(c, E, true);
      if(head) this.drawHead(c);
    }
    edge(E, side, k = 1){ return E.map(q => [q.x + q.nx*q.hw*side*k, q.y + q.ny*q.hw*side*k]); }
    smoothPath(c, pts, move = true){
      if(move) c.moveTo(pts[0][0], pts[0][1]); else c.lineTo(pts[0][0], pts[0][1]);
      for(let i=1;i<pts.length-1;i++){ const mx = (pts[i][0] + pts[i+1][0])/2, my = (pts[i][1] + pts[i+1][1])/2; c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
      const l = pts[pts.length-1]; c.lineTo(l[0], l[1]);
    }
    drawBody(c, E){
      const C = this.C;
      const back = this.edge(E, 1), belly = this.edge(E, -1).reverse(), g = this.glow;
      // silhouette
      c.beginPath(); this.smoothPath(c, back); this.smoothPath(c, belly, false); c.closePath();
      c.fillStyle = C.deep; c.fill();
      // lit upper body
      const up = this.edge(E, 1, .92), mid = this.edge(E, -1, .15).reverse();
      c.beginPath(); this.smoothPath(c, up); this.smoothPath(c, mid, false); c.closePath();
      c.fillStyle = C.base; c.fill();
      const up2 = this.edge(E, 1, .78), mid2 = this.edge(E, 1, .25).reverse();
      c.beginPath(); this.smoothPath(c, up2); this.smoothPath(c, mid2, false); c.closePath();
      c.fillStyle = C.mid; c.fill();
      // belly plates
      const b1 = this.edge(E, -1, .93), b2 = this.edge(E, -1, .38).reverse();
      c.beginPath(); this.smoothPath(c, b1); this.smoothPath(c, b2, false); c.closePath();
      const bg = c.createLinearGradient(E[0].x, E[0].y, E[E.length-1].x, E[E.length-1].y); bg.addColorStop(0, C.belly1); bg.addColorStop(1, C.belly2);
      c.fillStyle = bg; c.fill();
      c.strokeStyle = C.bellyLine; c.lineWidth = 1.6*this.S; c.beginPath();
      E.forEach((q, k) => { if(k % 2 || q.hw < 3) return; const a = .93, b = .38; c.moveTo(q.x - q.nx*q.hw*a, q.y - q.ny*q.hw*a); c.quadraticCurveTo(q.x - q.nx*q.hw*.62 + q.tx*q.hw*.18, q.y - q.ny*q.hw*.62 + q.ty*q.hw*.18, q.x - q.nx*q.hw*b, q.y - q.ny*q.hw*b); });
      c.stroke();
      // scales: staggered crescents across the back
      c.lineWidth = 1.5*this.S;
      E.forEach((q, k) => {
        if(q.hw < 4) return;
        const rows = [.62, .2, -.18];
        rows.forEach((r, ri) => {
          if((k + ri) % 2) return;
          const x = q.x + q.nx*q.hw*r, y = q.y + q.ny*q.hw*r, R = q.hw*.42, ang = Math.atan2(q.ty, q.tx);
          c.beginPath(); c.arc(x, y, R, ang + Math.PI*.55, ang + Math.PI*1.45); c.strokeStyle = 'rgba(60,0,10,.55)'; c.stroke();
          c.beginPath(); c.arc(x + q.tx*1.2*this.S, y + q.ty*1.2*this.S, R*.82, ang + Math.PI*.7, ang + Math.PI*1.3); c.strokeStyle = `rgba(255,170,150,${.22*g})`; c.stroke();
        });
      });
      // rim light along the back
      c.beginPath(); this.smoothPath(c, this.edge(E, 1, .86)); c.strokeStyle = `rgba(255,177,153,${.55*g})`; c.lineWidth = 2.2*this.S; c.stroke();
    }
    drawBodyPC(c, E){
      const C = this.C, S = this.S;
      const sil = new Path2D(); this.smoothPath(sil, this.edge(E, 1)); this.smoothPath(sil, this.edge(E, -1).reverse(), false); sil.closePath();
      c.fillStyle = C.base; c.fill(sil);
      // scale panel (gold) with red fish-scale engraving
      const pan = new Path2D(); this.smoothPath(pan, this.edge(E, 1, .74)); this.smoothPath(pan, this.edge(E, -1, .38).reverse(), false); pan.closePath();
      const a = E[0], z = E[E.length-1], g = c.createLinearGradient(a.x, a.y, z.x, z.y);
      g.addColorStop(0, C.goldHi); g.addColorStop(.5, C.belly1); g.addColorStop(1, C.gold);
      c.fillStyle = g; c.fill(pan);
      c.save(); c.clip(pan);
      c.strokeStyle = C.base; c.lineWidth = 1.6*S; c.lineCap = 'round';
      E.forEach((q, k) => {
        if(q.hw < 3) return;
        const R = Math.max(2.4*S, this.seg*.8), span = 1.12*q.hw, n = Math.max(1, Math.round(span/(R*1.15))), ang = Math.atan2(q.ty, q.tx);
        for(let j=0;j<n;j++){
          const r = -.38 + (j + .5)*(1.12/n), sh = (j % 2)*this.seg*.5;
          const x = q.x + q.nx*q.hw*r + q.tx*sh, y = q.y + q.ny*q.hw*r + q.ty*sh;
          c.beginPath(); c.arc(x, y, R, ang + Math.PI*.5, ang + Math.PI*1.5); c.stroke();
          if(R > 5*S){ c.beginPath(); c.arc(x - q.tx*R*.3, y - q.ty*R*.3, R*.45, ang + Math.PI*.6, ang + Math.PI*1.4); c.stroke(); }
        }
      });
      c.restore();
      // crisp borders: red frame + inner gold line along the back
      c.strokeStyle = C.base; c.lineWidth = 2.6*S;
      c.beginPath(); this.smoothPath(c, this.edge(E, 1, .74)); c.stroke();
      c.beginPath(); this.smoothPath(c, this.edge(E, -1, .38)); c.stroke();
      c.strokeStyle = C.gold; c.lineWidth = 1.5*S;
      c.beginPath(); this.smoothPath(c, this.edge(E, 1, .86)); c.stroke();
      // segmented belly band: gold blocks on red
      c.fillStyle = C.gold;
      for(let k=0;k<E.length-1;k+=2){
        const q = E[k], r = E[k+1]; if(q.hw < 3) continue;
        const p1 = [q.x - q.nx*q.hw*.52, q.y - q.ny*q.hw*.52], p2 = [r.x - r.nx*r.hw*.52, r.y - r.ny*r.hw*.52];
        const p3 = [r.x - r.nx*r.hw*.86, r.y - r.ny*r.hw*.86], p4 = [q.x - q.nx*q.hw*.86, q.y - q.ny*q.hw*.86];
        c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.lineTo(p3[0], p3[1]); c.lineTo(p4[0], p4[1]); c.closePath(); c.fill();
      }
    }
    drawFinsPC(c, E){
      const C = this.C, S = this.S, t = this.t;
      for(let k=1;k<E.length-2;k+=2){
        const q = E[k], r = E[k+2] || E[k+1]; if(q.hw < 2.5) continue;
        const tN = q.i/this.N, big = (q.i % 6 === 0) ? 1.35 : 1;
        const h = this.W*.46*(1 - tN*.7)*big*(.88 + .12*Math.sin(t*8 - q.i*.4));
        const bx1 = q.x + q.nx*q.hw*.9, by1 = q.y + q.ny*q.hw*.9, bx2 = r.x + r.nx*r.hw*.9, by2 = r.y + r.ny*r.hw*.9;
        const tx = (bx1 + bx2)/2 + q.nx*h - q.tx*h*1.15, ty = (by1 + by2)/2 + q.ny*h - q.ty*h*1.15;
        c.fillStyle = C.base;
        c.beginPath(); c.moveTo(bx1, by1); c.quadraticCurveTo(bx1 + q.nx*h*.75 - q.tx*h*.2, by1 + q.ny*h*.75 - q.ty*h*.2, tx, ty);
        c.quadraticCurveTo((bx2 + tx)/2 + q.nx*h*.12, (by2 + ty)/2 + q.ny*h*.12, bx2, by2); c.closePath(); c.fill();
        if(h > 9*S){ c.strokeStyle = C.gold; c.lineWidth = 1.2*S; c.beginPath(); const mx = (bx1 + bx2)/2 + q.nx*2*S, my = (by1 + by2)/2 + q.ny*2*S; c.moveTo(mx, my); c.quadraticCurveTo(mx + q.nx*h*.45, my + q.ny*h*.45, mx + (tx - mx)*.7, my + (ty - my)*.7); c.stroke(); }
      }
    }
    drawFins(c, E){
      const C = this.C;
      const t = this.t, S = this.S;
      for(let k=2;k<E.length-3;k+=3){
        const q = E[k], r = E[k+2]; if(q.hw < 3) continue;
        const tN = q.i/this.N, h = (tN < .1 ? 34 : 26)*S*(1 - tN*.75)*(.85 + .15*Math.sin(t*9 - q.i*.45));
        const bx1 = q.x + q.nx*q.hw*.85, by1 = q.y + q.ny*q.hw*.85, bx2 = r.x + r.nx*r.hw*.85, by2 = r.y + r.ny*r.hw*.85;
        const tx = (bx1 + bx2)/2 + q.nx*h - q.tx*h*.75, ty = (by1 + by2)/2 + q.ny*h - q.ty*h*.75;
        const gr = c.createLinearGradient(bx1, by1, tx, ty); gr.addColorStop(0, C.fin4); gr.addColorStop(.45, C.fin3); gr.addColorStop(1, C.fin2);
        c.beginPath(); c.moveTo(bx1, by1); c.quadraticCurveTo(bx1 + q.nx*h*.6, by1 + q.ny*h*.6, tx, ty); c.quadraticCurveTo((bx2 + tx)/2 + q.tx*2*S, (by2 + ty)/2 + q.ty*2*S, bx2, by2); c.closePath();
        c.fillStyle = gr; c.fill();
      }
    }
    capsule(c, x1, y1, r1, x2, y2, r2){
      const a = Math.atan2(y2-y1, x2-x1), nx = -Math.sin(a), ny = Math.cos(a);
      c.beginPath(); c.moveTo(x1 + nx*r1, y1 + ny*r1); c.lineTo(x2 + nx*r2, y2 + ny*r2); c.arc(x2, y2, r2, a + Math.PI/2, a - Math.PI/2, true);
      c.lineTo(x1 - nx*r1, y1 - ny*r1); c.arc(x1, y1, r1, a - Math.PI/2, a + Math.PI/2, true); c.closePath(); c.fill();
    }
    drawLegs(c, E, near){
      const C = this.C;
      const S = this.S, t = this.t;
      [[.15, 0], [.47, 2.2]].forEach(([at, ph], li) => {
        const k = Math.round(at*this.N) - E[0].i; if(k < 1 || k >= E.length - 1) return;
        const q = E[k], sw = Math.sin(t*3.4 + ph + (near ? 0 : 1.6));
        const L1 = (li ? 36 : 38)*S, L2 = (li ? 30 : 32)*S, r0 = (li ? 17 : 16)*S, r1 = 10*S, r2 = 7*S;
        const off = near ? 0 : 7*S;
        const ax = q.x - q.nx*q.hw*.2 + q.tx*off, ay = q.y - q.ny*q.hw*.2 + q.ty*off;
        const bel = Math.atan2(-q.ny, -q.nx), bx = -q.tx, by = -q.ty, s = Math.sign((-q.nx)*by - (-q.ny)*bx) || 1;
        const a1 = bel + s*(li ? .7 : .3) + s*sw*.42;
        const kx = ax + Math.cos(a1)*L1, ky = ay + Math.sin(a1)*L1;
        const a2 = a1 + (li ? s*.85 : -s*1.25) + s*sw*.3;
        const fx = kx + Math.cos(a2)*L2, fy = ky + Math.sin(a2)*L2;
        // elbow tuft (behind the limb)
        c.fillStyle = near ? C.fin3 : '#7a1a10';
        for(let j=0;j<3;j++){ const ta = a1 + Math.PI + s*(.5 + j*.35), tl = (20 - j*4)*S*(.9 + .1*Math.sin(t*8 + j));
          c.beginPath(); c.moveTo(kx + Math.cos(a1 + s*1.57)*r1*.6, ky + Math.sin(a1 + s*1.57)*r1*.6); c.quadraticCurveTo(kx + Math.cos(ta)*tl*.6, ky + Math.sin(ta)*tl*.6, kx + Math.cos(ta)*tl, ky + Math.sin(ta)*tl); c.lineTo(kx - Math.cos(a1)*r1*.4, ky - Math.sin(a1)*r1*.4); c.fill(); }
        if(near){ c.fillStyle = C.fin2; c.beginPath(); const ta = a1 + Math.PI + s*.7; c.moveTo(kx, ky); c.quadraticCurveTo(kx + Math.cos(ta)*10*S, ky + Math.sin(ta)*10*S, kx + Math.cos(ta)*16*S, ky + Math.sin(ta)*16*S); c.lineTo(kx - Math.cos(a1)*4*S, ky - Math.sin(a1)*4*S); c.fill(); }
        // limb: muscular capsules
        c.fillStyle = near ? C.base : C.deep;
        this.capsule(c, ax, ay, r0, kx, ky, r1);
        this.capsule(c, kx, ky, r1*.95, fx, fy, r2);
        if(near){
          // lit upper surface + cream inner stripe + scale bands
          c.fillStyle = C.mid; const ox = Math.cos(a1 - s*1.57)*r0*.25, oy = Math.sin(a1 - s*1.57)*r0*.25;
          this.capsule(c, ax + ox, ay + oy, r0*.62, kx + ox*.6, ky + oy*.6, r1*.55);
          c.strokeStyle = C.belly1; c.lineWidth = 2.6*S; c.lineCap = 'round';
          const ix = Math.cos(a1 + s*1.57), iy = Math.sin(a1 + s*1.57);
          c.beginPath(); c.moveTo(ax + ix*r0*.7, ay + iy*r0*.7); c.lineTo(kx + ix*r1*.7, ky + iy*r1*.7); c.stroke();
          c.strokeStyle = this.style === 'papercut' ? C.gold : 'rgba(60,0,10,.45)'; c.lineWidth = (this.style === 'papercut' ? 2 : 1.4)*S;
          for(let j=1;j<4;j++){ const px = ax + (kx-ax)*j/4, py = ay + (ky-ay)*j/4, rr = lerp(r0, r1, j/4)*.9; c.beginPath(); c.arc(px, py, rr, a1 + 1.1, a1 + 2.0); c.stroke(); }
          c.strokeStyle = `rgba(255,177,153,${.4*this.glow})`; c.lineWidth = 2*S; const ox2 = Math.cos(a1 - s*1.57), oy2 = Math.sin(a1 - s*1.57);
          c.beginPath(); c.moveTo(ax + ox2*r0*.9, ay + oy2*r0*.9); c.lineTo(kx + ox2*r1*.9, ky + oy2*r1*.9); c.stroke();
        }
        // paw + talons
        c.fillStyle = near ? C.base : C.deep; c.beginPath(); c.arc(fx, fy, r2*1.25, 0, TAU); c.fill();
        const open = .38 + .18*Math.sin(t*3.4 + ph + 1);
        for(let j=-1.5;j<=1.5;j+=1){
          const ca = a2 + j*open, l = (j === -1.5 ? 9 : 13)*S;
          const x0 = fx + Math.cos(ca)*r2, y0 = fy + Math.sin(ca)*r2, x1 = x0 + Math.cos(ca)*l, y1 = y0 + Math.sin(ca)*l;
          const tx2 = x1 + Math.cos(ca + 1.5*s)*7*S, ty2 = y1 + Math.sin(ca + 1.5*s)*7*S;
          c.strokeStyle = near ? C.base : C.deep; c.lineWidth = 6*S; c.lineCap = 'round'; c.beginPath(); c.moveTo(fx, fy); c.lineTo(x0, y0); c.stroke();
          c.fillStyle = near ? C.claw : '#b89a72';
          c.beginPath(); c.moveTo(x0 + Math.cos(ca + 1.57)*3*S, y0 + Math.sin(ca + 1.57)*3*S); c.quadraticCurveTo(x1, y1, tx2, ty2); c.quadraticCurveTo(x1 - Math.cos(ca)*3*S, y1 - Math.sin(ca)*3*S, x0 - Math.cos(ca + 1.57)*3*S, y0 - Math.sin(ca + 1.57)*3*S); c.closePath(); c.fill();
        }
      });
    }
    drawRope(c, r, w0, w1, col){
      const p = r.p; for(let i=1;i<p.length;i++){ const k = i/(p.length-1); c.strokeStyle = typeof col === 'function' ? col(k) : col; c.lineWidth = lerp(w0, w1, k); c.beginPath(); c.moveTo(p[i-1].x, p[i-1].y); c.lineTo(p[i].x, p[i].y); c.stroke(); }
    }
    drawTuft(c){
      const C = this.C;
      c.lineCap = 'round';
      if(this.style === 'papercut'){ this.tuft.forEach((r, k) => { const w = (19 - Math.abs(k-3)*2.6)*this.S; this.drawRope(c, r, w, 1.2*this.S, C.base); this.drawRope(c, r, w*.2, .5*this.S, C.gold); }); return; }
      this.tuft.forEach((r, k) => this.drawRope(c, r, (15 - Math.abs(k-3)*2.5)*this.S, 1*this.S, x => x < .3 ? C.fin3 : x < .7 ? C.fin2 : C.fin1));
    }
    drawMane(c){
      const C = this.C;
      c.lineCap = 'round';
      if(this.style === 'papercut'){ this.mane.forEach((r, k) => { const w = (26 - k*1.5)*this.S; this.drawRope(c, r, w, 2*this.S, x => x < .25 ? C.fin4 : C.base); this.drawRope(c, r, w*.18, .6*this.S, C.gold); }); return; }
      this.mane.forEach((r, k) => this.drawRope(c, r, (22 - k*1.4)*this.S, 2*this.S, x => x < .2 ? C.fin4 : x < .5 ? C.fin3 : x < .8 ? C.fin2 : C.fin1));
    }
    taper(c, pts, w0, w1, col0, col1){
      for(let i=1;i<pts.length;i++){ const k = i/(pts.length-1); c.strokeStyle = k < .5 ? col0 : col1; c.lineWidth = lerp(w0, w1, k); c.beginPath(); c.moveTo(pts[i-1][0], pts[i-1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke(); }
    }
    qpts(x0, y0, cx, cy, x1, y1, n = 10){ const p = []; for(let i=0;i<=n;i++){ const t = i/n, u = 1-t; p.push([u*u*x0 + 2*u*t*cx + t*t*x1, u*u*y0 + 2*u*t*cy + t*t*y1]); } return p; }
    antler(c, ox, oy, sc, dark){
      const C = this.C;
      c.lineCap = 'round';
      const c0 = dark ? '#8a6a38' : C.horn2, c1 = dark ? '#a8854a' : C.horn1;
      const main = this.qpts(ox, oy, ox - 40*sc, oy - 40*sc, ox - 96*sc, oy - 34*sc, 14);
      this.taper(c, main, 11*sc, 3*sc, c0, c1);
      [[.32, -1, 30], [.55, -1, 26], [.78, -1, 18], [.45, 1, 14]].forEach(([at, dir, len]) => {
        const i = Math.round(at*(main.length-1)), p = main[i], q = main[Math.min(main.length-1, i+1)];
        const ang = Math.atan2(q[1]-p[1], q[0]-p[0]) + dir*1.15, l = len*sc;
        const tip = [p[0] + Math.cos(ang)*l, p[1] + Math.sin(ang)*l], mid = [p[0] + Math.cos(ang + .35*dir)*l*.55, p[1] + Math.sin(ang + .35*dir)*l*.55];
        this.taper(c, this.qpts(p[0], p[1], mid[0], mid[1], tip[0], tip[1], 6), 6*sc, 1.5*sc, c0, c1);
      });
      if(!dark){ c.fillStyle = C.fin2; c.beginPath(); c.ellipse(ox, oy, 8*sc, 5*sc, -.6, 0, TAU); c.fill(); }
    }
    drawHead(c){
      const C = this.C;
      const P = this.pts, f = this.frame(0, P), S = this.S, H = this.HS, j = this.jaw, t = this.t, g = this.glow;
      // whiskers (world space, behind the head): thick root, fine tip
      c.lineCap = 'round';
      if(this.style === 'papercut') this.whisk.forEach((r, k) => { this.drawRope(c, r, (k ? 4.5 : 5.5)*S, .8*S, C.base); this.drawRope(c, r, (k ? 1.2 : 1.5)*S, .3*S, C.gold); });
      else this.whisk.forEach((r, k) => this.drawRope(c, r, (k ? 4.5 : 5.5)*S, .8*S, x => x < .5 ? C.fin2 : 'rgba(255,241,194,.8)'));
      c.save();
      c.setTransform(c.getTransform().multiply(new DOMMatrix([f.tx*H, f.ty*H, -f.nx*H, -f.ny*H, P[0].x, P[0].y])));
      // local: +x forward, -y = top, +y = throat
      this.antler(c, 22, -34, .72, true);
      // ear fin
      c.fillStyle = C.fin3; c.beginPath(); c.moveTo(8,-30); c.quadraticCurveTo(-14,-48 + Math.sin(t*5)*3,-34,-46); c.quadraticCurveTo(-12,-34,2,-22); c.fill();
      c.fillStyle = C.fin2; c.beginPath(); c.moveTo(6,-28); c.quadraticCurveTo(-10,-40,-24,-40); c.quadraticCurveTo(-8,-32,2,-24); c.fill();
      // ---- lower jaw (opens) ----
      c.save(); c.translate(22, 10); c.rotate(j*.95);
      c.fillStyle = '#2a0006'; c.beginPath(); c.moveTo(0,-6); c.lineTo(78,-6); c.lineTo(74,6); c.lineTo(0,8); c.fill();
      if(j > .08){ c.fillStyle = '#d4485a'; c.beginPath(); c.moveTo(6,-2); c.quadraticCurveTo(46,-6 - j*8,74,-2); c.lineTo(84,-8); c.lineTo(80,0); c.lineTo(86,4); c.lineTo(70,2); c.quadraticCurveTo(40,4,6,4); c.fill(); }
      c.fillStyle = C.base; c.beginPath(); c.moveTo(-18,2); c.quadraticCurveTo(36,6,80,-2); c.quadraticCurveTo(86,6,76,12); c.quadraticCurveTo(36,24,-14,20); c.closePath(); c.fill();
      c.fillStyle = C.belly1; c.beginPath(); c.moveTo(-10,15); c.quadraticCurveTo(34,20,76,11); c.quadraticCurveTo(36,26,-8,22); c.fill();
      c.strokeStyle = C.bellyLine; c.lineWidth = 1; for(let x=4;x<70;x+=9){ c.beginPath(); c.moveTo(x,15 + x*.02); c.lineTo(x+3,21); c.stroke(); }
      c.fillStyle = '#fff8e6'; for(let x=16;x<74;x+=7){ c.beginPath(); c.moveTo(x,-1); c.lineTo(x+2.5,-8); c.lineTo(x+5,-1); c.fill(); }
      c.beginPath(); c.moveTo(68,-1); c.lineTo(72,-16); c.lineTo(76,-1); c.fill();
      // beard: flowing strands
      c.lineCap = 'round';
      for(let k=0;k<5;k++){ const x0 = 4 + k*11, w = Math.sin(t*4 + k)*3;
        this.taper(c, this.qpts(x0, 19, x0 - 4 + w, 34, x0 - 18 + w*1.5, 38 + (k % 2)*6, 8), 7 - k*.6, 1.2, C.fin3, C.fin2); }
      c.restore();
      // mouth glow
      if(j > .1){ const mg = c.createRadialGradient(74, 12, 2, 74, 12, 40); mg.addColorStop(0, `rgba(255,240,190,${Math.min(1, j*1.8)})`); mg.addColorStop(1, 'rgba(255,120,40,0)'); c.fillStyle = mg; c.beginPath(); c.arc(74, 12, 40, 0, TAU); c.fill(); }
      // ---- skull ----
      const sk = new Path2D();
      sk.moveTo(-24,-26); sk.bezierCurveTo(-8,-44, 18,-48, 36,-40);
      sk.bezierCurveTo(48,-36, 56,-28, 70,-27); sk.bezierCurveTo(84,-26, 92,-34, 100,-31);
      sk.bezierCurveTo(110,-27, 112,-14, 108,-6); sk.bezierCurveTo(106,0, 104,6, 98,9);
      sk.lineTo(34,12); sk.bezierCurveTo(16,16, -4,24, -22,24); sk.bezierCurveTo(-34,16, -36,-14, -24,-26); sk.closePath();
      c.fillStyle = C.deep; c.fill(sk);
      const hg = c.createLinearGradient(0,-46,0,14); hg.addColorStop(0, C.hi); hg.addColorStop(.18, C.mid); hg.addColorStop(.6, C.base); hg.addColorStop(1, C.deep);
      c.save(); c.translate(1,-2); c.scale(.97,.9); c.fillStyle = hg; c.fill(sk); c.restore();
      // forehead gold plates + snout ridge scales
      c.fillStyle = C.fin2;
      for(let k=0;k<4;k++){ c.beginPath(); c.ellipse(12 + k*8, -40 + k*1.5, 4.2 - k*.5, 2.6, -.2, 0, TAU); c.fill(); }
      c.strokeStyle = 'rgba(60,0,10,.5)'; c.lineWidth = 1.3;
      for(let x=56;x<96;x+=7){ c.beginPath(); c.arc(x, -22, 6, Math.PI*.15, Math.PI*.85); c.stroke(); }
      for(let x=60;x<92;x+=7){ c.beginPath(); c.arc(x + 3, -13, 5, Math.PI*.15, Math.PI*.85); c.stroke(); }
      if(this.style === 'papercut'){
        c.strokeStyle = C.gold; c.lineWidth = 1.7; c.lineCap = 'round';
        c.beginPath(); for(let a=0;a<9.5;a+=.25){ const r = 1 + a*1.2, x = 12 + Math.cos(a)*r, y = -4 + Math.sin(a)*r*.85; a ? c.lineTo(x,y) : c.moveTo(x,y); } c.stroke();
        c.beginPath(); c.moveTo(60,-7); c.quadraticCurveTo(80,-11,99,-5); c.stroke();
        c.beginPath(); c.moveTo(56,2); c.quadraticCurveTo(76,0,96,3); c.stroke();
        c.beginPath(); c.moveTo(-18,-20); c.quadraticCurveTo(0,-30,24,-28); c.stroke();
        c.beginPath(); c.moveTo(-20,14); c.quadraticCurveTo(-4,10,10,12); c.stroke();
      }
      // upper lip edge + teeth + fangs
      c.strokeStyle = C.belly1; c.lineWidth = 2.2; c.beginPath(); c.moveTo(34,11); c.quadraticCurveTo(70,10,98,8); c.stroke();
      c.fillStyle = '#fff8e6'; for(let x=40;x<96;x+=7){ c.beginPath(); c.moveTo(x,9); c.lineTo(x+2.5,16); c.lineTo(x+5,9); c.fill(); }
      c.beginPath(); c.moveTo(88,8); c.lineTo(92,26); c.lineTo(96,8); c.fill();
      c.beginPath(); c.moveTo(54,9); c.lineTo(57,22); c.lineTo(60,9); c.fill();
      // nostril spiral (gold)
      c.strokeStyle = C.fin2; c.lineWidth = 2.4; c.beginPath();
      for(let a=0;a<4.6;a+=.2){ const r = 2 + a*1.3, x = 100 + Math.cos(a + 3)*r, y = -22 + Math.sin(a + 3)*r*.8; a ? c.lineTo(x,y) : c.moveTo(x,y); } c.stroke();
      // cheek frills: radiating pointed spikes, layered
      [[C.deep, 1.2, 0], [C.fin3, 1, .7], [C.fin2, .72, 1.4]].forEach(([col, sc, ph]) => {
        c.fillStyle = col;
        for(let k=0;k<6;k++){
          const ang = Math.PI - .7 + k*.28 + Math.sin(t*5 + k + ph)*.05, L = (34 + (k % 2)*12 + (k === 2 ? 12 : 0))*sc, ox = -16, oy = 2;
          const tx = ox + Math.cos(ang)*L, ty = oy + Math.sin(ang)*L, pa = ang + Math.PI/2, w = 9*sc;
          c.beginPath(); c.moveTo(ox + Math.cos(pa)*w, oy + Math.sin(pa)*w);
          c.quadraticCurveTo(ox + Math.cos(ang - .12)*L*.6, oy + Math.sin(ang - .12)*L*.6, tx, ty);
          c.quadraticCurveTo(ox + Math.cos(ang + .1)*L*.5, oy + Math.sin(ang + .1)*L*.5, ox - Math.cos(pa)*w, oy - Math.sin(pa)*w); c.closePath(); c.fill();
        }
      });
      // brow ridge with spikes
      c.fillStyle = C.deep;
      c.beginPath(); c.moveTo(28,-30); c.quadraticCurveTo(44,-44,66,-34); c.lineTo(62,-28); c.quadraticCurveTo(46,-34,32,-24); c.fill();
      c.fillStyle = C.fin2;
      [[34,-36,-8],[44,-40,-6],[54,-40,-4]].forEach(([x,y,d]) => { c.beginPath(); c.moveTo(x,y); c.quadraticCurveTo(x - 10, y - 10, x - 18, y - 14 + d*.3); c.quadraticCurveTo(x - 6, y - 4, x + 6, y + 1); c.fill(); });
      c.strokeStyle = C.fin2; c.lineWidth = 1.6; c.beginPath(); c.moveTo(30,-31); c.quadraticCurveTo(46,-43,66,-34); c.stroke();
      // eye
      c.fillStyle = '#1c0003'; c.beginPath(); c.ellipse(48,-24,11,7,-.12,0,TAU); c.fill();
      const eg = c.createRadialGradient(48,-24,0,48,-24,22); eg.addColorStop(0, `rgba(255,226,122,${.85*g})`); eg.addColorStop(1, 'rgba(255,170,60,0)');
      c.fillStyle = eg; c.beginPath(); c.arc(48,-24,22,0,TAU); c.fill();
      const ig = c.createRadialGradient(48,-24,1,48,-24,8); ig.addColorStop(0, '#fff6c8'); ig.addColorStop(.55, C.eye); ig.addColorStop(1, '#e0602a');
      c.fillStyle = ig; c.beginPath(); c.ellipse(48,-24,8.5,5.6,-.12,0,TAU); c.fill();
      c.fillStyle = '#140300'; c.beginPath(); c.ellipse(49,-24,1.7,5,-.12,0,TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(45.5,-26,1.5,0,TAU); c.fill();
      // rim light along the top of the head
      c.strokeStyle = `rgba(255,190,165,${.75*g})`; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-18,-31); c.bezierCurveTo(-4,-44, 18,-46, 34,-40); c.stroke();
      c.beginPath(); c.moveTo(70,-28); c.bezierCurveTo(84,-27, 92,-34, 100,-31); c.stroke();
      // outline
      c.strokeStyle = 'rgba(40,0,6,.7)'; c.lineWidth = 1.2; c.stroke(sk);
      // near antler on top
      this.antler(c, 28, -36, .82, false);
      c.restore();
    }
    drawFire(c){
      if(!this.fire.length) return;
      c.save(); c.globalCompositeOperation = 'lighter';
      this.fire.forEach(f => { const L = f.life, gr = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        gr.addColorStop(0, L > .7 ? 'rgba(255,250,225,.95)' : L > .4 ? 'rgba(255,214,120,.85)' : 'rgba(237,60,30,.6)'); gr.addColorStop(1, 'rgba(200,20,20,0)');
        c.globalAlpha = Math.min(1, L*1.4)*this.alpha; c.fillStyle = gr; c.beginPath(); c.arc(f.x, f.y, f.r, 0, TAU); c.fill(); });
      c.restore();
    }
  }
  return {Dragon};
})();
