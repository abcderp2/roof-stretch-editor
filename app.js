"use strict";

function updateSetting(key, value, options) {
  const opts = options || {}; state.settings[key] = value;
  if (opts.linkPadding && elements.linkPadding.checked) for (const paddingKey of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]) state.settings[paddingKey] = value;
  state.settings = Core.normalizeSettings(state.settings); applySettingsToControls(); scheduleRender(); if (opts.commit) commitHistory();
}
function getPreviewMaximumDimension() { const width = Math.max(260, Math.min(elements.beforeViewport.clientWidth, elements.afterViewport.clientWidth) - 24); return Math.min(profile.previewDimension, Math.max(320, width)); }
function drawCanvas(target, source) { target.width = source.width; target.height = source.height; const context = target.getContext("2d", { alpha: true }); if (!context) throw new Error("プレビュー機能を利用できません。"); context.clearRect(0, 0, target.width, target.height); context.drawImage(source, 0, 0); target.hidden = false; }
function applyZoom() {
  const scale = state.zoom / 100;
  for (const canvas of [elements.beforeCanvas, elements.afterCanvas]) { if (canvas.hidden) continue; canvas.style.width = `${Math.max(1, Math.round(canvas.width * scale))}px`; canvas.style.height = `${Math.max(1, Math.round(canvas.height * scale))}px`; }
  elements.zoomRange.value = String(state.zoom); elements.zoomOutput.textContent = `${state.zoom}%`;
}
function renderPreviewNow() {
  state.renderFrame = null; if (!state.image) return;
  try {
    const maximumDimension = getPreviewMaximumDimension(); const draft = readPatchDraft();
    const before = Render.renderOriginalPreview(state.image, state.sourceWidth, state.sourceHeight, maximumDimension, { selection: state.selection, patch: draft || (state.editingPatchId ? state.settings.patches.find((patch) => patch.id === state.editingPatchId) : null) });
    const previewSettings = getPreviewSettings();
    const after = Render.renderResult(state.image, state.sourceWidth, state.sourceHeight, previewSettings, { maximumDimension, pixelLimit: Math.min(profile.exportPixelLimit, 3_500_000) });
    drawCanvas(elements.beforeCanvas, before.canvas); drawCanvas(elements.afterCanvas, after.canvas);
    before.canvas.width = 1; before.canvas.height = 1; after.canvas.width = 1; after.canvas.height = 1;
    elements.beforeEmpty.hidden = true; elements.afterEmpty.hidden = true; applyZoom();
    const geometry = Core.computeGeometry(state.sourceWidth, state.sourceHeight, previewSettings);
    elements.dimensionText.textContent = `元画像 ${geometry.sourceWidth.toLocaleString("ja-JP")} × ${geometry.sourceHeight.toLocaleString("ja-JP")}px　出力予定 ${geometry.outputWidth.toLocaleString("ja-JP")} × ${geometry.outputHeight.toLocaleString("ja-JP")}px　部分修正 ${previewSettings.patches.length}個`;
  } catch (error) { handleError(error, "プレビューを更新できませんでした。"); }
}
function scheduleRender() { if (!state.image) return; if (state.renderFrame !== null) cancelAnimationFrame(state.renderFrame); state.renderFrame = requestAnimationFrame(renderPreviewNow); }
function handleError(error, fallback) { const message = error instanceof Error && error.message ? error.message : fallback; setStatus(message, "error"); console.error(fallback, error); }
function getCanvasPoint(event) { const rect = elements.beforeCanvas.getBoundingClientRect(); return { x: Core.clamp((event.clientX - rect.left) / rect.width * 100, 0, 100), y: Core.clamp((event.clientY - rect.top) / rect.height * 100, 0, 100) }; }
function beginSelection(event) {
  if (!state.image || elements.beforeCanvas.hidden || event.button > 0) return; const point = getCanvasPoint(event); state.dragStart = point;
  state.selection = { x: point.x, y: point.y, width: Core.LIMITS.minimumPatchPercent, height: Core.LIMITS.minimumPatchPercent };
  elements.beforeCanvas.setPointerCapture(event.pointerId); updateSelectionSummary(); updateEnabled(); scheduleRender();
}
function moveSelection(event) {
  if (!state.dragStart) return; const point = getCanvasPoint(event); const x = Math.min(state.dragStart.x, point.x); const y = Math.min(state.dragStart.y, point.y);
  const width = Math.max(Core.LIMITS.minimumPatchPercent, Math.abs(point.x - state.dragStart.x)); const height = Math.max(Core.LIMITS.minimumPatchPercent, Math.abs(point.y - state.dragStart.y));
  const normalized = Core.normalizePatch({ x, y, width, height }, 0); state.selection = { x: normalized.x, y: normalized.y, width: normalized.width, height: normalized.height };
  updateSelectionSummary(); updateEnabled(); scheduleRender();
}
function endSelection(event) {
  if (!state.dragStart) return; const wasTiny = state.selection.width < 2 || state.selection.height < 2;
  if (wasTiny) { const center = getCanvasPoint(event); state.selection = { x: Core.clamp(center.x - 6, 0, 88), y: Core.clamp(center.y - 6, 0, 88), width: 12, height: 12 }; }
  state.dragStart = null; updateSelectionSummary(); updateEnabled(); scheduleRender();
}
function handleKeyboard(event) {
  const targetName = event.target && event.target.tagName; const editingText = targetName === "INPUT" || targetName === "SELECT" || targetName === "TEXTAREA"; const modifier = event.ctrlKey || event.metaKey;
  if (modifier) { const key = event.key.toLowerCase(); if (key === "z" && event.shiftKey) { event.preventDefault(); redo(); } else if (key === "z") { event.preventDefault(); undo(); } else if (key === "y") { event.preventDefault(); redo(); } else if (key === "s" && state.image) { event.preventDefault(); downloadImage(); } return; }
  if (event.key === "Escape" && state.editingPatchId && !editingText) { state.selection = null; resetPatchForm(); applySettingsToControls(); scheduleRender(); }
}
function bindEvents() {
  elements.helpButton.addEventListener("click", () => { elements.helpPanel.hidden = !elements.helpPanel.hidden; elements.helpButton.setAttribute("aria-expanded", String(!elements.helpPanel.hidden)); });
  elements.helpClose.addEventListener("click", () => { elements.helpPanel.hidden = true; elements.helpButton.setAttribute("aria-expanded", "false"); elements.helpButton.focus(); });
  elements.sampleButton.addEventListener("click", loadSample);
  elements.imageInput.addEventListener("change", () => { const file = elements.imageInput.files && elements.imageInput.files[0]; if (file) loadFile(file); });
  elements.dropZone.addEventListener("dragover", (event) => { event.preventDefault(); elements.dropZone.dataset.dragging = "true"; });
  elements.dropZone.addEventListener("dragleave", () => elements.dropZone.removeAttribute("data-dragging"));
  elements.dropZone.addEventListener("drop", (event) => { event.preventDefault(); elements.dropZone.removeAttribute("data-dragging"); const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]; if (file) loadFile(file); });
  document.addEventListener("paste", (event) => { const items = event.clipboardData && event.clipboardData.items; if (!items) return; const imageItem = Array.from(items).find((item) => item.type.startsWith("image/")); const file = imageItem && imageItem.getAsFile(); if (file) loadFile(file); });
  elements.undoButton.addEventListener("click", undo); elements.redoButton.addEventListener("click", redo); elements.resetButton.addEventListener("click", resetSettings); elements.clearButton.addEventListener("click", clearImage);
  elements.patchMode.addEventListener("change", () => { updatePatchOptions(); scheduleRender(); });
  for (const input of [elements.selectionX, elements.selectionY, elements.selectionWidth, elements.selectionHeight]) { input.addEventListener("input", updateSelectionFromNumbers); input.addEventListener("change", updateSelectionFromNumbers); }
  for (const input of [elements.sourceOffsetX, elements.sourceOffsetY, elements.blurRadius, elements.blockSize, elements.patchOpacity, elements.patchColor]) input.addEventListener("input", () => { updatePatchOptions(); scheduleRender(); });
  elements.patchApply.addEventListener("click", applyPatchDraft);
  elements.patchCancelEdit.addEventListener("click", () => { state.selection = null; resetPatchForm(); applySettingsToControls(); scheduleRender(); });
  elements.patchDelete.addEventListener("click", deleteEditingPatch); elements.patchClearAll.addEventListener("click", clearAllPatches);
  document.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => applyPreset(button.dataset.preset)));
  document.querySelectorAll('input[name="axis"]').forEach((input) => input.addEventListener("change", () => updateSetting("axis", input.value, { commit: true })));
  elements.operationMode.addEventListener("change", () => { state.settings.mode = elements.operationMode.value; if (state.settings.mode === "remove") state.settings.amountPercent = 100; if (state.settings.mode === "offset" && Math.abs(state.settings.amountPercent) > 100) state.settings.amountPercent = 20; state.settings = Core.normalizeSettings(state.settings); applySettingsToControls(); commitHistory(); scheduleRender(); });
  for (const [input, key, scale] of settingInputs) { input.addEventListener("input", () => updateSetting(key, Number(input.value) * (scale || 1), { linkPadding: key.startsWith("padding") })); input.addEventListener("change", () => commitHistory()); }
  elements.paddingMode.addEventListener("change", () => updateSetting("paddingMode", elements.paddingMode.value, { commit: true })); elements.paddingColor.addEventListener("input", () => updateSetting("paddingColor", elements.paddingColor.value)); elements.paddingColor.addEventListener("change", () => commitHistory()); elements.outputFormat.addEventListener("change", () => updateSetting("outputFormat", elements.outputFormat.value, { commit: true }));
  elements.rotateLeft.addEventListener("click", () => rotate(-90)); elements.rotateRight.addEventListener("click", () => rotate(90)); elements.flipX.addEventListener("click", () => toggleFlip("flipX", elements.flipX)); elements.flipY.addEventListener("click", () => toggleFlip("flipY", elements.flipY));
  elements.downloadButton.addEventListener("click", downloadImage); elements.shareButton.addEventListener("click", shareImage); elements.recipeDownload.addEventListener("click", downloadRecipe);
  elements.recipeInput.addEventListener("change", () => { const file = elements.recipeInput.files && elements.recipeInput.files[0]; if (file) importRecipe(file); });
  elements.beforeCanvas.addEventListener("pointerdown", beginSelection); elements.beforeCanvas.addEventListener("pointermove", moveSelection); elements.beforeCanvas.addEventListener("pointerup", endSelection); elements.beforeCanvas.addEventListener("pointercancel", endSelection);
  elements.zoomRange.addEventListener("input", () => { state.zoom = Number(elements.zoomRange.value); applyZoom(); });
  elements.zoomFit.addEventListener("click", () => { state.zoom = 100; applyZoom(); elements.beforeViewport.scrollTo(0, 0); elements.afterViewport.scrollTo(0, 0); });
  window.addEventListener("resize", scheduleRender); window.addEventListener("keydown", handleKeyboard); window.addEventListener("beforeunload", releaseImage, { once: true });
}
function initialize() {
  if (!elements.beforeCanvas.getContext || !elements.afterCanvas.getContext) { setStatus("このブラウザでは画像編集機能を利用できません。", "error"); return; }
  elements.deviceProfile.textContent = `端末向け設定: ${profile.name}、プレビュー最大${profile.previewDimension}px`;
  if (navigator.share && typeof File === "function") elements.shareButton.hidden = false;
  applySettingsToControls(); updatePatchOptions(); updateEnabled(); bindEvents();
}
initialize();
