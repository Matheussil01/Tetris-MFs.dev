const COLS=10,ROWS=20,CELL=36;
const COL={I:['#7df3ff','#1b9ad6'],O:['#fff07a','#f2a31b'],T:['#d79bff','#7a3fe0'],S:['#7dffb2','#1fb56b'],Z:['#ff8c9a','#d6304f'],J:['#8fa6ff','#3a50d8'],L:['#ffb877','#e0651f']};
const SH={I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],O:[[1,1],[1,1]],T:[[0,1,0],[1,1,1],[0,0,0]],S:[[0,1,1],[1,1,0],[0,0,0]],Z:[[1,1,0],[0,1,1],[0,0,0]],J:[[1,0,0],[1,1,1],[0,0,0]],L:[[0,0,1],[1,1,1],[0,0,0]]};
const $=id=>document.getElementById(id);
const cv=$('board'),ctx=cv.getContext('2d');
cv.width=COLS*CELL;cv.height=ROWS*CELL;
const hx=$('hold').getContext('2d'),nx=$('next').getContext('2d');
let board,cur,hold,canHold,queue,bag,score=0,lines=0,level=1,hi=0,state='ready';
let drop=0,lockT=0,lockResets=0,clearing=null,parts=[],softDown=false,shake=0;
try{hi=+localStorage.getItem('tt_hi')||0}catch(e){}

/* ---------- peças ---------- */
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const take=()=>{if(!bag.length)bag=shuffle(Object.keys(SH));return bag.pop()};
const make=t=>{const m=SH[t].map(r=>[...r]);return{t,m,x:(COLS-m[0].length)>>1,y:t==='I'?-1:0}};
const fromQueue=()=>{const t=queue.shift();queue.push(take());return t};
function hit(m,x,y){
  for(let r=0;r<m.length;r++)for(let c=0;c<m[r].length;c++){
    if(!m[r][c])continue;
    const px=x+c,py=y+r;
    if(px<0||px>=COLS||py>=ROWS)return true;
    if(py>=0&&board[py][px])return true;
  }
  return false;
}
function reset(){
  board=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  bag=[];queue=[take(),take(),take(),take()];
  hold=null;canHold=true;score=0;lines=0;level=1;clearing=null;parts=[];cur=null;
}
function spawn(){
  cur=make(fromQueue());drop=0;lockT=0;lockResets=0;
  if(hit(cur.m,cur.x,cur.y))end();
}
function start(){reset();state='play';spawn();ov()}
function end(){
  state='over';cur=cur&&hit(cur.m,cur.x,cur.y)?cur:null;saveHi();ov();
}
function saveHi(){if(score>hi){hi=score;try{localStorage.setItem('tt_hi',hi)}catch(e){}}}
const gravity=()=>Math.max(40,650*Math.pow(.78,level-1));

/* ---------- ações ---------- */
function touched(){if(hit(cur.m,cur.x,cur.y+1)&&lockResets<10){lockT=0;lockResets++}}
function move(dx){if(!hit(cur.m,cur.x+dx,cur.y)){cur.x+=dx;touched()}}
function rot(d){
  if(cur.t==='O')return;
  const m=cur.m;
  const n=d>0?m[0].map((_,i)=>m.map(r=>r[i]).reverse()):m[0].map((_,i)=>m.map(r=>r[r.length-1-i]));
  for(const k of [[0,0],[-1,0],[1,0],[0,-1],[-2,0],[2,0],[-1,-1],[1,-1]]){
    if(!hit(n,cur.x+k[0],cur.y+k[1])){cur.m=n;cur.x+=k[0];cur.y+=k[1];touched();return}
  }
}
function hardDrop(){
  let n=0;while(!hit(cur.m,cur.x,cur.y+1)){cur.y++;n++}
  score+=n*2;shake=Math.max(shake,2);lock();
}
function swap(){
  if(!canHold)return;
  canHold=false;
  const t=cur.t,nt=hold||fromQueue();
  hold=t;cur=make(nt);drop=0;lockT=0;lockResets=0;
  if(hit(cur.m,cur.x,cur.y))end();
}
function act(a){
  if(a==='pause'){
    if(state==='play'){state='paused';ov()}else if(state==='paused'){state='play';ov()}
    return;
  }
  if(state!=='play'||!cur)return;
  if(a==='left')move(-1);
  else if(a==='right')move(1);
  else if(a==='rot')rot(1);
  else if(a==='rotccw')rot(-1);
  else if(a==='drop')hardDrop();
  else if(a==='hold')swap();
}

