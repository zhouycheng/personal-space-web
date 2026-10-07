import { expect } from 'playwright/test';
import sharp from 'sharp';
import { test } from './helpers/app';

test('submerged marine meshes composite through water, reject foreground depth and pause', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const w = window as any;
    w.__THREE_DEVTOOLS__ = new EventTarget();
    const observed = new WeakSet();
    w.__THREE_DEVTOOLS__.addEventListener('observe', (event: any) => {
      const object = event.detail;
      if (observed.has(object)) return;observed.add(object);
      if (!object.isWebGLRenderer) return;
      const render = object.render;
      w.__marine = { renderer: object };
      object.render = function (scene: any, camera: any) {
        const p = w.__marine;
        p.scene = scene;p.camera = camera;
        if (this.getRenderTarget()) p.target = this.getRenderTarget();
        return render.call(this, scene, camera);
      };
    });
  });
  await page.clock.setFixedTime(new Date('2026-10-07T06:00:00Z'));
  await page.goto('/home');
  const mount = page.locator('[data-studio-scene]');
  await expect(mount).toHaveAttribute('data-ocean-active', 'true', { timeout: 30000 });
  await expect(mount).not.toHaveAttribute('data-entrance-progress', /.+/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(mount).toHaveAttribute('data-ocean-active', 'false');
  await page.waitForTimeout(300);
  await page.screenshot({ path: info.outputPath('marine-overview.png') });
  const initial = await page.evaluate(() => {
    const p = (window as any).__marine, { scene, target } = p;
    const shark = scene.getObjectByName('marine-shark');
    return { position: shark.position.toArray(), target: [target.width, target.height],
      schools: [0, 1, 2].map(i => scene.getObjectByName(`marine-school-${i}`).count),
      ready: scene.getObjectByName('island-water').material.uniforms.marineReady.value };
  });
  expect(initial.schools).toEqual([12, 12, 12]);expect(initial.ready).toBe(1);
  expect(Math.max(...initial.target)).toBeLessThanOrEqual(info.project.use.viewport!.width <= 600 ? 1024 : 1280);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as any).__marine.scene.getObjectByName('marine-shark').position.toArray())).toEqual(initial.position);

  // Render the actual scene shader with a controlled camera and body position.
  // Changing only the fish depth isolates rejection from water animation and UI motion.
  await page.evaluate(() => {
    const p = (window as any).__marine;
    p.camera.position.set(-13, 10, 8);p.camera.lookAt(-13, -.5, 2);p.camera.updateMatrixWorld();
    p.scene.getObjectByName('marine-turtle').position.set(-13, -1.3, 2);
    p.draw = () => {
      const { renderer: r, scene, camera, target } = p;
      const mask = camera.layers.mask, tone = r.toneMapping, shadow = r.shadowMap.enabled;
      const clear = r.getClearColor(scene.getObjectByName('marine-turtle').material.color.clone()), alpha = r.getClearAlpha();
      camera.layers.set(1);r.shadowMap.enabled = false;r.toneMapping = 0;
      r.setClearColor(0, 0);r.setRenderTarget(target);r.render(scene, camera);
      camera.layers.mask = mask;r.shadowMap.enabled = shadow;r.toneMapping = tone;
      r.setClearColor(clear, alpha);r.setRenderTarget(null);r.render(scene, camera);
    };
    p.draw();
  });
  const canvas = mount.locator('canvas');
  const submerged = await canvas.screenshot({ path: info.outputPath('marine-submerged.png') });
  await page.evaluate(() => { const p = (window as any).__marine;p.scene.getObjectByName('marine-turtle').visible = false;p.draw(); });
  const empty = await canvas.screenshot();
  await page.evaluate(() => {
    const p = (window as any).__marine, turtle = p.scene.getObjectByName('marine-turtle');
    turtle.visible = true;turtle.position.y = 2;p.draw();
  });
  const foreground = await canvas.screenshot();
  async function difference(a: Buffer, b: Buffer) {
    const aa = await sharp(a).removeAlpha().raw().toBuffer(), bb = await sharp(b).removeAlpha().raw().toBuffer();
    return aa.reduce((sum, value, index) => sum + (Math.abs(value - bb[index]) > 3 ? 1 : 0), 0);
  }
  expect(await difference(submerged, empty)).toBeGreaterThan(150);
  expect(await difference(foreground, empty)).toBeLessThan(10);
  expect(errors).toEqual([]);
});
