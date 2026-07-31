"use strict";
const assert=require("node:assert/strict");const fs=require("node:fs");const path=require("node:path");
const root=path.resolve(__dirname,"..");const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const robots=fs.readFileSync(path.join(root,"robots.txt"),"utf8");
const ai=fs.readFileSync(path.join(root,"ai.txt"),"utf8");
const sitemap=fs.readFileSync(path.join(root,"sitemap.xml"),"utf8");
const appFiles=["app-base.js","app-patches.js","app-io.js","app.js"];
const app=appFiles.map((file)=>fs.readFileSync(path.join(root,file),"utf8")).join("\n");
const core=fs.readFileSync(path.join(root,"core.js"),"utf8");
const render=["patch-render.js","render.js"].map((file)=>fs.readFileSync(path.join(root,file),"utf8")).join("\n");
const ids=[...app.matchAll(/querySelector\("#([a-zA-Z0-9_-]+)"\)/g)].map((match)=>match[1]);
for(const id of ids)assert.match(html,new RegExp(`id=["']${id}["']`),`missing DOM id ${id}`);
assert.equal(new Set(ids).size,ids.length,"duplicate app DOM references");
assert.match(html,/connect-src 'none'/);assert.match(html,/object-src 'none'/);assert.match(html,/frame-src 'none'/);assert.match(html,/form-action 'none'/);assert.match(html,/script-src-attr 'none'/);assert.match(html,/style-src-attr 'none'/);assert.match(html,/Permissions-Policy/);assert.match(html,/href="ai\.txt"/);assert.match(robots,/User-agent: \*/);assert.match(robots,/Sitemap:/);assert.match(ai,/MIT License/);assert.match(ai,/AI visits|AIの訪問/);assert.match(sitemap,/https:\/\/abcderp2\.github\.io\/roof-stretch-editor\//);assert.doesNotMatch(html,/https?:\/\//);
for(const source of [app,core,render]){assert.doesNotMatch(source,/\beval\s*\(/);assert.doesNotMatch(source,/new\s+Function\s*\(/);assert.doesNotMatch(source,/\.innerHTML\s*=/);assert.doesNotMatch(source,/\bfetch\s*\(/);assert.doesNotMatch(source,/XMLHttpRequest|WebSocket/);}
assert.match(html,/id="before-canvas"/);assert.match(html,/id="after-canvas"/);assert.match(html,/id="sample-button"/);assert.match(html,/id="patch-controls"/);
console.log(`static checks completed for ${ids.length} DOM references`);
