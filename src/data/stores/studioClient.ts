import { atom } from "nanostores";
import type { AppPage } from "../../contracts/navigation";
import type { StudioState } from "../../contracts/studio";

/** Created once for each mounted shell. No visitor state exists in the server module scope. */
export function createStudioClientStore(initialPage: AppPage, initialState: StudioState) {
  const $page = atom<AppPage>(initialPage);
  const $state = atom<StudioState>(initialState);
  return {
    $page,
    $state,
    get page() { return $page.get(); },
    set page(value: AppPage) { $page.set(value); },
    get state() { return $state.get(); },
    set state(value: StudioState) { $state.set(value); },
  };
}
