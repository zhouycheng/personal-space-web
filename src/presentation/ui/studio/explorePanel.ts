import { stepRoomView, DEFAULT_ROOM_VIEW, type RoomView, type RoomViewAction } from "../../../animation/studio/studioMotion";
import type { ScenePort } from "../../../contracts/studioPorts";

type ExplorePanelOptions = {
  studio: HTMLElement;
  mount: HTMLElement;
  reducedMotion: MediaQueryList;
  signal: AbortSignal;
  scene: () => ScenePort | undefined;
  isRoom: () => boolean;
};

export function createExplorePanel({ studio, mount, reducedMotion, signal, scene, isRoom }: ExplorePanelOptions) {
  const explore = studio.querySelector<HTMLButtonElement>("[data-studio-explore]")!;
  const panel = studio.querySelector<HTMLDialogElement>(".studio-panel")!;
  const title = panel.querySelector<HTMLElement>("#studio-panel-title")!;
  const status = panel.querySelector<HTMLElement>("[data-studio-panel-status]")!;
  const hint = studio.querySelector<HTMLElement>("[data-studio-hint]")!;
  const tabs = [...panel.querySelectorAll<HTMLButtonElement>("[data-studio-tab]")];
  const viewButtons = [...panel.querySelectorAll<HTMLButtonElement>(
    '[data-studio-action^="zoom-"],[data-studio-action^="view-"],[data-studio-action="reset-view"]',
  )];
  let closeTimer = 0;
  let backdropDown = false;

  function selectTab(id: string) {
    for (const tab of tabs) {
      const selected = tab.dataset.studioTab === id;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panel.querySelector<HTMLElement>(`#${tab.getAttribute("aria-controls")}`)!.hidden = !selected;
    }
    panel.querySelector<HTMLElement>(".studio-panel-content")!.scrollTop = 0;
  }

  function open() {
    if (!isRoom()) return;
    window.clearTimeout(closeTimer);
    panel.classList.remove("is-closing");
    hint.hidden = true;
    selectTab("places");
    panel.querySelectorAll("details").forEach(detail => { detail.open = false; });
    scene()?.setPointerEnabled(false);
    if (!panel.open) panel.showModal();
    explore.setAttribute("aria-expanded", "true");
    title.focus();
  }

  function close(restoreFocus = true, immediate = false) {
    window.clearTimeout(closeTimer);
    if (!panel.open) return;
    const finish = () => {
      panel.classList.remove("is-closing");
      panel.close();
      explore.setAttribute("aria-expanded", "false");
      scene()?.setPointerEnabled(true);
      if (restoreFocus && isRoom()) explore.focus();
    };
    if (immediate || reducedMotion.matches) finish();
    else {
      panel.classList.add("is-closing");
      closeTimer = window.setTimeout(finish, 160);
    }
  }

  function syncView(view: RoomView) {
    const output = panel.querySelector<HTMLOutputElement>("[data-studio-zoom]")!;
    const label = `${view.zoom.toFixed(2)}×`;
    if (output.textContent !== label) output.textContent = label;
    for (const button of viewButtons) {
      const next = stepRoomView(view, button.dataset.studioAction as RoomViewAction);
      const focused = document.activeElement === button;
      button.disabled = button.dataset.studioAction !== "reset-view" && next.zoom === view.zoom && next.angle === view.angle && next.elevation === view.elevation;
      if (focused && button.disabled) (button.closest("details")?.querySelector("summary") ?? output).focus({ preventScroll: true });
    }
  }

  function sceneAvailability(ready: boolean) {
    tabs.filter(tab => tab.dataset.studioTab !== "places").forEach(tab => { tab.hidden = !ready; });
    status.hidden = ready;
    if (!ready) selectTab("places");
  }

  function outsidePanel(event: MouseEvent) {
    const rect = panel.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  }

  explore.addEventListener("click", open, { signal });
  panel.querySelector("[data-studio-close]")!.addEventListener("click", () => close(), { signal });
  panel.addEventListener("cancel", event => { event.preventDefault(); close(); }, { signal });
  panel.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const items = [...panel.querySelectorAll<HTMLElement>("button,a,summary,[tabindex]")]
      .filter(item => item.tabIndex >= 0 && !item.matches(":disabled") && item.checkVisibility());
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === title)) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  }, { signal });
  panel.addEventListener("pointerdown", event => { backdropDown = event.target === panel && outsidePanel(event); }, { signal });
  panel.addEventListener("click", event => {
    if (backdropDown && event.target === panel && outsidePanel(event)) close();
    backdropDown = false;
  }, { signal });
  for (const tab of tabs) {
    tab.addEventListener("click", () => selectTab(tab.dataset.studioTab!), { signal });
    tab.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const visible = tabs.filter(item => !item.hidden);
      const index = visible.indexOf(tab);
      const next = visible[event.key === "Home" ? 0 : event.key === "End" ? visible.length - 1 :
        (index + (event.key === "ArrowRight" ? 1 : -1) + visible.length) % visible.length];
      selectTab(next.dataset.studioTab!);
      next.focus();
    }, { signal });
  }
  mount.addEventListener("pointerup", () => { hint.hidden = true; }, { signal });
  mount.addEventListener("wheel", () => { hint.hidden = true; }, { signal });
  syncView(DEFAULT_ROOM_VIEW);

  return {
    element: panel,
    explore,
    status,
    open,
    close,
    syncView,
    sceneAvailability,
    isOpen: () => panel.open,
    dispose: () => window.clearTimeout(closeTimer),
  };
}
