"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const core = fs.readFileSync(path.join(root, "core.js"), "utf8");
const render = fs.readFileSync(path.join(root, "render.js"), "utf8");

const ids = [...app.matchAll(/querySelector\("#([a-zA-Z0-9_-]+)"\)/g)].map((match) => match[1]);
for (const id of ids) assert.match(html, new RegExp(`id=["']${id}["']`), `missing DOM id ${id}`);
assert.equal(new Set(ids).size, ids.length, "duplicate app DOM references");
assert.match(html, /connect-src 'none'/);
assert.match(html, /object-src 'none'/);
assert.match(html, /frame-src 'none'/);
assert.match(html, /form-action 'none'/);
assert.doesNotMatch(html, /https?:\/\//);
for (const source of [app, core, render]) {
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /new\s+Function\s*\(/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest|WebSocket/);
}
assert.match(html, /id="before-canvas"/);
assert.match(html, /id="after-canvas"/);
assert.match(html, /id="sample-button"/);
assert.match(html, /id="patch-controls"/);
console.log(`static checks completed for ${ids.length} DOM references`);
