import { atom } from "nanostores";
import type { JournalAvailability, JournalSession } from "../../contracts/journal";

export function createJournalSessionStore(availability: JournalAvailability, error = "") {
  return atom<JournalSession>({ active: false, phase: "stowed", availability, error,
    page: 0, single: false, zoom: 1, busy: false, textures: 0 });
}
