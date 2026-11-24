import { test, expect } from '@playwright/test';
import { setup } from '../support/rooms.fixture';

for (const width of [1440, 390]) for (const action of ['create', 'join']) {
  test(`${action} validates input, retains failures, retries and opens the room (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page); await page.goto('/');
    if (width < 960) await page.getByRole('button', { name: 'Open rooms', exact: true }).click();
    const title = action === 'create' ? 'Create a room' : 'Join via invite';
    const label = action === 'create' ? 'Room name' : 'Invite code';
    const button = action === 'create' ? 'Create room' : 'Join room';
    const requests: Array<{ action: string; payload: Record<string, string> }> = [];
    await page.route('**/api/rooms', async route => {
      const body = route.request().postDataJSON();
      if (body.action !== action) { await route.fallback(); return; }
      requests.push(body);
      if (requests.length === 1) { await route.fulfill({ status: 500, json: { success: false, error: 'Try again' } }); return; }
      await route.fulfill({ json: { success: true, data: { room: { id: 'room', name: 'Test room', createdBy: 'owner', bagEnabled: true, memberCount: 1 } } } });
    });
    await page.getByRole('button', { name: button, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: title, exact: true });
    const submit = dialog.getByRole('button', { name: button, exact: true });
    await expect(submit).toBeDisabled();
    const field = dialog.getByLabel(label, { exact: true });
    await field.fill(action === 'create' ? ' New adventure ' : ' abcd '); await submit.click();
    await expect(page.locator('.v-snackbar').getByText('Try again', { exact: true })).toBeVisible();
    await expect(field).not.toHaveValue(''); await submit.click();
    await expect(page).toHaveURL(/\/rooms\/room$/);
    await expect(page.getByRole('button', { name: 'Room settings', exact: true })).toBeVisible();
    expect(requests).toHaveLength(2);
    expect(requests[1].payload[action === 'create' ? 'name' : 'inviteCode']).toBe(action === 'create' ? 'New adventure' : 'ABCD');
  });
}