/* ---------- travar e limpar linhas ---------- */
function lock(){
  let over=false;
  cur.m.forEach((row,r)=>row.forEach((v,c)=>{
    if(!v)return;
    const y=cur.y+r,x=cur.x+c;
    if(y<0)over=true;else board[y][x]=cur.t;
  }));
  canHold=true;cur=null;
  if(over){end();return}
  const rows=[];board.forEach((r,i)=>{if(r.every(Boolean))rows.push(i)});
  if(rows.length){clearing={rows,t:0};burst(rows);shake=Math.max(shake,rows.length*3)}
  else spawn();
}
function burst(rows){
  const cols=Object.values(COL).map(c=>c[0]);
  rows.forEach(r=>{
    for(let i=0;i<24;i++)parts.push({x:Math.random()*COLS*CELL,y:r*CELL+CELL/2,vx:(Math.random()-.5)*6,vy:(Math.random()-.9)*5,life:700,max:700,c:cols[Math.random()*cols.length|0],s:2+Math.random()*4});
  });
}
function finishClear(){
  const n=clearing.rows.length,rows=clearing.rows;
  board=board.filter((_,i)=>!rows.includes(i));
  while(board.length<ROWS)board.unshift(Array(COLS).fill(0));
  score+=[0,100,300,500,800][n]*level;lines+=n;level=1+Math.floor(lines/8);
  clearing=null;spawn();
}

/* ---------- loop ---------- */
function update(dt){
  parts.forEach(p=>{p.x+=p.vx*dt/16;p.y+=p.vy*dt/16;p.vy+=.15*dt/16;p.life-=dt});
  parts=parts.filter(p=>p.life>0);
  shake=Math.max(0,shake-dt*.012);
  if(state!=='play')return;
  if(clearing){clearing.t+=dt;if(clearing.t>=280)finishClear();return}
  if(!cur)return;
  drop+=dt;
  const iv=softDown?Math.min(45,gravity()):gravity();
  while(drop>=iv){
    drop-=iv;
    if(!hit(cur.m,cur.x,cur.y+1)){cur.y++;if(softDown)score++}
    else{drop=0;break}
  }
  if(hit(cur.m,cur.x,cur.y+1)){lockT+=dt;if(lockT>=350)lock()}else lockT=0;
}

