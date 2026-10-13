export type ShortcutKey = string | {
  key: string;
  mod?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean | 'any';
};
export type ShortcutModifiers = { mod: boolean; ctrl: boolean; meta: boolean; alt: boolean; shift: boolean };
export type ShortcutCommand = {
  id: string;
  description: string;
  keys: readonly ShortcutKey[];
  when?: (event: KeyboardEvent) => boolean;
  run: (event: KeyboardEvent) => void | Promise<void>;
  allowInEditable?: boolean;
  repeat?: boolean;
  presses?: 2;
};
type ScopeOptions = {
  id: string;
  owner: HTMLElement;
  kind?: 'page' | 'overlay' | 'modal' | 'global' | 'startup';
  active?: boolean;
  enabled?: () => boolean;
  signal?: AbortSignal;
};
export type ShortcutScope = {
  setActive: (active: boolean) => void;
  register: (command: ShortcutCommand) => () => void;
  dispose: () => void;
};
export type ShortcutSystem = {
  createScope: (options: ScopeOptions) => ShortcutScope;
  observeModifiers: (listener: (modifiers: ShortcutModifiers) => void, signal?: AbortSignal) => () => void;
  attachFrame: (frame: HTMLIFrameElement, options?: { enabled?: () => boolean; signal?: AbortSignal }) => () => void;
};
type ScopeRecord = ScopeOptions & { active: boolean; order: number; commands: Map<string, ShortcutCommand> };
type Runtime = { system: ShortcutSystem; forward: (listener: (event: KeyboardEvent) => boolean) => () => void };
const runtimes = new WeakMap<Document, Runtime>();
const layers = { global: 0, page: 1, overlay: 2, modal: 3, startup: 4 };

function element(target: EventTarget | null) {
  return target && 'nodeType' in target && target.nodeType === 1 ? target as HTMLElement : null;
}
function editable(target: EventTarget | null) {
  return element(target)?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"]');
}
export function matchesShortcut(event: KeyboardEvent, binding: ShortcutKey, mac: boolean) {
  const key = typeof binding === 'string' ? { key: binding } : binding;
  return event.key === (key.key === 'Space' ? ' ' : key.key) &&
    Boolean(event.ctrlKey) === (key.ctrl ?? (mac ? false : key.mod ?? false)) &&
    Boolean(event.metaKey) === (key.meta ?? (mac ? key.mod ?? false : false)) &&
    Boolean(event.altKey) === (key.alt ?? false) &&
    (key.shift === 'any' || Boolean(event.shiftKey) === (key.shift ?? false));
}

/** Each document owns one listener; components own the commands and their lifetime. */
export function getShortcutSystem(document: Document): ShortcutSystem {
  return runtimeFor(document).system;
}

