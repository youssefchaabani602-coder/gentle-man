async (page) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  await page.screencast.start({
    path: '.aistudio/artifacts/computer_use/gentleman_atelier_tour_30s.webm',
    size: { width: 1280, height: 800 },
    fps: 30,
  });

  await page.screencast.showActions({
    cursor: 'pointer',
    duration: 380,
    style: {
      point: 'width: 18px; height: 18px; border-radius: 50%; background: rgba(197, 160, 89, 0.92); border: 2px solid #fff;',
      title: 'display: none',
    },
  });

  const setBadge = async (tag, subtitle) => {
    return await page.screencast.showOverlay(`
      <div style="position: fixed; bottom: 20px; left: 20px; z-index: 9999;
        padding: 10px 14px; background: rgba(17, 17, 17, 0.94);
        border: 1px solid #C5A059; color: #F9F7F2; font-family: system-ui, sans-serif;
        box-shadow: 0 10px 25px rgba(0,0,0,0.4); max-width: 310px;">
        <div style="font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: #C5A059; font-weight: 700;">
          ${tag}
        </div>
        <div style="font-size: 12px; color: #E8E3D9; margin-top: 3px;">
          ${subtitle}
        </div>
      </div>
    `);
  };

  // 1. Client Page Only (/) + Interactive 3D Runway (~5s)
  let badge = await setBadge('1 · Client Shop Only (/)', 'Interactive 3D Runway — mouse & scroll reactive');
  await page.mouse.move(780, 350, { steps: 8 });
  await page.mouse.move(950, 310, { steps: 8 });
  await page.getByRole('button', { name: 'Overshirt', exact: true }).click();
  await page.waitForTimeout(550);
  await page.getByRole('button', { name: 'Fabric color Sahara Sand', exact: true }).click();
  await page.waitForTimeout(550);
  await page.getByRole('button', { name: 'Bomber', exact: true }).click();
  await page.waitForTimeout(550);

  // 2. Catalog + 3D Product Modal + Pre-Filled WhatsApp Checkout (~9s)
  await badge.dispose();
  badge = await setBadge('2 · Catalog & 3D Fit', '3D product inspection, size & color selection');
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await page.waitForTimeout(700);

  const view3dBtn = page.getByRole('button', { name: /3D View/i }).first();
  await view3dBtn.waitFor({ state: 'visible' });
  await view3dBtn.click();
  await page.waitForTimeout(800);
  const modal = page.getByRole('dialog').last();
  await modal.waitFor({ state: 'visible' });
  const size48 = modal.getByRole('button', { name: '48', exact: true });
  if (await size48.count()) {
    await size48.first().click();
    await page.waitForTimeout(350);
  }
  await modal.getByRole('button', { name: 'Add to Shopping Bag' }).click();
  await page.waitForTimeout(650);

  await badge.dispose();
  badge = await setBadge('3 · Pre-Filled WhatsApp', 'Cart sends exact item, size & color + 10-pt rewards');
  const drawerScroll = page.getByRole('dialog', { name: 'Shopping Bag and Checkout' }).locator('div.overflow-y-auto');
  await drawerScroll.evaluate((el) => el.scrollTo({ top: 340, behavior: 'smooth' }));
  await page.waitForTimeout(1300);
  await page.getByRole('button', { name: 'Close shopping bag', exact: true }).click();
  await page.waitForTimeout(350);

  // 3. 10-Point Rewards, Parcel Tracking & Kairouan Google Map (~6s)
  await badge.dispose();
  badge = await setBadge('4 · Rewards, Tracking & Map', '10 pts = 10% OFF · Live tracking · Kairouan Map');
  await page.getByRole('button', { name: 'Track & Rewards', exact: true }).click();
  await page.waitForTimeout(750);
  await page.getByRole('button', { name: 'Check', exact: true }).click().catch(() => {});
  await page.waitForTimeout(750);
  await page.evaluate(() => window.scrollBy({ top: 560, behavior: 'smooth' }));
  await page.waitForTimeout(1200);

  // 4. Separate Seller / Owner Page (/owner) (~9s)
  await badge.dispose();
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  await page.waitForTimeout(550);
  await page.getByRole('link', { name: 'Seller Portal' }).click();
  await page.waitForURL('**/owner');
  await page.getByRole('button', { name: 'Add New Garment' }).waitFor();

  badge = await setBadge('5 · Separate Seller Page (/owner)', 'Owner Console: Inventory, Cash Flow & Orders');
  await page.waitForTimeout(950);
  await page.evaluate(() => window.scrollBy({ top: 460, behavior: 'smooth' }));
  await page.waitForTimeout(850);

  const incBtn = page.getByRole('button', { name: /Increase stock for/i }).first();
  const decBtn = page.getByRole('button', { name: /Decrease stock for/i }).first();
  await incBtn.click();
  await page.waitForTimeout(350);
  await decBtn.click();
  await page.waitForTimeout(350);

  await page.getByRole('button', { name: /Cash Flow Ledger/i }).click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: /Orders & WhatsApp/i }).click();
  await page.waitForTimeout(950);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(600);

  await badge.dispose();
  await page.screencast.stop();
}
