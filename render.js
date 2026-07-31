(function (root) {
  "use strict";

  const Core = root.LocalTransformCore;
  if (!Core) {
    throw new Error("core.js must be loaded before render.js");
  }

  function createCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
  }

  function getContext(canvas, alpha) {
    const context = canvas.getContext("2d", { alpha: alpha !== false, desynchronized: true });
    if (!context) {
      throw new Error("Canvas 2D機能を利用できません。");
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    return context;
  }

  function buildBaseCanvas(source, geometry, scale) {
    const width = Math.max(1, Math.round(geometry.baseWidth * scale));
    const height = Math.max(1, Math.round(geometry.baseHeight * scale));
    const canvas = createCanvas(width, height);
    const context = getContext(canvas, true);
    const cropWidth = geometry.cropWidth * scale;
    const cropHeight = geometry.cropHeight * scale;

    context.save();
    context.translate(width / 2, height / 2);
    context.scale(geometry.settings.flipX ? -1 : 1, geometry.settings.flipY ? -1 : 1);
    context.rotate(geometry.settings.rotation * Math.PI / 180);
    context.drawImage(
      source,
      geometry.cropX,
      geometry.cropY,
      geometry.cropWidth,
      geometry.cropHeight,
      -cropWidth / 2,
      -cropHeight / 2,
      cropWidth,
      cropHeight
    );
    context.restore();
    return canvas;
  }

  function drawVerticalTile(context, source, sourceStart, sourceEnd, destinationStart, destinationLength, mirrored) {
    const width = source.width;
    const sourceBand = sourceEnd - sourceStart;
    const sourceLength = Math.min(sourceBand, destinationLength);
    if (!mirrored) {
      context.drawImage(source, 0, sourceStart, width, sourceLength, 0, destinationStart, width, destinationLength);
      return;
    }
    context.save();
    context.translate(0, destinationStart + destinationLength);
    context.scale(1, -1);
    context.drawImage(source, 0, sourceEnd - sourceLength, width, sourceLength, 0, 0, width, destinationLength);
    context.restore();
  }

  function drawHorizontalTile(context, source, sourceStart, sourceEnd, destinationStart, destinationLength, mirrored) {
    const height = source.height;
    const sourceBand = sourceEnd - sourceStart;
    const sourceLength = Math.min(sourceBand, destinationLength);
    if (!mirrored) {
      context.drawImage(source, sourceStart, 0, sourceLength, height, destinationStart, 0, destinationLength, height);
      return;
    }
    context.save();
    context.translate(destinationStart + destinationLength, 0);
    context.scale(-1, 1);
    context.drawImage(source, sourceEnd - sourceLength, 0, sourceLength, height, 0, 0, destinationLength, height);
    context.restore();
  }

  function softenVerticalSeams(context, source, geometry, destinationBandStart, destinationBandEnd, featherPixels) {
    const feather = Math.min(featherPixels, Math.floor(geometry.bandOutputSize / 2), 36);
    if (feather <= 0 || geometry.mode === "remove") {
      return;
    }
    const width = source.width;
    for (let index = 0; index < feather; index += 1) {
      const alpha = 0.34 * (1 - index / feather);
      context.globalAlpha = alpha;
      if (geometry.start > 0) {
        context.drawImage(source, 0, geometry.start - 1, width, 1, 0, destinationBandStart + index, width, 1);
      }
      if (geometry.end < source.height) {
        context.drawImage(source, 0, geometry.end, width, 1, 0, destinationBandEnd - 1 - index, width, 1);
      }
    }
    context.globalAlpha = 1;
  }

  function softenHorizontalSeams(context, source, geometry, destinationBandStart, destinationBandEnd, featherPixels) {
    const feather = Math.min(featherPixels, Math.floor(geometry.bandOutputSize / 2), 36);
    if (feather <= 0 || geometry.mode === "remove") {
      return;
    }
    const height = source.height;
    for (let index = 0; index < feather; index += 1) {
      const alpha = 0.34 * (1 - index / feather);
      context.globalAlpha = alpha;
      if (geometry.start > 0) {
        context.drawImage(source, geometry.start - 1, 0, 1, height, destinationBandStart + index, 0, 1, height);
      }
      if (geometry.end < source.width) {
        context.drawImage(source, geometry.end, 0, 1, height, destinationBandEnd - 1 - index, 0, 1, height);
      }
    }
    context.globalAlpha = 1;
  }

  function applyVerticalOperation(source, geometry, settings) {
    const canvas = createCanvas(source.width, geometry.operationHeight);
    const context = getContext(canvas, true);
    const topHeight = geometry.start;
    const destinationBandStart = topHeight;
    const destinationBandEnd = destinationBandStart + geometry.bandOutputSize;
    const bottomHeight = source.height - geometry.end;

    if (topHeight > 0) {
      context.drawImage(source, 0, 0, source.width, topHeight, 0, 0, source.width, topHeight);
    }

    if (geometry.bandOutputSize > 0) {
      if (settings.mode === "repeat" || settings.mode === "mirror") {
        let destination = destinationBandStart;
        let tileIndex = 0;
        while (destination < destinationBandEnd) {
          const length = Math.min(geometry.bandSize, destinationBandEnd - destination);
          drawVerticalTile(
            context,
            source,
            geometry.start,
            geometry.end,
            destination,
            length,
            settings.mode === "mirror" && tileIndex % 2 === 1
          );
          destination += length;
          tileIndex += 1;
        }
      } else if (settings.mode === "smear") {
        const sourceY = Math.min(source.height - 1, Math.round((geometry.start + geometry.end) / 2));
        context.drawImage(source, 0, sourceY, source.width, 1, 0, destinationBandStart, source.width, geometry.bandOutputSize);
      } else if (settings.mode === "offset") {
        const shift = Math.round(source.width * settings.amountPercent / 100);
        for (const offset of [-source.width, 0, source.width]) {
          context.drawImage(
            source,
            0,
            geometry.start,
            source.width,
            geometry.bandSize,
            shift + offset,
            destinationBandStart,
            source.width,
            geometry.bandOutputSize
          );
        }
      } else {
        context.drawImage(
          source,
          0,
          geometry.start,
          source.width,
          geometry.bandSize,
          0,
          destinationBandStart,
          source.width,
          geometry.bandOutputSize
        );
      }
    }

    if (bottomHeight > 0) {
      context.drawImage(
        source,
        0,
        geometry.end,
        source.width,
        bottomHeight,
        0,
        destinationBandEnd,
        source.width,
        bottomHeight
      );
    }

    const featherPixels = Math.round(source.height * settings.featherPercent / 100);
    softenVerticalSeams(context, source, Object.assign({ mode: settings.mode }, geometry), destinationBandStart, destinationBandEnd, featherPixels);
    return canvas;
  }

  function applyHorizontalOperation(source, geometry, settings) {
    const canvas = createCanvas(geometry.operationWidth, source.height);
    const context = getContext(canvas, true);
    const leftWidth = geometry.start;
    const destinationBandStart = leftWidth;
    const destinationBandEnd = destinationBandStart + geometry.bandOutputSize;
    const rightWidth = source.width - geometry.end;

    if (leftWidth > 0) {
      context.drawImage(source, 0, 0, leftWidth, source.height, 0, 0, leftWidth, source.height);
    }

    if (geometry.bandOutputSize > 0) {
      if (settings.mode === "repeat" || settings.mode === "mirror") {
        let destination = destinationBandStart;
        let tileIndex = 0;
        while (destination < destinationBandEnd) {
          const length = Math.min(geometry.bandSize, destinationBandEnd - destination);
          drawHorizontalTile(
            context,
            source,
            geometry.start,
            geometry.end,
            destination,
            length,
            settings.mode === "mirror" && tileIndex % 2 === 1
          );
          destination += length;
          tileIndex += 1;
        }
      } else if (settings.mode === "smear") {
        const sourceX = Math.min(source.width - 1, Math.round((geometry.start + geometry.end) / 2));
        context.drawImage(source, sourceX, 0, 1, source.height, destinationBandStart, 0, geometry.bandOutputSize, source.height);
      } else if (settings.mode === "offset") {
        const shift = Math.round(source.height * settings.amountPercent / 100);
        for (const offset of [-source.height, 0, source.height]) {
          context.drawImage(
            source,
            geometry.start,
            0,
            geometry.bandSize,
            source.height,
            destinationBandStart,
            shift + offset,
            geometry.bandOutputSize,
            source.height
          );
        }
      } else {
        context.drawImage(
          source,
          geometry.start,
          0,
          geometry.bandSize,
          source.height,
          destinationBandStart,
          0,
          geometry.bandOutputSize,
          source.height
        );
      }
    }

    if (rightWidth > 0) {
      context.drawImage(
        source,
        geometry.end,
        0,
        rightWidth,
        source.height,
        destinationBandEnd,
        0,
        rightWidth,
        source.height
      );
    }

    const featherPixels = Math.round(source.width * settings.featherPercent / 100);
    softenHorizontalSeams(context, source, Object.assign({ mode: settings.mode }, geometry), destinationBandStart, destinationBandEnd, featherPixels);
    return canvas;
  }

  function applyOperation(baseCanvas, settings) {
    const localSettings = Object.assign({}, settings, {
      rotation: 0,
      flipX: false,
      flipY: false,
      cropTop: 0,
      cropRight: 0,
      cropBottom: 0,
      cropLeft: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0
    });
    const geometry = Core.computeGeometry(baseCanvas.width, baseCanvas.height, localSettings);
    if (settings.axis === "horizontal") {
      return { canvas: applyHorizontalOperation(baseCanvas, geometry, settings), geometry };
    }
    return { canvas: applyVerticalOperation(baseCanvas, geometry, settings), geometry };
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
    if (top + right + bottom + left === 0) {
      return source;
    }

    const canvas = createCanvas(source.width + left + right, source.height + top + bottom);
    const context = getContext(canvas, true);

    if (settings.paddingMode === "solid") {
      context.fillStyle = settings.paddingColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
    } else if (settings.paddingMode === "repeat" || settings.paddingMode === "mirror") {
      fillRepeated(context, source, canvas.width, canvas.height, left, top, settings.paddingMode === "mirror");
    } else if (settings.paddingMode === "edge") {
      if (top > 0) {
        context.drawImage(source, 0, 0, source.width, 1, left, 0, source.width, top);
      }
      if (bottom > 0) {
        context.drawImage(source, 0, source.height - 1, source.width, 1, left, top + source.height, source.width, bottom);
      }
      if (left > 0) {
        context.drawImage(source, 0, 0, 1, source.height, 0, top, left, source.height);
      }
      if (right > 0) {
        context.drawImage(source, source.width - 1, 0, 1, source.height, left + source.width, top, right, source.height);
      }
      if (top > 0 && left > 0) {
        context.drawImage(source, 0, 0, 1, 1, 0, 0, left, top);
      }
      if (top > 0 && right > 0) {
        context.drawImage(source, source.width - 1, 0, 1, 1, left + source.width, 0, right, top);
      }
      if (bottom > 0 && left > 0) {
        context.drawImage(source, 0, source.height - 1, 1, 1, 0, top + source.height, left, bottom);
      }
      if (bottom > 0 && right > 0) {
        context.drawImage(source, source.width - 1, source.height - 1, 1, 1, left + source.width, top + source.height, right, bottom);
      }
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
    const base = buildBaseCanvas(source, geometry, scale);
    const operation = applyOperation(base, settings);
    const output = applyPadding(operation.canvas, settings);
    return { canvas: output, geometry, scale, baseCanvas: base, operationGeometry: operation.geometry };
  }

  function renderSelection(source, sourceWidth, sourceHeight, rawSettings, maximumDimension, showOverlay) {
    const settings = Core.normalizeSettings(rawSettings);
    const geometry = Core.computeGeometry(sourceWidth, sourceHeight, settings);
    const scale = Math.min(1, maximumDimension / Math.max(geometry.baseWidth, geometry.baseHeight));
    const base = buildBaseCanvas(source, geometry, scale);
    const canvas = createCanvas(base.width, base.height);
    const context = getContext(canvas, true);
    context.drawImage(base, 0, 0);

    if (showOverlay !== false) {
      const axisLength = settings.axis === "vertical" ? canvas.height : canvas.width;
      const start = Math.round(axisLength * settings.startPercent / 100);
      const end = Math.round(axisLength * settings.endPercent / 100);
      context.save();
      context.fillStyle = "rgba(0, 0, 0, 0.42)";
      context.strokeStyle = "#ffffff";
      context.lineWidth = Math.max(2, Math.round(Math.min(canvas.width, canvas.height) / 240));
      context.setLineDash([8, 6]);
      if (settings.axis === "vertical") {
        context.fillRect(0, 0, canvas.width, start);
        context.fillRect(0, end, canvas.width, canvas.height - end);
        context.strokeRect(1, start, canvas.width - 2, Math.max(1, end - start));
      } else {
        context.fillRect(0, 0, start, canvas.height);
        context.fillRect(end, 0, canvas.width - end, canvas.height);
        context.strokeRect(start, 1, Math.max(1, end - start), canvas.height - 2);
      }
      context.restore();
    }

    return { canvas, geometry, scale, baseCanvas: base };
  }

  root.LocalTransformRender = Object.freeze({
    renderResult,
    renderSelection
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
