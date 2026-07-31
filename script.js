(() => {
  "use strict";

  // 低スペック端末でメモリ不足を起こしにくくするための上限です。
  const LIMITS = Object.freeze({
    maxFileBytes: 12 * 1024 * 1024,
    maxSourcePixels: 16_000_000,
    maxSourceDimension: 8_192,
    maxOutputPixels: 20_000_000,
    maxOutputDimension: 8_192,
    previewDimension: 1_200,
    minimumBandPercent: 5
  });

  // 設定を戻す操作で使用する初期値です。
  const DEFAULTS = Object.freeze({
    startPercent: 0,
    endPercent: 40,
    stretchPercent: 40,
    previewMode: "selection"
  });

  const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

  const elements = {
    imageInput: document.querySelector("#image-input"),
    status: document.querySelector("#status"),
    rangeControls: document.querySelector("#range-controls"),
    viewControls: document.querySelector("#view-controls"),
    downloadControls: document.querySelector("#download-controls"),
    rangeStart: document.querySelector("#range-start"),
    rangeEnd: document.querySelector("#range-end"),
    stretchAmount: document.querySelector("#stretch-amount"),
    rangeStartOutput: document.querySelector("#range-start-output"),
    rangeEndOutput: document.querySelector("#range-end-output"),
    stretchOutput: document.querySelector("#stretch-output"),
    outputFormat: document.querySelector("#output-format"),
    resetButton: document.querySelector("#reset-button"),
    clearButton: document.querySelector("#clear-button"),
    downloadButton: document.querySelector("#download-button"),
    canvas: document.querySelector("#preview-canvas"),
    canvasShell: document.querySelector("#canvas-shell"),
    emptyPreview: document.querySelector("#empty-preview"),
    dimensionText: document.querySelector("#dimension-text"),
    modeLabel: document.querySelector("#mode-label")
  };

  // 読み込んだ画像と処理中の状態を1か所で管理します。
  const state = {
    image: null,
    fileName: "image",
    sourceWidth: 0,
    sourceHeight: 0,
    objectUrl: null,
    renderFrame: null,
    isDownloading: false
  };

  function setStatus(message, kind = "info") {
    elements.status.textContent = message;
    if (kind === "info") {
      elements.status.removeAttribute("data-kind");
      return;
    }
    elements.status.dataset.kind = kind;
  }

  function setEditorEnabled(enabled) {
    elements.rangeControls.disabled = !enabled;
    elements.viewControls.disabled = !enabled;
    elements.downloadControls.disabled = !enabled;
    elements.resetButton.disabled = !enabled;
    elements.clearButton.disabled = !enabled;
    elements.downloadButton.disabled = !enabled || state.isDownloading;
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) {
      return `${Math.ceil(bytes / 1024)}KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("ja-JP").format(value);
  }

  function getPreviewMode() {
    const selected = document.querySelector('input[name="preview-mode"]:checked');
    return selected ? selected.value : DEFAULTS.previewMode;
  }

  function getSettings() {
    return {
      startPercent: Number(elements.rangeStart.value),
      endPercent: Number(elements.rangeEnd.value),
      stretchPercent: Number(elements.stretchAmount.value)
    };
  }

  function normalizeRange(changedControl) {
    let start = Number(elements.rangeStart.value);
    let end = Number(elements.rangeEnd.value);
    const minimum = LIMITS.minimumBandPercent;

    if (end - start >= minimum) {
      return;
    }

    if (changedControl === "start") {
      start = Math.max(0, end - minimum);
      elements.rangeStart.value = String(start);
    } else {
      end = Math.min(100, start + minimum);
      elements.rangeEnd.value = String(end);
    }
  }

  function updateControlOutputs() {
    elements.rangeStartOutput.textContent = `${elements.rangeStart.value}%`;
    elements.rangeEndOutput.textContent = `${elements.rangeEnd.value}%`;
    elements.stretchOutput.textContent = `${elements.stretchAmount.value}%`;
  }

  // 選択帯の位置と、伸長後の画像サイズを整数ピクセルで計算します。
  function calculateGeometry(width, height, settings) {
    const startY = Math.round(height * settings.startPercent / 100);
    const rawEndY = Math.round(height * settings.endPercent / 100);
    const endY = Math.max(startY + 1, rawEndY);
    const bandHeight = Math.max(1, endY - startY);
    const extraHeight = Math.round(bandHeight * settings.stretchPercent / 100);
    const outputHeight = height + extraHeight;

    return {
      width,
      height,
      startY,
      endY,
      bandHeight,
      extraHeight,
      outputHeight
    };
  }

  function getPreviewSize(width, height) {
    const scale = Math.min(1, LIMITS.previewDimension / Math.max(width, height));
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
    };
  }

  function prepareCanvas(width, height) {
    if (elements.canvas.width !== width) {
      elements.canvas.width = width;
    }
    if (elements.canvas.height !== height) {
      elements.canvas.height = height;
    }

    const context = elements.canvas.getContext("2d", {
      alpha: true,
      desynchronized: true
    });

    if (!context) {
      throw new Error("画像を表示する機能を利用できません。別のブラウザでお試しください。");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.clearRect(0, 0, width, height);
    return context;
  }

  // 上部、伸ばす帯、下部の3領域に分けて描画し、元画像の幅は変えません。
  function drawStretchedImage(context, source, geometry, targetWidth, targetHeight) {
    const topHeight = Math.round(targetHeight * geometry.startY / geometry.outputHeight);
    const stretchedBandHeight = Math.round(
      targetHeight * (geometry.bandHeight + geometry.extraHeight) / geometry.outputHeight
    );
    const bottomHeight = Math.max(0, targetHeight - topHeight - stretchedBandHeight);

    if (geometry.startY > 0 && topHeight > 0) {
      context.drawImage(
        source,
        0,
        0,
        geometry.width,
        geometry.startY,
        0,
        0,
        targetWidth,
        topHeight
      );
    }

    context.drawImage(
      source,
      0,
      geometry.startY,
      geometry.width,
      geometry.bandHeight,
      0,
      topHeight,
      targetWidth,
      stretchedBandHeight
    );

    const bottomSourceHeight = geometry.height - geometry.endY;
    if (bottomSourceHeight > 0 && bottomHeight > 0) {
      context.drawImage(
        source,
        0,
        geometry.endY,
        geometry.width,
        bottomSourceHeight,
        0,
        topHeight + stretchedBandHeight,
        targetWidth,
        bottomHeight
      );
    }
  }

  function drawSelectionPreview(context, geometry, targetWidth, targetHeight) {
    context.drawImage(
      state.image,
      0,
      0,
      geometry.width,
      geometry.height,
      0,
      0,
      targetWidth,
      targetHeight
    );

    const top = Math.round(targetHeight * geometry.startY / geometry.height);
    const bottom = Math.round(targetHeight * geometry.endY / geometry.height);

    context.save();
    context.fillStyle = "rgba(0, 0, 0, 0.48)";
    context.fillRect(0, 0, targetWidth, top);
    context.fillRect(0, bottom, targetWidth, targetHeight - bottom);

    context.strokeStyle = "#ffffff";
    context.lineWidth = Math.max(2, Math.round(targetWidth / 500));
    context.setLineDash([8, 6]);
    context.strokeRect(1, top, targetWidth - 2, Math.max(1, bottom - top));
    context.restore();
  }

  function updateDimensions(geometry) {
    const original = `${formatNumber(geometry.width)} × ${formatNumber(geometry.height)}px`;
    const result = `${formatNumber(geometry.width)} × ${formatNumber(geometry.outputHeight)}px`;
    elements.dimensionText.textContent = `元画像 ${original}　保存画像 ${result}`;
  }

  function renderPreviewNow() {
    state.renderFrame = null;

    if (!state.image) {
      return;
    }

    try {
      const settings = getSettings();
      const geometry = calculateGeometry(state.sourceWidth, state.sourceHeight, settings);
      const mode = getPreviewMode();
      const previewHeight = mode === "result" ? geometry.outputHeight : geometry.height;
      const previewSize = getPreviewSize(geometry.width, previewHeight);
      const context = prepareCanvas(previewSize.width, previewSize.height);

      if (mode === "result") {
        drawStretchedImage(
          context,
          state.image,
          geometry,
          previewSize.width,
          previewSize.height
        );
        elements.modeLabel.textContent = "仕上がり確認";
      } else {
        drawSelectionPreview(context, geometry, previewSize.width, previewSize.height);
        elements.modeLabel.textContent = "範囲確認";
      }

      updateDimensions(geometry);
      elements.emptyPreview.hidden = true;
      elements.canvas.hidden = false;
    } catch (error) {
      handleError(error, "プレビューを更新できませんでした。");
    }
  }

  // スライダー操作が続いても、1画面更新につき1回だけ再描画します。
  function scheduleRender() {
    if (state.renderFrame !== null) {
      cancelAnimationFrame(state.renderFrame);
    }
    state.renderFrame = requestAnimationFrame(renderPreviewNow);
  }

  // 画像を展開する前に、形式とファイル容量を検証します。
  function validateFile(file) {
    if (!file) {
      throw new Error("画像ファイルが選ばれていません。");
    }
    if (!SUPPORTED_TYPES.has(file.type)) {
      throw new Error("JPEG、PNG、WebP形式の画像を選んでください。");
    }
    if (file.size <= 0) {
      throw new Error("空のファイルは読み込めません。");
    }
    if (file.size > LIMITS.maxFileBytes) {
      throw new Error(
        `画像の容量が大きすぎます。${formatBytes(LIMITS.maxFileBytes)}以下の画像を選んでください。`
      );
    }
  }

  function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("画像を読み込めませんでした。ファイルが壊れていないか確認してください。"));
      image.src = url;
    });
  }

  function validateImageDimensions(image) {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const pixels = width * height;

    if (!Number.isSafeInteger(pixels) || width <= 0 || height <= 0) {
      throw new Error("画像の大きさを確認できませんでした。別の画像を選んでください。");
    }
    if (width > LIMITS.maxSourceDimension || height > LIMITS.maxSourceDimension) {
      throw new Error(
        `画像の縦または横が大きすぎます。${formatNumber(LIMITS.maxSourceDimension)}px以下にしてください。`
      );
    }
    if (pixels > LIMITS.maxSourcePixels) {
      throw new Error(
        `画像の画素数が大きすぎます。${formatNumber(LIMITS.maxSourcePixels)}画素以下に縮小してください。`
      );
    }

    return { width, height };
  }

  function selectDefaultOutputFormat(fileType) {
    if (SUPPORTED_TYPES.has(fileType)) {
      elements.outputFormat.value = fileType;
    } else {
      elements.outputFormat.value = "image/png";
    }
  }

  // 新しい画像を読み込み、成功した場合だけ現在の画像と入れ替えます。
  async function handleFileSelection() {
    const file = elements.imageInput.files ? elements.imageInput.files[0] : null;

    try {
      validateFile(file);
      setStatus("画像を読み込んでいます。", "info");
      setEditorEnabled(false);

      const nextUrl = URL.createObjectURL(file);
      let nextImage;

      try {
        nextImage = await loadImageFromUrl(nextUrl);
        const dimensions = validateImageDimensions(nextImage);

        releaseCurrentImage();
        state.image = nextImage;
        state.objectUrl = nextUrl;
        state.fileName = file.name;
        state.sourceWidth = dimensions.width;
        state.sourceHeight = dimensions.height;
      } catch (error) {
        URL.revokeObjectURL(nextUrl);
        throw error;
      }

      resetSettings(false);
      selectDefaultOutputFormat(file.type);
      setEditorEnabled(true);
      setStatus("画像を読み込みました。範囲を調整してください。", "success");
      scheduleRender();
    } catch (error) {
      elements.imageInput.value = "";
      setEditorEnabled(Boolean(state.image));
      handleError(error, "画像を読み込めませんでした。");
    }
  }

  function resetSettings(announce = true) {
    elements.rangeStart.value = String(DEFAULTS.startPercent);
    elements.rangeEnd.value = String(DEFAULTS.endPercent);
    elements.stretchAmount.value = String(DEFAULTS.stretchPercent);

    const defaultMode = document.querySelector(
      `input[name="preview-mode"][value="${DEFAULTS.previewMode}"]`
    );
    if (defaultMode) {
      defaultMode.checked = true;
    }

    updateControlOutputs();
    if (announce && state.image) {
      setStatus("編集設定を初期状態に戻しました。", "success");
      scheduleRender();
    }
  }

  function releaseCurrentImage() {
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
    }
    state.image = null;
    state.objectUrl = null;
    state.fileName = "image";
    state.sourceWidth = 0;
    state.sourceHeight = 0;
  }

  function clearImage() {
    releaseCurrentImage();
    elements.imageInput.value = "";
    elements.canvas.hidden = true;
    elements.emptyPreview.hidden = false;
    elements.dimensionText.textContent = "画像はまだ選ばれていません";
    elements.modeLabel.textContent = "範囲確認";
    setEditorEnabled(false);
    resetSettings(false);
    setStatus("画像を外しました。新しい画像を選べます。", "success");
  }

  function validateOutputGeometry(geometry) {
    const outputPixels = geometry.width * geometry.outputHeight;

    if (
      geometry.width > LIMITS.maxOutputDimension ||
      geometry.outputHeight > LIMITS.maxOutputDimension
    ) {
      throw new Error(
        `保存後の縦または横が${formatNumber(LIMITS.maxOutputDimension)}pxを超えます。伸ばす量を小さくしてください。`
      );
    }
    if (!Number.isSafeInteger(outputPixels) || outputPixels > LIMITS.maxOutputPixels) {
      throw new Error(
        `保存後の画像が大きすぎます。伸ばす量を小さくするか、元画像を縮小してください。`
      );
    }
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("画像データを作成できませんでした。別の保存形式をお試しください。"));
          }
        },
        type,
        quality
      );
    });
  }

  function buildDownloadName(originalName, mimeType) {
    const extensionMap = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp"
    };
    const extension = extensionMap[mimeType] || "png";
    const withoutExtension = originalName.replace(/\.[^.]+$/, "");
    const safeBase = withoutExtension
      .normalize("NFKC")
      .replace(/[\\/:*?"<>|\u0000-\u001F]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "image";

    return `${safeBase}-stretched.${extension}`;
  }

  // 保存時だけ元画像サイズのCanvasを作り、通常操作時のメモリ使用量を抑えます。
  async function downloadImage() {
    if (!state.image || state.isDownloading) {
      return;
    }

    state.isDownloading = true;
    setEditorEnabled(true);
    setStatus("保存用の画像を作成しています。", "info");

    try {
      const settings = getSettings();
      const geometry = calculateGeometry(state.sourceWidth, state.sourceHeight, settings);
      validateOutputGeometry(geometry);

      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = geometry.width;
      outputCanvas.height = geometry.outputHeight;

      const context = outputCanvas.getContext("2d", { alpha: true });
      if (!context) {
        throw new Error("保存機能を利用できません。別のブラウザでお試しください。");
      }

      const mimeType = elements.outputFormat.value;
      if (mimeType === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      drawStretchedImage(
        context,
        state.image,
        geometry,
        outputCanvas.width,
        outputCanvas.height
      );

      const quality = mimeType === "image/png" ? undefined : 0.92;
      const blob = await canvasToBlob(outputCanvas, mimeType, quality);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = buildDownloadName(state.fileName, mimeType);
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);

      setStatus("画像を保存しました。ブラウザのダウンロード一覧をご確認ください。", "success");
    } catch (error) {
      handleError(error, "画像を保存できませんでした。");
    } finally {
      state.isDownloading = false;
      setEditorEnabled(Boolean(state.image));
    }
  }

  function handleError(error, fallbackMessage) {
    const message = error instanceof Error && error.message ? error.message : fallbackMessage;
    setStatus(message, "error");
    console.error(fallbackMessage, error);
  }

  function handleRangeInput(changedControl) {
    normalizeRange(changedControl);
    updateControlOutputs();
    scheduleRender();
  }

  function bindEvents() {
    elements.imageInput.addEventListener("change", handleFileSelection);
    elements.rangeStart.addEventListener("input", () => handleRangeInput("start"));
    elements.rangeEnd.addEventListener("input", () => handleRangeInput("end"));
    elements.stretchAmount.addEventListener("input", () => {
      updateControlOutputs();
      scheduleRender();
    });
    elements.viewControls.addEventListener("change", scheduleRender);
    elements.resetButton.addEventListener("click", () => resetSettings(true));
    elements.clearButton.addEventListener("click", clearImage);
    elements.downloadButton.addEventListener("click", downloadImage);
    window.addEventListener("beforeunload", releaseCurrentImage, { once: true });
  }

  // 必要なブラウザ機能を確認してから操作を有効にします。
  function initialize() {
    if (!elements.canvas.getContext) {
      setStatus("このブラウザでは画像編集機能を利用できません。", "error");
      return;
    }
    updateControlOutputs();
    setEditorEnabled(false);
    bindEvents();
  }

  initialize();
})();
