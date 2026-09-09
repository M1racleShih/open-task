const baseTasks = [
 {id:'OT-024',title:'确认客户访谈总结与需求优先级',project:'客户体验改进',parent:'9 月客户需求梳理',owner:'林悦',kind:'review',group:'action',status:'待我验收',wait:'2 天',who:'等待你验收',update:'已整理 12 位客户的反馈，补充了需求排序依据。',result:'形成一份可供产品排期使用的客户访谈总结，明确优先解决的三个问题及其依据。',criteria:['覆盖 12 位客户的访谈反馈，并保留来源。','按影响与紧迫程度排列前三项需求。','每项优先需求附上具体场景和建议。'],file:'客户访谈总结 · 第 2 版',filetype:'DOC',due:'9 月 10 日 18:00',at:'9 月 7 日 16:40'},
 {id:'OT-018',title:'协调试点客户的数据访问权限',project:'客户体验改进',parent:'试点客户验证',owner:'陈默',kind:'block',group:'action',status:'请求我协助',wait:'6 小时',who:'陈默需要你协调',update:'测试账号尚未开通，需要协助联系客户 IT 负责人。',result:'为两位试点客户取得可用的测试账号，完成数据读取验证。',criteria:['测试账号可以登录。','可读取约定范围内的脱敏数据。','记录权限申请及验证结果。'],due:'9 月 10 日 12:00',at:'9 月 9 日 09:00',dependency:'客户侧 IT 开通访问权限'},
 {id:'OT-031',title:'审核华东区域试点执行方案',project:'秋季业务试点',parent:'区域试点准备',owner:'周宁',kind:'review',group:'action',status:'待我验收',wait:'1 天',who:'等待你验收',update:'已补齐人员分工、预算与每周检查安排。',result:'完成华东区域的两周试点安排，明确人员、预算和复盘方式。',criteria:['覆盖两个试点城市及负责人。','预算控制在 3 万元以内。','列明第一周的检查点和退出条件。'],file:'华东试点执行方案',filetype:'DOC',due:'9 月 10 日 18:00',at:'9 月 8 日 14:20'},
 {id:'OT-036',title:'整理本周合作伙伴沟通纪要',project:'独立任务',parent:'团队直接任务',owner:'你',kind:'accept',group:'action',status:'待我接收',wait:'3 小时',who:'等待你确认接收',update:'许言下发了任务，希望周五前整理合作意向和下一步安排。',result:'汇总三家合作伙伴的讨论结论，供周五团队会议使用。',criteria:['逐家记录合作意向与未决问题。','每个后续动作有明确联系人和时间。'],due:'9 月 11 日 12:00',at:'9 月 9 日 12:00'},
 {id:'OT-027',title:'确认第二批试点客户名单',project:'秋季业务试点',parent:'区域试点准备',owner:'许言',kind:'pending',group:'follow',status:'尚未回应',wait:'1 天',who:'等待许言接收',update:'9 月 8 日已下发，尚未收到接收确认。',result:'筛选第二批五家试点客户，并确认各自参与意向。',criteria:['列出五家客户及联系人。','说明选择依据并记录参与意向。'],due:'9 月 11 日 18:00',at:'9 月 8 日 09:30'},
 {id:'OT-022',title:'完成服务流程的现场验证',project:'客户体验改进',parent:'服务流程优化',owner:'方禾',kind:'block',group:'follow',status:'执行受阻',wait:'4 小时',who:'等待赵川提供资料',update:'缺少最新服务规范，现场验证暂时无法继续。',result:'按照新版服务规范，在两个门店完成现场流程验证。',criteria:['覆盖两个门店的完整服务流程。','记录实际步骤与规范的差异。','提交可复现的问题清单。'],due:'9 月 12 日 18:00',at:'9 月 9 日 11:00',dependency:'赵川 · 发布新版服务规范'},
 {id:'OT-029',title:'确认培训范围调整',project:'秋季业务试点',parent:'一线团队培训',owner:'苏晴',kind:'change',group:'follow',status:'调整待确认',wait:'2 天',who:'等待苏晴确认第 2 版',update:'培训范围从销售团队扩大到门店运营，等待负责人确认。',result:'为试点销售与门店运营团队完成一次实操培训。',criteria:['覆盖销售及门店运营两个团队。','保留签到、课件及问题记录。'],due:'9 月 13 日 18:00',at:'9 月 7 日 11:00'}
];
const todoStates={done:{label:'已完成',icon:'circle-check'},doing:{label:'进行中',icon:'circle-dot'},blocked:{label:'受阻',icon:'triangle-alert'},todo:{label:'待开始',icon:'circle'}};
const checklist={
 'OT-024':[['汇总 12 位客户访谈记录','done'],['归纳共性问题与需求','done'],['完成需求优先级排序','done'],['补齐客户反馈与排序依据','done']],
 'OT-018':[['明确测试账号与权限范围','done'],['提交客户侧权限申请','done'],['开通两位试点客户账号','blocked'],['验证脱敏数据读取','todo']],
 'OT-031':[['确认试点城市与人员分工','done'],['完成预算及检查点安排','done'],['整理执行方案并提交','done']],
 'OT-036':[['整理三家伙伴的沟通记录','todo'],['确认合作意向与后续联系人','todo'],['汇总会议纪要','todo']],
 'OT-027':[['确认客户筛选条件','todo'],['联系五家候选客户','todo'],['汇总参与意向','todo']],
 'OT-022':[['确认两家验证门店','done'],['取得最新服务规范','blocked'],['执行门店现场验证','todo'],['提交差异与问题清单','todo']],
 'OT-029':[['整理销售团队培训内容','done'],['补充门店运营案例','doing'],['确认调整后的培训范围','todo'],['完成两组实操培训','todo']]
};
const labels={review:{text:'待验收',icon:'list-checks'},block:{text:'受阻',icon:'triangle-alert'},accept:{text:'待接收',icon:'inbox'},pending:{text:'未回应',icon:'clock'},change:{text:'待确认',icon:'circle-pause'},doing:{text:'进行中',icon:'circle-dot'},done:{text:'已完成',icon:'circle-check'}};

