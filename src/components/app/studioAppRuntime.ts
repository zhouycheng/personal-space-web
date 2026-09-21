import { NAV_ITEMS, PAGE_TITLES, pathForPage, pageForPath, studioStateForPage, historyAction, type AppPage } from "../../app/navigation";
import { ACTION_LABELS, type StudioState, type StudioAction } from "../studio/studioState";
import type { StudioScene } from "../studio/studioScene";
import { canRetryStudio, studioFailure, type StudioFailure } from "../studio/studioFailure";
import { studioLighting } from "../studio/studioTime";
import { smooth, surfaceOpacity, stepRoomView, DEFAULT_ROOM_VIEW, type RoomView, type RoomViewAction } from "../studio/studioMotion";
import { createJournalReader } from "../journal/journalRuntime";

const shell = document.querySelector<HTMLElement>(".alpha-shell");
if (shell) init(shell);

function init(shell: HTMLElement) {
  const studio = shell.querySelector<HTMLElement>("[data-studio]")!;
  const mount = studio.querySelector<HTMLElement>("[data-studio-scene]")!;
  const status = studio.querySelector<HTMLElement>("[data-studio-status]")!;
  const desktop = shell.querySelector<HTMLElement>("[data-os-fullscreen]")!;
  const personalCanvas = shell.querySelector<HTMLElement>("#page-canvas")!;
  const returnButton = shell.querySelector<HTMLButtonElement>("[data-studio-return]")!;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const events = new AbortController();
  const explore = studio.querySelector<HTMLButtonElement>("[data-studio-explore]")!;
  const panel = studio.querySelector<HTMLDialogElement>(".studio-panel")!;
  const panelTitle = panel.querySelector<HTMLElement>("#studio-panel-title")!;
  const panelStatus = panel.querySelector<HTMLElement>("[data-studio-panel-status]")!;
  const hint = studio.querySelector<HTMLElement>("[data-studio-hint]")!;
  const tabs = [...panel.querySelectorAll<HTMLButtonElement>("[data-studio-tab]")];
  const viewButtons = [...panel.querySelectorAll<HTMLButtonElement>('[data-studio-action^="zoom-"],[data-studio-action^="view-"],[data-studio-action="reset-view"]')];
  let panelCloseTimer = 0;
  let page: AppPage = pageForPath(location.pathname);
  let state: StudioState = studioStateForPage(page);
  let historyPending = false;
  let scene: StudioScene | undefined;
  let sceneLoading: Promise<void> | undefined;
  let sceneBlocked=false,lightweight=false;
  let savedScene:ReturnType<StudioScene["snapshot"]>|undefined;
  const retry=panel.querySelector<HTMLButtonElement>("[data-studio-retry]")!;
  const diagnostics=panel.querySelector<HTMLDetailsElement>("[data-studio-diagnostics]")!;
  const diagnosticText=diagnostics.querySelector<HTMLTextAreaElement>("textarea")!;
  const diagnosticMode=new URLSearchParams(location.search).get("studioDebug")==="1";
  diagnostics.hidden=!diagnosticMode;
  const diagnosticEntries:string[]=[];
  let disposed = false;
  let transition = 0;
  let clock = 0;
  const journal = createJournalReader(shell.querySelector<HTMLElement>('[data-journal-root]')!,()=>scene,path=>{
    history.pushState({justinPage:'journal',from:page},'',path);
    if(page==='journal')journal.select(location.pathname+location.hash);else void applyRoute('journal');
  });
  const isOpen = () => state === "desktop" || state === "canvas";
  const isMoving = () => state.startsWith("entering") || state.startsWith("returning");
  function selectPanelTab(id:string) {
    for(const tab of tabs) {
      const selected=tab.dataset.studioTab===id;
      tab.setAttribute("aria-selected",String(selected));tab.tabIndex=selected?0:-1;
      panel.querySelector<HTMLElement>(`#${tab.getAttribute("aria-controls")}`)!.hidden=!selected;
    }
    panel.querySelector<HTMLElement>(".studio-panel-content")!.scrollTop=0;
  }
  function openExplore() {
    if(page!=="home"||state!=="room")return;
    clearTimeout(panelCloseTimer);panel.classList.remove("is-closing");
    hint.hidden=true;selectPanelTab("places");
    panel.querySelectorAll("details").forEach(detail=>detail.open=false);
    scene?.setPointerEnabled(false);
    if(!panel.open)panel.showModal();
    explore.setAttribute("aria-expanded","true");panelTitle.focus();
  }
  function closeExplore(restoreFocus=true,immediate=false) {
    clearTimeout(panelCloseTimer);
    if(!panel.open)return;
    const finish=()=>{
      panel.classList.remove("is-closing");panel.close();
      explore.setAttribute("aria-expanded","false");scene?.setPointerEnabled(true);
      if(restoreFocus&&page==="home"&&state==="room")explore.focus();
    };
    if(immediate||reduce.matches)finish();
    else {panel.classList.add("is-closing");panelCloseTimer=window.setTimeout(finish,160);}
  }
  function syncView(view:RoomView) {
    const output=panel.querySelector<HTMLOutputElement>("[data-studio-zoom]")!;
    const label=`${view.zoom.toFixed(2)}×`;
    if(output.textContent!==label)output.textContent=label;
    for(const button of viewButtons) {
      const next=stepRoomView(view,button.dataset.studioAction as RoomViewAction);
      const focused=document.activeElement===button;
      button.disabled=button.dataset.studioAction!=="reset-view"&&next.zoom===view.zoom&&next.angle===view.angle&&next.elevation===view.elevation;
      if(focused&&button.disabled)(button.closest("details")?.querySelector("summary")??output).focus({preventScroll:true});
    }
  }
  function sceneAvailability(ready:boolean) {
    tabs.filter(tab=>tab.dataset.studioTab!=="places").forEach(tab=>tab.hidden=!ready);
    panelStatus.hidden=ready;
    if(!ready)selectPanelTab("places");
  }
  explore.addEventListener("click",openExplore,{signal:events.signal});
  panel.querySelector("[data-studio-close]")!.addEventListener("click",()=>closeExplore(),{signal:events.signal});
  panel.addEventListener("cancel",event=>{event.preventDefault();closeExplore();},{signal:events.signal});
  panel.addEventListener("keydown",event=>{
    if(event.key!=="Tab")return;
    const items=[...panel.querySelectorAll<HTMLElement>("button,a,summary,[tabindex]")].filter(item=>item.tabIndex>=0&&!item.matches(":disabled")&&item.checkVisibility());
    const first=items[0],last=items.at(-1);
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===panelTitle)) {event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last) {event.preventDefault();first?.focus();}
  },{signal:events.signal});
  let backdropDown=false;
  panel.addEventListener("pointerdown",event=>{backdropDown=event.target===panel&&outsidePanel(event);},{signal:events.signal});
  panel.addEventListener("click",event=>{if(backdropDown&&event.target===panel&&outsidePanel(event))closeExplore();backdropDown=false;},{signal:events.signal});
  function outsidePanel(event:MouseEvent) {
    const rect=panel.getBoundingClientRect();
    return event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;
  }
  for(const tab of tabs) {
    tab.addEventListener("click",()=>selectPanelTab(tab.dataset.studioTab!),{signal:events.signal});
    tab.addEventListener("keydown",event=>{
      if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
      event.preventDefault();const visible=tabs.filter(item=>!item.hidden),index=visible.indexOf(tab);
      const next=visible[event.key==="Home"?0:event.key==="End"?visible.length-1:(index+(event.key==="ArrowRight"?1:-1)+visible.length)%visible.length];
      selectPanelTab(next.dataset.studioTab!);next.focus();
    },{signal:events.signal});
  }
  mount.addEventListener("pointerup",()=>{hint.hidden=true;},{signal:events.signal});
  mount.addEventListener("wheel",()=>{hint.hidden=true;},{signal:events.signal});
  syncView(DEFAULT_ROOM_VIEW);
  function clearProjection() {
    for (const el of [desktop, personalCanvas]) {
      el.classList.remove("studio-projecting");
      el.style.removeProperty("transform");el.style.removeProperty("opacity");
    }
  }

  function updateLighting() {
    const now = new Date();
    const light = studioLighting(now);
    studio.style.backgroundColor = light.background;
    studio.style.color = light.foreground;
    scene?.setLighting(light);
    scene?.setTime(now);
  }
  function report(error?:StudioFailure) {
    if(error)console.error(`[studio:${error.stage}]`,error);
    if(!diagnosticMode)return;
    const canvas=mount.querySelector("canvas");
    const gl=canvas?.getContext("webgl2");
    diagnosticEntries.push(JSON.stringify({time:new Date().toISOString(),stage:error?.stage??"ready",message:error?.message,stack:error?.stack,cause:error?.cause instanceof Error?error.cause.stack:undefined,protocol:location.protocol,secureContext:isSecureContext,userAgent:navigator.userAgent,lightweight,webgl2:gl?true:null,contextLost:gl?.isContextLost(),attributes:gl?.getContextAttributes(),maxTextureSize:gl&&!gl.isContextLost()?gl.getParameter(gl.MAX_TEXTURE_SIZE):null},null,2));
    diagnosticText.value=diagnosticEntries.slice(-12).join("\n\n");
  }
  function sceneReady() {
    if(disposed)return;
    sceneBlocked=false;studio.classList.remove("is-fallback");status.hidden=true;retry.hidden=true;
    sceneAvailability(true);scene?.setPointerEnabled(!panel.open);
    mount.dataset.renderActive=String((page==="home"||page==="journal"||isMoving())&&!document.hidden);
    report();
    scene?.setActive((page==="home"||page==="journal"||isMoving())&&!document.hidden);
  }
  function sceneFailed(error:StudioFailure) {
    if(disposed)return;
    report(error);sceneBlocked=true;
    if(page==='journal')journal.fallback();
    if(isMoving()) {transition++;state=studioStateForPage(page);clearProjection();scene?.cancelTransition();sync();}
    studio.classList.add("is-fallback");
    status.hidden = false;
    const retrying=canRetryStudio(error,lightweight,disposed);
    status.textContent = retrying?"正在以轻量模式恢复工作室…":error.stage==="context-lost"?"三维场景已暂停，等待恢复…":"三维场景加载失败，可在探索中重试。";
    panelStatus.textContent=status.textContent;
    retry.hidden=retrying;
    sceneAvailability(false);openExplore();
    if(retrying) {lightweight=true;queueMicrotask(()=>void rebuildScene());}
  }
  async function rebuildScene() {
    await sceneLoading;
    if(disposed)return;
    savedScene=scene?.snapshot()??savedScene;scene?.dispose();scene=undefined;
    sceneBlocked=false;
    retry.hidden=true;status.hidden=false;status.textContent="正在恢复工作室…";
    await loadScene();
  }
  retry.addEventListener("click",()=>{retry.hidden=true;void rebuildScene();},{signal:events.signal});
  diagnostics.querySelector("button")!.addEventListener("click",async()=>{
    diagnosticText.focus();diagnosticText.select();
    try {await navigator.clipboard.writeText(diagnosticText.value);}catch { /* HTTP supports manual selection and copy. */ }
  },{signal:events.signal});
  function sync() {
    const home = page === "home";
    if(!home||state!=="room")closeExplore(false,true);
    const osOpen = state === "desktop";
    const canvasOpen = state === "canvas";
    const canvasVisible = canvasOpen || state.endsWith("-canvas");
    const journalVisible = page==='journal'||state.endsWith('-journal');
    studio.dataset.state = state;
    studio.inert = !journalVisible&&(!home || state !== "room");
    studio.style.visibility = isOpen() ? "hidden" : "";
    shell.classList.toggle("is-home-active", home || isMoving());
    shell.classList.toggle("is-home-suspended", page === "works");
    shell.classList.toggle("is-gallery-active", page === "works");
    shell.classList.toggle("is-journal-active", journalVisible);
    shell.querySelector<HTMLElement>(".app-dock")!.hidden = true;
    desktop.classList.toggle("is-settled", osOpen);
    desktop.setAttribute("aria-hidden", String(!osOpen));
    desktop.inert = !osOpen;
    shell.querySelectorAll<HTMLElement>(".app-page").forEach(el => {
      const active = el.id === `page-${page}` || (el.id === "page-home" && (page === "works" || journalVisible || isMoving())) || (el === personalCanvas && canvasVisible);
      el.classList.toggle("is-active", active);
      el.inert = !active || (el === personalCanvas && canvasVisible && !canvasOpen) || (el.id === "page-home" && page === "works");
    });
    personalCanvas.classList.toggle("studio-canvas-open", canvasVisible);
    shell.querySelector<HTMLElement>("[data-canvas-return]")!.hidden = !canvasOpen;
    shell.querySelectorAll<HTMLAnchorElement>(".app-dock a").forEach(link => {
      link.classList.toggle("is-active", link.dataset.page === page);
      if (link.dataset.page === page) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if(page!=='journal')document.title = PAGE_TITLES[page];
    scene?.setActive((home || journalVisible || isMoving()) && !document.hidden);
    if (home || journalVisible || isMoving() || page === "works") void loadScene();
    clearInterval(clock);
    if ((home || isMoving() || osOpen) && !document.hidden) {
      const tick = () => {
        if (!osOpen) updateLighting();
        else shell.querySelector("[data-os-time]")!.textContent = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date());
      };
      tick(); clock = window.setInterval(tick, 1000);
    }
  }
  function loadScene() {
    if (sceneLoading) return sceneLoading;
    if(scene||sceneBlocked||disposed)return Promise.resolve();
    sceneLoading = import("../studio/studioScene").catch(error=>{throw studioFailure(error,"module");}).then(({ createStudioScene }) => {
      if (disposed) return;
      scene = createStudioScene(mount, action => void act(action), sceneFailed, syncView,sceneReady,lightweight);
      if(savedScene)scene.restore(savedScene);
      scene.setPointerEnabled(!panel.open);
      updateLighting();
      // First-frame success owns availability and subsequent background suspension.
    }).catch(error=>sceneFailed(studioFailure(error,"initialization"))).finally(()=>{sceneLoading=undefined;});
    return sceneLoading;
  }
  function navigate(next: AppPage) {
    closeExplore(false,true);
    if (historyPending) return;
    const action = historyAction(page, next, history.state);
    if (action === "none") return;
    if (action === "back") { historyPending = true; history.back(); return; }
    const path = pathForPage(next);
    const entry = { justinPage: next, from: action === "push" ? page : null };
    if (action === "replace") history.replaceState(entry, "", path);
    else history.pushState(entry, "", path);
    void applyRoute(next);
  }
  async function applyRoute(next: AppPage) {
    closeExplore(false,true);
    const from = page;
    const animate = !isMoving() && ((from === "home" && (next === "os" || next === "canvas")) || (next === "home" && (from === "os" || from === "canvas")));
    const token = ++transition;
    scene?.cancelTransition();
    clearProjection();
    page = next;
    state = studioStateForPage(next);
    if(next==='journal'){
      state='entering-journal';sync();await loadScene();
      if(token!==transition||disposed)return;
      if(from==='journal'){journal.select(location.pathname+location.hash);state='journal';sync();return;}
      await journal.enter(location.pathname+location.hash,reduce.matches||from!=='home'?0:1250);
      if(token!==transition||disposed)return;
      state='journal';sync();focusRoute();return;
    }
    if(from==='journal'){
      if(next==='home'){
        state='returning-journal';sync();await journal.leave(reduce.matches?0:950);
        if(token!==transition||disposed)return;
        state=studioStateForPage(next);sync();focusRoute();return;
      }
      journal.deactivate();
    }else if(!next.startsWith('journal'))journal.deactivate();
    if (!animate) {sync();focusRoute();return;}
    const enter = from === "home";
    const target = (enter ? next : from) === "canvas" ? "canvas" : "computer";
    state = target === "canvas" ? enter ? "entering-canvas" : "returning-canvas" : enter ? "entering" : "returning";
    const surface = target === "canvas" ? personalCanvas : desktop;
    surface.classList.add("studio-projecting");
    surface.style.opacity=enter?"0":"1";
    sync();
    await loadScene();
    if (token !== transition || disposed) return;
    await scene?.moveToSurface(target, enter, reduce.matches ? 0 : 1800, (progress,rect)=>{
      surface.style.opacity=String(surfaceOpacity(progress));
      // Once the camera is square to the screen, the live UI follows its bounds.
      // Ease the final crop into the viewport so fullscreen has no layout jump.
      const settle=smooth((progress-0.8)/0.2);
      const width=rect.width+(surface.clientWidth-rect.width)*settle;
      const height=rect.height+(surface.clientHeight-rect.height)*settle;
      surface.style.transform=`translate(${rect.left*(1-settle)}px,${rect.top*(1-settle)}px) scale(${Math.max(0.001,width/surface.clientWidth)},${Math.max(0.001,height/surface.clientHeight)})`;
    });
    if (token !== transition || disposed) return;
    state = studioStateForPage(page);
    clearProjection();
    sync();
    focusRoute();
  }
  function focusRoute() {
    if (page === "journal") shell.querySelector<HTMLAnchorElement>('[data-journal-close]')?.focus();
    else if (page === "os") returnButton.focus();
    else if (page === "canvas") shell.querySelector<HTMLButtonElement>("[data-canvas-return]")?.focus();
    else if (page === "works") shell.querySelector<HTMLButtonElement>("[data-gallery-return]")?.focus();
    else (mount.querySelector<HTMLCanvasElement>("canvas:not([hidden])") ?? explore).focus();
  }
  async function act(action: StudioAction) {
    if (page !== "home" || state !== "room") return;
    if (action === "computer") { navigate("os"); return; }
    if (action === "canvas") { navigate("canvas"); return; }
    if (action === "works") { navigate("works"); return; }
    if (action === "chair") { scene?.spinChair(reduce.matches); return; }
    if (action === "diary") { navigate("journal"); return; }
    if (!scene) return;
    if (action === "zoom-in" || action === "zoom-out" || action === "reset-view" || action === "view-left" || action === "view-right" || action === "view-up" || action === "view-down") { scene.adjustView(action); return; }
    const button = studio.querySelector<HTMLButtonElement>(`[data-studio-action="${action}"]`);
    if (action === "lamp") button?.setAttribute("aria-checked", String(scene.toggleLamp()));
    if (action === "clock") {
      const showDate = scene.toggleClock();
      panel.querySelectorAll<HTMLButtonElement>("[data-studio-clock]").forEach(option=>option.setAttribute("aria-pressed",String((option.dataset.studioClock==="date")===showDate)));
    }
    if (action === "drawer-top" || action === "drawer-middle" || action === "drawer-bottom") {
      const open = scene.toggleDrawer(action);
      button?.setAttribute("aria-expanded", String(open));
      if (button) {button.textContent=open?"关闭":"打开";button.setAttribute("aria-label",ACTION_LABELS[action].replace("打开",open?"关闭":"打开"));}
      panel.querySelector<HTMLElement>(`[data-drawer-status="${action.replace("drawer-","")}"]`)!.textContent=open?"已打开":"已关闭";
    }
  }
  shell.addEventListener("click", event => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest<HTMLElement>("button,a");
    if (!target) return;
    if (target.matches(".app-dock a")) {
      if (event instanceof MouseEvent && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)) return;
      event.preventDefault(); navigate(pageForPath((target as HTMLAnchorElement).pathname));
    }
    const action = target.dataset.studioAction;
    if (action && Object.hasOwn(ACTION_LABELS, action)) {
      if(target instanceof HTMLAnchorElement) {
        if(event instanceof MouseEvent&&(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0))return;
        event.preventDefault();
      }
      void act(action as StudioAction);
    }
    if(target.dataset.studioClock&&target.getAttribute("aria-pressed")!=="true")void act("clock");
    if (target === returnButton || target.matches("[data-canvas-return]")) navigate("home");
    if (target.matches("[data-gallery-return]")) navigate("home");
    if (target.matches("[data-journal-close]")) {
      if(event instanceof MouseEvent&&(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey))return;
      event.preventDefault();navigate('home');
    }
    const command = target.dataset.desktopCommand;
    if (command === "open-display-controls" || command === "arrange-icons") window.dispatchEvent(new CustomEvent(`justin-os-desktop:${command}`));
  }, { signal: events.signal });
  window.addEventListener("popstate", () => { historyPending = false; void applyRoute(pageForPath(location.pathname)); }, { signal: events.signal });
  document.addEventListener("visibilitychange", sync, { signal: events.signal });
  window.addEventListener("pagehide", event => {
    closeExplore(false,true);clearTimeout(panelCloseTimer);
    transition++;
    state = studioStateForPage(page);
    scene?.cancelTransition(); clearProjection(); scene?.setActive(false);
    clearInterval(clock);
    if (!event.persisted) { disposed = true; journal.dispose();scene?.dispose(); events.abort(); }
  }, { signal: events.signal });
  window.addEventListener("pageshow", event => {
    if (!event.persisted) return;
    historyPending=false;page=pageForPath(location.pathname);state=studioStateForPage(page);sync();if(page==='journal')void journal.enter(location.pathname,0);
  }, { signal: events.signal });
  // URL, not an old tab-wide session flag, determines refresh and deep-link state.
  history.replaceState({ ...history.state, justinPage: page }, "", (page==='journal'?location.pathname:pathForPage(page)) + location.search + location.hash);
  sync();
  if(page==='journal')void loadScene().then(()=>{if(page==='journal')return journal.enter(location.pathname+location.hash,0);});
}
