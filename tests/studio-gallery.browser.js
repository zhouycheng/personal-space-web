// Run with playwright-cli run-code --filename=tests/studio-gallery.browser.js against the dev server.
async page => {
  await page.goto('http://localhost:4321/works');
  const buttons = page.locator('[data-gallery-file]');
  const dialog = page.locator('[data-gallery-detail]');
  if (await page.locator('[data-studio-gallery]').evaluate(el => getComputedStyle(el).userSelect) !== 'none') throw Error('Gallery text can be selected');
  if (await dialog.evaluate(el => getComputedStyle(el).userSelect) !== 'text') throw Error('Detail text cannot be copied');
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  const activate = async index => {
    const point = await buttons.nth(index).evaluate(button => {
      const rect = button.getBoundingClientRect();
      for (let y = Math.max(0, rect.top) + 8; y < Math.min(innerHeight, rect.bottom); y += 8)
        for (let x = Math.max(0, rect.left) + 8; x < Math.min(innerWidth, rect.right); x += 8)
          if (button.contains(document.elementFromPoint(x, y))) return { x, y };
      throw Error('Card has no visible click target');
    });
    if (touch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(700);
  };
  await activate(1);
  if (await dialog.evaluate(el => el.open)) throw Error('Side card opened instead of centering');
  if (await buttons.nth(1).evaluate(el => el.closest('article').dataset.filePosition) !== 'current') throw Error('Side card did not become current');
  await activate(1);
  if (!await dialog.evaluate(el => el.open)) throw Error('Current card did not open');
  if (await dialog.locator('h2').textContent() !== 'QandA') throw Error('Wrong file opened');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await buttons.nth(2).focus();
  await page.waitForTimeout(700);
  await page.keyboard.press('Enter');
  if (!await dialog.evaluate(el => el.open)) throw Error('Keyboard activation failed');
  await page.keyboard.press('Escape');
  return 'Side click centers, current click opens, keyboard activation passes';
}
