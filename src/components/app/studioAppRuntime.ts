import { NAV_ITEMS, PAGE_TITLES, pageForPath, studioStateForPage, historyAction, type AppPage } from "../../app/navigation";
import { ACTION_LABELS, DIARY_URL, type StudioState, type StudioAction } from "../studio/studioState";
import type { StudioScene } from "../studio/studioScene";
import { studioLighting } from "../studio/studioTime";
import { smooth, surfaceOpacity } from "../studio/studioMotion";

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
  let page: AppPage = pageForPath(location.pathname);
  let state: StudioState = studioStateForPage(page);
  let historyPending = false;
  let scene: StudioScene | undefined;
  let sceneLoading: Promise<void> | undefined;
  let disposed = false;
  let transition = 0;
  let clock = 0;
  const isOpen = () => state === "desktop" || state === "canvas";
  const isMoving = () => state.startsWith("entering") || state.startsWith("returning");
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
  function sceneFailed() {
    studio.classList.add("is-fallback");
    status.hidden = false;
    status.textContent = "三维场景暂不可用，请使用下方入口。";
  }
  function sync() {
    const home = page === "home";
    const osOpen = state === "desktop";
    const canvasOpen = state === "canvas";
    const canvasVisible = canvasOpen || state.endsWith("-canvas");
    studio.dataset.state = state;
    studio.inert = !home || state !== "room";
    studio.style.visibility = isOpen() ? "hidden" : "";
    shell.classList.toggle("is-home-active", home || isMoving());
    shell.classList.toggle("is-home-suspended", page === "works");
    shell.classList.toggle("is-gallery-active", page === "works");
    shell.querySelector<HTMLElement>(".app-dock")!.hidden = true;
    desktop.classList.toggle("is-settled", osOpen);
    desktop.setAttribute("aria-hidden", String(!osOpen));
    desktop.inert = !osOpen;
    shell.querySelectorAll<HTMLElement>(".app-page").forEach(el => {
      const active = el.id === `page-${page}` || (el.id === "page-home" && (page === "works" || isMoving())) || (el === personalCanvas && canvasVisible);
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
    document.title = PAGE_TITLES[page];
    scene?.setActive((home || isMoving()) && !document.hidden);
    if (home || isMoving() || page === "works") void loadScene();
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
    sceneLoading = import("../studio/studioScene").then(({ createStudioScene }) => {
      if (disposed) return;
      scene = createStudioScene(mount, action => void act(action), sceneFailed);
      updateLighting();
      status.hidden = true;
      // Paint once for a directly loaded gallery's room backdrop, then suspend.
      if (page === "works") requestAnimationFrame(()=>scene?.setActive(false));
      else scene.setActive((page === "home" || isMoving()) && !document.hidden);
    }).catch(sceneFailed);
    return sceneLoading;
  }
  function navigate(next: AppPage) {
    if (historyPending) return;
    const action = historyAction(page, next, history.state);
    if (action === "none") return;
    if (action === "back") { historyPending = true; history.back(); return; }
    const path = NAV_ITEMS.find(item => item.page === next)!.path;
    const entry = { justinPage: next, from: action === "push" ? page : null };
    if (action === "replace") history.replaceState(entry, "", path);
    else history.pushState(entry, "", path);
    void applyRoute(next);
  }
  async function applyRoute(next: AppPage) {
    const from = page;
    const animate = !isMoving() && ((from === "home" && (next === "os" || next === "canvas")) || (next === "home" && (from === "os" || from === "canvas")));
    const token = ++transition;
    scene?.cancelTransition();
    clearProjection();
    page = next;
    state = studioStateForPage(next);
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
    if (page === "os") returnButton.focus();
    else if (page === "canvas") shell.querySelector<HTMLButtonElement>("[data-canvas-return]")?.focus();
    else if (page === "works") shell.querySelector<HTMLButtonElement>("[data-gallery-return]")?.focus();
    else (mount.querySelector<HTMLCanvasElement>("canvas:not([hidden])") ?? studio.querySelector<HTMLButtonElement>('[data-studio-action="computer"]'))?.focus();
  }
  async function act(action: StudioAction) {
    if (page !== "home" || state !== "room") return;
    if (action === "computer") { navigate("os"); return; }
    if (action === "canvas") { navigate("canvas"); return; }
    if (action === "works") { navigate("works"); return; }
    if (action === "chair") { scene?.spinChair(reduce.matches); return; }
    if (action === "diary") { location.assign(DIARY_URL); return; }
    if (!scene) return;
    const button = studio.querySelector<HTMLButtonElement>(`[data-studio-action="${action}"]`);
    if (action === "lamp") button?.setAttribute("aria-pressed", String(scene.toggleLamp()));
    if (action === "clock") {
      const showDate = scene.toggleClock();
      button?.setAttribute("aria-pressed", String(showDate));
      if (button) button.textContent = showDate ? "显示时间" : "显示日期";
    }
    if (action === "drawer-top" || action === "drawer-middle" || action === "drawer-bottom") {
      const open = scene.toggleDrawer(action);
      button?.setAttribute("aria-expanded", String(open));
      if (button) button.textContent = ACTION_LABELS[action].replace("打开", open ? "关闭" : "打开");
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
    if (action && Object.hasOwn(ACTION_LABELS, action)) void act(action as StudioAction);
    if (target === returnButton || target.matches("[data-canvas-return]")) navigate("home");
    if (target.matches("[data-gallery-return]")) navigate("home");
    const command = target.dataset.desktopCommand;
    if (command === "open-display-controls" || command === "arrange-icons") window.dispatchEvent(new CustomEvent(`justin-os-desktop:${command}`));
  }, { signal: events.signal });
  window.addEventListener("popstate", () => { historyPending = false; void applyRoute(pageForPath(location.pathname)); }, { signal: events.signal });
  document.addEventListener("visibilitychange", sync, { signal: events.signal });
  window.addEventListener("pagehide", event => {
    transition++;
    state = studioStateForPage(page);
    scene?.cancelTransition(); clearProjection(); scene?.setActive(false);
    clearInterval(clock);
    if (!event.persisted) { disposed = true; scene?.dispose(); events.abort(); }
  }, { signal: events.signal });
  window.addEventListener("pageshow", event => {
    if (!event.persisted) return;
    historyPending=false;page=pageForPath(location.pathname);state=studioStateForPage(page);sync();
  }, { signal: events.signal });
  // URL, not an old tab-wide session flag, determines refresh and deep-link state.
  history.replaceState({ ...history.state, justinPage: page }, "", NAV_ITEMS.find(item=>item.page===page)!.path + location.search + location.hash);
  sync();
}
