import { NAV_ITEMS, PAGE_TITLES, pageForPath, type AppPage } from "../../app/navigation";
import { ACTION_LABELS, STUDIO_STATE_KEY, restoredStudioState, stableStudioState, nextStudioState, type StudioAction } from "../studio/studioState";
import type { StudioScene } from "../studio/studioScene";
import { studioLighting } from "../studio/studioTime";

const shell = document.querySelector<HTMLElement>(".alpha-shell");
if (shell) init(shell);

function init(shell: HTMLElement) {
  const studio = shell.querySelector<HTMLElement>("[data-studio]")!;
  const mount = studio.querySelector<HTMLElement>("[data-studio-scene]")!;
  const status = studio.querySelector<HTMLElement>("[data-studio-status]")!;
  const desktop = shell.querySelector<HTMLElement>("[data-os-fullscreen]")!;
  const dialog = shell.querySelector<HTMLDialogElement>("[data-studio-dialog]")!;
  const returnButton = shell.querySelector<HTMLButtonElement>("[data-studio-return]")!;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const events = new AbortController();
  let page: AppPage = pageForPath(location.pathname);
  let state = restoredStudioState(readSession());
  let scene: StudioScene | undefined;
  let sceneLoading: Promise<void> | undefined;
  let disposed = false;
  let transition = 0;
  let clock = 0;
  let panelTrigger: HTMLElement | null = null;

  function readSession() {
    try { return sessionStorage.getItem(STUDIO_STATE_KEY); } catch { return null; }
  }
  function save() {
    try { sessionStorage.setItem(STUDIO_STATE_KEY, stableStudioState(state)); } catch { /* private browsing */ }
  }
  function updateLighting() {
    const light = studioLighting();
    studio.style.backgroundColor = light.background;
    studio.style.color = light.foreground;
    scene?.setLighting(light);
  }
  function sceneFailed() {
    studio.classList.add("is-fallback");
    status.hidden = false;
    status.textContent = "三维场景暂不可用，请使用下方入口。";
  }
  function sync() {
    const home = page === "home";
    const osOpen = home && state === "desktop";
    studio.dataset.state = state;
    studio.inert = !home || state !== "room";
    studio.style.visibility = osOpen ? "hidden" : "";
    shell.classList.toggle("is-home-active", home);
    shell.classList.toggle("is-home-suspended", !home);
    shell.querySelector<HTMLElement>(".app-dock")!.hidden = home;
    desktop.classList.toggle("is-settled", osOpen);
    desktop.setAttribute("aria-hidden", String(!osOpen));
    desktop.inert = !osOpen;
    shell.querySelectorAll<HTMLElement>(".app-page").forEach(el => {
      const active = el.id === `page-${page}`;
      el.classList.toggle("is-active", active);
      el.inert = !active;
    });
    shell.querySelectorAll<HTMLAnchorElement>(".app-dock a").forEach(link => {
      link.classList.toggle("is-active", link.dataset.page === page);
      if (link.dataset.page === page) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.title = PAGE_TITLES[page];
    scene?.setActive(home && !osOpen && !document.hidden && !dialog.open);
    if (home && state !== "desktop") void loadScene();
    clearInterval(clock);
    if (home && !document.hidden) {
      const tick = () => {
        if (!osOpen) updateLighting();
        else shell.querySelector("[data-os-time]")!.textContent = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date());
      };
      tick(); clock = window.setInterval(tick, 30_000);
    }
    save();
  }
  function loadScene() {
    if (sceneLoading) return sceneLoading;
    sceneLoading = import("../studio/studioScene").then(({ createStudioScene }) => {
      if (disposed) return;
      scene = createStudioScene(mount, action => void act(action), sceneFailed);
      updateLighting();
      status.hidden = true;
      scene.setActive(page === "home" && state !== "desktop" && !document.hidden && !dialog.open);
    }).catch(sceneFailed);
    return sceneLoading;
  }
  function navigate(next: AppPage, push = true) {
    transition++;
    state = nextStudioState(state, "cancel");
    scene?.cancelTransition(state === "desktop");
    dialog.close();
    page = next;
    if (push) {
      const path = NAV_ITEMS.find(item => item.page === next)!.path;
      if (location.pathname !== path) history.pushState({ page }, "", path);
    }
    sync();
  }
  async function enterOrReturn(enter: boolean) {
    const next = nextStudioState(state, enter ? "enter" : "return");
    if (next === state || page !== "home") return;
    state = next;
    const token = ++transition;
    sync();
    await loadScene();
    if (token !== transition || disposed) return;
    await scene?.moveToComputer(enter, reduce.matches ? 0 : 900);
    if (token !== transition || disposed) return;
    state = nextStudioState(state, "complete");
    sync();
    if (enter) returnButton.focus();
    else (mount.querySelector<HTMLCanvasElement>("canvas:not([hidden])") ?? studio.querySelector<HTMLButtonElement>('[data-studio-action="computer"]'))?.focus();
  }
  async function act(action: StudioAction) {
    if (page !== "home" || state !== "room") return;
    if (action === "computer") { await enterOrReturn(true); return; }
    if (action === "works") { navigate("works"); return; }
    if (action === "chair") { scene?.spinChair(reduce.matches); return; }
    panelTrigger = document.activeElement instanceof HTMLElement && studio.contains(document.activeElement)
      ? document.activeElement : mount.querySelector<HTMLCanvasElement>("canvas");
    dialog.querySelector("h2")!.textContent = ACTION_LABELS[action];
    dialog.querySelectorAll<HTMLElement>("[data-studio-panel]").forEach(panel => { panel.hidden = panel.dataset.studioPanel !== action; });
    dialog.showModal();
    sync();
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
    if (target === returnButton) void enterOrReturn(false);
    if (target.matches(".studio-close")) dialog.close();
    const command = target.dataset.desktopCommand;
    if (command === "open-display-controls" || command === "arrange-icons") window.dispatchEvent(new CustomEvent(`justin-os-desktop:${command}`));
  }, { signal: events.signal });
  dialog.addEventListener("close", () => { sync(); if (page === "home" && state === "room") panelTrigger?.focus(); }, { signal: events.signal });
  window.addEventListener("popstate", () => navigate(pageForPath(location.pathname), false), { signal: events.signal });
  document.addEventListener("visibilitychange", sync, { signal: events.signal });
  window.addEventListener("pagehide", event => {
    transition++;
    state = nextStudioState(state, "cancel"); save();
    scene?.cancelTransition(state === "desktop"); scene?.setActive(false);
    clearInterval(clock);
    if (!event.persisted) { disposed = true; scene?.dispose(); events.abort(); }
  }, { signal: events.signal });
  window.addEventListener("pageshow", sync, { signal: events.signal });
  sync();
}
