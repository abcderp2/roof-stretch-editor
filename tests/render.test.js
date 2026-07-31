"use strict";

const assert = require("node:assert/strict");
global.LocalTransformCore = require("../core.js");

class FakeContext {
  constructor(canvas) {
    this.canvas = canvas;
    this.globalAlpha = 1;
    this.globalCompositeOperation = "source-over";
    this.imageSmoothingEnabled = true;
    this.imageSmoothingQuality = "high";
    this.fillStyle = "#000000";
    this.strokeStyle = "#000000";
    this.filter = "none";
    this.font = "12px system-ui";
    this.calls = [];
  }
  drawImage(...args) { this.calls.push(["drawImage", args.length]); }
  save() {}
  restore() {}
  translate() {}
  scale() {}
  rotate() {}
  fillRect() {}
  clearRect() {}
  strokeRect() {}
  setLineDash() {}
  fillText() {}
}

class FakeCanvas {
  constructor(width = 1, height = 1) {
    this.width = width;
    this.height = height;
    this.context = new FakeContext(this);
  }
  getContext() { return this.context; }
}

global.document = {
  createElement(name) {
    assert.equal(name, "canvas");
    return new FakeCanvas();
  }
};

require("../render.js");
const Render = global.LocalTransformRender;
const source = new FakeCanvas(400, 300);

function test(name, fn) {
  try { fn(); console.log(`ok ${name}`); }
  catch (error) { console.error(`not ok ${name}`); throw error; }
}

for (const mode of global.LocalTransformCore.PATCH_MODES) {
  test(`local patch ${mode} renders`, () => {
    const result = Render.renderResult(source, 400, 300, {
      amountPercent: 0,
      patches: [{ id: mode, mode, x: 20, y: 20, width: 25, height: 25, sourceOffsetX: 10, sourceOffsetY: -10 }]
    }, { maximumDimension: 1000, pixelLimit: 2_000_000 });
    assert.equal(result.canvas.width, 400);
    assert.equal(result.canvas.height, 300);
  });
}

for (const axis of ["vertical", "horizontal"]) {
  for (const mode of ["stretch", "compress", "repeat", "mirror", "smear", "remove", "offset"]) {
    test(`${axis} ${mode} renders`, () => {
      const result = Render.renderResult(source, 400, 300, {
        axis, mode, startPercent: 25, endPercent: 50,
        amountPercent: mode === "offset" ? -20 : 50,
        featherPercent: 1
      }, { maximumDimension: 1000, pixelLimit: 2_000_000 });
      assert.ok(result.canvas.width > 0);
      assert.ok(result.canvas.height > 0);
    });
  }
}

for (const paddingMode of ["transparent", "solid", "edge", "repeat", "mirror"]) {
  test(`padding ${paddingMode} renders`, () => {
    const result = Render.renderResult(source, 400, 300, {
      amountPercent: 0, paddingTop: 10, paddingRight: 20, paddingBottom: 10, paddingLeft: 20, paddingMode
    }, { maximumDimension: 1000, pixelLimit: 2_000_000 });
    assert.equal(result.canvas.width, 560);
    assert.equal(result.canvas.height, 360);
  });
}

test("original preview draws selection and clone source overlays", () => {
  const result = Render.renderOriginalPreview(source, 400, 300, 500, {
    selection: { x: 10, y: 20, width: 30, height: 40 },
    patch: { mode: "clone", x: 10, y: 20, width: 30, height: 40, sourceOffsetX: 20, sourceOffsetY: 0 }
  });
  assert.equal(result.canvas.width, 400);
  assert.equal(result.canvas.height, 300);
});

test("large conceptual output is safely downscaled", () => {
  const result = Render.renderResult(new FakeCanvas(5000, 4000), 5000, 4000, {
    amountPercent: 300, paddingTop: 100, paddingRight: 100, paddingBottom: 100, paddingLeft: 100,
    outputMaxDimension: 1280
  }, { maximumDimension: 1280, pixelLimit: 10_000_000 });
  assert.ok(Math.max(result.canvas.width, result.canvas.height) <= 1280);
  assert.ok(result.canvas.width * result.canvas.height <= 10_000_000);
});

console.log("render tests completed");
