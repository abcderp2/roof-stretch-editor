(function (root) {
  "use strict";
  const Core = root.LocalTransformCore;
  if (!Core) throw new Error("core.js must be loaded before patch-render.js");

  function createCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
  }

  function getContext(canvas, alpha) {
    const context = canvas.getContext("2d", { alpha: alpha !== false, desynchronized: true });
    if (!context) throw new Error("Canvas 2D機能を利用できません。");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    return context;
  }

  function rectFromPercent(item, width, height) {
    const x = Math.round(width * Core.clamp(item.x, 0, 100) / 100);
    const y = Math.round(height * Core.clamp(item.y, 0, 100) / 100);
    const w = Math.max(1, Math.round(width * Core.clamp(item.width, Core.LIMITS.minimumPatchPercent, 100) / 100));
    const h = Math.max(1, Math.round(height * Core.clamp(item.height, Core.LIMITS.minimumPatchPercent, 100) / 100));
    return { x: Math.min(width - 1, x), y: Math.min(height - 1, y), width: Math.min(w, width - x), height: Math.min(h, height - y) };
  }

  function copyCanvas(source) {
    const canvas = createCanvas(source.width, source.height);
    getContext(canvas, true).drawImage(source, 0, 0);
    return canvas;
  }

  function createPatchCanvas(snapshot, patch, rect) {
    const temp = createCanvas(rect.width, rect.height);
    const context = getContext(temp, true);
    const sourceX = Core.clamp(rect.x + Math.round(snapshot.width * patch.sourceOffsetX / 100), 0, Math.max(0, snapshot.width - rect.width));
    const sourceY = Core.clamp(rect.y + Math.round(snapshot.height * patch.sourceOffsetY / 100), 0, Math.max(0, snapshot.height - rect.height));

    if (patch.mode === "solid") {
      context.fillStyle = patch.color;
      context.fillRect(0, 0, rect.width, rect.height);
    } else if (patch.mode === "smear") {
      const sampleX = Math.min(snapshot.width - 1, Math.round(sourceX + rect.width / 2));
      context.drawImage(snapshot, sampleX, sourceY, 1, rect.height, 0, 0, rect.width, rect.height);
    } else if (patch.mode === "mosaic") {
      const small = createCanvas(Math.max(1, Math.ceil(rect.width / patch.blockSize)), Math.max(1, Math.ceil(rect.height / patch.blockSize)));
      getContext(small, true).drawImage(snapshot, sourceX, sourceY, rect.width, rect.height, 0, 0, small.width, small.height);
      context.imageSmoothingEnabled = false;
      context.drawImage(small, 0, 0, small.width, small.height, 0, 0, rect.width, rect.height);
      small.width = 1;
      small.height = 1;
    } else if (patch.mode === "blur") {
      if ("filter" in context) context.filter = `blur(${Math.max(0.5, patch.blurRadius)}px)`;
      context.drawImage(snapshot, sourceX, sourceY, rect.width, rect.height, 0, 0, rect.width, rect.height);
      if ("filter" in context) context.filter = "none";
    } else if (patch.mode === "mirror-x" || patch.mode === "mirror-y") {
      context.save();
      context.translate(patch.mode === "mirror-x" ? rect.width : 0, patch.mode === "mirror-y" ? rect.height : 0);
      context.scale(patch.mode === "mirror-x" ? -1 : 1, patch.mode === "mirror-y" ? -1 : 1);
      context.drawImage(snapshot, sourceX, sourceY, rect.width, rect.height, 0, 0, rect.width, rect.height);
      context.restore();
    } else {
      context.drawImage(snapshot, sourceX, sourceY, rect.width, rect.height, 0, 0, rect.width, rect.height);
    }
    return temp;
  }

  function applyPatches(source, patches) {
    const canvas = copyCanvas(source);
    const context = getContext(canvas, true);
    for (const patch of Core.normalizePatches(patches)) {
      const rect = rectFromPercent(patch, canvas.width, canvas.height);
      if (patch.mode === "transparent") {
        context.save();
        context.globalAlpha = patch.opacity;
        context.globalCompositeOperation = "destination-out";
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
        context.restore();
        continue;
      }
      const snapshot = copyCanvas(canvas);
      const temp = createPatchCanvas(snapshot, patch, rect);
      context.save();
      context.globalAlpha = patch.opacity;
      context.drawImage(temp, rect.x, rect.y);
      context.restore();
      snapshot.width = 1;
      snapshot.height = 1;
      temp.width = 1;
      temp.height = 1;
    }
    return canvas;
  }

  function buildPatchedSourceCanvas(source, sourceWidth, sourceHeight, scale, patches) {
    const canvas = createCanvas(sourceWidth * scale, sourceHeight * scale);
    getContext(canvas, true).drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    if (!patches || patches.length === 0) return canvas;
    const scaled = Core.normalizePatches(patches).map((patch) => Object.assign({}, patch, {
      blockSize: Math.max(2, Math.round(patch.blockSize * scale)),
      blurRadius: Math.max(0.5, patch.blurRadius * scale)
    }));
    const patched = applyPatches(canvas, scaled);
    canvas.width = 1;
    canvas.height = 1;
    return patched;
  }

  function drawOverlay(context, item, width, height, strokeStyle, fillStyle, label) {
    if (!item) return;
    const rect = rectFromPercent(item, width, height);
    context.save();
    context.fillStyle = fillStyle;
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    context.strokeStyle = strokeStyle;
    context.lineWidth = Math.max(2, Math.round(Math.min(width, height) / 240));
    context.setLineDash([8, 6]);
    context.strokeRect(rect.x + 1, rect.y + 1, Math.max(1, rect.width - 2), Math.max(1, rect.height - 2));
    if (label && typeof context.fillText === "function") {
      context.setLineDash([]);
      context.font = `${Math.max(12, Math.round(Math.min(width, height) / 32))}px system-ui`;
      context.fillStyle = strokeStyle;
      context.fillText(label, rect.x + 6, Math.max(18, rect.y + 18));
    }
    context.restore();
  }

  function renderOriginalPreview(source, sourceWidth, sourceHeight, maximumDimension, overlays) {
    const scale = Math.min(1, maximumDimension / Math.max(sourceWidth, sourceHeight));
    const canvas = createCanvas(sourceWidth * scale, sourceHeight * scale);
    const context = getContext(canvas, true);
    context.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    const selection = overlays && overlays.selection;
    const patch = overlays && overlays.patch;
    if (patch && patch.mode === "clone") {
      drawOverlay(context, Object.assign({}, patch, {
        x: Core.clamp(patch.x + patch.sourceOffsetX, 0, 100 - patch.width),
        y: Core.clamp(patch.y + patch.sourceOffsetY, 0, 100 - patch.height)
      }), canvas.width, canvas.height, "#33d6ff", "rgba(51,214,255,0.12)", "コピー元");
    }
    drawOverlay(context, selection || patch, canvas.width, canvas.height, "#ffbf47", "rgba(255,191,71,0.16)", "修正先");
    return { canvas, scale };
  }

  root.LocalPatchRender = Object.freeze({ createCanvas, getContext, buildPatchedSourceCanvas, renderOriginalPreview, applyPatches, rectFromPercent });
})(typeof globalThis !== "undefined" ? globalThis : this);
