/** Keep the visitor's desktop menu preference within this shell session. */
export function createHomeMenu(studio: HTMLElement, signal: AbortSignal) {
  const menu = studio.querySelector<HTMLElement>('[data-home-menu]')!;
  const toggle = studio.querySelector<HTMLButtonElement>('[data-studio-menu-toggle]')!;
  const explore = studio.querySelector<HTMLButtonElement>('[data-studio-explore]')!;
  const mobile = matchMedia('(max-width: 640px)');
  let available = false, hidden = false;
  function sync() {
    menu.dataset.userHidden = String(hidden);
    menu.inert = !available || (hidden && !mobile.matches);
    toggle.setAttribute('aria-expanded', String(!hidden));
    toggle.setAttribute('aria-label', `${hidden ? '显示' : '隐藏'}顶部菜单栏`);
  }
  toggle.addEventListener('click', () => {
    if (!available || mobile.matches) return;
    hidden = !hidden;
    sync();
  }, { signal });
  mobile.addEventListener('change', () => {
    sync();
    if (mobile.matches && document.activeElement === toggle) explore.focus({ preventScroll: true });
  }, { signal });
  return { setAvailable(value: boolean) { available = value; sync(); } };
}
