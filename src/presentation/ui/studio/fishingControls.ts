import type { FishingState } from '../../../contracts/fishing';

export function createFishingControls(studio: HTMLElement, signal: AbortSignal, interact: () => void, exit: () => void, restoreFocus: () => void) {
  const dialog = studio.querySelector<HTMLDialogElement>('[data-fishing]')!;
  const status = dialog.querySelector<HTMLElement>('[data-fishing-status]')!;
  const action = dialog.querySelector<HTMLButtonElement>('[data-fishing-action]')!;
  dialog.addEventListener('cancel', event => { event.preventDefault(); exit(); }, { signal });
  dialog.querySelector('[data-fishing-exit]')!.addEventListener('click', exit, { signal });
  action.addEventListener('click', () => { if (action.getAttribute('aria-disabled') !== 'true') interact(); }, { signal });
  dialog.addEventListener('keydown', event => {
    if (event.repeat && [' ', 'Enter'].includes(event.key)) event.preventDefault();
  }, { signal });
  return {
    update(state: FishingState) {
      const { phase } = state;
      dialog.dataset.phase = phase;
      studio.toggleAttribute('data-fishing-active', phase !== 'idle');
      if (phase === 'idle') {
        if (dialog.open) { dialog.close(); restoreFocus(); }
        return;
      }
      const copy: Record<Exclude<typeof phase, 'idle'>, [string, string, boolean]> = {
        entering: ['去码头坐一会儿', '正在靠近', false],
        ready: ['抛一竿，看看海里有什么', '抛竿', true],
        casting: ['鱼线划过海面', '正在抛竿', false],
        waiting: ['留意浮标，等它沉入水中', '收线', true],
        nibble: ['小鱼正在试探，再等一下', '收线', true],
        bite: ['浮标沉下去了，现在收线！', '收线！', true],
        reeling: ['钓到了，慢慢提起来', '正在收线', false],
        caught: [`一条 ${state.length} cm 的银色小鱼`, '放生', true],
        missed: [state.miss === 'early' ? '收早了一点，小鱼还在试探' : '小鱼游走了，下次留意浮标', '再抛一竿', true],
        releasing: ['回到海里去吧', '正在放生', false],
        leaving: ['把鱼竿放好，回到海岛', '正在返回', false],
      };
      const [message, label, enabled] = copy[phase];
      status.textContent = message; action.textContent = label;
      action.setAttribute('aria-disabled', String(!enabled));
      if (!dialog.open) { dialog.showModal(); action.focus({ preventScroll: true }); }
    },
  };
}
