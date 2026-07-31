"use strict";

const assert = require("node:assert/strict");
const Core = require("../core.js");

function test(name, fn) {
  try { fn(); console.log(`ok ${name}`); }
  catch (error) { console.error(`not ok ${name}`); throw error; }
}

test("normalizes a valid local patch", () => {
  const patch = Core.normalizePatch({ id: "a", mode: "mosaic", x: 90, y: 92, width: 30, height: 20, blockSize: 999 }, 0);
  assert.equal(patch.mode, "mosaic");
  assert.equal(patch.width, 10);
  assert.equal(patch.height, 8);
  assert.equal(patch.blockSize, 64);
});

test("limits patch count and deduplicates ids", () => {
  const patches = Array.from({ length: 30 }, (_, index) => ({ id: "same", x: index }));
  const normalized = Core.normalizePatches(patches);
  assert.equal(normalized.length, Core.LIMITS.maximumPatches);
  assert.equal(new Set(normalized.map((patch) => patch.id)).size, normalized.length);
});

test("normalizes unsafe settings", () => {
  const settings = Core.normalizeSettings({
    mode: "unknown", startPercent: 99, endPercent: 2, outputQuality: 8,
    paddingColor: "javascript:bad", patches: [{ mode: "bad", opacity: -4 }]
  });
  assert.equal(settings.mode, "stretch");
  assert.ok(settings.endPercent - settings.startPercent >= Core.LIMITS.minimumBandPercent);
  assert.equal(settings.outputQuality, 1);
  assert.equal(settings.paddingColor, "#ffffff");
  assert.equal(settings.patches[0].mode, "clone");
  assert.equal(settings.patches[0].opacity, 0.1);
});

test("computes horizontal and vertical output geometry", () => {
  const vertical = Core.computeGeometry(400, 300, { axis: "vertical", startPercent: 20, endPercent: 40, amountPercent: 100 });
  assert.equal(vertical.outputWidth, 400);
  assert.equal(vertical.outputHeight, 360);
  const horizontal = Core.computeGeometry(400, 300, { axis: "horizontal", startPercent: 20, endPercent: 40, amountPercent: 100 });
  assert.equal(horizontal.outputWidth, 480);
  assert.equal(horizontal.outputHeight, 300);
});

test("migrates version 1 recipes", () => {
  const settings = Core.parseRecipe(JSON.stringify({ version: 1, settings: { mode: "compress" } }));
  assert.equal(settings.mode, "compress");
  assert.deepEqual(settings.patches, []);
});

test("round trips version 2 recipes with patches", () => {
  const source = Core.normalizeSettings({ patches: [{ id: "repair", mode: "blur", x: 10, y: 20, width: 30, height: 40 }] });
  const parsed = Core.parseRecipe(Core.serializeRecipe(source));
  assert.equal(parsed.patches.length, 1);
  assert.equal(parsed.patches[0].mode, "blur");
});

test("rejects oversized recipe text", () => {
  assert.throws(() => Core.parseRecipe("x".repeat(Core.LIMITS.maximumRecipeBytes + 1)), /大きすぎ/);
});

test("selects low-memory profile", () => {
  const profile = Core.getDeviceProfile({ deviceMemory: 2, hardwareConcurrency: 2 }, { width: 360, height: 800 });
  assert.equal(profile.name, "省メモリ");
  assert.ok(profile.previewDimension <= 640);
});

test("sanitizes output file names", () => {
  assert.equal(Core.buildDownloadName("../危険:*?.png", "image/jpeg"), "..-危険-reframed.jpg");
});

console.log("core tests completed");