let tasks, selected, detailTab='overview', action='', theme='light';
let treeQuery='', collapsed=new Set(), graphScope='project', graphFocus=false, panelTab='attention', panelOpen=true;
let treeOpen=true, detailOpen=true, mobileView='graph', autoFit=true, zoom=1, pan={x:0,y:0};
let editorView='graph', selectedUpdate=null, historyProject='all', historyAuthor='all', historyQuery='';
let sampleUpdates=[], updateSequence=0;
const drafts={};
const nodeOffsets=new Map();
let suppressNodeClickUntil=0;
let graphMotion=null, graphFrame=0;
const app=document.querySelector('#app');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(name,cls='')=>`<span class="icon ${cls}" aria-hidden="true" style="--icon:url('assets/lucide/${name}.svg')"></span>`;
const stat=t=>labels[t.finished?'done':t.kind];
const badge=t=>`<span class="badge ${t.finished?'done':t.kind}">${icon(stat(t).icon)}${stat(t).text}</span>`;
const completed=t=>t.todos.filter(x=>x.state==='done').length;
try{theme=localStorage.getItem('open-task-theme')==='dark'?'dark':'light';}catch{}
document.documentElement.dataset.theme=theme;
function reset(){tasks=structuredClone(baseTasks).map(t=>({...t,originalUpdate:t.update,todos:checklist[t.id].map(([name,state])=>({name,state})),records:[]}));selected=new URL(location).searchParams.get('task')||'OT-018';if(!tasks.some(t=>t.id===selected))selected='OT-018';sampleUpdates=seedUpdates();updateSequence=0;selectedUpdate=null;}
function toast(s){const el=document.querySelector('#toast');el.textContent=s;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,3000);}
const projects=['客户体验改进','秋季业务试点','独立任务'];
const shortNames={'OT-024':'客户访谈与需求优先级','OT-018':'协调数据访问权限','OT-031':'华东试点执行方案','OT-036':'合作伙伴沟通纪要','OT-027':'第二批试点客户名单','OT-022':'服务流程现场验证','OT-029':'培训范围调整'};
const trackColors=['teal','blue','mauve','peach','yellow','red','subtext'];
const trackColor=id=>trackColors[baseTasks.findIndex(t=>t.id===id)];
function seedUpdates(){
 const updates=[];
 function add(t,at,author,label,text,changes,kind='doing'){
  updates.push({id:`sample-${updates.length+1}`,taskId:t.id,at,author,label,text,changes,kind});
 }
 tasks.forEach((t,i)=>{
  const publisher=t.id==='OT-036'?'许言':'沈知行';
  if(!['accept','pending'].includes(t.kind)){
   add(t,`2026-09-05T${String(10+i).padStart(2,'0')}:00:00+08:00`,publisher,'下发任务','明确预期结果与验收标准，邀请负责人接收任务。',[['负责人','未指定',t.owner],['状态','未下发','待接收']],'accept');
   add(t,`2026-09-06T${String(9+i).padStart(2,'0')}:20:00+08:00`,t.owner,'接收任务','已确认结果要求与交付时间，开始执行。',[['状态','待接收','进行中']]);
  }
  const [,month,day,time]=t.at.match(/(\d+) 月 (\d+) 日 (\d+:\d+)/);
  const at=`2026-${month.padStart(2,'0')}-${day.padStart(2,'0')}T${time}:00+08:00`;
  if(t.kind==='review')add(t,at,t.owner,'提交验收',t.originalUpdate,[['状态','进行中','待验收'],['成果','整理中',t.file]],'review');
  else if(t.kind==='block')add(t,at,t.owner,'报告阻塞',t.originalUpdate,[['状态','进行中','受阻'],['等待事项','无',t.dependency]],'block');
  else if(t.kind==='change')add(t,at,publisher,'提交范围调整',t.originalUpdate,[['培训范围','销售团队','销售与门店运营团队'],['任务版本','v1','v2 · 待确认']],'change');
  else add(t,at,publisher,'下发任务',t.id==='OT-036'?'请在周五前整理三家合作伙伴的沟通纪要。':'邀请许言确认第二批五家试点客户名单。',[['负责人','未指定',t.owner==='你'?'沈知行':t.owner],['状态','未下发','待接收']],'accept');
 });
 const earlier=[
  ['OT-018','2026-09-08T16:10:00+08:00','提交权限申请','已向客户 IT 提交两个测试账号的权限申请。','执行清单','1 / 4 已完成','2 / 4 已完成'],
  ['OT-024','2026-09-07T10:20:00+08:00','补充客户反馈','已归纳共性问题，补齐需求排序的客户反馈依据。','执行清单','3 / 4 已完成','4 / 4 已完成'],
  ['OT-031','2026-09-08T10:10:00+08:00','更新执行方案','补充两个城市的负责人和每周检查点。','执行清单','2 / 3 已完成','3 / 3 已完成'],
  ['OT-022','2026-09-08T15:30:00+08:00','确认验证门店','两家门店已确认参与现场验证。','执行清单','0 / 4 已完成','1 / 4 已完成'],
  ['OT-029','2026-09-06T16:30:00+08:00','整理培训内容','销售团队培训内容已整理，等待确认后续培训范围。','执行清单','0 / 4 已完成','1 / 4 已完成']
 ];
 earlier.forEach(([id,at,label,text,field,before,after])=>{const t=tasks.find(t=>t.id===id);add(t,at,t.owner,label,text,[[field,before,after]]);});
 return updates;
}
function teamUpdates(){return [...sampleUpdates,...tasks.flatMap(t=>t.records)].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||(b.sequence||0)-(a.sequence||0));}
const taskUpdates=t=>teamUpdates().filter(e=>e.taskId===t.id);
function recordUpdate(t,label,text,changes=[]){
 t.records.unshift({id:`local-${++updateSequence}`,sequence:updateSequence,taskId:t.id,author:'沈知行',at:new Date().toISOString(),label,text,changes,kind:t.finished?'done':t.kind,session:true});
}
function updateTime(at,full=false){const parts=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,...(full?{year:'numeric'}:{})}).format(new Date(at));return parts;}
function activityArticles(t,limit=Infinity){return taskUpdates(t).slice(0,limit).map(r=>`<article>${icon('history')}<div><strong>${esc(r.author)} · ${esc(r.label)}</strong><small>${updateTime(r.at)}${r.session?' · 本次操作':''}</small><p>${esc(r.text)}</p></div></article>`).join('');}
function filteredUpdates(){return teamUpdates().filter(e=>{
  const t=tasks.find(t=>t.id===e.taskId);
  return (historyProject==='all'||t.project===historyProject)&&(historyAuthor==='all'||e.author===historyAuthor)&&(!historyQuery||`${t.id} ${t.title} ${e.label} ${e.text} ${e.author}`.toLowerCase().includes(historyQuery.toLowerCase()));
 });}
