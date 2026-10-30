/* Interlace Loop Studio — original Canvas implementation, Zoheb Mamoo portfolio edition. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('art'), ctx = canvas.getContext('2d', { alpha: false });
  const TAU = Math.PI * 2;
  const palettes = {
    electric: ['#164bff', '#00ef9c', '#fff43a'], acid: ['#ae38ff', '#b8ff22', '#00d7ff'],
    ember: ['#ff4b19', '#ffd78b', '#79efff'], mono: ['#f2f1e9', '#a9b4bd', '#ffffff']
  };
  const defaults = { layout:'diamond', symmetry:'mirror', columns:8, rows:2, scale:.86, detail:7, seed:271,
    glyph:1, petal:1, orbit:.7, ribbon:.65, lattice:.3, palette:'electric',
    color1:'#164bff', color2:'#00ef9c', color3:'#fff43a', background:'#050607', hue:0, glow:2, line:1,
    bpm:120, bars:4, cycles:2, motion:.55, spread:.4, size:'1600x400' };
  const presets = {
    garden: { ...defaults },
    circuit: { ...defaults, seed:17, layout:'grid', columns:10, detail:5, petal:0, orbit:.25, ribbon:.3, lattice:.6, palette:'acid', scale:.8, motion:.3 },
    bloom: { ...defaults, seed:74, columns:7, symmetry:'radial', glyph:0, petal:1, orbit:.3, ribbon:1, lattice:.15, palette:'ember', detail:9, scale:1, motion:.8, spread:.7 },
    pulse: { ...defaults, seed:81, layout:'bands', columns:6, rows:3, glyph:.3, petal:.2, orbit:1, ribbon:.2, lattice:.2, palette:'acid', cycles:4, motion:.75 }
  };
  let state = {...defaults}, phase = 0, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastTime = performance.now(), lastDraw = 0, recording = null;
  const controls = Object.keys(defaults);
  const duration = () => 60 / state.bpm * 4 * state.bars;
  const message = text => { $('status').textContent = text; };
  const hash = n => { const x = Math.sin(n * 127.1 + state.seed * 311.7) * 43758.5453; return x - Math.floor(x); };
  function shifted(hex) {
    if (!state.hue) return hex;
    let [r,g,b] = hex.slice(1).match(/../g).map(v => parseInt(v,16)/255);
    const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min, l=(max+min)/2;
    let h=0; if(d) h = max===r ? ((g-b)/d+6)%6 : max===g ? (b-r)/d+2 : (r-g)/d+4;
    return `hsl(${(h*60+state.hue)%360} ${d ? d/(1-Math.abs(2*l-1))*100 : 0}% ${l*100}%)`;
  }
  function colors() { return [state.color1,state.color2,state.color3].map(shifted); }
  function gradient(r, cs, turn=0) {
    const g=ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0,cs[turn%3]); g.addColorStop(.52,cs[(turn+1)%3]); g.addColorStop(1,cs[(turn+2)%3]); return g;
  }
  function path(points, close=true) {
    ctx.beginPath(); points.forEach(([x,y],i)=>i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); if(close)ctx.closePath();
  }
  function diamond(x,y,r,fill=false) {
    path([[x,y-r],[x+r,y],[x,y+r],[x-r,y]]); fill ? ctx.fill() : ctx.stroke();
  }
  function glyph(r,t,cs) {
    ctx.save(); ctx.rotate(Math.sin(t)*state.motion*.12);
    ctx.strokeStyle=cs[0]; ctx.shadowColor=cs[0]; ctx.lineWidth=state.line*2;
    // A stepped cross inside a diamond: one reusable geometric vocabulary.
    const points=[[-1,-3],[1,-3],[1,-1],[3,-1],[3,1],[1,1],[1,3],[-1,3],[-1,1],[-3,1],[-3,-1],[-1,-1]];
    ctx.rotate(Math.PI/4);
    for(let k=0;k<3;k++) {
      const u=r*(.19-k*.033)*(1+Math.sin(t)*.035*state.motion);
      ctx.strokeStyle=cs[k]; path(points.map(([x,y])=>[x*u,y*u])); ctx.stroke();
    }
    ctx.rotate(-Math.PI/4);
    ctx.fillStyle=gradient(r,cs); diamond(0,0,r*.11,true);
    for(let side=0;side<4;side++) {
      ctx.save();ctx.rotate(side*Math.PI/2);
      for(let j=0;j<state.detail;j++) {
        const y=r*(.72+j*.1), sz=r*(.035+(j%2)*.015);
        ctx.strokeStyle=cs[j%3];diamond(0,y,sz);if(j%3===0)diamond(-r*.19,y,sz*.55);
      }
      ctx.restore();
    }
    ctx.restore();
  }
  function petals(r,t,cs) {
    ctx.save();ctx.translate(0,r*.45);
    const count=state.detail;
    for(let j=0;j<count;j++) {
      const a=(j/(count-1)-.5)*2.1;
      const len=r*(.65+.3*Math.cos(a))*(1+state.motion*.15*Math.sin(t+a));
      ctx.save();ctx.rotate(a+state.motion*.13*Math.sin(t));
      ctx.fillStyle=gradient(len,cs,j);ctx.shadowColor=cs[j%3];
      ctx.beginPath();ctx.moveTo(0,0);
      ctx.bezierCurveTo(-len*.035,-len*.55,-len*.18,-len,0,-len);
      ctx.bezierCurveTo(len*.18,-len,len*.035,-len*.55,0,0);ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  function orbits(r,t,cs) {
    ctx.save();ctx.lineWidth=state.line*1.4;
    for(let j=0;j<Math.ceil(state.detail/2);j++) {
      const rr=r*(.2+j*.12)*(1+.08*state.motion*Math.sin(t+j*.5));
      ctx.strokeStyle=cs[j%3];ctx.shadowColor=cs[j%3];
      ctx.beginPath();ctx.ellipse(0,0,rr,rr*(.78+.12*Math.cos(t)*state.motion),j*.25,0,TAU);ctx.stroke();
      const a=Math.sin(t)*(j%2 ? -1 : 1)*state.motion*TAU+j*1.1;
      ctx.fillStyle=cs[(j+1)%3];ctx.beginPath();ctx.arc(Math.cos(a)*rr,Math.sin(a)*rr*.8,r*.025,0,TAU);ctx.fill();
    }
    ctx.restore();
  }
  function ribbons(r,t,cs) {
    ctx.save();ctx.lineWidth=state.line*1.2;
    for(let j=0;j<Math.ceil(state.detail/2);j++) {
      const x=(j-(Math.ceil(state.detail/2)-1)/2)*r*.13;
      const bend=r*(.4+Math.sin(t+j*.2)*state.motion*.25);
      ctx.strokeStyle=cs[j%3];ctx.shadowColor=cs[j%3];
      ctx.beginPath();ctx.moveTo(x-r*.3,-r*.9);ctx.bezierCurveTo(x+bend,-r*.3,x-bend,r*.3,x+r*.3,r*.9);ctx.stroke();
      ctx.fillStyle=cs[(j+1)%3];ctx.beginPath();ctx.arc(x-r*.3,-r*.9,r*.03,0,TAU);ctx.fill();
    }
    ctx.restore();
  }
  function render(p=phase) {
    // Normalize endpoints before trigonometry so phase 0 and 1 are identical pixels.
    p=((p%1)+1)%1;
    const [w,h]=state.size.split('x').map(Number);
    if(canvas.width!==w || canvas.height!==h){canvas.width=w;canvas.height=h;}
    ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.shadowBlur=0;
    ctx.fillStyle=state.background;ctx.fillRect(0,0,w,h);
    const cs=colors(), cw=w/state.columns, ch=h/state.rows;
    const r=Math.min(cw,ch)*.43*state.scale, clock=TAU*p*state.cycles;
    for(let row=0;row<state.rows;row++)for(let col=0;col<state.columns;col++) {
      const mirror=state.symmetry==='mirror', mc=mirror?Math.min(col,state.columns-1-col):col;
      const id=row*state.columns+mc, rnd=hash(id+1), kind=(mc+row*2+Math.floor(hash(row+13)*4))%4;
      const t=clock+state.spread*TAU*(mc/state.columns+row/state.rows)*.5;
      ctx.save();ctx.translate((col+.5)*cw,(row+.5)*ch);
      if(mirror && col>=state.columns/2)ctx.scale(-1,1);
      if(state.symmetry==='radial')ctx.rotate(((row+col)%4)*Math.PI/2);
      if(state.lattice){
        ctx.globalAlpha=state.lattice;ctx.strokeStyle='#9da6b2';ctx.lineWidth=.65*state.line;
        for(let k=0;k<3;k++) {
          const rr=r*(1.03+k*.22);
          if(state.layout==='diamond')diamond(0,0,rr);
          else if(state.layout==='grid')ctx.strokeRect(-rr,-rr,rr*2,rr*2);
          else {path([[-rr,-ch/2],[-rr,ch/2]],false);ctx.stroke();path([[rr,-ch/2],[rr,ch/2]],false);ctx.stroke();}
        }
      }
      ctx.shadowBlur=state.glow;
      const enabled=[state.glyph,state.petal,state.orbit,state.ribbon];
      // Pick the next enabled family so single-layer compositions still fill the field.
      let main=kind; for(let i=0;i<4 && !enabled[main];i++)main=(main+1)%4;
      const draw=[glyph,petals,orbits,ribbons];
      for(let k=0;k<4;k++)if(enabled[k]) {
        ctx.save();ctx.globalAlpha=enabled[k];
        if(k===main){
          if(state.layout==='diamond' && k===0)ctx.rotate((row%2)*Math.PI/2);
          draw[k](r*(1.12+rnd*.16),t,cs);
        } else if((id+k)%3===0) {
          ctx.translate(cw*.34, -ch*.34);ctx.scale(.28,.28);draw[k](r,t,cs);
        }
        ctx.restore();
      }
      // Small linking marks carry the palette into the negative space.
      if(enabled.some(Boolean))for(let j=0;j<3;j++) {
        ctx.globalAlpha=.65;ctx.fillStyle=cs[j];ctx.shadowBlur=0;
        diamond(-cw*.38,-ch*.28+j*r*.12,r*.018*(1+.2*state.motion*Math.sin(t+j)),true);
      }
      ctx.restore();
    }
    ctx.globalAlpha=1;ctx.shadowBlur=0;
  }
  function sync() {
    for(const key of controls) {
      $(key).value=state[key];
      const out=document.querySelector(`output[for="${key}"]`);if(out)out.textContent=state[key];
    }
    $('duration').textContent=`${duration().toFixed(2)} s / ${state.bpm} BPM`;
    $('play').textContent=playing?'Pause':'Play';$('phase').value=phase;
  }
  function readValue(key, value) {
    const el=$(key);
    if(el.tagName==='SELECT') {
      if(!Array.from(el.options).some(o=>o.value===String(value)))throw new Error(`Invalid ${key}`);
      return typeof defaults[key]==='number'?Number(value):value;
    }
    if(el.type==='color') {if(!/^#[\da-f]{6}$/i.test(value))throw new Error(`Invalid ${key}`);return value;}
    if(typeof value!=='number' && typeof value!=='string')throw new Error(`Invalid ${key}`);
    if(String(value).trim()==='' || !Number.isFinite(Number(value)))throw new Error(`Invalid ${key}`);
    let n=Math.max(Number(el.min),Math.min(Number(el.max),Number(value)));
    if(el.step==='1')n=Math.round(n);return n;
  }
  function setPalette() { if(palettes[state.palette]) [state.color1,state.color2,state.color3]=palettes[state.palette]; }
  const grids={'1600x400':[8,2],'1920x1080':[8,4],'1080x1080':[5,5],'1080x1920':[4,6]};
  function fitGrid() { [state.columns,state.rows]=grids[state.size]; }
  function selectPreset(name) {
    const size=state.size;state={...presets[name],size};if(size!=='1600x400')fitGrid();setPalette();phase=0;lastTime=performance.now();sync();render();
    $('presetName').textContent=$('preset').selectedOptions[0].textContent;
  }
  controls.forEach(key=>$(key).addEventListener(['bpm','seed'].includes(key)?'change':'input',()=>{
    try{state[key]=readValue(key,$(key).value);}catch{return;}
    if(key==='palette')setPalette();
    if(key==='size'){fitGrid();message('Canvas changed and grid adapted. Adjust columns and rows to refine the density.');}
    if(/^color[123]$/.test(key))state.palette='custom';
    $('presetName').textContent='Custom composition';sync();render();
  }));
  // Restore valid values on blur if an incomplete number was left in a field.
  ['bpm','seed'].forEach(key=>$(key).addEventListener('change',sync));
  $('preset').onchange=()=>selectPreset($('preset').value);
  $('variation').onclick=()=>{state.seed=1+Math.floor(Math.random()*99999);sync();render();$('presetName').textContent='New variation';};
  $('play').onclick=()=>{playing=!playing;lastTime=performance.now();sync();};
  $('reset').onclick=()=>{phase=0;lastTime=performance.now();sync();render();};
  $('phase').oninput=()=>{playing=false;phase=Number($('phase').value);sync();render();};
  $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await canvas.parentElement.requestFullscreen();}catch{message('Full screen is unavailable in this browser.');}};
  function download(blob,name) {
    const url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  $('png').onclick=()=>canvas.toBlob(blob=>{if(blob){download(blob,`interlace-${state.seed}.png`);message('PNG saved at the selected canvas size.');}else message('PNG export failed.');},'image/png');
  $('save').onclick=()=>{download(new Blob([JSON.stringify({format:'interlace-loop',version:1,settings:state},null,2)],{type:'application/json'}),`interlace-${state.seed}.json`);message('Settings saved. Load them to recreate this composition.');};
  $('load').onclick=()=>$('file').click();
  $('file').onchange=async()=>{
    const file=$('file').files[0];if(!file)return;
    try {
      if(file.size>65536)throw new Error('Settings file is too large.');
      const data=JSON.parse(await file.text());
      if(data.format!=='interlace-loop'||data.version!==1||!data.settings)throw new Error('Choose an Interlace Loop Studio settings file.');
      const next={...defaults};for(const key of controls)if(Object.hasOwn(data.settings,key))next[key]=readValue(key,data.settings[key]);
      state=next;phase=0;sync();render();$('presetName').textContent='Loaded composition';message('Composition loaded.');
    }catch(err){message(`Could not load settings: ${err.message}`);}finally{$('file').value='';}
  };
  const mime = typeof MediaRecorder!=='undefined' ? ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m)) : null;
  const canRecord=!!mime && typeof canvas.captureStream==='function';
  if(!canRecord){$('record').disabled=true;message('Video recording is unavailable here. PNG and settings export are available.');}
  function lock(active) {
    document.querySelectorAll('aside input, aside select, aside button, .transport button, #phase').forEach(el=>{el.disabled=active;});
    $('record').disabled=!canRecord;$('record').textContent=active?'Cancel recording':'Record one loop';
  }
  function finishRecording(cancel=false) {
    if(!recording)return;recording.cancelled ||= cancel;clearTimeout(recording.timer);
    if(recording.recorder.state!=='inactive')recording.recorder.stop();
  }
  $('record').onclick=()=>{
    if(recording){finishRecording(true);return;}
    let stream;const previous={playing,phase};
    try {
      playing=false;phase=0;render(0);sync();
      stream=canvas.captureStream(30);
      const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:12000000});
      const rec={recorder,stream,chunks:[],start:performance.now(),previous,cancelled:false};recording=rec;
      recorder.ondataavailable=e=>{if(e.data.size)rec.chunks.push(e.data);};
      recorder.onerror=()=>{rec.cancelled=true;finishRecording(true);};
      recorder.onstop=()=>{
        stream.getTracks().forEach(t=>t.stop());clearTimeout(rec.timer);
        if(!rec.cancelled && rec.chunks.length){download(new Blob(rec.chunks,{type:mime}),`interlace-${state.seed}.webm`);message('Loop recorded. Real-time capture can drop frames on busy devices.');}
        else message('Recording cancelled. No video saved.');
        recording=null;playing=rec.previous.playing;phase=rec.previous.phase;lastTime=performance.now();lock(false);sync();render();
      };
      recorder.start();rec.start=performance.now();
      rec.timer=setTimeout(()=>finishRecording(),duration()*1000);
      lock(true);message(`Recording ${duration().toFixed(2)} seconds. Keep this tab visible.`);
    }catch(err){stream?.getTracks().forEach(t=>t.stop());recording=null;playing=previous.playing;phase=previous.phase;lastTime=performance.now();lock(false);sync();render();message(`Recording unavailable: ${err.message}`);}
  };
  document.addEventListener('visibilitychange',()=>{lastTime=performance.now();if(document.hidden && recording)finishRecording(true);});
  function tick(now) {
    const dt=(now-lastTime)/1000;lastTime=now;
    if(recording)phase=Math.min((now-recording.start)/1000/duration(),1);
    else if(playing && !document.hidden)phase=(phase+dt/duration())%1;
    if((recording||playing) && now-lastDraw>=1000/30){render();$('phase').value=phase;lastDraw=now;}
    requestAnimationFrame(tick);
  }
  sync();render();requestAnimationFrame(tick);
  // Read-only snapshot and deterministic render entry point for seam verification.
  window.loopStudio={render, get settings(){return {...state};},get duration(){return duration();}};
})();