function runtimeFor(document: Document): Runtime {
  const existing = runtimes.get(document);
  if (existing) return existing;
  const view = document.defaultView!;
  const mac = /Macintosh|Mac OS X|iPhone|iPad/.test(view.navigator?.userAgent ?? '');
  const scopes = new Set<ScopeRecord>();
  const observers = new Map<symbol, (modifiers: ShortcutModifiers) => void>();
  const forwarders = new Set<(event: KeyboardEvent) => boolean>();
  let order = 0, listening = false, suspended = false;
  let pending: { scope: ScopeRecord; command: ShortcutCommand; key: string; time: number } | undefined;
  let modifiers: ShortcutModifiers = { mod: false, ctrl: false, meta: false, alt: false, shift: false };

  function updateModifiers(event?: KeyboardEvent) {
    modifiers = {
      ctrl: Boolean(event?.ctrlKey), meta: Boolean(event?.metaKey), alt: Boolean(event?.altKey),
      shift: Boolean(event?.shiftKey), mod: Boolean(mac ? event?.metaKey : event?.ctrlKey),
    };
    for (const listener of observers.values()) listener(modifiers);
  }
  function usable(scope: ScopeRecord) {
    return scope.active && scope.owner.isConnected && !scope.owner.closest('[hidden],[inert]') && (scope.enabled?.() ?? true);
  }
  function dispatch(event: KeyboardEvent, origin?: HTMLElement) {
    if (document.hidden || suspended || event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.key === 'Process') { pending = undefined; return false; }
    const active = [...scopes].filter(usable).sort((a, b) => {
      if (a.owner !== b.owner && a.owner.contains(b.owner)) return 1;
      if (a.owner !== b.owner && b.owner.contains(a.owner)) return -1;
      return layers[b.kind ?? 'page'] - layers[a.kind ?? 'page'] || b.order - a.order;
    });
    const modal = active.find(scope => scope.kind === 'modal');
    const nativeModal = modal?.owner.matches(':modal') ? modal.owner : document.querySelector('dialog:modal');
    for (const scope of active) {
      if (modal && scope !== modal && !modal.owner.contains(scope.owner)) continue;
      if (nativeModal && !nativeModal.contains(scope.owner) && scope.owner !== nativeModal) continue;
      if (origin && modal && !modal.owner.contains(origin)) continue;
      for (const command of scope.commands.values()) {
        if (!command.keys.some(key => matchesShortcut(event, key, mac)) || (command.when && !command.when(event))) continue;
        if (editable(event.target) && !command.allowInEditable) continue;
        if (element(event.target)?.closest('select,[role="combobox"]')) continue;
        event.preventDefault();
        // Consume before running: closing a scope must not pass this event to its parent.
        if (event.repeat && (!command.repeat || command.presses)) return true;
        if (command.presses === 2 && !(pending?.scope === scope && pending.command === command && pending.key === event.key && event.timeStamp - pending.time >= 0 && event.timeStamp - pending.time <= 400)) {
          pending = { scope, command, key: event.key, time: event.timeStamp };
          return true;
        }
        pending = undefined;
        try {
          void Promise.resolve(command.run(event)).catch(error => console.error(`Shortcut ${command.id} failed`, error));
        } catch (error) { console.error(`Shortcut ${command.id} failed`, error); }
        return true;
      }
    }
    pending = undefined;
    return false;
  }
  function keydown(event: KeyboardEvent) {
    if (document.hidden || suspended) return;
    updateModifiers(event);
    if (dispatch(event) || event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.key === 'Process' || document.querySelector('dialog:modal')) return;
    // Finish all iframe listeners before handing an unconsumed key to its host.
    if (forwarders.size) setTimeout(() => {
      if (document.hidden || suspended || event.defaultPrevented || document.querySelector('dialog:modal')) return;
      for (const forward of forwarders) if (forward(event)) break;
    }, 0);
  }
  function keyup(event: KeyboardEvent) { if (!document.hidden && !suspended) updateModifiers(event); }
  function reset() { pending = undefined; updateModifiers(); }
  function hide() { suspended = true; reset(); }
  function show() { suspended = false; reset(); }
  function visibility() { if (document.hidden) reset(); }
  function listen() {
    if (listening) return;
    listening = true;
    view.addEventListener('keydown', keydown);
    view.addEventListener('keyup', keyup);
    view.addEventListener('blur', reset);
    view.addEventListener('pagehide', hide);
    view.addEventListener('pageshow', show);
    document.addEventListener('visibilitychange', visibility);
  }
  function release() {
    if (!listening || scopes.size || observers.size || forwarders.size) return;
    view.removeEventListener('keydown', keydown);
    view.removeEventListener('keyup', keyup);
    view.removeEventListener('blur', reset);
    view.removeEventListener('pagehide', hide);
    view.removeEventListener('pageshow', show);
    document.removeEventListener('visibilitychange', visibility);
    listening = false;
    suspended = false;
    modifiers = { mod: false, ctrl: false, meta: false, alt: false, shift: false };
  }
  function untilAbort(cleanup: () => void, signal?: AbortSignal) {
    if (signal?.aborted) cleanup();
    else signal?.addEventListener('abort', cleanup, { once: true });
    return () => { signal?.removeEventListener('abort', cleanup); cleanup(); };
  }
  const runtime: Runtime = {
    forward(listener) {
      forwarders.add(listener); listen();
      return () => { forwarders.delete(listener); release(); };
    },
    system: {
      createScope(options) {
        if ([...scopes].some(scope => scope.id === options.id && scope.owner === options.owner)) throw new Error(`Duplicate shortcut scope: ${options.id}`);
        const scope: ScopeRecord = { ...options, active: options.active ?? true, order: ++order, commands: new Map() };
        scopes.add(scope); listen();
        const dispose = untilAbort(() => { if (pending?.scope === scope) pending = undefined; scopes.delete(scope); scope.commands.clear(); release(); }, options.signal);
        return {
          setActive(value) { if (value !== scope.active) pending = undefined; if (value && !scope.active) scope.order = ++order; scope.active = value; },
          register(command) {
            if (!scopes.has(scope)) return () => {};
            if (scope.commands.has(command.id)) throw new Error(`Duplicate shortcut command: ${scope.id}/${command.id}`);
            scope.commands.set(command.id, command);
            return () => { if (pending?.command === command) pending = undefined; if (scope.commands.get(command.id) === command) scope.commands.delete(command.id); };
          },
          dispose,
        };
      },
      observeModifiers(listener, signal) {
        const subscription = Symbol();
        observers.set(subscription, listener); listen(); listener(modifiers);
        return untilAbort(() => { observers.delete(subscription); release(); }, signal);
      },
      attachFrame(frame, options = {}) {
        let disconnect = () => {};
        function connect() {
          disconnect(); disconnect = () => {};
          try {
            const child = frame.contentDocument;
            if (!child || new URL(child.URL).origin !== document.location.origin) return;
            disconnect = runtimeFor(child).forward(event => {
              if (event.key !== 'Escape' || !frame.isConnected || frame.closest('[hidden],[inert]') || options.enabled?.() === false) return false;
              return dispatch(event, frame);
            });
          } catch { /* Cross-origin documents retain their own keyboard handling. */ }
        }
        frame.addEventListener('load', connect);
        connect();
        return untilAbort(() => { disconnect(); frame.removeEventListener('load', connect); }, options.signal);
      },
    },
  };
  runtimes.set(document, runtime);
  return runtime;
}
