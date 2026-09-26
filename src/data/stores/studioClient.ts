import { atom } from "nanostores";
import type { AppPage } from "../../contracts/navigation";
import type { StudioState } from "../../contracts/studio";
import type { StudioTargets } from "../../contracts/studioPorts";

/** Created once for each mounted shell. No visitor state exists in the server module scope. */
export function createStudioClientStore(initialPage: AppPage, initialState: StudioState, initialTargets: StudioTargets = { view: { zoom: 1, angle: -.48, elevation: .55 }, lampOn: true, showDate: false, drawers: [false, false, false] }) {
  const $page = atom<AppPage>(initialPage);
  const $state = atom<StudioState>(initialState);
  const $targets = atom<StudioTargets>({ ...initialTargets, view: { ...initialTargets.view }, drawers: [...initialTargets.drawers] });
  return {
    $page,
    $state,
    $targets,
    get targets() { return $targets.get(); },
    set targets(value: StudioTargets) { $targets.set(value); },
    get page() { return $page.get(); },
    set page(value: AppPage) { $page.set(value); },
    get state() { return $state.get(); },
    set state(value: StudioState) { $state.set(value); },
  };
}
