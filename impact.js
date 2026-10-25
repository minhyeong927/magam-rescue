/* Four canvas reveal experiences. This renderer never selects or changes a task. */
(function () {
  'use strict';
  window.playImpactReveal = function ({theme, titles, duration = 3000, sound, reduced, onReady}) {
    const dialog = document.getElementById('orbit-dialog');
    const canvas = document.getElementById('orbit-canvas'), c = canvas.getContext('2d');
    const phase = document.getElementById('orbit-phase'), telemetry = document.getElementById('orbit-coordinates');
    let w=0,h=0,raf=null,stopped=false,ready=false,last=-1,audio=null;
    const start=performance.now(), seed=Math.random()*100;
    const rnd=i=>{const x=Math.sin(i*127.1+seed)*43758.5453;return x-Math.floor(x);};
    const particles=Array.from({length:theme==='breakout'?85:65},(_,i)=>({a:rnd(i)*Math.PI*2,v:.35+rnd(i+100),size:3+rnd(i+200)*13,rot:rnd(i+300)*7}));
    const accent={breakout:'#ff954d',overdrive:'#ff4158',capsule:'#f6c84c',comic:'#ffdc38'}[theme];
    function resize(){w=canvas.clientWidth;h=canvas.clientHeight;const d=Math.min(devicePixelRatio||1,1.7);canvas.width=w*d;canvas.height=h*d;if(c)c.setTransform(d,0,0,d,0,0);if(ready&&!stopped)draw(performance.now());}
    resize();const observer=new ResizeObserver(resize);observer.observe(canvas);
    if(sound&&!reduced){try{audio=new(window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch(_){}}
    function hit(freq,length,vol=.06,type='sine'){if(!audio)return;try{const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(35,t+length);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(vol,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+length);o.connect(g);g.connect(audio.destination);o.start();o.stop(t+length+.02);}catch(_){}}
    const captions={breakout:['시작을 막던 벽 앞에서','고민에 금이 가는 중','마지막 한 번, 깨부숴!','시작의 벽, 돌파 완료.'],overdrive:['엔진 시동 중','집중 에너지 충전 중','충전 완료. 임무 발사!','지금 할 일, 장전 완료.'],capsule:['오늘의 캡슐을 골라요','통통, 어떤 일이 나올까요?','하나가 나왔어요. 열어 볼까요?','작은 시작을 발견했어요.'],comic:['오늘의 주인공은 너','다음 장면을 고르는 중','고민은 여기까지!','좋아. 지금은 이거다.']};
    function setPhase(n){if(n===last)return;last=n;dialog.dataset.phase=String(n);phase.textContent=captions[theme][n];if(n===3)hit(theme==='capsule'?640:80,.5,.10,theme==='comic'?'triangle':'sine');else hit(theme==='capsule'?420:160+n*100,.12,.035,'triangle');}
    function line(x1,y1,x2,y2,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
    function circle(x,y,r,fill,stroke,lw=1){c.beginPath();c.arc(x,y,Math.max(.1,r),0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
    function text(s,x,y,size,color,align='center'){c.font=`800 ${size}px system-ui, sans-serif`;c.textAlign=align;c.fillStyle=color;c.fillText(s,x,y);}
    function burst(cx,cy,q,color,gravity=false){particles.forEach((p,i)=>{const distance=q*Math.min(w,h)*p.v*.95;const x=cx+Math.cos(p.a)*distance,y=cy+Math.sin(p.a)*distance+(gravity?q*q*160:0);c.save();c.globalAlpha=Math.max(0,1-q*.9);c.translate(x,y);c.rotate(p.rot+q*9);c.fillStyle=i%3===0?'#fff5d7':color;c.fillRect(-p.size/2,-p.size/2,p.size*(1-q*.45),p.size*.5);c.restore();});}
    function labelCycle(t,x,y,color){if(t>.74)return;const idx=Math.floor(t*25)%titles.length;const s=titles[idx]||'지금 할 일';text(s.length>18?s.slice(0,18)+'…':s,x,y,Math.min(18,w/24),color);}
    function wall(t){
      c.fillStyle='#151719';c.fillRect(0,0,w,h);
      for(let y=0;y<h;y+=68)for(let x=-80;x<w;x+=130){const dx=x+(Math.floor(y/68)%2)*65;c.fillStyle=`rgba(255,255,255,${.012+rnd(x+y)*.025})`;c.fillRect(dx+2,y+2,126,64);}
      const cx=w/2,cy=h*.44,R=Math.min(w,h)*.26;
      if(t<.77){
        c.save();c.translate(cx,cy);if(t>.6){c.translate(Math.sin(t*300)*3,Math.cos(t*200)*3);}
        for(let i=0;i<12;i++){const a=i*Math.PI/6+rnd(i)*.2,len=R*Math.min(1,(t-.12)*2.1)*(0.6+rnd(i+12)*.8);let x=0,y=0;c.beginPath();c.moveTo(0,0);for(let j=1;j<=4;j++){x=Math.cos(a)*len*j/4+(rnd(i*5+j)-.5)*16;y=Math.sin(a)*len*j/4;c.lineTo(x,y);}c.strokeStyle=t>.59?'#ff914b':'#838074';c.lineWidth=1+i%3;c.stroke();}
        c.strokeStyle='#ff954d';c.lineWidth=3;c.strokeRect(-R*.9,-R*.7,R*1.8,R*1.4);text('BREAK',0,-4,Math.min(72,w*.13),'#f3e9d6');text('THE DOUBT',0,35,Math.min(19,w*.04),'#ff954d');c.restore();labelCycle(t,cx,cy+R+40,'#a9a28e');
      }else{
        const q=Math.min(1,(t-.77)/.35);circle(cx,cy,R*(.8+q*.7),'#0a0b0d','#4b4740',3);c.save();c.globalAlpha=.25*(1-q);circle(cx,cy,R*(1+q*5),null,'#ffb45e',8);c.restore();burst(cx,cy,q,'#77736c',true);
        for(let i=0;i<14;i++){let a=i*.449;line(cx+Math.cos(a)*R*1.4,cy+Math.sin(a)*R*1.4,cx+Math.cos(a)*(R*2.4),cy+Math.sin(a)*(R*2.4),'#ff954d18',1);}
      }
      for(let side of[0,w-10]){c.fillStyle='#f38f41';c.fillRect(side,100,10,h-200);for(let y=100;y<h-100;y+=30){c.fillStyle='#1b1d1f';c.fillRect(side,y,10,14);}}
    }
    function drive(t){
      c.fillStyle='#100d15';c.fillRect(0,0,w,h);const cx=w/2,cy=h*.44,R=Math.min(w,h)*.27,charge=Math.min(1,t/.73);
      for(let i=0;i<24;i++){const a=i*Math.PI/12;const active=i<charge*24;c.save();c.translate(cx,cy);c.rotate(a);c.fillStyle=active?'#ff4059':'#43232f';c.fillRect(R*.98,-3,R*.17,6);c.restore();}
      for(let j=0;j<3;j++){c.save();c.translate(cx,cy);c.rotate((j%2?1:-1)*t*(j+1)*3);c.strokeStyle=j===0?'#ff465a':'#6f364b';c.lineWidth=j===0?3:1;c.beginPath();c.arc(0,0,R*(.65+j*.12),j,Math.PI*1.3+j);c.stroke();c.restore();}
      if(t<.77){const glow=c.createRadialGradient(cx,cy,1,cx,cy,R);glow.addColorStop(0,`rgba(255,65,95,${.1+charge*.6})`);glow.addColorStop(1,'transparent');c.fillStyle=glow;c.fillRect(cx-R,cy-R,R*2,R*2);text(String(Math.floor(charge*100)).padStart(2,'0')+'%',cx,cy+12,Math.min(68,w*.13),'#fff1ee');labelCycle(t,cx,cy+R+45,'#d093a4');}
      else{const q=Math.min(1,(t-.77)/.35);burst(cx,cy,q,'#ff4059');circle(cx,cy,R*(1+q*3),null,`rgba(255,100,120,${(1-q)*.7})`,5);}
      c.fillStyle='#35202e';c.fillRect(w*.15,h*.79,w*.7,5);c.fillStyle='#ff4059';c.fillRect(w*.15,h*.79,w*.7*charge,5);
      text(t<.77?'CORE / ENERGY CHARGING':'SYSTEM / READY',cx,h*.84,10,'#b88292');
    }
    function capsuleShape(x,y,r,a,color){c.save();c.translate(x,y);c.rotate(a);c.beginPath();c.arc(0,0,r,Math.PI,Math.PI*2);c.closePath();c.fillStyle=color;c.fill();c.beginPath();c.arc(0,0,r,0,Math.PI);c.closePath();c.fillStyle='#fff6d8';c.fill();circle(0,0,r,null,'#39374c',2);line(-r,0,r,0,'#39374c',2);c.fillStyle='#ffffff88';c.beginPath();c.ellipse(-r*.28,-r*.34,r*.17,r*.3,.5,0,Math.PI*2);c.fill();c.restore();}
    function capsule(t){
      c.fillStyle='#f0e7fa';c.fillRect(0,0,w,h);for(let x=10;x<w;x+=28)for(let y=10;y<h;y+=28)circle(x,y,1,'#bca9cd55');
      const cx=w/2,cy=h*.43,R=Math.min(w*.34,155);
      if(t<.52){
        c.fillStyle='#e5cefa';c.fillRect(cx-R-14,cy-R-20,R*2+28,R*2+85);c.strokeStyle='#6e558d';c.lineWidth=4;c.strokeRect(cx-R-14,cy-R-20,R*2+28,R*2+85);
        for(let i=0;i<18;i++){const x=cx+Math.sin(i*2.4+t*6)*R*.7,y=cy+Math.cos(i*2.4+t*7)*R*.62+Math.abs(Math.sin(t*22+i))*12;capsuleShape(x,y,19,i+t*8,['#f4b647','#f09cb2','#9fbfe8','#aca4dc'][i%4]);}
        c.fillStyle='#6e558d';c.fillRect(cx-R-14,cy+R+16,R*2+28,55);circle(cx,cy+R+44,17,'#f4c94e','#39374c',2);line(cx-11,cy+R+44,cx+11,cy+R+44,'#39374c',4);
      }else if(t<.77){const q=(t-.52)/.25;const bounce=-Math.abs(Math.sin(q*Math.PI*2))*45;capsuleShape(cx,cy+bounce,55,q*6,'#f3bd4c');circle(cx,cy+75,3,'#b4a1c7');}
      else{const q=Math.min(1,(t-.77)/.35);burst(cx,cy,q,'#c18de3',true);c.save();c.globalAlpha=1-q;capsuleShape(cx-90*q,cy+140*q,55,-q*3,'#f3bd4c');c.restore();}
      if(t<.77)labelCycle(t,cx,h*.81,'#6f5281');
    }
    function comic(t){
      c.fillStyle='#ffdc38';c.fillRect(0,0,w,h);for(let x=6;x<w;x+=16)for(let y=6;y<h;y+=16)circle(x,y,1.5,'#30274422');
      const cx=w/2,cy=h*.43;
      for(let i=0;i<42;i++){const a=i*Math.PI/21+Math.sin(i)*.02,r=Math.min(w,h)*(.29+rnd(i)*.12);line(cx+Math.cos(a)*r,cy+Math.sin(a)*r,cx+Math.cos(a)*Math.max(w,h),cy+Math.sin(a)*Math.max(w,h),'#292333',i%3?1:5);}
      if(t<.77){const flip=Math.floor(t*10);c.save();c.translate(cx,cy);c.rotate(Math.sin(flip*3)*.09);c.fillStyle=flip%2?'#fff8e5':'#f27672';c.strokeStyle='#252334';c.lineWidth=6;c.fillRect(-w*.34,-95,w*.68,190);c.strokeRect(-w*.34,-95,w*.68,190);text(['어떤 일?','고민 끝!','준비됐어?'][flip%3],0,-10,Math.min(43,w*.09),'#252334');labelCycle(t,0,45,'#252334');c.restore();}
      else{const q=Math.min(1,(t-.77)/.35);burst(cx,cy,q,'#ee5c62');c.save();c.translate(cx,cy);c.rotate(-.06);c.beginPath();for(let i=0;i<32;i++){const a=i*Math.PI/16,r=(i%2?1:.85)*Math.min(w*.46,380);const x=Math.cos(a)*r,y=Math.sin(a)*r*.57;if(!i)c.moveTo(x,y);else c.lineTo(x,y);}c.closePath();c.fillStyle='#fff8e5';c.fill();c.strokeStyle='#252334';c.lineWidth=5;c.stroke();c.restore();}
    }
    function draw(now){if(stopped)return;const elapsed=Math.max(0,(now-start)/duration),t=reduced?1:Math.min(elapsed,1.18);const n=t<.18?0:t<.56?1:t<.77?2:3;setPhase(n);telemetry.textContent=`${theme.toUpperCase()} / ${Math.min(100,Math.floor(t*100))}%`;
      if(c){c.clearRect(0,0,w,h);c.save();if(!reduced&&t>=.77&&t<.87){const v=(.87-t)*65;c.translate(Math.sin(t*720)*v,Math.cos(t*600)*v);}({breakout:wall,overdrive:drive,capsule,comic}[theme])(t);c.restore();}
      if((elapsed>=1||reduced)&&!ready){ready=true;onReady();}
      if(!ready||(!reduced&&elapsed<1.2))raf=requestAnimationFrame(draw);
    }
    draw(performance.now());
    return ()=>{stopped=true;cancelAnimationFrame(raf);observer.disconnect();if(audio&&audio.state!=='closed')audio.close().catch(()=>{});};
  };
})();

/* A one-click fishing trip. Cosmetic only; task choice belongs to the shared engine. */
(function(){
 'use strict';
 window.playFishingReveal=function({duration=4000,sound=false,reduced=false,onReady}){
  const dialog=document.getElementById('orbit-dialog'),canvas=document.getElementById('orbit-canvas'),c=canvas.getContext('2d');
  const started=performance.now(),fishColors=['#ee9762','#d5b34b','#67a7a0'],catchColor=fishColors[Math.floor(Math.random()*3)];
  let w=0,h=0,raf=null,stopped=false,ready=false,lastPhase=-1,audio=null;
  const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);},mix=(a,b,q)=>a+(b-a)*q;
  const swimmers=Array.from({length:7},(_,i)=>({a:i*.9+Math.random()*.5,r:.35+Math.random()*.4,color:fishColors[i%3],size:.7+Math.random()*.4}));
  const drops=Array.from({length:24},(_,i)=>({a:i*Math.PI*2/24,v:.5+Math.random()*.8}));
  if(sound&&!reduced){try{audio=new(window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch(_){}}
  function plop(freq,len=.12,vol=.045){if(!audio)return;try{const o=audio.createOscillator(),g=audio.createGain(),at=audio.currentTime;o.type='sine';o.frequency.setValueAtTime(freq,at);o.frequency.exponentialRampToValueAtTime(65,at+len);g.gain.setValueAtTime(vol,at);g.gain.exponentialRampToValueAtTime(.001,at+len);o.connect(g);g.connect(audio.destination);o.start();o.stop(at+len+.01);}catch(_){}}
  function ellipse(x,y,rx,ry,fill,stroke='#345646',lw=2){c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
  function path(points,fill,stroke='#345646',lw=3){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
  function fish(x,y,size,rotation,color,shadow=false){
   c.save();c.translate(x,y);c.rotate(rotation);c.scale(size,size);
   if(shadow){ellipse(0,6,27,9,'#3c6b7830',null);c.restore();return;}
   c.lineJoin='round';
   path([[-25,0],[-48,-19],[-43,5],[-47,23],[-22,10]],color,'#365b55',2.8);
   path([[-8,-16],[0,-30],[14,-19],[22,-13]],'#b5cab4','#365b55',2.5);
   const g=c.createLinearGradient(0,-22,0,24);g.addColorStop(0,color);g.addColorStop(.6,color);g.addColorStop(.62,'#fff4d7');g.addColorStop(1,'#ddd8b7');
   ellipse(0,0,34,23,g,'#365b55',3);
   path([[-1,6],[8,20],[-10,14]],'#d09c64','#6d795c',1.5);
   c.beginPath();c.arc(15,0,10,-1.2,1.2);c.strokeStyle='#6a8064';c.lineWidth=1.5;c.stroke();
   ellipse(20,-6,6,7,'#fffdf0','#365b55',1.8);ellipse(22,-6,2,3,'#263e38',null);
   c.beginPath();c.moveTo(31,4);c.lineTo(38,1);c.strokeStyle='#365b55';c.lineWidth=2;c.stroke();
   c.beginPath();c.moveTo(-15,-12);c.quadraticCurveTo(-5,-17,4,-14);c.strokeStyle='#fffce8aa';c.lineWidth=3;c.stroke();c.restore();
  }
  function tree(x,y,scale){c.save();c.translate(x,y);c.scale(scale,scale);ellipse(5,13,39,9,'#3b5e3720',null);path([[-9,7],[-4,-48],[8,-46],[13,9]],'#977451','#405438',3);[[-24,-56,25],[-5,-76,28],[22,-61,26],[0,-48,29]].forEach(([x,y,r],i)=>ellipse(x,y,r,r*.9,['#8cad60','#a6bb65','#809e53','#a4b865'][i],'#405438',3));c.restore();}
  function draw(now){
   if(stopped||!c)return;
   const t=reduced?1:clamp((now-started)/duration),stage=t<.26?0:t<.61?1:t<.87?2:3;
   if(stage!==lastPhase){lastPhase=stage;dialog.dataset.phase=String(stage);document.getElementById('orbit-phase').textContent=['오늘 할 일, 하나 낚으러 가요','까딱, 까딱… 입질이 왔어요','지금이다! 힘껏 낚아 올려요','오늘의 월척!'][stage];if(stage===1)plop(430);if(stage===2)plop(760,.23,.07);if(stage===3)plop(520,.25,.045);}
   document.getElementById('orbit-coordinates').textContent='고민 낚시터 / '+String(Math.floor(t*100)).padStart(3,'0');
   c.clearRect(0,0,w,h);const wide=w>=800,unit=Math.min(w/460,h/760),cx=w*.5,cy=h*.5,rx=Math.min(w*.46,510),ry=Math.min(h*.22,190);
   const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#a8d5e3');sky.addColorStop(.38,'#e7efdc');sky.addColorStop(.39,'#e4dfbb');sky.addColorStop(1,'#f1ead2');c.fillStyle=sky;c.fillRect(0,0,w,h);
   // Puffy, cut-paper clouds and an uneven shoreline give the scene its old game character.
   [[w*.15,h*.19,38],[w*.75,h*.16,45]].forEach(([x,y,r])=>{ellipse(x,y,r*unit,r*.25*unit,'#fff9e8',null);ellipse(x-r*.25*unit,y-r*.15*unit,r*.46*unit,r*.30*unit,'#fff9e8',null);});
   c.fillStyle='#b3bd7b';c.beginPath();c.moveTo(0,h*.36);c.quadraticCurveTo(w*.25,h*.23,w*.48,h*.36);c.quadraticCurveTo(w*.78,h*.24,w,h*.36);c.lineTo(w,h*.42);c.lineTo(0,h*.42);c.fill();
   tree(cx-rx*.78,cy-ry*.77,.77*unit);tree(cx+rx*.75,cy-ry*.92,1.02*unit);
   ellipse(cx,cy+12*unit,rx+8*unit,ry+10*unit,'#a29b71','#5b7053',4*unit);
   const water=c.createLinearGradient(0,cy-ry,0,cy+ry);water.addColorStop(0,'#76aba8');water.addColorStop(.45,'#a9ced0');water.addColorStop(1,'#bddad0');
   ellipse(cx,cy,rx,ry,water,'#597c67',4*unit);ellipse(cx,cy-3*unit,rx-8*unit,ry-7*unit,null,'#e1e9cc',2*unit);
   c.save();c.beginPath();c.ellipse(cx,cy,rx-10*unit,ry-7*unit,0,0,Math.PI*2);c.clip();
   for(let i=0;i<6;i++){const yy=cy-ry*.67+i*ry*.27;c.beginPath();c.moveTo(cx-rx*.7,yy);c.bezierCurveTo(cx-rx*.25,yy-5*unit,cx+rx*.25,yy+5*unit,cx+rx*.7,yy);c.strokeStyle='#e5f1da55';c.lineWidth=2*unit;c.stroke();}
   swimmers.forEach((f,i)=>{const a=f.a+t*(i%2?1:-1)*1.9,fx=cx+Math.cos(a)*rx*f.r,fy=cy+Math.sin(a)*ry*f.r;fish(fx+5,fy+10,.48*unit*f.size,Math.sin(a)*.5,f.color,true);c.save();c.globalAlpha=.6;fish(fx,fy,.48*unit*f.size,Math.sin(a)*.5+(i%2?Math.PI:0),f.color);c.restore();});
   c.restore();
   // Reeds lean at different angles instead of repeating in a straight border.
   [-.88,-.61,.65,.88].forEach((x,i)=>{const gx=cx+rx*x,gy=cy+ry*Math.sqrt(1-x*x)+13*unit;c.strokeStyle='#617c47';c.lineWidth=4*unit;for(let j=0;j<3;j++){c.beginPath();c.moveTo(gx,gy);c.quadraticCurveTo(gx+(j-1)*9*unit,gy-16*unit,gx+(j-1)*12*unit,gy-(22+j%2*8)*unit);c.stroke();}});
   const cast=ease(t/.24),lift=ease((t-.61)/.23),bobX=mix(w*.84,cx,cast),bobY=mix(h*.3,cy,cast)-Math.sin(cast*Math.PI)*h*.20;
   const strike=t>.49&&t<.62?Math.sin((t-.49)*100)*7*unit:0;
   const finalFishY=wide?h*.31:Math.max(155,h*.27),hookY=mix(bobY+strike,finalFishY,lift);
   const handX=w*.92,handY=h*.51,tipX=mix(w*.70,w*.63,lift),tipY=mix(h*.17,h*.10,lift);
   // Bent bamboo rod, wound handle, reel and a curved line stay connected during the catch.
   c.save();c.lineCap='round';c.beginPath();c.moveTo(handX,handY);c.quadraticCurveTo(w*.72,h*.23+lift*h*.13,tipX,tipY);c.strokeStyle='#36584b';c.lineWidth=9*unit;c.stroke();c.strokeStyle='#b08e4e';c.lineWidth=5*unit;c.stroke();
   c.beginPath();c.moveTo(handX,handY);c.lineTo(handX-18*unit,handY-43*unit);c.strokeStyle='#70543a';c.lineWidth=14*unit;c.stroke();ellipse(handX-16*unit,handY-16*unit,10*unit,11*unit,'#d4bc7d','#36584b',2*unit);
   c.beginPath();c.moveTo(tipX,tipY);c.quadraticCurveTo(mix(tipX,bobX,.6),tipY+(hookY-tipY)*.45,bobX,hookY);c.strokeStyle='#f7f0d7';c.lineWidth=1.5*unit;c.stroke();c.restore();
   if(t>.21&&t<.69){const q=clamp((t-.21)/.16);c.save();c.globalAlpha=1-q*.7;ellipse(cx,cy,8*unit+q*40*unit,(3+q*10)*unit,null,'#f1f4d4',2*unit);c.restore();}
   if(t<.65){c.save();c.translate(bobX,bobY+strike);c.rotate(t>.4?Math.sin(t*85)*.18:-.15);if(t>.55)c.globalAlpha=1-clamp((t-.55)/.1);c.strokeStyle='#465c42';c.lineWidth=2*unit;c.beginPath();c.moveTo(0,-24*unit);c.lineTo(0,7*unit);c.stroke();ellipse(0,-5*unit,6*unit,14*unit,'#f6e9c3','#465c42',2*unit);c.fillStyle='#cf6147';c.beginPath();c.ellipse(0,-9*unit,5*unit,9*unit,0,Math.PI,Math.PI*2);c.fill();c.restore();}
   if(t>.61){const q=clamp((t-.61)/.25);c.save();c.globalAlpha=1-q;drops.forEach(p=>{const dx=Math.cos(p.a)*q*100*unit*p.v,dy=Math.sin(p.a)*q*65*unit*p.v+q*q*85*unit;ellipse(cx+dx,cy+dy,3*unit,6*unit,'#e9f4dc',null);});c.restore();
    const s=(.45+lift*.65)*unit,wiggle=(1-lift)*Math.sin(t*110)*.25;fish(cx,hookY+28*unit,s,-.40+wiggle,catchColor);
    if(t>.76){c.save();c.translate(cx,hookY-44*unit);c.rotate(-.08);c.font=`900 ${Math.max(23,32*unit)}px system-ui,sans-serif`;c.textAlign='center';c.lineWidth=6*unit;c.strokeStyle='#fff5d8';c.strokeText('낚았다!',0,0);c.fillStyle='#b35036';c.fillText('낚았다!',0,0);c.restore();}
   }
   // A short kick at the strike, not a constant screen shake.
   canvas.style.transform=t>.61&&t<.67?`translate(${Math.sin(t*400)*3}px,${Math.cos(t*330)*2}px)`:'none';
   if(t>=1&&!ready){ready=true;onReady();}
   if(!ready)raf=requestAnimationFrame(draw);
  }
  function resize(){w=canvas.clientWidth;h=canvas.clientHeight;const d=Math.min(devicePixelRatio||1,2);canvas.width=w*d;canvas.height=h*d;c.setTransform(d,0,0,d,0,0);if(ready&&!stopped)draw(started+duration);}
  resize();const observer=new ResizeObserver(resize);observer.observe(canvas);draw(performance.now());
  return()=>{stopped=true;cancelAnimationFrame(raf);observer.disconnect();canvas.style.removeProperty('transform');if(audio&&audio.state!=='closed')audio.close().catch(()=>{});};
 };
})();
