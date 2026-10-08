import { PAGE_TITLES, pathForPage, pageForPath, studioStateForPage, historyAction, type AppPage } from "./navigation";
import { ACTION_LABELS, type StudioAction } from "../contracts/studio";
import type { ScenePort } from "../contracts/studioPorts";
import { canRetryStudio } from "../application/studio/studioFailure";
import { studioFailure, type StudioFailure } from "../contracts/studioFailure";
import { environmentAt } from "../config/studioTime";
import { readObservation } from '../infrastructure/client/observation';
import type { EnvironmentSnapshot } from '../contracts/environment';
import { beginSurfaceProjection, updateSurfaceProjection, clearSurfaceProjection } from "../animation/studio/surfaceProjection";
import { createJournalReader } from "./journalReader";
import { createExplorePanel } from "../presentation/ui/studio/explorePanel";
import { sceneFiles } from "./siteContent";
import { siteIdentity } from "../data/repositories/siteIdentity";
import { journalRuntime } from "../config/journalRuntime";
import { createStudioClientStore } from "../data/stores/studioClient";
import { resolveStudioIntent, studioTargetsForIntent } from "../application/studio/resolveIntent";
import { createDomInstances } from "../justin-kit/runtime/domInstances";
import { activeTimeout } from "../infrastructure/client/activeDeadline";
import { createEntranceRuntime } from './entranceRuntime';
import { entranceCompleted } from '../infrastructure/client/entranceSession';
import type { StartupProgress } from '../contracts/startup';
import { paintOpportunity } from '../infrastructure/client/paintOpportunity';
import { createBgmPlayer } from '../presentation/ui/music/bgmRuntime';
import { createHomeProfile } from '../presentation/ui/music/homeProfile';

const instances = createDomInstances(".alpha-shell", init);
instances.init();

