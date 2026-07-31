(function () {
  "use strict";

  const Core = globalThis.LocalTransformCore;
  const Render = globalThis.LocalTransformRender;
  if (!Core || !Render) {
    throw new Error("必要なプログラムを読み込めませんでした。");
  }

  const STORAGE_KEY = "pixel-reframe-lab-settings-v1";
  const elements = {
    imageInput: document.querySelector("#image-input"),
    recipeInput: document.querySelector("#recipe-input"),
    dropZone: document.querySelector("#drop-zone"),
    status: document.querySelector("#status"),
    deviceProfile: document.querySelector("#device-profile"),
    presetControls: document.querySelector("#preset-controls"),
    sliceControls: document.querySelector("#slice-controls"),
    paddingControls: document.querySelector("#padding-controls"),
    geometryControls: document.querySelector("#geometry-controls"),
    outputControls: document.querySelector("#output-controls"),
    undoButton: document.querySelector("#undo-button"),
    redoButton: document.querySelector("#redo-button"),
    resetButton: document.querySelector("#reset-button"),
    clearButton: document.querySelector("#clear-button"),
    operationMode: document.querySelector("#operation-mode"),
    rangeStart: document.querySelector("#range-start"),
    rangeEnd: document.querySelector("#range-end"),
    amountPercent: document.querySelector("#amount-percent"),
    featherPercent: document.querySelector("#feather-percent"),
    rangeStartOutput: document.querySelector("#range-start-output"),
    rangeEndOutput: document.querySelector("#range-end-output"),
    amountOutput: document.querySelector("#amount-output"),
    amountLabel: document.querySelector("#amount-label"),
    amountHelp: document.querySelector("#amount-help"),
    featherOutput: document.querySelector("#feather-output"),
    paddingTop: document.querySelector("#padding-top"),
    paddingRight: document.querySelector("#padding-right"),
    paddingBottom: document.querySelector("#padding-bottom"),
    paddingLeft: document.querySelector("#padding-left"),
    paddingTopOutput: document.querySelector("#padding-top-output"),
    paddingRightOutput: document.querySelector("#padding-right-output"),
    paddingBottomOutput: document.querySelector("#padding-bottom-output"),
    paddingLeftOutput: document.querySelector("#padding-left-output"),
    linkPadding: document.querySelector("#link-padding"),
    paddingMode: document.querySelector("#padding-mode"),
    paddingColor: document.querySelector("#padding-color"),
    paddingColorRow: document.querySelector("#padding-color-row"),
    rotateLeft: document.querySelector("#rotate-left"),
    rotateRight: document.querySelector("#rotate-right"),
    flipX: document.querySelector("#flip-x"),
    flipY: document.querySelector("#flip-y"),
    cropTop: document.querySelector("#crop-top"),
    cropRight: document.querySelector("#crop-right"),
    cropBottom: document.querySelector("#crop-bottom"),
    cropLeft: document.querySelector("#crop-left"),
    cropTopOutput: document.querySelector("#crop-top-output"),
    cropRightOutput: document.querySelector("#crop-right-output"),
    cropBottomOutput: document.querySelector("#crop-bottom-output"),
    cropLeftOutput: document.querySelector("#crop-left-output"),
    outputFormat: document.querySelector("#output-format"),
    outputQuality: document.querySelector("#output-quality"),
    qualityOutput: document.querySelector("#quality-output"),
    qualityRow: document.querySelector("#quality-row"),
    outputMaxDimension: document.querySelector("#output-max-dimension"),
    downloadButton: document.querySelector("#download-button"),
    shareButton: document.querySelector("#share-button"),
    recipeDownload: document.querySelector("#recipe-download"),
    compareButton: document.querySelector("#compare-button"),
    canvasShell: document.querySelector("#canvas-shell"),
    canvas: document.querySelector("#preview-canvas"),
    emptyPreview: document.querySelector("#empty-preview"),
    dimensionText: document.querySelector("#dimension-text"),
    canvasHelp: document.querySelector("#canvas-help")
  };

  const profile = Core.getDeviceProfile(navigator, screen);
  const state = {
    image: null,
    objectUrl: null,
    fileName: "image",
    sourceWidth: 0,
    sourceHeight: 0,
    settings: loadSavedSettings(),
    history: [],
    historyIndex: -1,
    renderFrame: null,
    loadToken: 0,
    exporting: false,
    comparing: false,
    dragHandle: null
  };

  const settingInputs = [
    [elements.rangeStart, "startPercent"],
    [elements.rangeEnd, "endPercent"],
    [elements.amountPercent, "amountPercent"],
    [elements.featherPercent, "featherPercent"],
    [elements.paddingTop, "paddingTop"],
    [elements.paddingRight, "paddingRight"],
    [elements.paddingBottom, "paddingBottom"],
    [elements.paddingLeft, "paddingLeft"],
    [elements.cropTop, "cropTop"],
    [elements.cropRight, "cropRight"],
    [elements.cropBottom, "cropBottom"],
    [elements.cropLeft, "cropLeft"],
    [elements.outputQuality, "outputQuality", 0.01],
    [elements.outputMaxDimension, "outputMaxDimension"]
  ];

  function loadSavedSettings() {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      return text ? Core.normalizeSettings(JSON.parse(text)) : Core.normalizeSettings(Core.DEFAULTS);
    } catch (error) {
      return Core.normalizeSettings(Core.DEFAULTS);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
    } catch (error) {
      console.info("設定を端末へ保存できませんでした。", error);
    }
  }

  function setStatus(message, kind) {
    elements.status.textContent = message;
    if (!kind || kind === "info") {
      elements.status.removeAttribute("data-kind");
    } else {
      elements.status.dataset.kind = kind;
    }
  }

  function setEnabled(enabled) {
    for (const fieldset of [elements.presetControls, elements.sliceControls, elements.paddingControls, elements.geometryControls, elements.outputControls]) {
      fieldset.disabled = !enabled;
    }
    elements.undoButton.disabled = !enabled || state.historyIndex <= 0;
    elements.redoButton.disabled = !enabled || state.historyIndex >= state.history.length - 1;
    elements.resetButton.disabled = !enabled;
    elements.clearButton.disabled = !enabled;
    elements.compareButton.disabled = !enabled;
    elements.downloadButton.disabled = !enabled || state.exporting;
    elements.shareButton.disabled = !enabled || state.exporting;
  }

  function updateHistoryButtons() {
    elements.undoButton.disabled = !state.image || state.historyIndex <= 0;
    elements.redoButton.disabled = !state.image || state.historyIndex >= state.history.length - 1;
  }

  function snapshot(settings) {
    return JSON.stringify(Core.normalizeSettings(settings));
  }

  function commitHistory(announce) {
    state.settings = Core.normalizeSettings(state.settings);
    const current = snapshot(state.settings);
    if (state.history[state.historyIndex] === current) {
      saveSettings();
      return;
    }
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(current);
    if (state.history.length > Core.LIMITS.historyLength) {
      state.history.shift();
    }
    state.historyIndex = state.history.length - 1;
    updateHistoryButtons();
    saveSettings();
    if (announce) {
      setStatus(announce, "success");
    }
  }

  function restoreHistory(index) {
    if (index < 0 || index >= state.history.length) {
      return;
    }
    state.historyIndex = index;
    state.settings = Core.normalizeSettings(JSON.parse(state.history[index]));
    applySettingsToControls();
    updateHistoryButtons();
    saveSettings();
    scheduleRender();
  }

  function normalizeCurrentSettings() {
    state.settings = Core.normalizeSettings(state.settings);
  }

  function applySettingsToControls() {
    normalizeCurrentSettings();
    const settings = state.settings;
    const axis = document.querySelector(`input[name="axis"][value="${settings.axis}"]`);
    const previewMode = document.querySelector(`input[name="preview-mode"][value="${settings.previewMode}"]`);
    if (axis) axis.checked = true;
    if (previewMode) previewMode.checked = true;

    elements.operationMode.value = settings.mode;
    elements.rangeStart.value = String(settings.startPercent);
    elements.rangeEnd.value = String(settings.endPercent);
    elements.amountPercent.value = String(settings.amountPercent);
    elements.featherPercent.value = String(settings.featherPercent);
    elements.paddingTop.value = String(settings.paddingTop);
    elements.paddingRight.value = String(settings.paddingRight);
    elements.paddingBottom.value = String(settings.paddingBottom);
    elements.paddingLeft.value = String(settings.paddingLeft);
    elements.paddingMode.value = settings.paddingMode;
    elements.paddingColor.value = settings.paddingColor;
    elements.cropTop.value = String(settings.cropTop);
    elements.cropRight.value = String(settings.cropRight);
    elements.cropBottom.value = String(settings.cropBottom);
    elements.cropLeft.value = String(settings.cropLeft);
    elements.outputFormat.value = settings.outputFormat;
    elements.outputQuality.value = String(Math.round(settings.outputQuality * 100));
    elements.outputMaxDimension.value = String(settings.outputMaxDimension);
    elements.flipX.setAttribute("aria-pressed", String(settings.flipX));
    elements.flipY.setAttribute("aria-pressed", String(settings.flipY));
    updateDynamicControls();
    updateOutputs();
  }

  function updateDynamicControls() {
    const mode = state.settings.mode;
    elements.amountPercent.disabled = mode === "remove";
    if (mode === "offset") {
      elements.amountPercent.min = "-100";
      elements.amountPercent.max = "100";
      elements.amountLabel.textContent = "移動量";
      elements.amountHelp.textContent = "選択帯を直角方向へ循環移動します。";
    } else if (mode === "compress") {
      elements.amountPercent.min = "0";
      elements.amountPercent.max = "95";
      elements.amountLabel.textContent = "縮める量";
      elements.amountHelp.textContent = "100%に近いほど帯が細くなります。";
    } else if (mode === "remove") {
      elements.amountPercent.min = "0";
      elements.amountPercent.max = "100";
      elements.amountLabel.textContent = "削除";
      elements.amountHelp.textContent = "選択した帯を取り除き、前後を接続します。";
    } else {
      elements.amountPercent.min = "0";
      elements.amountPercent.max = "300";
      elements.amountLabel.textContent = mode === "smear" ? "引き伸ばす量" : "追加量";
      elements.amountHelp.textContent = "選択した帯の長さに対する追加量です。";
    }
    elements.paddingColorRow.hidden = state.settings.paddingMode !== "solid";
    elements.qualityRow.hidden = state.settings.outputFormat === "image/png";
  }

  function formatPercent(value) {
    const number = Number(value);
    return `${Number.isInteger(number) ? number : number.toFixed(1)}%`;
  }

  function updateOutputs() {
    const settings = state.settings;
    elements.rangeStartOutput.textContent = formatPercent(settings.startPercent);
    elements.rangeEndOutput.textContent = formatPercent(settings.endPercent);
    elements.amountOutput.textContent = formatPercent(settings.amountPercent);
    elements.featherOutput.textContent = formatPercent(settings.featherPercent);
    elements.paddingTopOutput.textContent = formatPercent(settings.paddingTop);
    elements.paddingRightOutput.textContent = formatPercent(settings.paddingRight);
    elements.paddingBottomOutput.textContent = formatPercent(settings.paddingBottom);
    elements.paddingLeftOutput.textContent = formatPercent(settings.paddingLeft);
    elements.cropTopOutput.textContent = formatPercent(settings.cropTop);
    elements.cropRightOutput.textContent = formatPercent(settings.cropRight);
    elements.cropBottomOutput.textContent = formatPercent(settings.cropBottom);
    elements.cropLeftOutput.textContent = formatPercent(settings.cropLeft);
    elements.qualityOutput.textContent = formatPercent(Math.round(settings.outputQuality * 100));
  }

  function updateSetting(key, value, options) {
    const opts = options || {};
    state.settings[key] = value;
    if (opts.linkPadding && elements.linkPadding.checked) {
      for (const paddingKey of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]) {
        state.settings[paddingKey] = value;
      }
    }
    normalizeCurrentSettings();
    applySettingsToControls();
    scheduleRender();
    if (opts.commit) {
      commitHistory();
    }
  }

  function getPreviewMaximumDimension() {
    const width = Math.max(280, elements.canvasShell.clientWidth - 32);
    const height = Math.max(240, Math.min(window.innerHeight * 0.72, 900));
    return Math.min(profile.previewDimension, Math.max(width, height));
  }

  function drawToPreview(sourceCanvas) {
    elements.canvas.width = sourceCanvas.width;
    elements.canvas.height = sourceCanvas.height;
    const context = elements.canvas.getContext("2d", { alpha: true });
    if (!context) {
      throw new Error("プレビュー機能を利用できません。");
    }
    context.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    context.drawImage(sourceCanvas, 0, 0);
    elements.emptyPreview.hidden = true;
    elements.canvas.hidden = false;
  }

  function renderPreviewNow() {
    state.renderFrame = null;
    if (!state.image) {
      return;
    }

    try {
      const maximumDimension = getPreviewMaximumDimension();
      let rendered;
      if (state.comparing) {
        rendered = Render.renderSelection(state.image, state.sourceWidth, state.sourceHeight, state.settings, maximumDimension, false);
      } else if (state.settings.previewMode === "selection") {
        rendered = Render.renderSelection(state.image, state.sourceWidth, state.sourceHeight, state.settings, maximumDimension, true);
      } else {
        rendered = Render.renderResult(state.image, state.sourceWidth, state.sourceHeight, state.settings, {
          maximumDimension,
          pixelLimit: Math.min(profile.exportPixelLimit, 4_000_000)
        });
      }
      drawToPreview(rendered.canvas);

      const geometry = Core.computeGeometry(state.sourceWidth, state.sourceHeight, state.settings);
      const originalText = `${geometry.sourceWidth.toLocaleString("ja-JP")} × ${geometry.sourceHeight.toLocaleString("ja-JP")}px`;
      const outputText = `${geometry.outputWidth.toLocaleString("ja-JP")} × ${geometry.outputHeight.toLocaleString("ja-JP")}px`;
      elements.dimensionText.textContent = `元画像 ${originalText}　出力予定 ${outputText}`;
      elements.canvasHelp.textContent = state.settings.previewMode === "selection"
        ? "白い枠の辺を指やマウスで動かせます。"
        : "範囲を調整するときは、範囲表示へ切り替えてください。";
    } catch (error) {
      handleError(error, "プレビューを更新できませんでした。");
    }
  }

  function scheduleRender() {
    if (!state.image) {
      return;
    }
    if (state.renderFrame !== null) {
      cancelAnimationFrame(state.renderFrame);
    }
    state.renderFrame = requestAnimationFrame(renderPreviewNow);
  }

  function handleError(error, fallback) {
    const message = error instanceof Error && error.message ? error.message : fallback;
    setStatus(message, "error");
    console.error(fallback, error);
  }

  function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("画像を復号できませんでした。ファイルが壊れていないか確認してください。"));
      image.src = url;
    });
  }

  function releaseImage() {
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
    }
    state.image = null;
    state.objectUrl = null;
    state.fileName = "image";
    state.sourceWidth = 0;
    state.sourceHeight = 0;
  }

  async function loadFile(file) {
    const token = ++state.loadToken;
    try {
      setStatus("画像の実データを確認しています。", "info");
      setEnabled(false);
      const buffer = await file.arrayBuffer();
      const header = Core.inspectImageHeader(buffer);
      Core.validateFileMetadata(file, header);
      if (token !== state.loadToken) return;

      const nextUrl = URL.createObjectURL(file);
      let nextImage;
      try {
        nextImage = await loadImageFromUrl(nextUrl);
      } catch (error) {
        URL.revokeObjectURL(nextUrl);
        throw error;
      }
      if (token !== state.loadToken) {
        URL.revokeObjectURL(nextUrl);
        return;
      }

      const pixels = nextImage.naturalWidth * nextImage.naturalHeight;
      if (nextImage.naturalWidth <= 0 || nextImage.naturalHeight <= 0 || pixels > Core.LIMITS.maxSourcePixels) {
        URL.revokeObjectURL(nextUrl);
        throw new Error("復号後の画像サイズが安全上限を超えています。");
      }

      releaseImage();
      state.image = nextImage;
      state.objectUrl = nextUrl;
      state.fileName = file.name || "image";
      state.sourceWidth = nextImage.naturalWidth;
      state.sourceHeight = nextImage.naturalHeight;
      state.settings = Core.normalizeSettings(Object.assign({}, state.settings, {
        outputFormat: header.mimeType
      }));
      state.history = [snapshot(state.settings)];
      state.historyIndex = 0;
      applySettingsToControls();
      setEnabled(true);
      setStatus("画像を読み込みました。目的または変形方法を選んでください。", "success");
      scheduleRender();
    } catch (error) {
      elements.imageInput.value = "";
      setEnabled(Boolean(state.image));
      handleError(error, "画像を読み込めませんでした。");
    }
  }

  function clearImage() {
    state.loadToken += 1;
    releaseImage();
    state.history = [];
    state.historyIndex = -1;
    elements.imageInput.value = "";
    elements.canvas.width = 1;
    elements.canvas.height = 1;
    elements.canvas.hidden = true;
    elements.emptyPreview.hidden = false;
    elements.dimensionText.textContent = "画像はまだ選ばれていません";
    setEnabled(false);
    setStatus("画像を外しました。新しい画像を選べます。", "success");
  }

  const presets = {
    headroom: { axis: "vertical", mode: "smear", startPercent: 2, endPercent: 8, amountPercent: 40, paddingTop: 28, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, paddingMode: "edge" },
    "side-space": { axis: "horizontal", mode: "stretch", startPercent: 40, endPercent: 60, amountPercent: 0, paddingTop: 0, paddingRight: 24, paddingBottom: 0, paddingLeft: 24, paddingMode: "mirror" },
    "remove-strip": { axis: "vertical", mode: "remove", startPercent: 42, endPercent: 58, amountPercent: 100, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
    "mirror-texture": { axis: "horizontal", mode: "mirror", startPercent: 30, endPercent: 55, amountPercent: 180, featherPercent: 0, paddingMode: "mirror" },
    "compress-center": { axis: "vertical", mode: "compress", startPercent: 28, endPercent: 72, amountPercent: 45, featherPercent: 1.5 },
    "glitch-shift": { axis: "vertical", mode: "offset", startPercent: 38, endPercent: 55, amountPercent: 18, featherPercent: 0 }
  };

  function applyPreset(name) {
    const preset = presets[name];
    if (!preset) return;
    state.settings = Core.normalizeSettings(Object.assign({}, state.settings, preset));
    applySettingsToControls();
    commitHistory("目的別の設定を適用しました。必要な範囲だけ調整してください。");
    scheduleRender();
  }

  function undo() {
    restoreHistory(state.historyIndex - 1);
    setStatus("1つ前の設定へ戻しました。", "success");
  }

  function redo() {
    restoreHistory(state.historyIndex + 1);
    setStatus("取り消した設定をやり直しました。", "success");
  }

  function resetSettings() {
    state.settings = Core.normalizeSettings(Core.DEFAULTS);
    applySettingsToControls();
    commitHistory("編集設定を初期状態へ戻しました。");
    scheduleRender();
  }

  function rotate(delta) {
    state.settings.rotation = (state.settings.rotation + delta + 360) % 360;
    normalizeCurrentSettings();
    applySettingsToControls();
    commitHistory();
    scheduleRender();
  }

  function toggleFlip(key, button) {
    state.settings[key] = !state.settings[key];
    button.setAttribute("aria-pressed", String(state.settings[key]));
    commitHistory();
    scheduleRender();
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("画像データを作成できませんでした。"));
      }, type, quality);
    });
  }

  async function createOutputBlob() {
    const geometry = Core.computeGeometry(state.sourceWidth, state.sourceHeight, state.settings);
    Core.validateGeometry(geometry, Core.LIMITS.maxOutputDimension, profile.exportPixelLimit);
    const result = Render.renderResult(state.image, state.sourceWidth, state.sourceHeight, state.settings, {
      maximumDimension: state.settings.outputMaxDimension,
      pixelLimit: profile.exportPixelLimit
    });
    let exportCanvas = result.canvas;
    if (state.settings.outputFormat === "image/jpeg") {
      const flattened = document.createElement("canvas");
      flattened.width = exportCanvas.width;
      flattened.height = exportCanvas.height;
      const context = flattened.getContext("2d", { alpha: false });
      context.fillStyle = state.settings.paddingColor || "#ffffff";
      context.fillRect(0, 0, flattened.width, flattened.height);
      context.drawImage(exportCanvas, 0, 0);
      exportCanvas = flattened;
    }
    const quality = state.settings.outputFormat === "image/png" ? undefined : state.settings.outputQuality;
    const blob = await canvasToBlob(exportCanvas, state.settings.outputFormat, quality);
    if (blob.type && blob.type !== state.settings.outputFormat) {
      throw new Error("このブラウザは選択した保存形式に対応していません。別の形式を選んでください。");
    }
    exportCanvas.width = 1;
    exportCanvas.height = 1;
    return blob;
  }

  async function withOutputBlob(actionName, handler) {
    if (!state.image || state.exporting) return;
    state.exporting = true;
    setEnabled(true);
    setStatus(`${actionName}用の画像を作成しています。`, "info");
    try {
      const blob = await createOutputBlob();
      await handler(blob);
      setStatus(`${actionName}が完了しました。画像の位置情報などの付加情報は引き継いでいません。`, "success");
    } catch (error) {
      handleError(error, `${actionName}に失敗しました。`);
    } finally {
      state.exporting = false;
      setEnabled(Boolean(state.image));
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function downloadImage() {
    withOutputBlob("保存", async (blob) => {
      downloadBlob(blob, Core.buildDownloadName(state.fileName, blob.type || state.settings.outputFormat));
    });
  }

  function shareImage() {
    withOutputBlob("共有", async (blob) => {
      const file = new File([blob], Core.buildDownloadName(state.fileName, blob.type), { type: blob.type });
      if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
        throw new Error("この端末では画像ファイルの共有を利用できません。保存を使用してください。");
      }
      await navigator.share({ files: [file], title: "Pixel Reframe Lab" });
    });
  }

  function downloadRecipe() {
    const blob = new Blob([Core.serializeRecipe(state.settings)], { type: "application/json" });
    downloadBlob(blob, "pixel-reframe-recipe.json");
    setStatus("設定レシピを保存しました。画像データは含まれていません。", "success");
  }

  async function importRecipe(file) {
    try {
      if (!file || file.size > 64 * 1024) {
        throw new Error("レシピファイルは64KB以下にしてください。");
      }
      state.settings = Core.parseRecipe(await file.text());
      applySettingsToControls();
      commitHistory("設定レシピを読み込みました。");
      scheduleRender();
    } catch (error) {
      handleError(error, "設定レシピを読み込めませんでした。");
    } finally {
      elements.recipeInput.value = "";
    }
  }

  function beginCompare() {
    if (!state.image) return;
    state.comparing = true;
    scheduleRender();
  }

  function endCompare() {
    if (!state.comparing) return;
    state.comparing = false;
    scheduleRender();
  }

  function getCanvasCoordinate(event) {
    const rect = elements.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * elements.canvas.width / rect.width,
      y: (event.clientY - rect.top) * elements.canvas.height / rect.height,
      cssScaleX: elements.canvas.width / rect.width,
      cssScaleY: elements.canvas.height / rect.height
    };
  }

  function beginRangeDrag(event) {
    if (!state.image || state.settings.previewMode !== "selection" || elements.canvas.hidden) return;
    const point = getCanvasCoordinate(event);
    const axisLength = state.settings.axis === "vertical" ? elements.canvas.height : elements.canvas.width;
    const coordinate = state.settings.axis === "vertical" ? point.y : point.x;
    const start = axisLength * state.settings.startPercent / 100;
    const end = axisLength * state.settings.endPercent / 100;
    const threshold = 30 * (state.settings.axis === "vertical" ? point.cssScaleY : point.cssScaleX);
    state.dragHandle = Math.abs(coordinate - start) <= Math.abs(coordinate - end) ? "startPercent" : "endPercent";
    if (Math.min(Math.abs(coordinate - start), Math.abs(coordinate - end)) > threshold) {
      state.dragHandle = coordinate < (start + end) / 2 ? "startPercent" : "endPercent";
    }
    elements.canvas.setPointerCapture(event.pointerId);
    moveRangeDrag(event);
  }

  function moveRangeDrag(event) {
    if (!state.dragHandle) return;
    const point = getCanvasCoordinate(event);
    const axisLength = state.settings.axis === "vertical" ? elements.canvas.height : elements.canvas.width;
    const coordinate = state.settings.axis === "vertical" ? point.y : point.x;
    const percent = Core.clamp(coordinate / axisLength * 100, 0, 100);
    if (state.dragHandle === "startPercent") {
      state.settings.startPercent = Math.min(percent, state.settings.endPercent - Core.LIMITS.minimumBandPercent);
    } else {
      state.settings.endPercent = Math.max(percent, state.settings.startPercent + Core.LIMITS.minimumBandPercent);
    }
    normalizeCurrentSettings();
    applySettingsToControls();
    scheduleRender();
  }

  function endRangeDrag() {
    if (!state.dragHandle) return;
    state.dragHandle = null;
    commitHistory();
  }

  function handleKeyboard(event) {
    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier) return;
    const key = event.key.toLowerCase();
    if (key === "z" && event.shiftKey) {
      event.preventDefault();
      redo();
    } else if (key === "z") {
      event.preventDefault();
      undo();
    } else if (key === "y") {
      event.preventDefault();
      redo();
    } else if (key === "s" && state.image) {
      event.preventDefault();
      downloadImage();
    }
  }

  function bindEvents() {
    elements.imageInput.addEventListener("change", () => {
      const file = elements.imageInput.files && elements.imageInput.files[0];
      if (file) loadFile(file);
    });

    elements.dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      elements.dropZone.dataset.dragging = "true";
    });
    elements.dropZone.addEventListener("dragleave", () => elements.dropZone.removeAttribute("data-dragging"));
    elements.dropZone.addEventListener("drop", (event) => {
      event.preventDefault();
      elements.dropZone.removeAttribute("data-dragging");
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) loadFile(file);
    });
    document.addEventListener("paste", (event) => {
      const items = event.clipboardData && event.clipboardData.items;
      if (!items) return;
      const imageItem = Array.from(items).find((item) => item.type.startsWith("image/"));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) loadFile(file);
      }
    });

    elements.undoButton.addEventListener("click", undo);
    elements.redoButton.addEventListener("click", redo);
    elements.resetButton.addEventListener("click", resetSettings);
    elements.clearButton.addEventListener("click", clearImage);

    document.querySelectorAll("[data-preset]").forEach((button) => {
      button.addEventListener("click", () => applyPreset(button.dataset.preset));
    });

    document.querySelectorAll('input[name="axis"]').forEach((input) => {
      input.addEventListener("change", () => updateSetting("axis", input.value, { commit: true }));
    });
    document.querySelectorAll('input[name="preview-mode"]').forEach((input) => {
      input.addEventListener("change", () => updateSetting("previewMode", input.value, { commit: true }));
    });

    elements.operationMode.addEventListener("change", () => {
      state.settings.mode = elements.operationMode.value;
      if (state.settings.mode === "remove") state.settings.amountPercent = 100;
      if (state.settings.mode === "offset" && Math.abs(state.settings.amountPercent) > 100) state.settings.amountPercent = 20;
      normalizeCurrentSettings();
      applySettingsToControls();
      commitHistory();
      scheduleRender();
    });

    for (const [input, key, scale] of settingInputs) {
      input.addEventListener("input", () => {
        const value = Number(input.value) * (scale || 1);
        updateSetting(key, value, { linkPadding: key.startsWith("padding"), commit: false });
      });
      input.addEventListener("change", () => commitHistory());
    }

    elements.paddingMode.addEventListener("change", () => updateSetting("paddingMode", elements.paddingMode.value, { commit: true }));
    elements.paddingColor.addEventListener("input", () => updateSetting("paddingColor", elements.paddingColor.value));
    elements.paddingColor.addEventListener("change", () => commitHistory());
    elements.outputFormat.addEventListener("change", () => updateSetting("outputFormat", elements.outputFormat.value, { commit: true }));

    elements.rotateLeft.addEventListener("click", () => rotate(-90));
    elements.rotateRight.addEventListener("click", () => rotate(90));
    elements.flipX.addEventListener("click", () => toggleFlip("flipX", elements.flipX));
    elements.flipY.addEventListener("click", () => toggleFlip("flipY", elements.flipY));

    elements.downloadButton.addEventListener("click", downloadImage);
    elements.shareButton.addEventListener("click", shareImage);
    elements.recipeDownload.addEventListener("click", downloadRecipe);
    elements.recipeInput.addEventListener("change", () => {
      const file = elements.recipeInput.files && elements.recipeInput.files[0];
      if (file) importRecipe(file);
    });

    for (const eventName of ["pointerdown", "keydown"]) {
      elements.compareButton.addEventListener(eventName, (event) => {
        if (eventName === "keydown" && event.key !== " " && event.key !== "Enter") return;
        beginCompare();
      });
    }
    for (const eventName of ["pointerup", "pointercancel", "pointerleave", "keyup", "blur"]) {
      elements.compareButton.addEventListener(eventName, endCompare);
    }

    elements.canvas.addEventListener("pointerdown", beginRangeDrag);
    elements.canvas.addEventListener("pointermove", moveRangeDrag);
    elements.canvas.addEventListener("pointerup", endRangeDrag);
    elements.canvas.addEventListener("pointercancel", endRangeDrag);
    window.addEventListener("resize", scheduleRender);
    window.addEventListener("keydown", handleKeyboard);
    window.addEventListener("beforeunload", releaseImage, { once: true });
  }

  function initialize() {
    if (!elements.canvas.getContext) {
      setStatus("このブラウザでは画像編集機能を利用できません。", "error");
      return;
    }
    elements.deviceProfile.textContent = `端末向け設定: ${profile.name}、プレビュー最大${profile.previewDimension}px`;
    if (navigator.share && typeof File === "function") {
      elements.shareButton.hidden = false;
    }
    applySettingsToControls();
    setEnabled(false);
    bindEvents();
  }

  initialize();
})();
