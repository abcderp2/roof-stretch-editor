"use strict";

const assert = require("node:assert/strict");
const Core = require("../core.js");

function test(name, fn) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (error) {
    console.error(`not ok ${name}`);
    throw error;
  }
}

test("range keeps minimum width", () => {
  assert.deepEqual(Core.normalizeRange(50, 50, 2), { start: 50, end: 52 });
});

test("stretch grows selected band", () => {
  assert.equal(Core.calculateBandOutputSize(100, "stretch", 50), 150);
});

test("compress keeps at least one pixel", () => {
  assert.equal(Core.calculateBandOutputSize(10, "compress", 95), 1);
});

test("remove deletes the selected band", () => {
  assert.equal(Core.calculateBandOutputSize(100, "remove", 100), 0);
});

test("vertical operation changes height", () => {
  const geometry = Core.computeGeometry(1000, 800, {
    axis: "vertical",
    mode: "stretch",
    startPercent: 25,
    endPercent: 50,
    amountPercent: 100
  });
  assert.equal(geometry.outputWidth, 1000);
  assert.equal(geometry.outputHeight, 1000);
});

test("horizontal operation changes width", () => {
  const geometry = Core.computeGeometry(1000, 800, {
    axis: "horizontal",
    mode: "remove",
    startPercent: 20,
    endPercent: 40
  });
  assert.equal(geometry.outputWidth, 800);
  assert.equal(geometry.outputHeight, 800);
});

test("crop and rotation are reflected", () => {
  const geometry = Core.computeGeometry(1200, 800, {
    cropLeft: 10,
    cropRight: 10,
    rotation: 90,
    mode: "offset",
    amountPercent: 0
  });
  assert.equal(geometry.cropWidth, 960);
  assert.equal(geometry.baseWidth, 800);
  assert.equal(geometry.baseHeight, 960);
});

test("padding expands all sides", () => {
  const geometry = Core.computeGeometry(1000, 500, {
    mode: "offset",
    amountPercent: 0,
    paddingTop: 10,
    paddingRight: 10,
    paddingBottom: 10,
    paddingLeft: 10
  });
  assert.equal(geometry.outputWidth, 1200);
  assert.equal(geometry.outputHeight, 600);
});

test("PNG header is inspected", () => {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 640);
  view.setUint32(20, 480);
  assert.deepEqual(Core.inspectImageHeader(bytes.buffer), { mimeType: "image/png", width: 640, height: 480 });
});

test("recipe round trip normalizes settings", () => {
  const recipe = Core.serializeRecipe({ mode: "mirror", amountPercent: 120 });
  const parsed = Core.parseRecipe(recipe);
  assert.equal(parsed.mode, "mirror");
  assert.equal(parsed.amountPercent, 120);
});

test("unsafe filename characters are removed", () => {
  assert.equal(Core.buildDownloadName("a/b:c?.png", "image/jpeg"), "a-b-c-reframed.jpg");
});

test("low memory device selects conservative profile", () => {
  const profile = Core.getDeviceProfile({ deviceMemory: 2, hardwareConcurrency: 2 }, { width: 360, height: 800 });
  assert.equal(profile.name, "省メモリ");
  assert.equal(profile.exportPixelLimit, 12_000_000);
});
