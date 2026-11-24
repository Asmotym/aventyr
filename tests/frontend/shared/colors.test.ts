import assert from 'node:assert/strict';
import test from 'node:test';
import { hexToRgb, relativeLuminance } from '../../../src/shared/utils/colors';

test('theme color parsing supports short and full hex values and rejects invalid input', () => {
  assert.deepEqual(hexToRgb(' #AbC '), { r: 170, g: 187, b: 204 });
  assert.deepEqual(hexToRgb('#336699'), { r: 51, g: 102, b: 153 });
  for (const value of ['', '#xyxyxy', 'transparent', '#12345']) assert.equal(hexToRgb(value), null);
});

test('relative luminance preserves readable foreground choices at dark and light extremes', () => {
  assert.equal(relativeLuminance({ r: 0, g: 0, b: 0 }), 0);
  assert.equal(relativeLuminance({ r: 255, g: 255, b: 255 }), 1);
  assert.equal(relativeLuminance(hexToRgb('#336699')!) > 0.179, false);
  assert.equal(relativeLuminance(hexToRgb('#fdd835')!) > 0.179, true);
});