/* ---------- desenho ---------- */
function block(g,x,y,s,t,a=1){
  const c=COL[t],p=s*.06,w=s-p*2;
  g.globalAlpha=a;
  const gr=g.createLinearGradient(x,y,x,y+s);gr.addColorStop(0,c[0]);gr.addColorStop(1,c[1]);
  g.fillStyle=gr;g.shadowColor=c[1];g.shadowBlur=s*.45;
  g.beginPath();g.roundRect(x+p,y+p,w,w,s*.2);g.fill();
  g.shadowBlur=0;
  g.fillStyle='rgba(255,255,255,.26)';
  g.beginPath();g.roundRect(x+p+s*.1,y+p+s*.08,w-s*.2,w*.28,s*.12);g.fill();
  g.strokeStyle='rgba(255,255,255,.32)';g.lineWidth=1;
  g.beginPath();g.roundRect(x+p+.5,y+p+.5,w-1,w-1,s*.2);g.stroke();
  g.globalAlpha=1;
}
function mini(g,t,ox,oy,w,h,s,a=1){
  const m=SH[t];let r0=9,r1=0,c0=9,c1=0;
  m.forEach((row,r)=>row.forEach((v,c)=>{if(v){r0=Math.min(r0,r);r1=Math.max(r1,r);c0=Math.min(c0,c);c1=Math.max(c1,c)}}));
  const sx=ox+(w-(c1-c0+1)*s)/2,sy=oy+(h-(r1-r0+1)*s)/2;
  m.forEach((row,r)=>row.forEach((v,c)=>{if(v)block(g,sx+(c-c0)*s,sy+(r-r0)*s,s,t,a)}));
}
function draw(){
  const W=cv.width,H=cv.height;
  ctx.save();
  if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
  const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#14103a');bg.addColorStop(1,'#0a0820');
  ctx.fillStyle=bg;ctx.fillRect(-10,-10,W+20,H+20);
  ctx.strokeStyle='rgba(255,255,255,.045)';ctx.lineWidth=1;ctx.beginPath();
  for(let i=1;i<COLS;i++){ctx.moveTo(i*CELL+.5,0);ctx.lineTo(i*CELL+.5,H)}
  for(let i=1;i<ROWS;i++){ctx.moveTo(0,i*CELL+.5);ctx.lineTo(W,i*CELL+.5)}
  ctx.stroke();
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(board&&board[r][c])block(ctx,c*CELL,r*CELL,CELL,board[r][c]);
  if(cur&&state!=='ready'){
    let gy=0;while(!hit(cur.m,cur.x,cur.y+gy+1))gy++;
    const col=COL[cur.t];
    cur.m.forEach((row,r)=>row.forEach((v,c)=>{
      if(!v)return;
      const x=(cur.x+c)*CELL,y=(cur.y+gy+r)*CELL;
      if(gy>0){
        ctx.fillStyle=col[0];ctx.globalAlpha=.1;ctx.beginPath();ctx.roundRect(x+2,y+2,CELL-4,CELL-4,6);ctx.fill();
        ctx.globalAlpha=.55;ctx.strokeStyle=col[0];ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(x+2.5,y+2.5,CELL-5,CELL-5,6);ctx.stroke();ctx.globalAlpha=1;
      }
    }));
    cur.m.forEach((row,r)=>row.forEach((v,c)=>{if(v&&cur.y+r>=0)block(ctx,(cur.x+c)*CELL,(cur.y+r)*CELL,CELL,cur.t)}));
  }
  if(clearing){
    const a=.9*(1-clearing.t/280)*(.65+.35*Math.sin(clearing.t/25));
    ctx.fillStyle='rgba(255,255,255,'+Math.max(0,a)+')';
    clearing.rows.forEach(r=>ctx.fillRect(0,r*CELL,W,CELL));
  }
  parts.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.c;ctx.fillRect(p.x,p.y,p.s,p.s)});
  ctx.globalAlpha=1;ctx.restore();
  hx.clearRect(0,0,110,72);nx.clearRect(0,0,110,132);
  if(hold)mini(hx,hold,0,0,110,72,18,canHold?1:.35);
  if(queue)for(let i=0;i<2;i++)mini(nx,queue[i],0,i*66,110,66,18);
}
const set=(id,v)=>{const e=$(id);if(e._v!==v){e.textContent=v;e._v=v}};
function hud(){set('s',score);set('lv',level);set('ln',lines);set('hs',Math.max(hi,score))}
function ov(){
  const o=$('ov');o.hidden=state==='play';
  const T={ready:['TETRIS','Empilhe os blocos e limpe as linhas','JOGAR'],paused:['PAUSA','Respire fundo e volte quando quiser','CONTINUAR'],over:['FIM DE JOGO','Pontos: '+score+' · Linhas: '+lines,'JOGAR DE NOVO']}[state];
  if(T){$('ot').textContent=T[0];$('op').textContent=T[1];$('go').textContent=T[2]}
}
let last=performance.now();
function loop(t){
  const dt=Math.min(t-last,60);last=t;
  update(dt);draw();hud();requestAnimationFrame(loop);
}

/* ---------- controles ---------- */
const KEYS={ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',ArrowUp:'rot',w:'rot',W:'rot',x:'rot',X:'rot',z:'rotccw',Z:'rotccw',' ':'drop',c:'hold',C:'hold',Shift:'hold',p:'pause',P:'pause',Escape:'pause'};
addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'||e.key==='s'||e.key==='S'){e.preventDefault();softDown=true;return}
  const a=KEYS[e.key];
  if(!a)return;
  e.preventDefault();
  if(e.key===' '&&state!=='play'){if(state==='paused')act('pause');else start();return}
  if(e.repeat&&(a==='drop'||a==='hold'||a==='rot'||a==='rotccw'||a==='pause'))return;
  act(a);
});
addEventListener('keyup',e=>{if(e.key==='ArrowDown'||e.key==='s'||e.key==='S')softDown=false});
$('go').addEventListener('click',()=>{if(state==='paused')act('pause');else start()});
document.querySelectorAll('#pad button').forEach(b=>{
  const a=b.dataset.a;let iv,to;
  const stop=()=>{clearInterval(iv);clearTimeout(to);if(a==='soft')softDown=false};
  b.addEventListener('pointerdown',e=>{
    e.preventDefault();
    if(a==='soft'){softDown=true;return}
    act(a);
    if(a==='left'||a==='right')to=setTimeout(()=>{iv=setInterval(()=>act(a),90)},170);
  });
  ['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,stop));
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')act('pause')});

reset();ov();hud();requestAnimationFrame(loop);
