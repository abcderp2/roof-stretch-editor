"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const core = fs.readFileSync(path.join(root, "core.js"), "utf8");
const render = fs.readFileSync(path.join(root, "render.js"), "utf8");

const ids = new Set(Array.from(html.matchAll(/\sid="([^"]+)"/g), (match) => match[1]));
const references = Array.from(app.matchAll(/querySelector\("#([^"]+)"\)/g), (match) => match[1]);
for (const id of references) {
  assert.ok(ids.has(id), `missing HTML id: ${id}`);
}

assert.match(html, /connect-src 'none'/);
assert.match(html, /object-src 'none'/);
assert.match(html, /base-uri 'none'/);
assert.doesNotMatch(app + core + render, /\beval\s*\(/);
assert.doesNotMatch(app + core + render, /innerHTML\s*=/);
assert.doesNotMatch(app + core + render, /fetch\s*\(/);
assert.doesNotMatch(html, /https?:\/\/(?!abcderp2\.github\.io)/);
assert.equal(new Set(references).size, references.length, "duplicate element map references");
console.log(`ok ${references.length} DOM references and security invariants`);
