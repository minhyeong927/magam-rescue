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