function renderHistory(){
 const body=document.querySelector('#history-rows');if(!body)return;
 const updates=filteredUpdates(),lanes=tasks.filter(t=>updates.some(e=>e.taskId===t.id)).map(t=>t.id);
 const bounds=new Map(lanes.map(id=>[id,[updates.findIndex(e=>e.taskId===id),updates.findLastIndex(e=>e.taskId===id)]]));
 document.querySelector('#history-count').textContent=`${updates.length} 条记录`;
 document.querySelector('#history-table').style.setProperty('--lane-count',Math.max(1,lanes.length));
 body.innerHTML=updates.map((e,index)=>{
  const t=tasks.find(t=>t.id===e.taskId),lane=lanes.indexOf(t.id);
  const lines=lanes.map((id,i)=>{const [first,last]=bounds.get(id);if(index<first||index>last||first===last)return '';return `<i class="history-line ${index===first?'line-start':''} ${index===last?'line-end':''}" style="--lane-index:${i};--track:var(--${trackColor(id)})"></i>`;}).join('');
  return `<button class="history-row ${selectedUpdate===e.id?'selected':''}" data-update="${e.id}" aria-current="${selectedUpdate===e.id}" aria-label="${esc(`${e.author} · ${e.label} · ${t.id} · ${updateTime(e.at)}`)}"><span class="history-track" aria-hidden="true">${lines}<i class="history-dot" style="--lane-index:${lane};--track:var(--${trackColor(t.id)})"></i></span><span class="history-summary"><strong><span class="history-kind ${e.kind}">${esc(e.label)}</span><span class="history-excerpt">${esc(e.text)}</span>${e.session?'<small class="session-mark">本次</small>':''}</strong><span><code>${t.id}</code>${esc(shortNames[t.id])}</span><small class="history-compact-meta">${esc(e.author)} · ${updateTime(e.at)}</small></span><span class="history-author"><i>${e.author.slice(0,1)}</i>${esc(e.author)}</span><time datetime="${e.at}" title="${updateTime(e.at,true)}">${updateTime(e.at)}</time></button>`;
 }).join('')||'<div class="history-empty">'+icon('search')+'<strong>没有匹配的更新</strong><p>试试其他项目、成员或关键词。</p><button data-clear-history>清除筛选</button></div>';
}
function historyDetail(){const e=teamUpdates().find(e=>e.id===selectedUpdate);if(!e)return detail();const t=tasks.find(t=>t.id===e.taskId);
 return `<header class="detail-top"><button class="icon-button mobile-back" data-close aria-label="返回工作区">${icon('arrow-left')}</button>${icon('history')}<span>更新详情</span><button class="icon-button close" data-close aria-label="收起详情">${icon('panel-right-close')}</button></header><div class="detail-scroll"><div class="breadcrumb">${icon('folder-kanban')}${t.project}</div><h2>${esc(e.label)}</h2><div class="update-byline"><span class="update-avatar">${e.author.slice(0,1)}</span><div><strong>${esc(e.author)}</strong><time datetime="${e.at}">${updateTime(e.at,true)} · 北京时间</time></div><span class="update-id">${e.id.replace('sample-','U-').replace('local-','L-').toUpperCase()}</span></div><button class="update-task-link" data-history-task>${icon('clipboard-list')}<span><small>${t.id} · 关联任务</small><strong>${esc(t.title)}</strong></span>${icon('chevron-right')}</button><section class="update-message"><h3>${icon('message-square')}更新说明</h3><p>${esc(e.text)}</p></section><section class="update-changes"><h3>${icon('list-checks')}变更内容 <span>${e.changes.length}</span></h3>${e.changes.map(([field,before,after])=>`<article><h4>${esc(field)}</h4><div class="change-before"><span>之前</span><p>${esc(before)}</p></div><div class="change-after"><span>之后</span><p>${esc(after)}</p></div></article>`).join('')||'<p class="micro">本次仅新增跟进说明，任务状态保持不变。</p>'}</section><div class="history-context">${icon('history')}同一任务的 ${taskUpdates(t).length} 条更新已收录</div></div><footer class="detail-footer"><button data-history-graph>${icon('network')}在图谱中定位</button><button class="primary" data-history-task>打开任务${icon('arrow-right')}</button></footer>`;
}
function switchEditor(view){
 editorView=view;mobileView='graph';if(view==='graph')selectedUpdate=null;
 document.querySelector('.graph-toolbar').hidden=view!=='graph';document.querySelector('#graph-canvas').hidden=view!=='graph';document.querySelector('#team-history').hidden=view!=='history';
 document.querySelectorAll('[data-editor-view]').forEach(b=>{const active=b.dataset.editorView===view;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 document.querySelector('[data-editor-fit]').hidden=view!=='graph';document.querySelector('#workspace-view').textContent=view==='history'?'团队更新':'任务图谱';
 updateDetail();applyLayout();if(view==='history')renderHistory();else renderGraph();
}
function model(){
 const nodes=[],edges=[];
 projects.forEach((name,i)=>{
  const projectId='project-'+i;nodes.push({id:projectId,title:name,type:'project',project:name});
  const subset=tasks.filter(t=>t.project===name);
  [...new Set(subset.map(t=>t.parent))].forEach((parent,j)=>{
   const parentId=`phase-${i}-${j}`;nodes.push({id:parentId,title:parent,type:'phase',project:name,parent:projectId});edges.push({from:projectId,to:parentId,type:'hierarchy'});
   subset.filter(t=>t.parent===parent).forEach(t=>{nodes.push({...t,type:'task',parent:parentId});edges.push({from:parentId,to:t.id,type:'hierarchy'});});
  });
 });
 nodes.push({id:'external-it',title:'客户 IT 开通权限',type:'external',project:projects[0],description:'客户侧 IT 需要开通测试账号，完成后由任务负责人验证访问权限。',owner:'客户侧 IT'},
  {id:'external-spec',title:'发布新版服务规范',type:'external',project:projects[0],description:'赵川提供最新服务规范后，方禾才能继续现场验证。',owner:'赵川'});
 edges.push({from:'external-it',to:'OT-018',type:'dependency'},{from:'external-spec',to:'OT-022',type:'dependency'},{from:'OT-024',to:'OT-022',type:'related'});
 return {nodes,edges};
}
function currentNode(){return model().nodes.find(n=>n.id===selected);}
function currentProject(){return currentNode()?.project||projects[0];}
function renderTree(){
 const {nodes}=model(); const matches=n=>!treeQuery||`${n.title} ${n.owner||''} ${n.id}`.toLowerCase().includes(treeQuery.toLowerCase());
 const children=id=>nodes.filter(n=>n.parent===id);
 const includes=n=>matches(n)||children(n.id).some(includes);
 function item(n,depth){
  const kids=children(n.id),isOpen=!!treeQuery||!collapsed.has(n.id),active=n.id===selected;
  return `<li class="tree-item" data-tree-id="${n.id}"><div class="tree-row ${active?'selected':''} ${n.type}" style="--depth:${depth}">${kids.length?`<button class="disclosure" data-collapse="${n.id}" aria-expanded="${isOpen}" aria-label="${isOpen?'折叠':'展开'}${n.title}">${icon(isOpen?'chevron-down':'chevron-right')}</button>`:'<span class="disclosure-spacer"></span>'}<button class="tree-label" data-node="${n.id}" title="${n.title}" aria-current="${active?'true':'false'}">${icon(n.type==='task'?'clipboard-list':n.type==='project'?'folder-kanban':'target')}<span>${esc(n.title)}</span>${n.type==='task'?`<span class="tree-dot ${n.finished?'done':n.kind}" title="${stat(n).text}"></span>`:`<small>${kids.length}</small>`}</button></div>${kids.length&&isOpen?`<ul>${kids.filter(includes).map(c=>item(c,depth+1)).join('')}</ul>`:''}</li>`;
 }
 const roots=nodes.filter(n=>n.type==='project'&&includes(n));
 return roots.length?`<ul class="tree-root">${roots.map(n=>item(n,0)).join('')}</ul>`:'<p class="empty">没有匹配的任务</p>';
}
function graphNodes(){const m=model();let nodes=m.nodes.filter(n=>graphScope==='all'||n.project===currentProject());if(graphFocus){const connected=new Set([selected,...m.edges.filter(e=>e.from===selected||e.to===selected).flatMap(e=>[e.from,e.to])]);nodes=nodes.filter(n=>connected.has(n.id));}const ids=new Set(nodes.map(n=>n.id));return {nodes,edges:m.edges.filter(e=>ids.has(e.from)&&ids.has(e.to))};}
const positions={
 'project-0':[.45,.15],'phase-0-0':[.17,.32],'phase-0-1':[.48,.34],'phase-0-2':[.79,.31],
 'OT-024':[.14,.54],'OT-018':[.47,.57],'OT-022':[.82,.53],'external-it':[.36,.82],'external-spec':[.82,.80],
 'project-1':[.5,.18],'phase-1-0':[.29,.39],'phase-1-1':[.75,.40],'OT-031':[.16,.66],'OT-027':[.44,.73],'OT-029':[.77,.69],
 'project-2':[.36,.27],'phase-2-0':[.58,.49],'OT-036':[.40,.74]
};
function layoutKey(){return `${graphScope}:${graphScope==='all'?'all':currentProject()}:${graphFocus?selected:'full'}`;}
function graphLayout(nodes){
 const canvas=document.querySelector('#graph-canvas');const all=graphScope==='all'&&!graphFocus;
 const width=Math.max(all?1050:650,canvas.clientWidth),height=Math.max(all?720:500,canvas.clientHeight);
 let points={};
 if(graphFocus){nodes.forEach((n,i)=>{if(n.id===selected)points[n.id]=[width*.5,height*.46];else{const others=nodes.filter(x=>x.id!==selected);const angle=-Math.PI/2+others.indexOf(n)*Math.PI*2/others.length;points[n.id]=[width*(.5+.32*Math.cos(angle)),height*(.46+.29*Math.sin(angle))];}});}
 else nodes.forEach(n=>{let [x,y]=positions[n.id]||[.5,.5];if(all){const index=projects.indexOf(n.project);if(index===0){x=.03+x*.55;y=.02+y*.88;}else if(index===1){x=.57+x*.39;y=.02+y*.57;}else{x=.58+x*.35;y=.58+y*.42;}}points[n.id]=[x*width,y*height];});
 const offsets=nodeOffsets.get(layoutKey())||{};nodes.forEach(n=>{const delta=offsets[n.id];if(delta){points[n.id][0]+=delta[0]*width;points[n.id][1]+=delta[1]*height;}});
 return {width,height,points};
}
function graphEdgeMarkup(edges,points){const m=model();
 return edges.map(e=>{const a=points[e.from],b=points[e.to];const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;const x=b[0]-dx/len*15,y=b[1]-dy/len*15;return `<line class="edge ${e.type} ${e.from===selected||e.to===selected?'active':''}" x1="${a[0]}" y1="${a[1]}" x2="${x}" y2="${y}" ${e.type==='dependency'?'marker-end="url(#dependency-arrow)"':''}><title>${esc(m.nodes.find(n=>n.id===e.from).title)} ${e.type==='related'?'↔':'→'} ${esc(m.nodes.find(n=>n.id===e.to).title)} · ${relationLabel(e.type)}</title></line>`;}).join('');
}
function renderGraph(){
 stopGraphMotion();
 const canvas=document.querySelector('#graph-canvas');if(!canvas.clientWidth||!canvas.clientHeight)return;
 const {nodes,edges}=graphNodes(),{width,height,points}=graphLayout(nodes),m=model();
 const connected=new Set([selected,...m.edges.filter(e=>e.from===selected||e.to===selected).flatMap(e=>[e.from,e.to])]);
 const edgeMarkup=graphEdgeMarkup(edges,points);
 document.querySelector('#graph-board').innerHTML=`<svg class="graph-edges" width="${width}" height="${height}" aria-hidden="true"><defs><marker id="dependency-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L7 4 L0 8" fill="none" stroke="var(--red)" stroke-width="1.3"/></marker></defs>${edgeMarkup}</svg>${nodes.map(n=>`<button class="graph-node ${n.type} ${n.finished?'done':n.kind||''} ${n.id===selected?'selected':connected.has(n.id)?'connected':''}" style="left:${points[n.id][0]}px;top:${points[n.id][1]}px" data-node="${n.id}" aria-current="${n.id===selected?'true':'false'}" title="${esc(n.title)}"><span class="node-point">${icon('clipboard-list')}</span><strong>${shortNames[n.id]||esc(n.title)}</strong><small class="${n.type==='task'?(n.finished?'done':n.kind):''}">${n.type==='task'?`${n.owner} · ${stat(n).text}`:n.type==='project'?'项目':n.type==='external'?'前置依赖 · 待提供':'上级任务'}</small></button>`).join('')}`;
 const board=document.querySelector('#graph-board');board.style.width=width+'px';board.style.height=height+'px';transformGraph();
 document.querySelector('#graph-caption').textContent=graphScope==='all'?'全部任务':currentProject();
 document.querySelector('#graph-count').textContent=`${nodes.length} 个节点 · ${edges.length} 条关系`;
 document.querySelector('#focus-node').classList.toggle('active',graphFocus);document.querySelector('#focus-node').setAttribute('aria-pressed',String(graphFocus));if(autoFit&&document.querySelector('#graph-canvas').clientWidth)fitGraph();
}
function transformGraph(){const board=document.querySelector('#graph-board');if(board)board.style.transform=`translate(${pan.x}px,${pan.y}px) scale(${zoom})`;document.querySelectorAll('[data-zoom-label]').forEach(el=>el.textContent=Math.round(zoom*100)+'%');}
function fitGraph(){autoFit=true;const canvas=document.querySelector('#graph-canvas');if(!canvas.clientWidth||!canvas.clientHeight)return;const {nodes}=graphNodes(),{points}=graphLayout(nodes),values=Object.values(points);if(!values.length)return;const left=Math.min(...values.map(p=>p[0]))-95,top=Math.min(...values.map(p=>p[1]))-45,right=Math.max(...values.map(p=>p[0]))+95,bottom=Math.max(...values.map(p=>p[1]))+100;zoom=Math.min(1,(canvas.clientWidth-20)/(right-left),(canvas.clientHeight-35)/(bottom-top));pan={x:(canvas.clientWidth-(right-left)*zoom)/2-left*zoom,y:(canvas.clientHeight-(bottom-top)*zoom)/2-top*zoom-5};transformGraph();}
function locateSelected(){autoFit=false;const {nodes}=graphNodes(),layout=graphLayout(nodes),point=layout.points[selected];if(!point)return;const canvas=document.querySelector('#graph-canvas');pan={x:canvas.clientWidth/2-point[0]*zoom,y:canvas.clientHeight/2-point[1]*zoom};transformGraph();}
function relationLabel(type){return {hierarchy:'上下级',dependency:'前置依赖',related:'普通关联'}[type];}
function renderBottom(){
 const m=model(),items=tasks.filter(t=>!t.finished&&t.group==='action');
 document.querySelector('#bottom-tabs').innerHTML=[['attention','待处理',items.length],['activity','动态',teamUpdates().filter(e=>e.taskId===selected).length],['relations','关系',m.edges.filter(e=>e.from===selected||e.to===selected).length]].map(([key,title,count])=>`<button data-panel-tab="${key}" class="${panelTab===key?'active':''}" aria-pressed="${panelTab===key}">${title}<span>${count}</span></button>`).join('');
 const body=document.querySelector('#bottom-content');
 if(panelTab==='attention')body.innerHTML=`<div class="panel-table-head"><span>任务</span><span>负责人</span><span>状态</span><span>等待</span></div>${items.map(t=>`<button class="panel-row ${t.id===selected?'selected':''}" data-node="${t.id}"><span>${icon('clipboard-list')}<small>${t.id}</small><b>${t.title}</b></span><span>${t.owner}</span><span>${badge(t)}</span><span>${t.wait}</span></button>`).join('')||'<p class="empty">当前待处理事项已完成</p>'}`;
 else if(panelTab==='activity'){const t=tasks.find(t=>t.id===selected);body.innerHTML=t?`<div class="panel-events">${taskUpdates(t).map(r=>`<article>${icon('history')}<time>${updateTime(r.at)}</time><b>${esc(r.author)} · ${esc(r.label)}</b><p>${esc(r.text)}</p></article>`).join('')}</div>`:'<p class="empty">选择一个任务，查看它的进展记录。</p>';}
 else{const edges=m.edges.filter(e=>e.from===selected||e.to===selected);body.innerHTML=edges.map(e=>{const outgoing=e.from===selected,n=m.nodes.find(n=>n.id===(outgoing?e.to:e.from));const text=e.type==='hierarchy'?(outgoing?'下级任务':'上级任务'):e.type==='dependency'?(outgoing?'此任务依赖当前节点':'当前任务依赖此项'):'普通关联';return `<button class="relation-row ${e.type}" data-node="${n.id}">${icon(e.type==='dependency'?'triangle-alert':e.type==='related'?'network':'folder-kanban')}<span>${text}</span><strong>${n.title}</strong>${icon('chevron-right')}</button>`;}).join('')||'<p class="empty">当前节点没有关联关系。</p>';}
 document.querySelector('#status-selection').textContent=currentNode()?.title||'任务图谱';
}
function overviewDetail(){const n=currentNode();if(!n)return '';const {nodes}=model(),children=nodes.filter(x=>x.parent===n.id);return `<header class="detail-top"><button class="icon-button mobile-back" data-close aria-label="返回工作区">${icon('arrow-left')}</button><span>${n.type==='external'?'前置依赖':'层级概览'}</span><button class="icon-button close" data-close aria-label="收起详情">${icon('panel-right-close')}</button></header><div class="detail-scroll"><div class="breadcrumb">${icon('folder-kanban')}${n.project}</div><h2>${n.title}</h2>${n.type==='external'?`<div class="attention block">${icon('triangle-alert')}<div><strong>等待 ${n.owner}</strong><p>${n.description}</p></div></div><p class="micro">此项为外部条件，不计入任务完成数量。</p>`:`<p class="overview-intro">${children.length} 个直接下级 · 点击继续展开任务</p><div class="branch-list">${children.map(c=>`<button data-node="${c.id}">${icon(c.type==='task'?'clipboard-list':'target')}<span>${c.title}</span>${icon('chevron-right')}</button>`).join('')}</div>`}<section class="description"><h3>${icon('network')}关联关系</h3><p>在图谱中查看此节点的位置，在底部“关系”面板查看上下级、前置依赖与普通关联。</p><button class="text-button" data-open-relations>查看关系${icon('chevron-right')}</button></section></div>`;}
function updateDetail(){document.querySelector('.detail').innerHTML=editorView==='history'&&selectedUpdate?historyDetail():tasks.some(t=>t.id===selected)?detail():overviewDetail();}
function updateList(){document.querySelector('#task-tree').innerHTML=renderTree();renderGraph();renderBottom();renderHistory();}
function selectNode(id,updateId=null){const n=model().nodes.find(n=>n.id===id);if(!n)return;const previousProject=currentProject();selected=id;selectedUpdate=updateId;detailTab='overview';detailOpen=true;mobileView='detail';let parent=n.parent;const nodes=model().nodes;while(parent){collapsed.delete(parent);parent=nodes.find(x=>x.id===parent)?.parent;}if(previousProject!==currentProject()&&graphScope==='project'){autoFit=true;zoom=1;pan={x:0,y:0};}updateDetail();updateList();applyLayout();const url=new URL(location);if(n.type==='task')url.searchParams.set('task',id);else url.searchParams.delete('task');history.replaceState(null,'',url);}
function applyLayout(){const shell=document.querySelector('.ide');shell.classList.toggle('tree-hidden',!treeOpen);shell.classList.toggle('detail-hidden',!detailOpen);shell.classList.toggle('panel-hidden',!panelOpen);shell.dataset.mobileView=mobileView;document.querySelectorAll('[data-toggle-panel]').forEach(b=>b.setAttribute('aria-pressed',String(panelOpen)));document.querySelectorAll('button[data-mobile-view]').forEach(b=>b.classList.toggle('active',b.dataset.mobileView===mobileView));}
function render(){app.innerHTML=`<div class="ide" data-mobile-view="${mobileView}"><header class="titlebar"><a class="brand" href="frappe.html">${icon('list-checks')}<b>open-task</b><span>任务工作空间</span></a><span class="workspace-name">山野工作室${icon('chevron-right')}<span id="workspace-view">任务图谱</span></span><div class="title-actions"><span class="demo">交互原型 · 示例数据</span><button class="icon-button" data-toggle-tree aria-label="显示或隐藏任务树" title="显示或隐藏任务树">${icon('panel-left')}</button><button class="icon-button" data-toggle-panel aria-label="显示或隐藏底部面板" title="显示或隐藏底部面板">${icon('panel-bottom')}</button><button class="icon-button" data-toggle-detail aria-label="显示或隐藏任务详情" title="显示或隐藏任务详情">${icon('panel-right-close')}</button><button class="icon-button" id="theme-toggle" aria-label="${theme==='dark'?'切换浅色主题':'切换深色主题'}">${icon(theme==='dark'?'sun':'moon')}</button></div></header><nav class="activity-rail" aria-label="工作区工具"><button class="rail-button active" data-toggle-tree aria-label="任务树" title="任务树">${icon('folder-kanban')}</button><button class="rail-button" data-search-focus aria-label="搜索任务" title="搜索任务">${icon('search')}</button><button class="rail-button" data-show-graph aria-label="任务图谱" title="任务图谱">${icon('network')}</button><button class="rail-button" data-editor-view="history" aria-label="团队更新" title="团队更新">${icon('history')}</button><button class="rail-button" data-attention aria-label="待处理事项" title="待处理事项">${icon('inbox')}<i></i></button><button class="rail-button rail-bottom" id="reset" aria-label="重置示例" title="重置示例">${icon('rotate-ccw')}</button><span class="user-avatar" title="沈知行 · 团队负责人">沈</span></nav><aside class="tree-pane"><header class="pane-header"><strong>任务资源管理器</strong><div class="explorer-actions" role="toolbar" aria-label="任务管理操作"><button class="icon-button" data-create="task" aria-label="新建任务" title="新建任务">${icon('file-plus')}</button><button class="icon-button" data-create="project" aria-label="新建项目" title="新建项目">${icon('folder-plus')}</button><button class="icon-button" data-refresh-tree aria-label="刷新任务" title="刷新任务">${icon('refresh-cw')}</button><button class="icon-button" data-collapse-all aria-label="折叠或展开全部任务" title="折叠或展开全部任务">${icon('chevrons-down-up')}</button></div></header><label class="tree-search">${icon('search')}<input id="tree-search" aria-label="在任务树中搜索" placeholder="搜索任务或负责人…" value="${esc(treeQuery)}"></label><div class="tree-workspace">${icon('chevron-down')}<strong>山野工作室</strong><span>7</span></div><nav id="task-tree" class="tree-scroll" aria-label="任务层级">${renderTree()}</nav><footer class="tree-footer">${icon('clipboard-list')}7 个任务<span>3 个项目</span></footer></aside><div class="splitter tree-splitter" role="separator" tabindex="0" aria-orientation="vertical" aria-label="调整任务树宽度" data-resize="tree"></div><main class="graph-pane"><section class="editor-surface"><header class="editor-tabs"><nav aria-label="工作区视图"><button class="editor-tab active" data-editor-view="graph" aria-pressed="true">${icon('network')}任务图谱</button><button class="editor-tab" data-editor-view="history" aria-pressed="false">${icon('history')}团队更新</button></nav><button class="icon-button" data-editor-fit data-fit aria-label="适应画布" title="适应画布">${icon('maximize-2')}</button></header><div class="graph-toolbar"><span id="graph-caption"></span><div><label><span class="sr-only">图谱范围</span><select id="graph-scope" aria-label="图谱范围"><option value="project">当前项目</option><option value="all">全部任务</option></select></label><button id="focus-node" data-focus-node aria-pressed="false">${icon('locate-fixed')}仅看关联</button></div></div><div id="graph-canvas" class="graph-canvas" aria-label="任务关系画布"><div class="canvas-stamp"><span id="graph-count"></span><small>拖动节点牵引关联 · 滚轮缩放</small></div><div id="graph-board"></div><div class="graph-legend"><span><i class="hierarchy"></i>上下级</span><span><i class="dependency"></i>依赖 → 任务</span><span><i class="related"></i>普通关联</span></div><div class="graph-controls"><button class="icon-button" data-zoom="out" aria-label="缩小">${icon('minus')}</button><button class="zoom-label" data-fit data-zoom-label title="适应画布">100%</button><button class="icon-button" data-zoom="in" aria-label="放大">${icon('plus')}</button><span></span><button class="icon-button" data-locate aria-label="定位选中任务" title="定位选中任务">${icon('locate-fixed')}</button><button class="icon-button" data-reset-layout aria-label="恢复布局" title="恢复布局">${icon('rotate-ccw')}</button></div></div><section id="team-history" class="team-history" aria-label="团队更新记录" hidden><div class="history-toolbar"><label class="history-search">${icon('search')}<input id="history-search" placeholder="搜索更新、任务或成员…" aria-label="搜索团队更新"></label><div class="history-filters"><select id="history-project" aria-label="按项目筛选更新"><option value="all">全部项目</option>${projects.map(p=>`<option>${p}</option>`).join('')}</select><select id="history-author" aria-label="按成员筛选更新"><option value="all">全部成员</option>${[...new Set(teamUpdates().map(e=>e.author))].map(a=>`<option>${a}</option>`).join('')}</select></div></div><div class="history-guide"><span>${icon('history')}连线串起同一任务的更新</span><span id="history-count" role="status"></span></div><div id="history-table" class="history-table"><div class="history-table-head"><span>轨迹</span><span>更新 / 任务</span><span>成员</span><span>时间 ↓</span></div><div id="history-rows"></div></div><footer class="history-footer"><span>最新在上 · 示例团队记录</span><span>按任务连接</span></footer></section></section><div class="splitter bottom-splitter" role="separator" tabindex="0" aria-orientation="horizontal" aria-label="调整底部面板高度" data-resize="bottom"></div><section class="bottom-panel"><header><nav id="bottom-tabs" aria-label="辅助面板"></nav><span>工作区</span><button class="icon-button" data-toggle-panel aria-label="关闭底部面板">${icon('x')}</button></header><div id="bottom-content"></div></section></main><div class="splitter detail-splitter" role="separator" tabindex="0" aria-orientation="vertical" aria-label="调整任务详情宽度" data-resize="detail"></div><aside class="detail" aria-label="任务详情"></aside><footer class="statusbar"><span>${icon('network')}本地预览</span><span id="status-selection"></span><button data-toggle-panel>${icon('panel-bottom')}底部面板</button><span>示例数据 · 刷新重置</span></footer><nav class="mobile-nav" aria-label="切换工作区"><button data-mobile-view="tree">${icon('folder-kanban')}任务树</button><button data-mobile-view="graph">${icon('network')}工作区</button><button data-mobile-view="detail">${icon('clipboard-list')}详情</button></nav></div>`;updateDetail();renderGraph();renderBottom();applyLayout();bindCanvas();bindResizers();new ResizeObserver(()=>renderGraph()).observe(document.querySelector('#graph-canvas'));}

function recentActivity(t){return `<section class="recent-activity"><header><h3>${icon('history')}最近动态</h3><button data-tab="activity">查看全部${icon('chevron-right')}</button></header><div class="activity">${activityArticles(t,3)}</div></section>`;}
function detail(){const t=tasks.find(t=>t.id===selected);if(!t)return '';const n=completed(t);return `<header class="detail-top"><button class="icon-button mobile-back" data-close aria-label="返回工作区">${icon('arrow-left')}</button><span>${t.id}</span><span class="detail-top-label">任务详情</span><button class="icon-button close" data-close aria-label="收起详情">${icon('panel-right-close')}</button></header><div class="detail-scroll"><div class="breadcrumb">${icon('folder-kanban')}${t.project}${icon('chevron-right')}${t.parent}</div><h2>${t.title}</h2><div class="detail-badges">${badge(t)}<span class="subtle">${icon('clock')}${t.finished?'刚刚完成':t.wait==='刚刚'?'刚刚更新':'已等待 '+t.wait}</span></div><div class="attention ${t.finished?'done':t.kind}">${icon(t.finished?'circle-check':stat(t).icon)}<div><strong>${t.finished?'你已通过本次验收':t.who}</strong><p>${t.finished?'验收结果已记录，可以继续处理下一项。':esc(t.update)}</p></div></div><div class="metadata"><span>${icon('user')}负责人 <b>${t.owner}</b></span><span>${icon('circle-check')}验收人 <b>${t.owner==='你'?'许言':'你'}</b></span><span>${icon('calendar-days')}交付时间 <b>${t.due}</b></span><span>${icon('flag')}当前版本 <b>${t.kind==='change'?'v2 · 待确认':'v1'}</b></span></div><nav class="detail-tabs" aria-label="详情内容"><button data-tab="overview" class="${detailTab==='overview'?'active':''}">${icon('list-checks')}任务内容</button><button data-tab="activity" class="${detailTab==='activity'?'active':''}">${icon('history')}动态 <span>${taskUpdates(t).length}</span></button></nav>${detailTab==='overview'?`<div class="overview-grid"><div class="execution"><section class="progress-section"><div class="section-title"><h3>${icon('list-checks')}执行清单</h3><span><b>${n}</b> / ${t.todos.length} 已完成 <strong class="percentage">${Math.round(n/t.todos.length*100)}%</strong></span></div><progress class="big-progress" max="${t.todos.length}" value="${n}" aria-label="执行清单完成进度"></progress><div class="todo-list">${t.todos.map((x,i)=>`<div class="todo ${x.state}">${icon(todoStates[x.state].icon)}<span>${x.name}</span><select data-todo="${i}" aria-label="${x.name}的状态" ${t.finished?'disabled':''}>${Object.entries(todoStates).map(([key,s])=>`<option value="${key}" ${x.state===key?'selected':''}>${s.label}</option>`).join('')}</select></div>`).join('')}</div><p class="micro">清单完成后，仍需验收确认。</p></section></div><div class="requirements"><section class="description"><h3>${icon('target')}预期结果与验收标准</h3><p>${t.result}</p><ul>${t.criteria.map(c=>`<li>${c}</li>`).join('')}</ul></section>${t.dependency?`<section class="dependency"><h3>${icon('folder-kanban')}前置依赖</h3><p>${icon('triangle-alert')} ${t.dependency}</p></section>`:''}${t.kind==='change'?'<section class="description"><h3>本次调整</h3><p><del>原范围：销售团队</del><br>新范围：销售与门店运营团队</p></section>':''}${t.file?`<div class="attachment">${icon('paperclip')}<span>${t.file}<small>示例成果条目 · 未附真实文件</small></span></div>`:''}</div></div>${recentActivity(t)}`:`<section class="activity">${activityArticles(t)}</section>`}</div><footer class="detail-footer">${t.finished?`<span class="green">${icon('circle-check')}处理结果已保留</span><button class="primary" data-next>下一项${icon('chevron-right')}</button>`:t.kind==='review'?`<span>验收当前提交</span><button data-action="return">${icon('rotate-ccw')}退回修改</button><button class="primary" data-action="approve">${icon('check')}通过验收</button>`:t.kind==='accept'?`<span>确认任务 v1</span><button class="primary" data-action="accept">${icon('check')}确认接收</button>`:`<span>${icon('message-square')}跟进不会自动解除阻塞</span><button class="primary" data-action="note">${icon('plus')}记录跟进</button>`}</footer>`;}

function setZoom(next,cx,cy){autoFit=false;const canvas=document.querySelector('#graph-canvas');cx??=canvas.clientWidth/2;cy??=canvas.clientHeight/2;next=Math.max(.45,Math.min(2,next));pan={x:cx-(cx-pan.x)*next/zoom,y:cy-(cy-pan.y)*next/zoom};zoom=next;transformGraph();}
function stopGraphMotion(){cancelAnimationFrame(graphFrame);graphFrame=0;graphMotion=null;}
function startGraphMotion(id){
 stopGraphMotion();const {nodes,edges}=graphNodes(),layout=graphLayout(nodes);
 graphMotion={...layout,key:layoutKey(),id,initial:structuredClone(layout.points),offsets:structuredClone(nodeOffsets.get(layoutKey())||{}),velocity:Object.fromEntries(nodes.map(n=>[n.id,[0,0]])),target:[...layout.points[id]],edges,
  links:edges.map(e=>({...e,length:Math.hypot(layout.points[e.to][0]-layout.points[e.from][0],layout.points[e.to][1]-layout.points[e.from][1])})),
  elements:new Map([...document.querySelectorAll('.graph-node')].map(el=>[el.dataset.node,el])),releasedAt:null,last:performance.now(),accumulator:0,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};
}
function stepGraphMotion(m){
 const ids=Object.keys(m.points),forces=Object.fromEntries(ids.map(id=>[id,[0,0]]));
 m.points[m.id]=[...m.target];
 // Springs preserve the spacing of the user's current arrangement.
 m.links.forEach(e=>{const a=m.points[e.from],b=m.points[e.to],dx=b[0]-a[0],dy=b[1]-a[1],distance=Math.hypot(dx,dy)||1;
  const strength=(distance-e.length)*(e.type==='hierarchy'?.032:e.type==='dependency'?.022:.012)/distance;
  forces[e.from][0]+=dx*strength;forces[e.from][1]+=dy*strength;forces[e.to][0]-=dx*strength;forces[e.to][1]-=dy*strength;
 });
 // A short-range repulsion keeps nearby icons apart without scattering the graph.
 ids.forEach((a,i)=>ids.slice(i+1).forEach(b=>{const dx=m.points[b][0]-m.points[a][0]||.1,dy=m.points[b][1]-m.points[a][1],distance=Math.hypot(dx,dy);
  if(distance>=100)return;const strength=(100-distance)*.018/distance;forces[a][0]-=dx*strength;forces[a][1]-=dy*strength;forces[b][0]+=dx*strength;forces[b][1]+=dy*strength;
 }));
 let speed=0;
 ids.forEach(id=>{if(id===m.id)return;const point=m.points[id],v=m.velocity[id];
  for(let axis=0;axis<2;axis++){const home=(m.initial[id][axis]-point[axis])*.0025;v[axis]=(v[axis]+forces[id][axis]+home)*.82;v[axis]=Math.max(-18,Math.min(18,v[axis]));point[axis]+=v[axis];speed=Math.max(speed,Math.abs(v[axis]));}
 });return speed;
}
function paintGraphMotion(m){
 const offsets={...m.offsets};Object.entries(m.points).forEach(([id,point])=>{const el=m.elements.get(id);el.style.left=point[0]+'px';el.style.top=point[1]+'px';const original=m.offsets[id]||[0,0];offsets[id]=[original[0]+(point[0]-m.initial[id][0])/m.width,original[1]+(point[1]-m.initial[id][1])/m.height];});
 nodeOffsets.set(m.key,offsets);const svg=document.querySelector('.graph-edges');svg.innerHTML=svg.querySelector('defs').outerHTML+graphEdgeMarkup(m.edges,m.points);
}
function animateGraphMotion(now){
 const m=graphMotion;if(!m)return;graphFrame=0;m.accumulator+=Math.min(50,now-m.last);m.last=now;let speed=1;
 while(m.accumulator>=1000/60){speed=stepGraphMotion(m);m.accumulator-=1000/60;}paintGraphMotion(m);
 if(m.releasedAt!==null&&((now-m.releasedAt>200&&speed<.06)||now-m.releasedAt>2400)){stopGraphMotion();return;}
 graphFrame=requestAnimationFrame(animateGraphMotion);
}
function moveGraphNode(drag,dx,dy){
 const m=graphMotion;if(!m||m.id!==drag.id)return;m.target=[drag.point[0]+dx/zoom,drag.point[1]+dy/zoom];m.points[m.id]=[...m.target];
 if(m.reduced){for(let i=0;i<24;i++)stepGraphMotion(m);paintGraphMotion(m);}else{paintGraphMotion(m);if(!graphFrame)graphFrame=requestAnimationFrame(animateGraphMotion);}
}
function releaseGraphNode(){if(!graphMotion)return;if(graphMotion.reduced){stopGraphMotion();return;}graphMotion.releasedAt=performance.now();}
function bindCanvas(){const canvas=document.querySelector('#graph-canvas');let drag=null;
 canvas.onpointerdown=e=>{
  if(e.button!==0)return;const node=e.target.closest('.graph-node');if(e.target.closest('button')&&!node)return;
  if(node){stopGraphMotion();const layout=graphLayout(graphNodes().nodes);drag={kind:'node',node,id:node.dataset.node,start:{x:e.clientX,y:e.clientY},point:layout.points[node.dataset.node],moved:false};}
  else{autoFit=false;drag={kind:'canvas',x:e.clientX,y:e.clientY,pan:{...pan}};canvas.setPointerCapture(e.pointerId);canvas.classList.add('panning');}
 };
 canvas.onpointermove=e=>{
  if(!drag)return;
  if(drag.kind==='canvas'){pan={x:drag.pan.x+e.clientX-drag.x,y:drag.pan.y+e.clientY-drag.y};transformGraph();return;}
  const dx=e.clientX-drag.start.x,dy=e.clientY-drag.start.y;if(!drag.moved&&Math.hypot(dx,dy)<4)return;
  if(!drag.moved){autoFit=false;drag.moved=true;drag.node.setPointerCapture(e.pointerId);drag.node.classList.add('dragging');startGraphMotion(drag.id);}
  moveGraphNode(drag,dx,dy);
 };
 canvas.onpointerup=canvas.onpointercancel=()=>{if(drag?.kind==='node'&&drag.moved){suppressNodeClickUntil=performance.now()+250;drag.node.classList.remove('dragging');releaseGraphNode();}drag=null;canvas.classList.remove('panning');};
 canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();setZoom(zoom*(e.deltaY<0?1.08:.92),e.clientX-r.left,e.clientY-r.top);},{passive:false});
}
function resizePane(kind,delta,initial){const shell=document.querySelector('.ide');if(kind==='tree')shell.style.setProperty('--tree-width',Math.max(220,Math.min(400,initial+delta,innerWidth-750))+'px');if(kind==='detail')shell.style.setProperty('--detail-width',Math.max(340,Math.min(720,initial-delta,innerWidth-660))+'px');if(kind==='bottom')shell.style.setProperty('--panel-height',Math.max(100,Math.min(innerHeight*.52,initial-delta))+'px');}
function bindResizers(){document.querySelectorAll('[data-resize]').forEach(el=>{let drag=null;const kind=el.dataset.resize;const size=()=>document.querySelector(kind==='tree'?'.tree-pane':kind==='detail'?'.detail':'.bottom-panel').getBoundingClientRect()[kind==='bottom'?'height':'width'];el.onpointerdown=e=>{drag={start:kind==='bottom'?e.clientY:e.clientX,size:size()};el.setPointerCapture(e.pointerId);};el.onpointermove=e=>{if(drag)resizePane(kind,(kind==='bottom'?e.clientY:e.clientX)-drag.start,drag.size);};el.onpointerup=el.onpointercancel=()=>drag=null;el.onkeydown=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();resizePane(kind,['ArrowLeft','ArrowUp'].includes(e.key)?-20:20,size());}};});}
function act(type){const t=tasks.find(t=>t.id===selected);if(!t)return;
 if(type==='approve'){t.finished=true;recordUpdate(t,'通过验收','已验收当前提交。',[['状态','待验收','已完成']]);updateDetail();updateList();toast('验收已通过，任务树与图谱已同步');return;}
 if(type==='accept'){t.kind='doing';t.who='等待你按约定反馈';t.wait='刚刚';recordUpdate(t,'接收任务','你已接收 v1，任务开始推进。',[['状态','待接收','进行中']]);updateDetail();updateList();toast('已接收任务');return;}
 action=type;document.querySelector('#note-title').textContent=type==='return'?'退回修改':'记录跟进';document.querySelector('#note-context').textContent=t.title;document.querySelector('#note').value=drafts[t.id+type]||'';document.querySelector('#date-field').hidden=type!=='return';document.querySelector('#next-date').required=type==='return';document.querySelector('#note-dialog').showModal();
}
app.addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;
 if(button.dataset.editorView){switchEditor(button.dataset.editorView);return;}
 if(button.dataset.update){const event=teamUpdates().find(r=>r.id===button.dataset.update);if(event)selectNode(event.taskId,event.id);return;}
 if(button.hasAttribute('data-history-task')){selectedUpdate=null;updateDetail();renderHistory();return;}
 if(button.hasAttribute('data-history-graph')){switchEditor('graph');locateSelected();return;}
 if(button.hasAttribute('data-clear-history')){historyProject=historyAuthor='all';historyQuery='';document.querySelector('#history-project').value='all';document.querySelector('#history-author').value='all';document.querySelector('#history-search').value='';renderHistory();return;}
 if(button.dataset.node){if(performance.now()<suppressNodeClickUntil)return;selectNode(button.dataset.node);return;}
 if(button.dataset.create)openCreateDialog(button.dataset.create);
 if(button.hasAttribute('data-refresh-tree')){const y=document.querySelector('.tree-scroll').scrollTop;updateList();updateDetail();document.querySelector('.tree-scroll').scrollTop=y;toast('任务视图已刷新，当前示例操作和节点位置已保留');}
 if(button.hasAttribute('data-reset-layout')){nodeOffsets.delete(layoutKey());autoFit=true;renderGraph();toast('当前图谱已恢复初始布局');}
 if(button.dataset.collapse){const id=button.dataset.collapse;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);document.querySelector('#task-tree').innerHTML=renderTree();return;}
 if(button.hasAttribute('data-collapse-all')){collapsed=collapsed.size?new Set():new Set(model().nodes.filter(n=>n.type==='project'||n.type==='phase').map(n=>n.id));document.querySelector('#task-tree').innerHTML=renderTree();}
 if(button.hasAttribute('data-toggle-tree')){treeOpen=!treeOpen;mobileView='tree';applyLayout();}
 if(button.hasAttribute('data-search-focus')){treeOpen=true;mobileView='tree';applyLayout();document.querySelector('#tree-search').focus();}
 if(button.hasAttribute('data-show-graph'))switchEditor('graph');
 if(button.hasAttribute('data-toggle-detail')){detailOpen=!detailOpen;applyLayout();}
 if(button.hasAttribute('data-toggle-panel')){panelOpen=!panelOpen;applyLayout();}
 if(button.hasAttribute('data-attention')){panelOpen=true;panelTab='attention';mobileView='graph';applyLayout();renderBottom();}
 if(button.dataset.mobileView){mobileView=button.dataset.mobileView;if(mobileView==='tree')treeOpen=true;if(mobileView==='detail')detailOpen=true;applyLayout();}
 if(button.hasAttribute('data-close')){if(innerWidth<=960)mobileView='graph';else detailOpen=false;applyLayout();}
 if(button.hasAttribute('data-focus-node')){graphFocus=!graphFocus;autoFit=true;zoom=1;pan={x:0,y:0};renderGraph();}
 if(button.hasAttribute('data-fit'))fitGraph();
 if(button.hasAttribute('data-locate'))locateSelected();
 if(button.dataset.zoom)setZoom(zoom+(button.dataset.zoom==='in'?.15:-.15));
 if(button.dataset.panelTab){panelTab=button.dataset.panelTab;renderBottom();}
 if(button.hasAttribute('data-open-relations')){panelOpen=true;panelTab='relations';mobileView='graph';renderBottom();applyLayout();}
 if(button.dataset.tab){detailTab=button.dataset.tab;updateDetail();}
 if(button.dataset.action)act(button.dataset.action);
 if(button.hasAttribute('data-next')){const next=tasks.find(t=>!t.finished&&t.id!==selected);if(next)selectNode(next.id);else toast('没有其他待处理事项');}
 if(button.id==='theme-toggle'){theme=theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('open-task-theme',theme);}catch{}button.innerHTML=icon(theme==='dark'?'sun':'moon');button.setAttribute('aria-label',theme==='dark'?'切换浅色主题':'切换深色主题');}
 if(button.id==='reset'){history.replaceState(null,'',location.pathname);reset();nodeOffsets.clear();detailTab='overview';treeQuery='';document.querySelector('#tree-search').value='';collapsed.clear();graphFocus=false;graphScope='project';document.querySelector('#graph-scope').value='project';autoFit=true;zoom=1;pan={x:0,y:0};detailOpen=treeOpen=panelOpen=true;panelTab='attention';mobileView='graph';historyQuery='';historyProject=historyAuthor='all';document.querySelector('#history-search').value='';document.querySelector('#history-project').value='all';document.querySelector('#history-author').value='all';switchEditor('graph');updateDetail();updateList();applyLayout();toast('示例已重置');}
});
app.addEventListener('input',e=>{if(e.target.id==='history-search'){historyQuery=e.target.value;renderHistory();}if(e.target.id==='tree-search'){treeQuery=e.target.value;document.querySelector('#task-tree').innerHTML=renderTree();}});
app.addEventListener('change',e=>{const el=e.target;
 if(el.id==='history-project'){historyProject=el.value;renderHistory();}
 if(el.id==='history-author'){historyAuthor=el.value;renderHistory();}
 if(el.id==='graph-scope'){graphScope=el.value;graphFocus=false;autoFit=true;zoom=1;pan={x:0,y:0};renderGraph();fitGraph();}
 if(el.hasAttribute('data-todo')){const t=tasks.find(t=>t.id===selected),todo=t.todos[Number(el.dataset.todo)];const before=todoStates[todo.state].label;todo.state=el.value;recordUpdate(t,'更新清单',`${todo.name}：${todoStates[todo.state].label}`,[[todo.name,before,todoStates[todo.state].label]]);const y=document.querySelector('.detail-scroll').scrollTop;updateDetail();updateList();document.querySelector('.detail-scroll').scrollTop=y;toast('进度已同步；任务验收状态保留');}
});
document.querySelector('[data-dismiss]').onclick=()=>document.querySelector('#note-dialog').close();
document.querySelector('#note').oninput=e=>{drafts[selected+action]=e.target.value;e.target.setCustomValidity('');};
document.querySelector('#note-form').onsubmit=e=>{e.preventDefault();const text=document.querySelector('#note').value.trim();if(!text){document.querySelector('#note').setCustomValidity('请填写说明');document.querySelector('#note').reportValidity();return;}const t=tasks.find(t=>t.id===selected);const before=stat(t).text;if(action==='return'){t.kind='doing';t.who=`等待${t.owner}修改后反馈`;t.update=text;t.wait='刚刚';}recordUpdate(t,action==='return'?'退回修改':'记录跟进',text+(action==='return'?'；下次反馈：'+document.querySelector('#next-date').value.replace('T',' '):''),action==='return'?[['状态',before,stat(t).text]]:[]);delete drafts[selected+action];document.querySelector('#note-dialog').close();detailTab='activity';panelTab='activity';updateDetail();updateList();toast('示例记录已保存');};
reset();mobileView=new URL(location).searchParams.has('task')?'detail':innerWidth<=960?'tree':'graph';render();

