import { expect, type Page } from 'playwright/test';
import { test, studioDestination } from './helpers/app';

test.use({ reducedMotion: 'reduce' });

async function mockTracks(page: Page, count = 2) {
  const data=Buffer.alloc(44+8000*2*120);
  data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);
  data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(8000,24);data.writeUInt32LE(16000,28);
  data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(data.length-44,40);
  const tracks=[{id:'test',name:'测试音频 · 很长的曲目名称用于验证单行省略而不挤压导航',src:'/music/test.wav'},{id:'broken',name:'失败音频',src:'/music/broken.wav'}].slice(0,count);
  await page.route('**/music/test.wav',route=>route.fulfill({contentType:'audio/wav',body:data}));
  await page.route('**/music/broken.wav',route=>route.fulfill({status:404,body:''}));
  await page.route('**/home',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:(await response.text()).replace(/data-tracks="[^"]*"/,`data-tracks="${JSON.stringify(tracks).replaceAll('"','&quot;')}"`)});
  });
}

test('explore music controls keep one audio across navigation, pause and recover', async ({ page }) => {
  await mockTracks(page);
  await page.goto('/home');
  const music=page.locator('[data-bgm]'),play=page.locator('.bgm-settings [data-bgm-play]');
  await expect(page.locator('[data-studio-scene]')).toHaveAttribute('data-render-active', 'true', { timeout: 35000 });
  await page.locator('[data-studio-explore]').click();
  await page.getByRole('tab',{name:'音乐',exact:true}).click();
  await expect(play).toBeVisible();
  await expect(music).toHaveAttribute('data-playing','false');
  const original=await page.locator('audio').elementHandle();
  await play.click();
  await expect(music).toHaveAttribute('data-playing','true');
  await expect(page.locator('[data-ocean-audio]')).toHaveAttribute('data-state','playing');
  await page.getByRole('button',{name:'关闭面板',exact:true}).click();
  for (const [action, exit] of [['canvas','[data-canvas-return]'],['works','[data-gallery-return]'],['diary','[data-journal-close]'],['computer','[data-studio-return]']] as const) {
    await (await studioDestination(page,action)).click();
    await expect(page.locator(exit)).toBeVisible();
    await expect(page.locator('.bgm-settings')).toBeHidden();
    await expect(page.locator('.home-profile')).toBeHidden();
    expect(await original!.evaluate(el=>el===document.querySelector('audio'))).toBe(true);
    await expect(music).toHaveAttribute('data-playing','true');
    await expect(page.locator('[data-ocean-audio]')).toHaveAttribute('data-state','paused');
    await page.locator(exit).click();
    await expect(page.locator('[data-studio]')).toHaveAttribute('data-state','room');
  }
  await page.locator('[data-studio-explore]').click();
  await page.getByRole('tab',{name:'音乐',exact:true}).click();
  await play.click();
  await expect(music).toHaveAttribute('data-playing','false');
  const stopped=await page.locator('audio').evaluate(el=>(el as HTMLAudioElement).currentTime);
  await play.click();
  await expect.poll(()=>page.locator('audio').evaluate(el=>(el as HTMLAudioElement).currentTime)).toBeGreaterThan(stopped);
  await page.locator('.bgm-settings [data-bgm-next]').click();
  await expect(page.locator('.bgm-settings [data-bgm-status]')).toContainText('加载失败');
  await expect(music).toHaveAttribute('data-playing','false');
  await page.locator('.bgm-settings [data-bgm-prev]').click();
  await expect(music).toHaveAttribute('data-playing','true');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-studio-explore]')).toBeFocused();
  await page.reload();await expect(music).toHaveAttribute('data-playing','false');
});

