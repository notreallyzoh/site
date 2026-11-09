/* Portfolio-only transport. Never connects to the former StudioHQ server. */
(() => {
  'use strict';
  const h=window.HQ_HISTORY, esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const reply=(body,status=200)=>Promise.resolve(new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}}));
  const message='Historical demo: this action is disabled. No agent runs, messages or record changes are sent.';
  try{sessionStorage.setItem('hq-history-console-scenezero-v1','1');localStorage.setItem('hq-history-console-mode-v1','studio')}catch{}
  window.historicalShot=id=>{const r=h.reviews.find(r=>r.id===id);return r?.image?'../archive/'+r.image:''};
  const reviews=h.reviews.map(r=>({...r,note:r.summary,capturedAt:r.date,shot:!!r.image,events:r.events.map(e=>({...e,verdict:e.action})),verdict_note:r.events.at(-1)?.note,verdict_at:r.events.at(-1)?.at}));
  const flow={slug:'studio-reel-test',name:'Studio reel test / archived',camera:{x:30,y:100,zoom:.65},nodes:h.flow.nodes.map((n,i)=>({...n,x:i*300,y:0,w:260,h:170,data:i===0?{text:'Saved studio-ident pipeline test. Source footage was an FFmpeg test pattern.'}:i===3?{reviewCard:reviews.find(r=>r.id==='studio-reel-test-e0a932a8')}:{op:n.operation,progress:n.progress,finishedAt:n.finishedAt}})),edges:h.flow.edges};
  const state={generatedAt:'2026-10-13T08:41:39.075Z',jobs:[],clients:[],git:[],cron:[],roster:{},ticker:['HISTORICAL DEMO — original StudioHQ frontend, selected saved records.','Pane layouts and canvas positions are local. Work records stay unchanged.'],review:reviews,roadmap:[],gemini:null,agentsActive:{hermesGateway:false,claudeWorkers:0,geminiAuthed:false,total:0},orchestration:{units:[],processes:{claude:0,opencode:0}},
    tasks:h.tasks.map((t,i)=>({hash:'archived-'+i,text:t.title,done:t.done,steps:['Recorded due date: '+t.due,'Historical checkbox state; infrastructure instructions excluded.']})),
    links:{org:'../archive/#about',repos:[]},
    jams:{items:[{slug:'2026-07-28-1400',topic:'How do we describe our process honestly? Selected agent-generated excerpts, not verified status reports.',capturedAt:'2026-07-28T08:30:49.952Z',turns:h.conversation.map(c=>({speaker:c.name,text:c.text})),deptUpdates:[]}]},
    library:{lessons:h.lessons.map((l,i)=>({slug:'history-'+i,title:l.title,topic:l.topic,capturedAt:l.date,body:l.text+' '+l.boundary,source:l.source,appliesTo:[],isNew:false})),queue:[],inbox:[],inboxCount:0,collection:[]}};
  window.fetch=(input,options={})=>{
    const url=new URL(typeof input==='string'?input:input.url,location.href);const path=url.pathname.split('/api/')[1];const method=(options.method||input.method||'GET').toUpperCase();
    if(method==='GET'&&path==='state')return reply(state);
    if(method==='GET'&&path==='canvas/flows')return reply({flows:[{slug:flow.slug,name:flow.name,nodeCount:flow.nodes.length}]});
    if(method==='GET'&&path==='canvas/flow')return reply({flow});
    if(method==='GET'&&path==='canvas/now')return reply({items:[]});
    if(method==='GET'&&['fuel','rnd'].includes(path))return reply({});
    // Only viewport/layout coordinates can change, in memory for this tab.
    if(method==='POST'&&['canvas/flow/camera','canvas/node/update'].includes(path)){
      let b;try{b=JSON.parse(options.body)}catch{return reply({error:message},403)}
      if(path==='canvas/node/update'){
        const n=flow.nodes.find(n=>n.id===b.nodeId);const patch=b.patch||{};
        if(!n||Object.keys(patch).some(k=>!['x','y','w','h'].includes(k))||Object.values(patch).some(v=>!Number.isFinite(v)))return reply({error:message},403);
        Object.assign(n,patch);
      }
      return reply({flow,ok:true});
    }
    return reply({error:message},403);
  };
  window.renderHistoricalAgenda=()=>{
    const target=document.querySelector('[data-pane="agenda"] .term-body');
    if(!target||target.dataset.history)return;target.dataset.history='true';
    target.innerHTML='<p class="demo-pane-note">Historical activity / capture dates · No live schedule</p>'+h.reviews.map(r=>'<div class="demo-event"><time>'+esc(r.date.slice(0,10))+'</time><strong>'+esc(r.title)+'</strong><span>'+esc(r.status)+' · '+esc(r.project)+'</span></div>').join('');
  };
  document.addEventListener('DOMContentLoaded',()=>{
    const text=(id,t)=>{const el=document.getElementById(id);if(el)el.textContent=t};
    const help=(pane,t)=>{const body=document.querySelector('[data-pane="'+pane+'"] .term-body');if(body){const p=document.createElement('p');p.className='demo-pane-note';p.textContent=t;body.prepend(p)}};
    help('review','Saved decisions, dates and edited notes. Click an original screenshot to enlarge it. Approval controls are disabled.');
    help('canvas','Saved graph. Pan, zoom, select or move nodes locally. Stored idle states and saved progress fields are preserved; no processing runs.');
    help('roster','Original agent role cards. Activity is unavailable in this export; no agents are online.');
    help('tasks','Historical checkbox states. Expand tasks for recorded dates. Checking or adding tasks is disabled.');
    help('flow','Original architecture diagram; not live telemetry.');
    help('library','Saved lesson summaries. Open a lesson to read it. No research jobs are dispatched.');
    text('links-org','Source and archive notes ↗');
    text('concierge-transcript','No verified Hermes chat history is included. This was a separate agent session in the deployed app. Chat is disabled in this historical demo.');
    const blocked='#concierge-send,#concierge-input,#commons-topic-send,#commons-topic-input,.task-check,.review-approve,.review-rework,.review-comment,.review-composer-send,.review-amend-btn,#canvas-inspector input,#canvas-inspector textarea,#canvas-inspector .canvas-btn:not(#canvas-insp-open-eye),#canvas-new-flow-btn,#librarian-send,#librarian-input';
    const freeze=()=>{document.querySelectorAll(blocked).forEach(e=>{e.disabled=true;e.title=message});document.querySelectorAll('form input,form textarea,form button').forEach(e=>{e.disabled=true;e.title=message});};
    freeze();new MutationObserver(freeze).observe(document.getElementById('grid'),{childList:true,subtree:true});
    document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();text('demo-status',message)},true);
    document.addEventListener('click',e=>{
      const a=e.target.closest('a');if(a&&a.getAttribute('href')?.includes('./api/')){e.preventDefault();e.stopImmediatePropagation();text('demo-status',message)}
      const b=e.target.closest('[data-demo-pane]');if(b){document.querySelector('[data-rail="'+b.dataset.demoPane+'"]')?.click();document.querySelector('[data-pane="'+b.dataset.demoPane+'"] [data-action="fullscreen"]')?.click();}
      if(e.target.id==='demo-reset'){try{Object.keys(localStorage).filter(k=>k.startsWith('hq-history-console-')).forEach(k=>localStorage.removeItem(k))}catch{}location.reload()}
    },true);
    // Show an evidence-first original loadout on a fresh visit.
    setTimeout(()=>document.querySelector('[data-loadout="REVIEW"]')?.click(),400);
  });
})();
