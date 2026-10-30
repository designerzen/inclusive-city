export interface DesignerRect { left:number; top:number; width:number; height:number }
/** Largest clear rectangle between the actual rendered overlay bounds. */
export function freeDesignerRect(width:number,height:number,overlays:DesignerRect[],padding=12):DesignerRect {
  const pad=Math.min(padding,width/4,height/4),left=pad,top=pad,right=width-pad,bottom=height-pad;
  const xs=[...new Set([left,right,...overlays.flatMap(r=>[r.left-padding,r.left+r.width+padding])].map(x=>Math.max(left,Math.min(right,x))))].sort((a,b)=>a-b);
  const ys=[...new Set([top,bottom,...overlays.flatMap(r=>[r.top-padding,r.top+r.height+padding])].map(y=>Math.max(top,Math.min(bottom,y))))].sort((a,b)=>a-b);
  let best:DesignerRect={left:width/2,top:height/2,width:1,height:1},score=-1;
  for(let x=0;x<xs.length-1;x++)for(let r=x+1;r<xs.length;r++)for(let y=0;y<ys.length-1;y++)for(let b=y+1;b<ys.length;b++) {
    const candidate={left:xs[x],top:ys[y],width:xs[r]-xs[x],height:ys[b]-ys[y]};
    if(overlays.some(o=>candidate.left<o.left+o.width+padding-.01 && candidate.left+candidate.width>o.left-padding+.01 && candidate.top<o.top+o.height+padding-.01 && candidate.top+candidate.height>o.top-padding+.01))continue;
    const area=candidate.width*candidate.height,centred=area-.001*Math.hypot(candidate.left+candidate.width/2-width/2,candidate.top+candidate.height/2-height/2);
    if(centred>score){best=candidate;score=centred;}
  }
  return best;
}
export function designerFreeSpace(root:HTMLElement):DesignerRect {
  const overlays=[...root.querySelectorAll<HTMLElement>('.workspace-header,.workspace-dock,.workspace-drawer,.workspace-warning,.restore-workspace-ui')].filter(e=>e.getClientRects().length && getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return{left:r.left,top:r.top,width:r.width,height:r.height};});
  return freeDesignerRect(innerWidth,innerHeight,overlays);
}
/** Reuse the designer's controls and IDs in a canvas-first overlay workspace. */
export function arrangeBodyDesigner(root: HTMLElement) {
  const take = <T extends HTMLElement = HTMLElement>(selector: string) => {
    const node = root.querySelector<T>(selector);
    if (!node) throw new Error(`Missing designer control: ${selector}`);
    return node;
  };
  const panel = take('.body-panel'), preview = take('.body-preview'), stage = take('.body-stage');
  const shapePresets = take('[aria-label="Body starting shapes"]'), sculptPresets = take('[aria-label="Sculpted body starting points"]');
  const shapeHelp = panel.querySelectorAll<HTMLElement>(':scope > .parameter-help')[0];
  const surpriseHelp = panel.querySelectorAll<HTMLElement>(':scope > .parameter-help')[1];
  const group = (id: string, title: string, nodes: HTMLElement[], open = false) => {
    const details = document.createElement('details'); details.id = `group-${id}`; details.className = 'control-group'; details.open = open;
    const summary = document.createElement('summary'); summary.textContent = title;
    const body = document.createElement('div'); body.className = 'control-group-body'; body.append(...nodes);
    details.append(summary, body); return details;
  };
  const parameter = (id: string) => take(`#${id}`).closest<HTMLElement>('.parameter')!;
  const profile = group('profile', 'Angles & proportions', [take('#body-section').closest<HTMLElement>('label')!, take('#body-rim').closest<HTMLElement>('label')!, ...['aspect','lean','ridge'].map(parameter), shapeHelp]);
  const shape = group('shape', 'Body shape', [shapePresets, sculptPresets, ...['sides','diameter','height','taper','tabs'].map(parameter), profile], true);
  const material = take('.material-options'), decoration = take('.decoration-options'), hardware = take('.exposure-options');
  for (const section of [material, decoration, hardware]) section.querySelector('h2')?.classList.add('visually-hidden');
  const fit = take<HTMLDetailsElement>('.body-panel > details'); fit.id = 'group-fit'; fit.classList.add('control-group'); fit.append(take('#reset-body'));
  const designGroups = [shape, group('shell-identity', 'Shell identity & QR reader', [take('.shell-identity-options')]), group('roof', 'Roofs & lids', [take('.roof-options')]), group('decoration', 'Appendages & windows', [decoration]), group('material', 'Card & bend tolerances', [material]), group('hardware', 'Hardware openings', [hardware]), fit, group('surprises', 'Surprise options', [surpriseHelp, take('#surprise-appendages'), take('#surprise-windows')])];
  const folding = take('.fold-controls'), caption = take('.preview-caption'), viewActions = take('.view-actions');
  const status = take('#fit-status'), exports = take('.body-export'), exportNote = take('.export-note'), guide = take('#making');
  const back = take<HTMLAnchorElement>('.back-link'), switcher = take('.view-switch'), random = take('#random-body');
  back.textContent = '←'; back.setAttribute('aria-label', 'Back to the city'); back.title = 'Back to the city';
  random.textContent = '✦ Surprise me';
  const ui = document.createElement('div'); ui.className = 'workspace-interface';
  ui.innerHTML = `<header class="workspace-header"><div class="workspace-brand"><h1>Robot body lab</h1><span>ONE SHEET / YOUR DESIGN</span></div><button class="tertiary" id="hide-workspace-ui" aria-label="Hide all controls" title="Hide all controls">◫</button></header><div class="workspace-panels"></div><nav class="workspace-dock" aria-label="Designer tools"></nav><button id="workspace-warning" class="secondary workspace-warning" hidden>Check fit & cutting</button>`;
  const header = ui.querySelector('.workspace-header')!;
  header.prepend(back); header.append(switcher, random);
  const drawers = new Map<string, HTMLElement>(), buttons = new Map<string, HTMLButtonElement>();
  const titles: Record<string,string> = {design:'Design',fold:'Fold & view',export:'Cut & export',guide:'Making guide'};
  const dockTitles: Record<string,string> = {design:'Design',fold:'Fold',export:'Export',guide:'Guide'};
  const contents: Record<string,HTMLElement[]> = {design:designGroups,fold:[folding,viewActions,caption],export:[status,exports,exportNote],guide:[guide]};
  for (const id of Object.keys(titles)) {
    const drawer = document.createElement('section'); drawer.id = `drawer-${id}`; drawer.className = `workspace-drawer drawer-${id}`; drawer.hidden = true;
    drawer.setAttribute('aria-labelledby', `drawer-${id}-title`);
    drawer.innerHTML = `<div class="drawer-heading"><h2 id="drawer-${id}-title" tabindex="-1">${titles[id]}</h2><button class="tertiary" data-close-drawer="${id}" aria-label="Hide ${titles[id].toLowerCase()}">×</button></div><div class="drawer-content"></div>`;
    drawer.querySelector('.drawer-content')!.append(...contents[id]); ui.querySelector('.workspace-panels')!.append(drawer); drawers.set(id, drawer);
    const button = document.createElement('button'); button.classList.add('tertiary'); button.id = `tool-${id}`; button.textContent = dockTitles[id]; button.setAttribute('aria-controls',drawer.id); button.setAttribute('aria-expanded','false');
    ui.querySelector('.workspace-dock')!.append(button); buttons.set(id,button);
  }
  const restore = document.createElement('button'); restore.classList.add('tertiary'); restore.id='restore-workspace-ui'; restore.className='tertiary restore-workspace-ui'; restore.textContent='Show controls'; restore.hidden=true;
  preview.replaceChildren(stage); root.replaceChildren(preview,ui,restore); root.classList.add('designer-workspace');
  let layoutFrame=0;
  const scheduleLayout=()=>{
    cancelAnimationFrame(layoutFrame);
    layoutFrame=requestAnimationFrame(()=>{
      const free=designerFreeSpace(root);
      for(const [key,value] of Object.entries(free))root.style.setProperty(`--scene-${key}`,`${value}px`);
      root.dispatchEvent(new Event('designer-layout-change'));
    });
  };
  const geometryObserver=new ResizeObserver(scheduleLayout);
  for(const node of [header,...drawers.values(),ui.querySelector('.workspace-dock')!,restore,ui.querySelector('.workspace-warning')!])geometryObserver.observe(node);
  window.addEventListener('resize',scheduleLayout);
  let active: string|null=null;
  const open = (id: string|null, focus = false) => {
    active=id;
    ui.dataset.drawerOpen=String(id!==null);
    drawers.forEach((drawer,key)=>{drawer.hidden=key!==id;buttons.get(key)!.setAttribute('aria-expanded',String(key===id));});
    if(focus && id)drawers.get(id)!.querySelector<HTMLElement>('h2')!.focus({preventScroll:true});
    scheduleLayout();
  };
  const hide = () => {ui.hidden=true;restore.hidden=false;stage.querySelector<HTMLElement>('.stage-label')!.hidden=true;restore.focus({preventScroll:true});scheduleLayout();};
  const show = () => {ui.hidden=false;restore.hidden=true;stage.querySelector<HTMLElement>('.stage-label')!.hidden=false;ui.querySelector<HTMLButtonElement>('#hide-workspace-ui')!.focus({preventScroll:true});scheduleLayout();};
  buttons.forEach((button,id)=>button.addEventListener('click',()=>open(active===id?null:id,true)));
  ui.querySelectorAll<HTMLButtonElement>('[data-close-drawer]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.closeDrawer!;open(null);buttons.get(id)!.focus({preventScroll:true});}));
  ui.querySelector('#hide-workspace-ui')!.addEventListener('click',hide); restore.addEventListener('click',show);
  const warning=ui.querySelector<HTMLButtonElement>('#workspace-warning')!;warning.addEventListener('click',()=>open('export',true));
  const observer = new MutationObserver(()=>{warning.hidden=!status.classList.contains('has-warning');}); observer.observe(status,{attributes:true,attributeFilter:['class']});
  const escape = (event: KeyboardEvent) => {
    if(event.key!=='Escape')return;
    if(ui.hidden)show();else if(active){const id=active;open(null);buttons.get(id)!.focus({preventScroll:true});}else hide();
  };
  document.addEventListener('keydown',escape);
  // Keep each design section independently collapsible, and remember its state.
  try { const saved=JSON.parse(localStorage.getItem('robot-body-control-groups-v1')??'{}'); root.querySelectorAll<HTMLDetailsElement>('details[id^="group-"]').forEach(group=>{if(typeof saved[group.id]==='boolean')group.open=saved[group.id];}); } catch { /* Default groups work without storage. */ }
  root.querySelectorAll<HTMLDetailsElement>('details[id^="group-"]').forEach(details=>details.addEventListener('toggle',()=>{
    const state=Object.fromEntries([...root.querySelectorAll<HTMLDetailsElement>('details[id^="group-"]')].map(group=>[group.id,group.open]));
    try {localStorage.setItem('robot-body-control-groups-v1',JSON.stringify(state));}catch{/* Session-only layout. */}
  }));
  if(matchMedia('(min-width: 900px)').matches)open('design');
  scheduleLayout();
  return () => {observer.disconnect();geometryObserver.disconnect();cancelAnimationFrame(layoutFrame);window.removeEventListener('resize',scheduleLayout);document.removeEventListener('keydown',escape);};
}
