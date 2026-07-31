(function (root) {
  "use strict";
  const Core = root.LocalTransformCore;
  const Patch = root.LocalPatchRender;
  if (!Core || !Patch) throw new Error("core.js and patch-render.js must be loaded before render.js");
  const createCanvas = Patch.createCanvas;
  const getContext = Patch.getContext;

  function buildBaseCanvas(patchedSource, geometry, scale) {
    const width = Math.max(1, Math.round(geometry.baseWidth * scale));
    const height = Math.max(1, Math.round(geometry.baseHeight * scale));
    const canvas = createCanvas(width, height);
    const context = getContext(canvas, true);
    const cropX = geometry.cropX * scale;
    const cropY = geometry.cropY * scale;
    const cropWidth = geometry.cropWidth * scale;
    const cropHeight = geometry.cropHeight * scale;
    context.save();
    context.translate(width / 2, height / 2);
    context.scale(geometry.settings.flipX ? -1 : 1, geometry.settings.flipY ? -1 : 1);
    context.rotate(geometry.settings.rotation * Math.PI / 180);
    context.drawImage(patchedSource, cropX, cropY, cropWidth, cropHeight, -cropWidth / 2, -cropHeight / 2, cropWidth, cropHeight);
    context.restore();
    return canvas;
  }

  function drawVerticalTile(context, source, sourceStart, sourceEnd, destinationStart, destinationLength, mirrored) {
    const sourceBand = sourceEnd - sourceStart;
    const sourceLength = Math.min(sourceBand, destinationLength);
    if (!mirrored) {
      context.drawImage(source, 0, sourceStart, source.width, sourceLength, 0, destinationStart, source.width, destinationLength);
      return;
    }
    context.save();
    context.translate(0, destinationStart + destinationLength);
    context.scale(1, -1);
    context.drawImage(source, 0, sourceEnd - sourceLength, source.width, sourceLength, 0, 0, source.width, destinationLength);
    context.restore();
  }

  function drawHorizontalTile(context, source, sourceStart, sourceEnd, destinationStart, destinationLength, mirrored) {
    const sourceBand = sourceEnd - sourceStart;
    const sourceLength = Math.min(sourceBand, destinationLength);
    if (!mirrored) {
      context.drawImage(source, sourceStart, 0, sourceLength, source.height, destinationStart, 0, destinationLength, source.height);
      return;
    }
    context.save();
    context.translate(destinationStart + destinationLength, 0);
    context.scale(-1, 1);
    context.drawImage(source, sourceEnd - sourceLength, 0, sourceLength, source.height, 0, 0, destinationLength, source.height);
    context.restore();
  }

  function softenVerticalSeams(context, source, geometry, destinationStart, destinationEnd, featherPixels) {
    const feather = Math.min(featherPixels, Math.floor(geometry.bandOutputSize / 2), 36);
    if (feather <= 0 || geometry.settings.mode === "remove") return;
    for (let index = 0; index < feather; index += 1) {
      context.globalAlpha = 0.34 * (1 - index / feather);
      if (geometry.start > 0) context.drawImage(source, 0, geometry.start - 1, source.width, 1, 0, destinationStart + index, source.width, 1);
      if (geometry.end < source.height) context.drawImage(source, 0, geometry.end, source.width, 1, 0, destinationEnd - 1 - index, source.width, 1);
    }
    context.globalAlpha = 1;
  }

  function softenHorizontalSeams(context, source, geometry, destinationStart, destinationEnd, featherPixels) {
    const feather = Math.min(featherPixels, Math.floor(geometry.bandOutputSize / 2), 36);
    if (feather <= 0 || geometry.settings.mode === "remove") return;
    for (let index = 0; index < feather; index += 1) {
      context.globalAlpha = 0.34 * (1 - index / feather);
      if (geometry.start > 0) context.drawImage(source, geometry.start - 1, 0, 1, source.height, destinationStart + index, 0, 1, source.height);
      if (geometry.end < source.width) context.drawImage(source, geometry.end, 0, 1, source.height, destinationEnd - 1 - index, 0, 1, source.height);
    }
    context.globalAlpha = 1;
  }

  function applyVerticalOperation(source, geometry, settings) {
    const canvas = createCanvas(source.width, geometry.operationHeight);
    const context = getContext(canvas, true);
    const destinationStart = geometry.start;
    const destinationEnd = destinationStart + geometry.bandOutputSize;
    if (geometry.start > 0) context.drawImage(source, 0, 0, source.width, geometry.start, 0, 0, source.width, geometry.start);
    if (geometry.bandOutputSize > 0) {
      if (settings.mode === "repeat" || settings.mode === "mirror") {
        let destination = destinationStart;
        let tileIndex = 0;
        while (destination < destinationEnd) {
          const length = Math.min(geometry.bandSize, destinationEnd - destination);
          drawVerticalTile(context, source, geometry.start, geometry.end, destination, length, settings.mode === "mirror" && tileIndex % 2 === 1);
          destination += length;
          tileIndex += 1;
        }
      } else if (settings.mode === "smear") {
        const sourceY = Math.min(source.height - 1, Math.round((geometry.start + geometry.end) / 2));
        context.drawImage(source, 0, sourceY, source.width, 1, 0, destinationStart, source.width, geometry.bandOutputSize);
      } else if (settings.mode === "offset") {
        const shift = Math.round(source.width * settings.amountPercent / 100);
        for (const offset of [-source.width, 0, source.width]) context.drawImage(source, 0, geometry.start, source.width, geometry.bandSize, shift + offset, destinationStart, source.width, geometry.bandOutputSize);
      } else {
        context.drawImage(source, 0, geometry.start, source.width, geometry.bandSize, 0, destinationStart, source.width, geometry.bandOutputSize);
      }
    }
    const bottomHeight = source.height - geometry.end;
    if (bottomHeight > 0) context.drawImage(source, 0, geometry.end, source.width, bottomHeight, 0, destinationEnd, source.width, bottomHeight);
    softenVerticalSeams(context, source, geometry, destinationStart, destinationEnd, Math.round(source.height * settings.featherPercent / 100));
    return canvas;
  }

  function applyHorizontalOperation(source, geometry, settings) {
    const canvas = createCanvas(geometry.operationWidth, source.height);
    const context = getContext(canvas, true);
    const destinationStart = geometry.start;
    const destinationEnd = destinationStart + geometry.bandOutputSize;
    if (geometry.start > 0) context.drawImage(source, 0, 0, geometry.start, source.height, 0, 0, geometry.start, source.height);
    if (geometry.bandOutputSize > 0) {
      if (settings.mode === "repeat" || settings.mode === "mirror") {
        let destination = destinationStart;
        let tileIndex = 0;
        while (destination < destinationEnd) {
          const length = Math.min(geometry.bandSize, destinationEnd - destination);
          drawHorizontalTile(context, source, geometry.start, geometry.end, destination, length, settings.mode === "mirror" && tileIndex % 2 === 1);
          destination += length;
          tileIndex += 1;
        }
      } else if (settings.mode === "smear") {
        const sourceX = Math.min(source.width - 1, Math.round((geometry.start + geometry.end) / 2));
        context.drawImage(source, sourceX, 0, 1, source.height, destinationStart, 0, geometry.bandOutputSize, source.height);
      } else if (settings.mode === "offset") {
        const shift = Math.round(source.height * settings.amountPercent / 100);
        for (const offset of [-source.height, 0, source.height]) context.drawImage(source, geometry.start, 0, geometry.bandSize, source.height, destinationStart, shift + offset, geometry.bandOutputSize, source.height);
      } else {
        context.drawImage(source, geometry.start, 0, geometry.bandSize, source.height, destinationStart, 0, geometry.bandOutputSize, source.height);
      }
    }
    const rightWidth = source.width - geometry.end;
    if (rightWidth > 0) context.drawImage(source, geometry.end, 0, rightWidth, source.height, destinationEnd, 0, rightWidth, source.height);
    softenHorizontalSeams(context, source, geometry, destinationStart, destinationEnd, Math.round(source.width * settings.featherPercent / 100));
    return canvas;
  }

  function applyOperation(baseCanvas, settings) {
    const localSettings = Object.assign({}, settings, {
      rotation: 0, flipX: false, flipY: false, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0,
      paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, patches: []
    });
    const geometry = Core.computeGeometry(baseCanvas.width, baseCanvas.height, localSettings);
    return settings.axis === "horizontal" ? { canvas: applyHorizontalOperation(baseCanvas, geometry, settings), geometry } : { canvas: applyVerticalOperation(baseCanvas, geometry, settings), geometry };
  }

  function fillRepeated(context, source, outputWidth, outputHeight, offsetX, offsetY, mirrored) {
    const startX = -Math.ceil(offsetX / source.width) * source.width;
    const startY = -Math.ceil(offsetY / source.height) * source.height;
    let row = 0;
    for (let y = startY; y < outputHeight; y += source.height) {
      let column = 0;
      for (let x = startX; x < outputWidth; x += source.width) {
        const flipX = mirrored && column % 2 !== 0;
        const flipY = mirrored && row % 2 !== 0;
        context.save();
        context.translate(x + (flipX ? source.width : 0), y + (flipY ? source.height : 0));
        context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        context.drawImage(source, 0, 0);
        context.restore();
        column += 1;
      }
      row += 1;
    }
  }

  function applyPadding(source, settings) {
    const top = Math.round(source.height * settings.paddingTop / 100);
    const right = Math.round(source.width * settings.paddingRight / 100);
    const bottom = Math.round(source.height * settings.paddingBottom / 100);
    const left = Math.round(source.width * settings.paddingLeft / 100);
    if (top + right + bottom + left === 0) return source;
    const canvas = createCanvas(source.width + left + right, source.height + top + bottom);
    const context = getContext(canvas, true);
    if (settings.paddingMode === "solid") {
      context.fillStyle = settings.paddingColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
    } else if (settings.paddingMode === "repeat" || settings.paddingMode === "mirror") {
      fillRepeated(context, source, canvas.width, canvas.height, left, top, settings.paddingMode === "mirror");
    } else if (settings.paddingMode === "edge") {
      if (top > 0) context.drawImage(source, 0, 0, source.width, 1, left, 0, source.width, top);
      if (bottom > 0) context.drawImage(source, 0, source.height - 1, source.width, 1, left, top + source.height, source.width, bottom);
      if (left > 0) context.drawImage(source, 0, 0, 1, source.height, 0, top, left, source.height);
      if (right > 0) context.drawImage(source, source.width - 1, 0, 1, source.height, left + source.width, top, right, source.height);
      if (top > 0 && left > 0) context.drawImage(source, 0, 0, 1, 1, 0, 0, left, top);
      if (top > 0 && right > 0) context.drawImage(source, source.width - 1, 0, 1, 1, left + source.width, 0, right, top);
      if (bottom > 0 && left > 0) context.drawImage(source, 0, source.height - 1, 1, 1, 0, top + source.height, left, bottom);
      if (bottom > 0 && right > 0) context.drawImage(source, source.width - 1, source.height - 1, 1, 1, left + source.width, top + source.height, right, bottom);
    }
    context.drawImage(source, left, top);
    return canvas;
  }

  function calculateScale(geometry, maximumDimension, pixelLimit) {
    const dimensionScale = Math.min(1, maximumDimension / Math.max(geometry.outputWidth, geometry.outputHeight));
    const pixelScale = Math.min(1, Math.sqrt(pixelLimit / geometry.pixels));
    return Math.max(0.01, Math.min(dimensionScale, pixelScale));
  }

  function renderResult(source, sourceWidth, sourceHeight, rawSettings, options) {
    const settings = Core.normalizeSettings(rawSettings);
    const geometry = Core.computeGeometry(sourceWidth, sourceHeight, settings);
    const maximumDimension = Math.max(1, options && options.maximumDimension || settings.outputMaxDimension);
    const pixelLimit = Math.max(1, options && options.pixelLimit || Core.LIMITS.maxOutputPixels);
    const scale = calculateScale(geometry, maximumDimension, pixelLimit);
    const patchedSource = Patch.buildPatchedSourceCanvas(source, sourceWidth, sourceHeight, scale, settings.patches);
    const base = buildBaseCanvas(patchedSource, geometry, scale);
    patchedSource.width = 1;
    patchedSource.height = 1;
    const operation = applyOperation(base, settings);
    if (operation.canvas !== base) { base.width = 1; base.height = 1; }
    let output = applyPadding(operation.canvas, settings);
    if (output !== operation.canvas) { operation.canvas.width = 1; operation.canvas.height = 1; }
    const finalPixels = output.width * output.height;
    const finalScale = Math.min(1, maximumDimension / Math.max(output.width, output.height), Math.sqrt(pixelLimit / Math.max(1, finalPixels)));
    if (finalScale < 1) {
      const resized = createCanvas(output.width * finalScale, output.height * finalScale);
      getContext(resized, true).drawImage(output, 0, 0, output.width, output.height, 0, 0, resized.width, resized.height);
      output.width = 1;
      output.height = 1;
      output = resized;
    }
    return { canvas: output, geometry, scale: scale * finalScale, operationGeometry: operation.geometry };
  }

  root.LocalTransformRender = Object.freeze({ renderResult, renderOriginalPreview: Patch.renderOriginalPreview, applyPatches: Patch.applyPatches, rectFromPercent: Patch.rectFromPercent });
})(typeof globalThis !== "undefined" ? globalThis : this);