function openCreateDialog(type){
 const isTask=type==='task',title=isTask?'新建任务':'新建项目',dialog=document.querySelector('#create-dialog'),node=currentNode();
 dialog.innerHTML=`<form id="create-form"><header><h2 id="create-heading">${icon(isTask?'file-plus':'folder-plus')}${title}</h2><button type="button" data-cancel-create aria-label="关闭新建窗口">${icon('x')}</button></header><p class="create-subtitle">${isTask?'先明确任务名称和创建位置。':'创建项目，用来组织相关任务。'}</p><label for="create-name">${isTask?'任务名称':'项目名称'} <span class="required-mark">*</span></label><input id="create-name" required maxlength="80" placeholder="${isTask?'例如：完成试点数据验证':'例如：秋季业务试点'}" autocomplete="off">${isTask?`<div class="create-location"><label for="create-project">所属项目</label><select id="create-project">${projects.map(p=>`<option ${p===currentProject()?'selected':''}>${p}</option>`).join('')}</select><label for="create-parent">上级任务 <small>可选</small></label><select id="create-parent"></select><p id="create-path"></p></div>`:''}<label for="create-description">${isTask?'预期结果':'项目说明'} <small>可选</small></label><textarea id="create-description" rows="3" placeholder="${isTask?'希望交付什么结果？':'这个项目要达成什么？'}"></textarea><footer><span>界面预览 · 不保存数据</span><button type="button" data-cancel-create>取消</button><button type="submit" class="primary">${isTask?'创建任务':'创建项目'}</button></footer></form>`;
 if(isTask){const project=dialog.querySelector('#create-project'),parent=dialog.querySelector('#create-parent');const updatePath=()=>{const parentName=parent.value?model().nodes.find(n=>n.id===parent.value)?.title:'';dialog.querySelector('#create-path').textContent='创建位置：'+project.value+(parentName?' / '+parentName:' / 项目下的顶层任务');};const populate=initial=>{parent.innerHTML='<option value="">无上级任务</option>'+model().nodes.filter(n=>n.project===project.value&&['phase','task'].includes(n.type)).map(n=>`<option value="${n.id}" ${initial&&n.id===node?.id?'selected':''}>${esc(n.title)}</option>`).join('');updatePath();};populate(true);project.onchange=()=>populate(false);parent.onchange=updatePath;}
 dialog.querySelectorAll('[data-cancel-create]').forEach(button=>button.onclick=()=>dialog.close());
 dialog.querySelector('#create-form').onsubmit=e=>{e.preventDefault();const field=dialog.querySelector('#create-name');if(!field.value.trim()){field.setCustomValidity('请填写名称');field.reportValidity();return;}dialog.close();toast(`${title}的表单预览已完成；此原型不保存新数据`);};
 dialog.querySelector('#create-name').oninput=e=>e.target.setCustomValidity('');dialog.showModal();dialog.querySelector('#create-name').focus();
}