function init(shell: HTMLElement) {
  const studio = shell.querySelector<HTMLElement>("[data-studio]")!;
  const mount = studio.querySelector<HTMLElement>("[data-studio-scene]")!;
  const status = studio.querySelector<HTMLElement>("[data-studio-status]")!;
  const desktop = shell.querySelector<HTMLElement>("[data-os-fullscreen]")!;
  const personalCanvas = shell.querySelector<HTMLElement>("#page-canvas")!;
  const returnButton = shell.querySelector<HTMLButtonElement>("[data-studio-return]")!;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const events = new AbortController();
  const initialPage = pageForPath(location.pathname);
  const needsEntrance = !entranceCompleted() && new URLSearchParams(location.search).get('entrance') !== 'skip';
  let pendingPage = initialPage;
  let entrance: ReturnType<typeof createEntranceRuntime>;
  const model = createStudioClientStore(needsEntrance ? 'home' : initialPage, needsEntrance ? 'room' : studioStateForPage(initialPage));
  let historyPending = false;
  let scene: ScenePort | undefined;
  let sceneLoading: Promise<void> | undefined;
  let preparationAbort:AbortController|undefined;
  let scenePrepared = false;
  let sceneBlocked=false,lightweight=false,recoveryAttempted=false;
  let stopRecovery = () => {};
  let savedScene:ReturnType<ScenePort["snapshot"]>|undefined;
  const panelController = createExplorePanel({
    studio, reducedMotion: reduce, signal: events.signal,
    setSceneInputEnabled: enabled => scene?.setPointerEnabled(enabled),
    isRoom: () => !entrance?.covered && model.page === "home" && model.state === "room",
  });
  const panel = panelController.element;
  const music = createBgmPlayer(shell, playing => scene?.setMusicPlaying(playing));
  const stopHomeProfile=createHomeProfile(shell.querySelector<HTMLElement>('[data-bgm-desktop]')!);
  const explore = panelController.explore;
  const openExplore = panelController.open;
  const closeExplore = panelController.close;
  const syncView:typeof panelController.syncView = view => { model.targets={...model.targets,view};panelController.syncView(view); };
  const sceneAvailability = panelController.sceneAvailability;
  const panelStatus = panelController.status;
  const isOpen = () => model.state === "desktop" || model.state === "canvas";
  const isMoving = () => model.state.startsWith("entering") || model.state.startsWith("returning");
  const retry=panel.querySelector<HTMLButtonElement>("[data-studio-retry]")!;
  const diagnostics=panel.querySelector<HTMLDetailsElement>("[data-studio-diagnostics]")!;
  const diagnosticText=diagnostics.querySelector<HTMLTextAreaElement>("textarea")!;
  const diagnosticMode=new URLSearchParams(location.search).get("studioDebug")==="1";
  diagnostics.hidden=!diagnosticMode;
  const diagnosticEntries:string[]=[];
  let disposed = false;
  let transition = 0;
  let clock = 0;
  let previewHour:number|null=null;
  mount.addEventListener('studio-time-preview',event=>{
    previewHour=(event as CustomEvent<number|null>).detail;updateLighting();
  },{signal:events.signal});
  function environmentNow() {
    const date=new Date();
    if(previewHour!==null){const minutes=Math.round(previewHour*60);date.setHours(Math.floor(minutes/60),minutes%60,0,0);}
    return environmentAt(date,readObservation());
  }
  const journal = createJournalReader(shell.querySelector<HTMLElement>('[data-journal-root]')!,()=>scene,path=>{
    history.pushState({justinPage:'journal',from:model.page},'',path);
    if(model.page==='journal')journal.select(location.pathname+location.hash);else void applyRoute('journal');
  },()=>rebuildScene(false));
  function prepareJournalTargets(){
    if(!model.targets.lampOn&&environmentNow().lighting.daylight<.25){
      model.targets={...model.targets,lampOn:true};scene?.setLampEnabled(true);
    }
  }
  function clearProjection() {
    for (const el of [desktop, personalCanvas]) {
      clearSurfaceProjection(el);
    }
  }

  let appliedBackground = "", appliedForeground = "";
  function updateLighting() {
    applyEnvironment(environmentNow());
  }
  function applyEnvironment(environment:EnvironmentSnapshot) {
    const now = new Date(environment.timestamp);
    const light = environment.lighting;
    shell.dataset.skyPhase=environment.phase;
    entrance?.setPalette(environment.palette);
    if (appliedBackground !== light.background) {
      appliedBackground = light.background; studio.style.backgroundColor = light.background;
    }
    if (appliedForeground !== light.foreground) {
      appliedForeground = light.foreground; studio.style.color = light.foreground;
      shell.style.setProperty("--studio-foreground", light.foreground);
    }
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
    if(disposed || !scenePrepared)return;
    const restored=sceneBlocked;stopRecovery();
    sceneBlocked=false;studio.classList.remove("is-fallback");status.hidden=true;retry.hidden=true;
    if(entrance?.covered){report();return;}
    sceneAvailability(true);scene?.setPointerEnabled(!panel.open);
    mount.dataset.renderActive=String((model.page==="home"||model.page==="journal"||isMoving())&&!document.hidden);
    report();
    scene?.setActive((model.page==="home"||model.page==="journal"||isMoving())&&!document.hidden);
    if(restored&&model.page==="journal")void journal.enter(location.pathname+location.hash,0);
  }
  function sceneFailed(error:StudioFailure) {
    if(disposed)return;
    report(error);sceneBlocked=true;
    if(model.page==='journal')journal.fallback();
    if(isMoving()) {
      // Journal entry still has to activate its independent error/retry UI after loadScene settles.
      // Its controller owns animation cancellation; other surface flights end here.
      if(model.state!=='entering-journal')transition++;
      model.state=studioStateForPage(model.page);clearProjection();scene?.cancelTransition();sync();
    }
    studio.classList.add("is-fallback");
    status.hidden = false;
    const retrying=canRetryStudio(error,recoveryAttempted,disposed);
    status.textContent = retrying?"正在恢复工作室…":error.stage==="context-lost"?"三维场景已暂停，等待恢复…":"三维场景加载失败，可在导航面板中重试。";
    panelStatus.textContent=status.textContent;
    retry.hidden=retrying;
    sceneAvailability(false);
    if(entrance?.covered)entrance.failed();else openExplore();
    if(retrying) {recoveryAttempted=true;queueMicrotask(()=>{if(entrance?.covered)void entrance.start();else void rebuildScene();});}
    else if(error.stage==="context-lost"&&!recoveryAttempted){
      stopRecovery();stopRecovery=activeTimeout(()=>{if(sceneBlocked&&!disposed){recoveryAttempted=true;if(entrance?.covered)void entrance.start();else void rebuildScene();}},journalRuntime.recoveryTimeoutMs);
    }
  }
  async function rebuildScene(restoreJournal=true) {
    await sceneLoading;
    if(disposed)return;
    stopRecovery();savedScene=model.targets;scene?.dispose();scene=undefined;scenePrepared=false;
    sceneBlocked=false;
    retry.hidden=true;status.hidden=false;status.textContent="正在恢复工作室…";
    await loadScene();
    if(restoreJournal&&model.page==="journal"&&scene&&!sceneBlocked)await journal.enter(location.pathname+location.hash,0);
  }
  retry.addEventListener("click",()=>{retry.hidden=true;void rebuildScene();},{signal:events.signal});
  diagnostics.querySelector("button")!.addEventListener("click",async()=>{
    diagnosticText.focus();diagnosticText.select();
    try {await navigator.clipboard.writeText(diagnosticText.value);}catch { /* HTTP supports manual selection and copy. */ }
  },{signal:events.signal});
  const osHint=shell.querySelector<HTMLElement>('[data-os-home-hint]')!;
  let osHintShown=false;
  try {osHintShown=localStorage.getItem('justin-os-return-hint')==='seen';}catch {}
  shell.querySelector('[data-os-hint-close]')!.addEventListener('click',()=>{osHint.hidden=true;},{signal:events.signal});
  function sync() {
    const musicHome=model.page==='home'&&!isMoving();
    shell.dataset.musicHome=String(musicHome);
    shell.querySelector<HTMLElement>('[data-bgm-desktop]')!.inert=!musicHome||Boolean(entrance?.covered);
    if(entrance?.blocking) {
      shell.dataset.entrance=entrance.playing?'playing':'preparing';
      closeExplore(false,true);clearInterval(clock);scene?.setPointerEnabled(false);
      if(!document.hidden){updateLighting();clock=window.setInterval(updateLighting,1000);}
      studio.inert=true;studio.style.visibility='';
      shell.querySelectorAll<HTMLElement>('.app-page').forEach(el=>{
        el.classList.toggle('is-active',el.id==='page-home'||(pendingPage==='canvas'&&el===personalCanvas)||(entrance.playing&&pendingPage==='works'&&el.id==='page-works'));el.inert=true;
      });
      desktop.inert=true;desktop.setAttribute('aria-hidden','true');
      shell.querySelector<HTMLElement>('.app-dock')!.hidden=true;
      scene?.setActive(entrance.playing&&!document.hidden);
      return;
    }
    if(entrance?.covered)shell.dataset.entrance='refresh';
    else delete shell.dataset.entrance;
    studio.querySelector('[data-studio-action="lamp"]')?.setAttribute('aria-checked',String(model.targets.lampOn));
    panel.querySelectorAll<HTMLButtonElement>('[data-studio-clock]').forEach(option=>option.setAttribute('aria-pressed',String((option.dataset.studioClock==='date')===model.targets.showDate)));
    model.targets.drawers.forEach((open,index)=>{
      const name=['top','middle','bottom'][index];
      const button=studio.querySelector<HTMLButtonElement>(`[data-studio-action="drawer-${name}"]`);
      if(button){button.setAttribute('aria-expanded',String(open));button.textContent=open?'关闭':'打开';button.setAttribute('aria-label',`${open?'关闭':'打开'}${['第一','第二','第三'][index]}层抽屉`);}
      const status=panel.querySelector<HTMLElement>(`[data-drawer-status="${name}"]`);if(status)status.textContent=open?'已打开':'已关闭';
    });
    const home = model.page === "home";
    if(!home||model.state!=="room")closeExplore(false,true);
    const osOpen = model.state === "desktop";
    if(osOpen&&!osHintShown){
      osHint.hidden=false;osHintShown=true;
      try{localStorage.setItem('justin-os-return-hint','seen');}catch {}
    }
    if(!osOpen)osHint.hidden=true;
    const canvasOpen = model.state === "canvas";
    const canvasVisible = canvasOpen || model.state.endsWith("-canvas");
    const journalVisible = model.page==='journal'||model.state.endsWith('-journal');
    studio.dataset.state = model.state;
    studio.inert = !journalVisible&&(!home || model.state !== "room");
    studio.style.visibility = isOpen() ? "hidden" : "";
    shell.classList.toggle("is-home-active", home || isMoving());
    shell.classList.toggle("is-home-suspended", model.page === "works");
    shell.classList.toggle("is-gallery-active", model.page === "works");
    shell.classList.toggle("is-journal-active", journalVisible);
    shell.querySelector<HTMLElement>(".app-dock")!.hidden = true;
    desktop.classList.toggle("is-settled", osOpen);
    desktop.setAttribute("aria-hidden", String(!osOpen));
    desktop.inert = !osOpen;
    shell.querySelectorAll<HTMLElement>(".app-page").forEach(el => {
      const active = el.id === `page-${model.page}` || (el.id === "page-home" && (model.page === "works" || journalVisible || isMoving())) || (el === personalCanvas && canvasVisible);
      el.classList.toggle("is-active", active);
      el.inert = !active || (el === personalCanvas && canvasVisible && !canvasOpen) || (el.id === "page-home" && model.page === "works");
    });
    personalCanvas.classList.toggle("studio-canvas-open", canvasVisible);
    shell.querySelector<HTMLElement>("[data-canvas-return]")!.hidden = !canvasOpen;
    shell.querySelectorAll<HTMLAnchorElement>(".app-dock a").forEach(link => {
      link.classList.toggle("is-active", link.dataset.page === model.page);
      if (link.dataset.page === model.page) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if(model.page!=='journal')document.title = PAGE_TITLES[model.page];
    scene?.setActive((home || journalVisible || isMoving()) && !document.hidden);
    if (!entrance?.covered && (home || journalVisible || isMoving() || model.page === "works")) void loadScene();
    clearInterval(clock);
    if ((home || isMoving() || osOpen || entrance?.covered) && !document.hidden) {
      const tick = () => {
        if (!osOpen||entrance?.covered) updateLighting();
        if (osOpen) shell.querySelector("[data-os-time]")!.textContent = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date());
      };
      tick(); clock = window.setInterval(tick, 1000);
    }
  }
  function loadScene(onProgress: (value:StartupProgress)=>void = ()=>{}, prepareForEntrance = false) {
    if (sceneLoading) return sceneLoading;
    if(scene||sceneBlocked||disposed)return Promise.resolve();
    const abort=preparationAbort=new AbortController(),timings:Record<string,number>={};
    onProgress({stage:'module',progress:0});
    const moduleStarted=performance.now();
    sceneLoading = import("../presentation/scene/studio/studioScene").catch(error=>{throw studioFailure(error,"module");}).then(async ({ createStudioScene,prepareSceneGeometry,disposePreparedGeometry }) => {
      if (disposed||abort.signal.aborted) return;
      timings.moduleWait=performance.now()-moduleStarted;
      onProgress({stage:'geometry',progress:1/5});
      await paintOpportunity(abort.signal);
      let started!:()=>void;
      const workerStarted=new Promise<void>(resolve=>{started=resolve;});
      const geometry=prepareSceneGeometry(abort.signal,timings,started);
      // Observe early worker failure even if renderer/furniture construction fails first.
      void geometry.catch(()=>{});
      // Let the worker finish module loading before synchronous furniture work blocks its launch.
      await workerStarted;
      if(disposed||abort.signal.aborted){void geometry.then(disposePreparedGeometry,()=>{});return;}
      scenePrepared=false;
      try {scene = await createStudioScene(mount, action => void act(action), sceneFailed, syncView,sceneReady,lightweight,sceneFiles,siteIdentity.brand,{geometry,signal:abort.signal,timings});}
      catch(error){void geometry.then(disposePreparedGeometry,()=>{});throw error;}
      if(disposed||abort.signal.aborted){scene.dispose();scene=undefined;return;}
      mount.dataset.startupTimings=JSON.stringify(timings);
      scene.restore(savedScene??model.targets);
      scene.setPointerEnabled(!entrance?.covered&&!panel.open);
      scene.setMusicPlaying(music.playing);
      updateLighting();
      const current=scene;
      if(prepareForEntrance) {
        const result=await current.prepareStartup({entrance:Boolean(entrance?.blocking),onProgress});
        if(disposed||scene!==current)return;
        scenePrepared=result.status==='completed';
        if(scenePrepared)sceneReady();
      } else {
        // Normal direct navigation keeps its existing first-draw startup. Only
        // the cloud-covered entrance/refresh path needs the explicit warmup.
        scenePrepared=true;
        if(model.page==='home'||model.page==='journal'||isMoving())current.setActive(!document.hidden);
        else sceneReady();
      }
    }).catch(error=>{if(!disposed&&!abort.signal.aborted)sceneFailed(studioFailure(error,"initialization"));abort.abort();}).finally(()=>{sceneLoading=undefined;if(preparationAbort===abort)preparationAbort=undefined;});
    return sceneLoading;
  }
  function navigate(next: AppPage) {
    closeExplore(false,true);
    if (historyPending) return;
    const action = historyAction(model.page, next, history.state);
    if (action === "none") return;
    if (action === "back") { historyPending = true; history.back(); return; }
    const path = pathForPage(next);
    const entry = { justinPage: next, from: action === "push" ? model.page : null };
    if (action === "replace") history.replaceState(entry, "", path);
    else history.pushState(entry, "", path);
    void applyRoute(next);
  }
  async function applyRoute(next: AppPage) {
    if(entrance?.covered){
      pendingPage=next;
      transition++;scene?.cancelTransition();void entrance.start();
      return;
    }
    closeExplore(false,true);
    const from = model.page;
    const animate = !isMoving() && ((from === "home" && (next === "os" || next === "canvas")) || (next === "home" && (from === "os" || from === "canvas")));
    const token = ++transition;
    scene?.cancelTransition();
    clearProjection();
    model.page = next;
    model.state = studioStateForPage(next);
    if(next==='journal'){
      prepareJournalTargets();model.state='entering-journal';sync();await loadScene();
      if(token!==transition||disposed)return;
      if(from==='journal'){journal.select(location.pathname+location.hash);model.state='journal';sync();return;}
      await journal.enter(location.pathname+location.hash,reduce.matches||from!=='home'?0:1250);
      if(token!==transition||disposed)return;
      model.state='journal';sync();focusRoute();return;
    }
    if(from==='journal'){
      if(next==='home'){
        model.state='returning-journal';sync();await journal.leave(reduce.matches?0:950);
        if(token!==transition||disposed)return;
        model.state=studioStateForPage(next);sync();focusRoute();return;
      }
      journal.deactivate();
    }else if(!next.startsWith('journal'))journal.deactivate();
    if (!animate) {sync();focusRoute();return;}
    const enter = from === "home";
    const target = (enter ? next : from) === "canvas" ? "canvas" : "computer";
    model.state = target === "canvas" ? enter ? "entering-canvas" : "returning-canvas" : enter ? "entering" : "returning";
    const surface = target === "canvas" ? personalCanvas : desktop;
    beginSurfaceProjection(surface, enter);
    sync();
    await loadScene();
    if (token !== transition || disposed) return;
    await scene?.moveToSurface(target, enter, reduce.matches ? 0 : 1800, (progress,rect)=>updateSurfaceProjection(surface, progress, rect));
    if (token !== transition || disposed) return;
    model.state = studioStateForPage(model.page);
    clearProjection();
    sync();
    focusRoute();
  }
  function focusRoute() {
    if (model.page === "home") (mount.querySelector<HTMLCanvasElement>("canvas:not([hidden])") ?? explore).focus();
  }
  async function act(action: StudioAction) {
    if (entrance?.covered || model.page !== "home" || model.state !== "room") return;
    const command = resolveStudioIntent(action);
    if (command.kind === "navigate") { navigate(command.page); return; }
    if (action === "chair") { scene?.spinChair(reduce.matches); return; }
    if (!scene) return;
    model.targets=studioTargetsForIntent(model.targets,action);
    if (action === "zoom-in" || action === "zoom-out" || action === "reset-view" || action === "view-left" || action === "view-right" || action === "view-up" || action === "view-down") { scene.adjustView(action); return; }
    const button = studio.querySelector<HTMLButtonElement>(`[data-studio-action="${action}"]`);
    if (action === "lamp") {
      const enabled=model.targets.lampOn;
      scene.setLampEnabled(enabled);button?.setAttribute("aria-checked",String(enabled));
    }
    if (action === "clock") {
      const showDate = model.targets.showDate;scene.setClockMode(showDate?"date":"time");
      panel.querySelectorAll<HTMLButtonElement>("[data-studio-clock]").forEach(option=>option.setAttribute("aria-pressed",String((option.dataset.studioClock==="date")===showDate)));
    }
    if (action === "drawer-top" || action === "drawer-middle" || action === "drawer-bottom") {
      const index=["drawer-top","drawer-middle","drawer-bottom"].indexOf(action),open=model.targets.drawers[index];
      scene.setDrawerOpen(action,open);
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
    closeExplore(false,true);panelController.dispose();clearInterval(clock);scene?.setActive(false);
    if (!event.persisted) dispose();
  }, { signal: events.signal });
  window.addEventListener("pageshow", event => {
    if (!event.persisted) return;
    historyPending=false;
    const restoredPage=pageForPath(location.pathname);
    const currentPage=entrance?.covered?pendingPage:model.page;
    if(restoredPage!==currentPage)void applyRoute(restoredPage);else sync();
  }, { signal: events.signal });
  entrance=createEntranceRuntime(shell.querySelector<HTMLElement>('[data-cloud-entrance]')!,{
    reducedMotion:reduce,
    palette:environmentNow().palette,
    cancel:()=>{
      preparationAbort?.abort();
      mount.style.removeProperty('--entrance-blur');shell.style.removeProperty('--entrance-content-opacity');
      delete shell.dataset.entranceTarget;clearProjection();scene?.cancelTransition();
    },
    sync,
    async prepare(onProgress) {
      await sceneLoading;
      if(disposed)return {status:'cancelled',reason:'disposed'};
      journal.deactivate();clearProjection();model.state='room';delete shell.dataset.entranceTarget;
      if(sceneBlocked){scene?.dispose();scene=undefined;scenePrepared=false;sceneBlocked=false;}
      // Preload only the requested content; documents and journal pages stay lazy.
      const targetModule=pendingPage==='canvas'?import('../presentation/ui/canvas/canvasEditorModule').then(module=>module.loadCanvasEditor()):Promise.resolve();
      const progress=(value:StartupProgress)=>{if(value.stage!=='ready')onProgress({...value,progress:Math.min(value.progress,4/5)});};
      const startup=scenePrepared?Promise.resolve():scene?(async()=>{
        updateLighting();
        const result=await scene!.prepareStartup({entrance:Boolean(entrance?.blocking),onProgress:progress});scenePrepared=result.status==='completed';
      })():loadScene(progress,true);
      await Promise.all([targetModule,startup]);
      if(scenePrepared&&!sceneBlocked&&!entrance.blocking&&pendingPage==='journal') {
        prepareJournalTargets();scene?.setActive(!document.hidden);
        await journal.enter(location.pathname+location.hash,0);
      }
      if(scenePrepared&&!sceneBlocked)onProgress({stage:'ready',progress:1});
      return scenePrepared&&!sceneBlocked?{status:'completed',value:undefined}:{status:'failed',code:'startup',retryable:true};
    },
    async play(duration,onProgress) {
      if(!scene)return {status:'failed',code:'scene-missing',retryable:true};
      const reveal=(progress:number)=>{
        onProgress(progress);
        const t=Math.max(0,Math.min(1,(progress-.19)/.26));
        mount.style.setProperty('--entrance-blur',`${reduce.matches?0:3.5*(1-t*t*(3-2*t))}px`);
      };
      shell.dataset.entranceTarget=pendingPage;
      if(pendingPage==='works') {
        sync();
        return scene.playEntrance({duration,target:'works',onProgress:progress=>{
          reveal(progress);shell.style.setProperty('--entrance-content-opacity',String(Math.max(0,Math.min(1,(progress-.84)/.16))));
        }});
      }
      if(pendingPage==='journal') {
        prepareJournalTargets();model.state='entering-journal';
        await journal.enter(location.pathname+location.hash,0,{duration,onProgress:reveal});
        return journal.ready?{status:'completed',value:undefined}:{status:'failed',code:'journal-startup',retryable:true};
      }
      if(pendingPage==='os'||pendingPage==='canvas') {
        const target=pendingPage==='os'?'computer':'canvas';
        model.state=target==='computer'?'entering':'entering-canvas';
        const surface=target==='computer'?desktop:personalCanvas;
        beginSurfaceProjection(surface,true);
        return scene.playEntrance({duration,onProgress:reveal,target,onSurfaceProgress:(progress,rect)=>updateSurfaceProjection(surface,progress,rect)});
      }
      return scene.playEntrance({duration,onProgress:reveal});
    },
    complete(){
      sceneAvailability(true);scene?.setPointerEnabled(!panel.open);delete shell.dataset.entrance;delete shell.dataset.entranceTarget;
      model.page=pendingPage;model.state=studioStateForPage(pendingPage);clearProjection();sync();focusRoute();
      shell.style.removeProperty('--entrance-content-opacity');
      mount.style.removeProperty('--entrance-blur');
    },
  });
  history.replaceState({ ...history.state, justinPage: initialPage }, "", (initialPage==='journal'?location.pathname:pathForPage(initialPage)) + location.search + location.hash);
  sync();
  if(entrance.covered)void entrance.start();
  else if(model.page==='journal'){prepareJournalTargets();void loadScene().then(()=>{if(!disposed&&model.page==='journal')return journal.enter(location.pathname+location.hash,0);});}
  function dispose() {
    if(disposed)return;
    disposed=true;transition++;preparationAbort?.abort();clearInterval(clock);stopRecovery();events.abort();
    for(const cleanup of [stopHomeProfile,()=>music.dispose(),()=>entrance.dispose(),()=>closeExplore(false,true),()=>panelController.dispose(),()=>scene?.cancelTransition(),
      clearProjection,()=>journal.dispose(),()=>scene?.dispose()]) {
      try{cleanup();}catch(error){console.error("Application cleanup failed",error);}
    }
    scene=undefined;
  }
  return dispose;
}