test('desktop menu shares transport state, fits narrow windows and restores mobile focus', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Desktop menu only; mobile controls are covered by the shared player test');
  await mockTracks(page);
  await page.addInitScript(() => {
    window.EventSource = class {
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        Object.assign(window, { menuActivity: this });
        setTimeout(() => this.onmessage?.({ data: JSON.stringify({ appName: 'Safari', text: '高强度冲浪中 · 用长状态检查单行省略', observedAt: Date.now(), receivedAt: Date.now(), expiresAt: Date.now() + 60000 }) }), 0);
      }
      close() { this.onopen = this.onmessage = this.onerror = null; }
    } as unknown as typeof EventSource;
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/home');
  const menu = page.locator('.bgm-menu'), play = menu.locator('[data-bgm-play]');
  await expect(play).toBeVisible();
  await expect(page.locator('[data-profile-status]')).toHaveText(/高强度冲浪中/);
  await expect(page.locator('[data-studio-scene]')).toHaveAttribute('data-render-active', 'true', { timeout: 35000 });
  const angle = await page.locator('[data-studio-scene]').getAttribute('data-camera-angle');
  await play.focus(); await page.keyboard.press('Enter');
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-studio-scene]')).toHaveAttribute('data-camera-angle', angle!);
  await page.locator('[data-studio-explore]').click();
  await page.getByRole('tab', { name: '音乐', exact: true }).click();
  await expect(page.locator('.bgm-settings [data-bgm-play]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.bgm-settings [data-bgm-play]').click();
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Escape');
  await menu.locator('[data-bgm-next]').click();
  await expect(play).toHaveAccessibleName('重试播放');
  await menu.locator('[data-bgm-prev]').click();
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  for (const [width, height] of [[1440,900],[1024,768],[900,700],[641,700],[844,390],[1100,360]]) {
    await page.setViewportSize({ width, height });
    const avatar = (await page.locator('.profile-avatar').boundingBox())!;
    const controls = (await menu.boundingBox())!;
    const nav = (await page.locator('.studio-navigation').boundingBox())!;
    expect(avatar.width).toBe(24); expect(avatar.height).toBe(24);
    expect(Math.abs(avatar.y + 12 - nav.y - nav.height / 2)).toBeLessThan(1);
    expect(controls.x + controls.width + 20).toBeLessThanOrEqual(nav.x);
    expect(nav.x + nav.width).toBeLessThanOrEqual(width - 24);
    await expect(menu.locator('[data-bgm-name]')).toBeVisible({ visible: width > 900 });
    await page.screenshot({ path: info.outputPath(`menu-${width}-${height}.png`) });
  }
  await page.evaluate(() => (window as any).menuActivity.onerror());
  await expect(page.locator('[data-profile-status]')).toBeHidden();
  await play.focus();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-studio-explore]')).toBeFocused();
  await expect(menu).toBeHidden();
  const trigger = (await page.locator('[data-studio-explore]').boundingBox())!;
  expect(trigger.x + trigger.width / 2).toBe(195);
  await expect(page.locator('[data-bgm]')).toHaveAttribute('data-playing', 'true');
});

test('empty and single-track menus expose only the available playback actions', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop menu only');
  await mockTracks(page, 0);
  await page.goto('/home');
  const menu = page.locator('.bgm-menu');
  await expect(menu).toBeHidden();
  await expect(menu.locator('[data-bgm-play]')).toBeDisabled();
  await expect(menu.locator('[data-bgm-prev]')).toBeHidden();
  await expect(menu.locator('[data-bgm-next]')).toBeHidden();
  await mockTracks(page, 1);
  await page.reload();
  await expect(menu).toBeVisible();
  await expect(menu.locator('[data-bgm-play]')).toBeEnabled();
  await expect(menu.locator('[data-bgm-next]')).toBeHidden();
  await menu.locator('[data-bgm-play]').click();
  await expect(menu.locator('[data-bgm-play]')).toHaveAttribute('aria-pressed', 'true');
});

test('music remains usable when WebGL fails', async ({ page, isMobile }) => {
  await mockTracks(page, 1);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      return /webgl/.test(type) ? null : Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto('/home');
  await expect(page.locator('[data-studio]')).toHaveClass(/is-fallback/, { timeout: 35000 });
  await expect(page.locator('[data-studio-retry]')).toHaveJSProperty('hidden', false);
  await page.locator('[data-cloud-error] a[href="/os"]').click();
  await page.locator('[data-studio-return]').click();
  await expect(page.locator('[data-studio]')).toHaveAttribute('data-state','room');
  if (isMobile) {
    await page.locator('[data-studio-explore]').click();
    await page.getByRole('tab', { name: '音乐', exact: true }).click();
    await page.locator('.bgm-settings [data-bgm-play]').click();
  } else {
    await page.locator('.bgm-menu [data-bgm-play]').click();
    await expect(page.locator('.studio-topbar')).toHaveCSS('color', 'rgb(48, 59, 57)');
  }
  await expect(page.locator('[data-bgm]')).toHaveAttribute('data-playing', 'true');
  await expect(page.locator('[data-ocean-audio]')).toHaveAttribute('data-state','paused');
});
