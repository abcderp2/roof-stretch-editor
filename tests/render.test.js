"use strict";

const assert = require("node:assert/strict");
global.LocalTransformCore = require("../core.js");

class FakeContext {
  constructor(canvas) {
    this.canvas = canvas;
    this.globalAlpha = 1;
    this.imageSmoothingEnabled = true;
    this.imageSmoothingQuality = "high";
    this.fillStyle = "#000000";
  }
  drawImage() {}
  save() {}
  restore() {}
  translate() {}
  scale() {}
  rotate() {}
  fillRect() {}
  clearRect() {}
  strokeRect() {}
  setLineDash() {}
}

class FakeCanvas {
  constructor(width = 1, height = 1) {
    this.width = width;
    this.height = height;
    this.context = new FakeContext(this);
  }
  getContext() {
    return this.context;
  }
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
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (error) {
    console.error(`not ok ${name}`);
    throw error;
  }
}

for (const axis of ["vertical", "horizontal"]) {
  for (const mode of ["stretch", "compress", "repeat", "mirror", "smear", "remove", "offset"]) {
    test(`${axis} ${mode} renders`, () => {
      const result = Render.renderResult(source, 400, 300, {
        axis,
        mode,
        startPercent: 25,
        endPercent: 50,
        amountPercent: mode === "offset" ? -20 : 50,
        featherPercent: 1,
        outputMaxDimension: 4096
      }, { maximumDimension: 4096, pixelLimit: 10_000_000 });
      assert.ok(result.canvas.width > 0);
      assert.ok(result.canvas.height > 0);
    });
  }
}

for (const paddingMode of ["transparent", "solid", "edge", "repeat", "mirror"]) {
  test(`padding ${paddingMode} renders`, () => {
    const result = Render.renderResult(source, 400, 300, {
      mode: "offset",
      amountPercent: 0,
      paddingTop: 10,
      paddingRight: 20,
      paddingBottom: 10,
      paddingLeft: 20,
      paddingMode
    }, { maximumDimension: 4096, pixelLimit: 10_000_000 });
    assert.equal(result.canvas.width, 560);
    assert.equal(result.canvas.height, 360);
  });
}

test("selection preview renders overlay", () => {
  const result = Render.renderSelection(source, 400, 300, {
    axis: "horizontal",
    startPercent: 20,
    endPercent: 70
  }, 1000, true);
  assert.equal(result.canvas.width, 400);
  assert.equal(result.canvas.height, 300);
});

test("large conceptual output is scaled to a safe export canvas", () => {
  const largeSource = new FakeCanvas(5000, 4000);
  const result = Render.renderResult(largeSource, 5000, 4000, {
    axis: "vertical",
    mode: "stretch",
    startPercent: 0,
    endPercent: 100,
    amountPercent: 300,
    outputMaxDimension: 1280
  }, { maximumDimension: 1280, pixelLimit: 12_000_000 });
  assert.ok(Math.max(result.canvas.width, result.canvas.height) <= 1280);
  assert.ok(result.canvas.width * result.canvas.height <= 12_000_000);
});
