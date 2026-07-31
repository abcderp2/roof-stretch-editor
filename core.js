(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.LocalTransformCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LIMITS = Object.freeze({
    maxFileBytes: 18 * 1024 * 1024,
    maxSourcePixels: 20_000_000,
    maxSourceDimension: 10_000,
    maxOutputPixels: 24_000_000,
    maxOutputDimension: 10_000,
    previewDimensionLow: 760,
    previewDimensionDefault: 1100,
    previewDimensionHigh: 1500,
    historyLength: 30,
    minimumBandPercent: 2,
    maximumPaddingPercent: 100
  });

  const DEFAULTS = Object.freeze({
    axis: "vertical",
    mode: "stretch",
    startPercent: 30,
    endPercent: 55,
    amountPercent: 50,
    featherPercent: 1,
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
    paddingLeft: 0,
    paddingMode: "mirror",
    paddingColor: "#ffffff",
    previewMode: "result",
    outputFormat: "image/png",
    outputQuality: 0.92,
    outputMaxDimension: 4096
  });

  const SUPPORTED_MIME_TYPES = Object.freeze(["image/jpeg", "image/png", "image/webp"]);
  const MODES = Object.freeze(["stretch", "compress", "repeat", "mirror", "smear", "remove", "offset"]);
  const AXES = Object.freeze(["vertical", "horizontal"]);
  const PADDING_MODES = Object.freeze(["transparent", "solid", "edge", "repeat", "mirror"]);

  function clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return min;
    }
    return Math.min(max, Math.max(min, number));
  }

  function roundInt(value, minimum) {
    return Math.max(minimum || 0, Math.round(value));
  }

  function normalizeRange(start, end, minimum) {
    const minBand = clamp(minimum, 1, 50);
    let normalizedStart = clamp(start, 0, 100 - minBand);
    let normalizedEnd = clamp(end, minBand, 100);
    if (normalizedEnd - normalizedStart < minBand) {
      normalizedEnd = Math.min(100, normalizedStart + minBand);
      if (normalizedEnd - normalizedStart < minBand) {
        normalizedStart = Math.max(0, normalizedEnd - minBand);
      }
    }
    return { start: normalizedStart, end: normalizedEnd };
  }

  function normalizeCrop(settings) {
    let top = clamp(settings.cropTop, 0, 45);
    let right = clamp(settings.cropRight, 0, 45);
    let bottom = clamp(settings.cropBottom, 0, 45);
    let left = clamp(settings.cropLeft, 0, 45);

    if (top + bottom > 90) {
      const ratio = 90 / (top + bottom);
      top *= ratio;
      bottom *= ratio;
    }
    if (left + right > 90) {
      const ratio = 90 / (left + right);
      left *= ratio;
      right *= ratio;
    }
    return { top, right, bottom, left };
  }

  function normalizeSettings(input) {
    const source = Object.assign({}, DEFAULTS, input || {});
    const range = normalizeRange(source.startPercent, source.endPercent, LIMITS.minimumBandPercent);
    const crop = normalizeCrop(source);
    const rotationValues = [0, 90, 180, 270];
    const rotation = rotationValues.includes(Number(source.rotation)) ? Number(source.rotation) : 0;
    const mode = MODES.includes(source.mode) ? source.mode : DEFAULTS.mode;
    const amountMinimum = mode === "offset" ? -100 : 0;
    const amountMaximum = mode === "compress" ? 95 : mode === "remove" ? 100 : 300;

    return {
      axis: AXES.includes(source.axis) ? source.axis : DEFAULTS.axis,
      mode,
      startPercent: range.start,
      endPercent: range.end,
      amountPercent: mode === "remove" ? 100 : clamp(source.amountPercent, amountMinimum, amountMaximum),
      featherPercent: clamp(source.featherPercent, 0, 8),
      rotation,
      flipX: Boolean(source.flipX),
      flipY: Boolean(source.flipY),
      cropTop: crop.top,
      cropRight: crop.right,
      cropBottom: crop.bottom,
      cropLeft: crop.left,
      paddingTop: clamp(source.paddingTop, 0, LIMITS.maximumPaddingPercent),
      paddingRight: clamp(source.paddingRight, 0, LIMITS.maximumPaddingPercent),
      paddingBottom: clamp(source.paddingBottom, 0, LIMITS.maximumPaddingPercent),
      paddingLeft: clamp(source.paddingLeft, 0, LIMITS.maximumPaddingPercent),
      paddingMode: PADDING_MODES.includes(source.paddingMode) ? source.paddingMode : DEFAULTS.paddingMode,
      paddingColor: /^#[0-9a-f]{6}$/i.test(String(source.paddingColor)) ? String(source.paddingColor) : DEFAULTS.paddingColor,
      previewMode: source.previewMode === "selection" ? "selection" : "result",
      outputFormat: SUPPORTED_MIME_TYPES.includes(source.outputFormat) ? source.outputFormat : DEFAULTS.outputFormat,
      outputQuality: clamp(source.outputQuality, 0.5, 1),
      outputMaxDimension: roundInt(clamp(source.outputMaxDimension, 640, LIMITS.maxOutputDimension), 640)
    };
  }

  function calculateBandOutputSize(bandSize, mode, amountPercent) {
    const band = Math.max(1, bandSize);
    const amount = Number(amountPercent);
    if (mode === "remove") {
      return 0;
    }
    if (mode === "compress") {
      return Math.max(1, Math.round(band * (1 - clamp(amount, 0, 95) / 100)));
    }
    if (mode === "offset") {
      return band;
    }
    return Math.max(1, Math.round(band * (1 + clamp(amount, 0, 300) / 100)));
  }

  function computeGeometry(width, height, rawSettings) {
    const settings = normalizeSettings(rawSettings);
    const sourceWidth = roundInt(width, 1);
    const sourceHeight = roundInt(height, 1);

    const cropX = Math.round(sourceWidth * settings.cropLeft / 100);
    const cropY = Math.round(sourceHeight * settings.cropTop / 100);
    const cropRightPx = Math.round(sourceWidth * settings.cropRight / 100);
    const cropBottomPx = Math.round(sourceHeight * settings.cropBottom / 100);
    const cropWidth = Math.max(1, sourceWidth - cropX - cropRightPx);
    const cropHeight = Math.max(1, sourceHeight - cropY - cropBottomPx);

    const rotated = settings.rotation === 90 || settings.rotation === 270;
    const baseWidth = rotated ? cropHeight : cropWidth;
    const baseHeight = rotated ? cropWidth : cropHeight;
    const axisLength = settings.axis === "vertical" ? baseHeight : baseWidth;
    const start = Math.round(axisLength * settings.startPercent / 100);
    const rawEnd = Math.round(axisLength * settings.endPercent / 100);
    const end = Math.max(start + 1, Math.min(axisLength, rawEnd));
    const bandSize = Math.max(1, end - start);
    const bandOutputSize = calculateBandOutputSize(bandSize, settings.mode, settings.amountPercent);

    const operationWidth = settings.axis === "horizontal"
      ? baseWidth - bandSize + bandOutputSize
      : baseWidth;
    const operationHeight = settings.axis === "vertical"
      ? baseHeight - bandSize + bandOutputSize
      : baseHeight;

    const paddingTop = Math.round(operationHeight * settings.paddingTop / 100);
    const paddingRight = Math.round(operationWidth * settings.paddingRight / 100);
    const paddingBottom = Math.round(operationHeight * settings.paddingBottom / 100);
    const paddingLeft = Math.round(operationWidth * settings.paddingLeft / 100);
    const outputWidth = operationWidth + paddingLeft + paddingRight;
    const outputHeight = operationHeight + paddingTop + paddingBottom;
    const pixels = outputWidth * outputHeight;

    return {
      settings,
      sourceWidth,
      sourceHeight,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      baseWidth,
      baseHeight,
      axisLength,
      start,
      end,
      bandSize,
      bandOutputSize,
      operationWidth,
      operationHeight,
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
      outputWidth,
      outputHeight,
      pixels
    };
  }

  function validateGeometry(geometry, maxDimension, maxPixels) {
    const dimensionLimit = maxDimension || LIMITS.maxOutputDimension;
    const pixelLimit = maxPixels || LIMITS.maxOutputPixels;
    if (geometry.outputWidth > dimensionLimit || geometry.outputHeight > dimensionLimit) {
      throw new Error(`出力の縦横は${dimensionLimit}px以下にしてください。`);
    }
    if (!Number.isSafeInteger(geometry.pixels) || geometry.pixels > pixelLimit) {
      throw new Error(`出力画像は${pixelLimit.toLocaleString("ja-JP")}画素以下にしてください。`);
    }
    return true;
  }

  function getDeviceProfile(navigatorLike, screenLike) {
    const nav = navigatorLike || {};
    const screen = screenLike || {};
    const memory = Number(nav.deviceMemory || 0);
    const cores = Number(nav.hardwareConcurrency || 0);
    const shortSide = Math.min(Number(screen.width || 0), Number(screen.height || 0));
    const low = (memory > 0 && memory <= 2) || (cores > 0 && cores <= 2) || (shortSide > 0 && shortSide <= 480);
    const high = memory >= 8 && cores >= 8 && shortSide >= 900;

    if (low) {
      return { name: "省メモリ", previewDimension: LIMITS.previewDimensionLow, exportPixelLimit: 12_000_000 };
    }
    if (high) {
      return { name: "高精細", previewDimension: LIMITS.previewDimensionHigh, exportPixelLimit: LIMITS.maxOutputPixels };
    }
    return { name: "標準", previewDimension: LIMITS.previewDimensionDefault, exportPixelLimit: 18_000_000 };
  }

  function readUint24LE(view, offset) {
    return view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
  }

  function inspectImageHeader(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 12) {
      throw new Error("画像データが短すぎます。");
    }
    const view = new DataView(buffer);

    if (
      view.getUint32(0) === 0x89504e47 &&
      view.getUint32(4) === 0x0d0a1a0a &&
      buffer.byteLength >= 24
    ) {
      const width = view.getUint32(16);
      const height = view.getUint32(20);
      return { mimeType: "image/png", width, height };
    }

    if (view.getUint16(0) === 0xffd8) {
      let offset = 2;
      while (offset + 9 < buffer.byteLength) {
        if (view.getUint8(offset) !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = view.getUint8(offset + 1);
        offset += 2;
        if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          continue;
        }
        if (offset + 2 > buffer.byteLength) {
          break;
        }
        const length = view.getUint16(offset);
        if (length < 2 || offset + length > buffer.byteLength) {
          break;
        }
        const isSof = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
        if (isSof && length >= 7) {
          return {
            mimeType: "image/jpeg",
            height: view.getUint16(offset + 3),
            width: view.getUint16(offset + 5)
          };
        }
        offset += length;
      }
      throw new Error("JPEGの画像サイズを確認できませんでした。");
    }

    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    const webp = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    if (riff === "RIFF" && webp === "WEBP" && buffer.byteLength >= 30) {
      const chunk = String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15));
      if (chunk === "VP8X") {
        return {
          mimeType: "image/webp",
          width: readUint24LE(view, 24) + 1,
          height: readUint24LE(view, 27) + 1
        };
      }
      if (chunk === "VP8L" && view.getUint8(20) === 0x2f) {
        const bits = view.getUint32(21, true);
        return {
          mimeType: "image/webp",
          width: (bits & 0x3fff) + 1,
          height: ((bits >> 14) & 0x3fff) + 1
        };
      }
      if (chunk === "VP8 " && buffer.byteLength >= 30) {
        return {
          mimeType: "image/webp",
          width: view.getUint16(26, true) & 0x3fff,
          height: view.getUint16(28, true) & 0x3fff
        };
      }
      throw new Error("WebPの画像サイズを確認できませんでした。");
    }

    throw new Error("JPEG、PNG、WebPの実データではありません。");
  }

  function validateFileMetadata(file, header) {
    if (!file || typeof file.size !== "number") {
      throw new Error("画像ファイルが選ばれていません。");
    }
    if (file.size <= 0) {
      throw new Error("空のファイルは読み込めません。");
    }
    if (file.size > LIMITS.maxFileBytes) {
      throw new Error(`画像は${Math.round(LIMITS.maxFileBytes / 1024 / 1024)}MB以下にしてください。`);
    }
    if (!header || !SUPPORTED_MIME_TYPES.includes(header.mimeType)) {
      throw new Error("対応していない画像形式です。");
    }
    if (file.type && file.type !== header.mimeType) {
      throw new Error("ファイル表示形式と画像の実データが一致しません。");
    }
    const pixels = header.width * header.height;
    if (header.width <= 0 || header.height <= 0 || !Number.isSafeInteger(pixels)) {
      throw new Error("画像サイズが正しくありません。");
    }
    if (header.width > LIMITS.maxSourceDimension || header.height > LIMITS.maxSourceDimension) {
      throw new Error(`画像の縦横は${LIMITS.maxSourceDimension}px以下にしてください。`);
    }
    if (pixels > LIMITS.maxSourcePixels) {
      throw new Error(`画像は${LIMITS.maxSourcePixels.toLocaleString("ja-JP")}画素以下にしてください。`);
    }
    return true;
  }

  function buildDownloadName(originalName, mimeType) {
    const extensions = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
    const base = String(originalName || "image")
      .replace(/\.[^.]+$/, "")
      .normalize("NFKC")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "image";
    return `${base}-reframed.${extensions[mimeType] || "png"}`;
  }

  function serializeRecipe(settings) {
    return JSON.stringify({ version: 1, settings: normalizeSettings(settings) }, null, 2);
  }

  function parseRecipe(text) {
    let data;
    try {
      data = JSON.parse(String(text));
    } catch (error) {
      throw new Error("レシピJSONを読み取れませんでした。");
    }
    if (!data || data.version !== 1 || typeof data.settings !== "object") {
      throw new Error("対応していないレシピ形式です。");
    }
    return normalizeSettings(data.settings);
  }

  return Object.freeze({
    LIMITS,
    DEFAULTS,
    SUPPORTED_MIME_TYPES,
    MODES,
    AXES,
    PADDING_MODES,
    clamp,
    normalizeRange,
    normalizeSettings,
    calculateBandOutputSize,
    computeGeometry,
    validateGeometry,
    getDeviceProfile,
    inspectImageHeader,
    validateFileMetadata,
    buildDownloadName,
    serializeRecipe,
    parseRecipe
  });
});
