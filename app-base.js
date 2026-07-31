"use strict";

const Core = globalThis.LocalTransformCore;
const Render = globalThis.LocalTransformRender;
if (!Core || !Render) throw new Error("必要なプログラムを読み込めませんでした。");

const STORAGE_KEY = "pixel-reframe-lab-settings-v2";
const PATCH_LABELS = Object.freeze({
  clone: "近くの画素をコピー",
  "mirror-x": "左右反転",
  "mirror-y": "上下反転",
  blur: "ぼかし",
  mosaic: "モザイク",
  smear: "1列引き伸ばし",
  solid: "単色",
  transparent: "透明化"
});
const PATCH_HELP = Object.freeze({
  clone: "選択範囲と同じ大きさの画素を、指定した位置からコピーします。",
  "mirror-x": "選択範囲の近くを左右反転して貼り、左右対称の模様を作ります。",
  "mirror-y": "選択範囲の近くを上下反転して貼り、上下対称の模様を作ります。",
  blur: "選択範囲をぼかします。顔や文字を読みにくくする用途にも使えます。",
  mosaic: "選択範囲を粗い画素へ置き換えます。",
  smear: "コピー元の中央1列を横へ引き伸ばし、単純な背景を埋めます。",
  solid: "選択範囲を指定色で覆います。",
  transparent: "選択範囲を透明にします。PNGまたはWebP保存向けです。"
});

const elements = {
  helpButton: document.querySelector("#help-button"), helpPanel: document.querySelector("#help-panel"), helpClose: document.querySelector("#help-close"),
  sampleButton: document.querySelector("#sample-button"), imageInput: document.querySelector("#image-input"), recipeInput: document.querySelector("#recipe-input"),
  dropZone: document.querySelector("#drop-zone"), status: document.querySelector("#status"), nextAction: document.querySelector("#next-action"),
  deviceProfile: document.querySelector("#device-profile"), patchControls: document.querySelector("#patch-controls"), presetControls: document.querySelector("#preset-controls"),
  sliceControls: document.querySelector("#slice-controls"), paddingControls: document.querySelector("#padding-controls"), geometryControls: document.querySelector("#geometry-controls"), outputControls: document.querySelector("#output-controls"),
  undoButton: document.querySelector("#undo-button"), redoButton: document.querySelector("#redo-button"), resetButton: document.querySelector("#reset-button"), clearButton: document.querySelector("#clear-button"),
  selectionSummary: document.querySelector("#selection-summary"), selectionX: document.querySelector("#selection-x"), selectionY: document.querySelector("#selection-y"), selectionWidth: document.querySelector("#selection-width"), selectionHeight: document.querySelector("#selection-height"),
  patchMode: document.querySelector("#patch-mode"), patchModeHelp: document.querySelector("#patch-mode-help"), cloneOptions: document.querySelector("#clone-options"), blurOptions: document.querySelector("#blur-options"), mosaicOptions: document.querySelector("#mosaic-options"), colorOptions: document.querySelector("#color-options"),
  sourceOffsetX: document.querySelector("#source-offset-x"), sourceOffsetY: document.querySelector("#source-offset-y"), sourceOffsetXOutput: document.querySelector("#source-offset-x-output"), sourceOffsetYOutput: document.querySelector("#source-offset-y-output"),
  blurRadius: document.querySelector("#blur-radius"), blurRadiusOutput: document.querySelector("#blur-radius-output"), blockSize: document.querySelector("#block-size"), blockSizeOutput: document.querySelector("#block-size-output"),
  patchColor: document.querySelector("#patch-color"), patchOpacity: document.querySelector("#patch-opacity"), patchOpacityOutput: document.querySelector("#patch-opacity-output"),
  patchApply: document.querySelector("#patch-apply"), patchCancelEdit: document.querySelector("#patch-cancel-edit"), patchDelete: document.querySelector("#patch-delete"), patchClearAll: document.querySelector("#patch-clear-all"), patchList: document.querySelector("#patch-list"),
  operationMode: document.querySelector("#operation-mode"), rangeStart: document.querySelector("#range-start"), rangeEnd: document.querySelector("#range-end"), amountPercent: document.querySelector("#amount-percent"), featherPercent: document.querySelector("#feather-percent"),
  rangeStartOutput: document.querySelector("#range-start-output"), rangeEndOutput: document.querySelector("#range-end-output"), amountOutput: document.querySelector("#amount-output"), amountLabel: document.querySelector("#amount-label"), amountHelp: document.querySelector("#amount-help"), featherOutput: document.querySelector("#feather-output"),
  paddingTop: document.querySelector("#padding-top"), paddingRight: document.querySelector("#padding-right"), paddingBottom: document.querySelector("#padding-bottom"), paddingLeft: document.querySelector("#padding-left"),
  paddingTopOutput: document.querySelector("#padding-top-output"), paddingRightOutput: document.querySelector("#padding-right-output"), paddingBottomOutput: document.querySelector("#padding-bottom-output"), paddingLeftOutput: document.querySelector("#padding-left-output"),
  linkPadding: document.querySelector("#link-padding"), paddingMode: document.querySelector("#padding-mode"), paddingColor: document.querySelector("#padding-color"), paddingColorRow: document.querySelector("#padding-color-row"),
  rotateLeft: document.querySelector("#rotate-left"), rotateRight: document.querySelector("#rotate-right"), flipX: document.querySelector("#flip-x"), flipY: document.querySelector("#flip-y"),
  cropTop: document.querySelector("#crop-top"), cropRight: document.querySelector("#crop-right"), cropBottom: document.querySelector("#crop-bottom"), cropLeft: document.querySelector("#crop-left"),
  cropTopOutput: document.querySelector("#crop-top-output"), cropRightOutput: document.querySelector("#crop-right-output"), cropBottomOutput: document.querySelector("#crop-bottom-output"), cropLeftOutput: document.querySelector("#crop-left-output"),
  outputFormat: document.querySelector("#output-format"), outputQuality: document.querySelector("#output-quality"), qualityOutput: document.querySelector("#quality-output"), qualityRow: document.querySelector("#quality-row"), outputMaxDimension: document.querySelector("#output-max-dimension"),
  downloadButton: document.querySelector("#download-button"), shareButton: document.querySelector("#share-button"), recipeDownload: document.querySelector("#recipe-download"), dimensionText: document.querySelector("#dimension-text"), canvasHelp: document.querySelector("#canvas-help"),
  beforeViewport: document.querySelector("#before-viewport"), afterViewport: document.querySelector("#after-viewport"), beforeCanvas: document.querySelector("#before-canvas"), afterCanvas: document.querySelector("#after-canvas"), beforeEmpty: document.querySelector("#before-empty"), afterEmpty: document.querySelector("#after-empty"),
  zoomRange: document.querySelector("#zoom-range"), zoomOutput: document.querySelector("#zoom-output"), zoomFit: document.querySelector("#zoom-fit")
};

const profile = Core.getDeviceProfile(navigator, screen);
const state = { image: null, objectUrl: null, fileName: "image", sourceWidth: 0, sourceHeight: 0, settings: loadSavedSettings(), history: [], historyIndex: -1, renderFrame: null, loadToken: 0, exporting: false, selection: null, dragStart: null, editingPatchId: null, zoom: 100 };
const settingInputs = [
  [elements.rangeStart, "startPercent"], [elements.rangeEnd, "endPercent"], [elements.amountPercent, "amountPercent"], [elements.featherPercent, "featherPercent"],
  [elements.paddingTop, "paddingTop"], [elements.paddingRight, "paddingRight"], [elements.paddingBottom, "paddingBottom"], [elements.paddingLeft, "paddingLeft"],
  [elements.cropTop, "cropTop"], [elements.cropRight, "cropRight"], [elements.cropBottom, "cropBottom"], [elements.cropLeft, "cropLeft"],
  [elements.outputQuality, "outputQuality", 0.01], [elements.outputMaxDimension, "outputMaxDimension"]
];

function loadSavedSettings() { try { const text = localStorage.getItem(STORAGE_KEY); return text ? Core.normalizeSettings(JSON.parse(text)) : Core.normalizeSettings(Core.DEFAULTS); } catch (error) { return Core.normalizeSettings(Core.DEFAULTS); } }
function saveSettings() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings)); } catch (error) { console.info("設定を端末へ保存できませんでした。", error); } }
function setStatus(message, kind) { elements.status.textContent = message; if (!kind || kind === "info") elements.status.removeAttribute("data-kind"); else elements.status.dataset.kind = kind; }
function snapshot(settings) { return JSON.stringify(Core.normalizeSettings(settings)); }
function commitHistory(announce) {
  state.settings = Core.normalizeSettings(state.settings);
  const current = snapshot(state.settings);
  if (state.history[state.historyIndex] !== current) {
    state.history = state.history.slice(0, state.historyIndex + 1); state.history.push(current);
    if (state.history.length > Core.LIMITS.historyLength) state.history.shift(); state.historyIndex = state.history.length - 1;
  }
  updateEnabled(); saveSettings(); if (announce) setStatus(announce, "success");
}
function restoreHistory(index) { if (index < 0 || index >= state.history.length) return; state.historyIndex = index; state.settings = Core.normalizeSettings(JSON.parse(state.history[index])); state.editingPatchId = null; state.selection = null; applySettingsToControls(); scheduleRender(); }
function setFieldsets(enabled) { for (const fieldset of [elements.patchControls, elements.presetControls, elements.sliceControls, elements.paddingControls, elements.geometryControls, elements.outputControls]) fieldset.disabled = !enabled; }
function updateEnabled() {
  const enabled = Boolean(state.image); setFieldsets(enabled);
  elements.undoButton.disabled = !enabled || state.historyIndex <= 0; elements.redoButton.disabled = !enabled || state.historyIndex >= state.history.length - 1;
  elements.resetButton.disabled = !enabled; elements.clearButton.disabled = !enabled; elements.downloadButton.disabled = !enabled || state.exporting; elements.shareButton.disabled = !enabled || state.exporting;
  const canApply = enabled && Boolean(state.selection) && (Boolean(state.editingPatchId) || state.settings.patches.length < Core.LIMITS.maximumPatches);
  elements.patchApply.disabled = !canApply; elements.patchClearAll.disabled = !enabled || state.settings.patches.length === 0;
  for (const input of [elements.selectionX, elements.selectionY, elements.selectionWidth, elements.selectionHeight]) input.disabled = !enabled || !state.selection;
  updateNextAction();
}
function updateNextAction() {
  if (!state.image) elements.nextAction.textContent = "次は、画像を選ぶかサンプル画像を開きます。";
  else if (!state.selection && state.settings.patches.length === 0) elements.nextAction.textContent = "次は、左の元画像で直したい場所を囲みます。";
  else if (state.selection && !state.editingPatchId) elements.nextAction.textContent = "右の仮結果を確認し、部分修正を追加してください。";
  else if (state.editingPatchId) elements.nextAction.textContent = "修正方法や範囲を調整し、更新して確定してください。";
  else elements.nextAction.textContent = "別の場所を囲んで修正を重ねるか、保存へ進めます。";
}
function formatPercent(value) { const number = Number(value); return `${Number.isInteger(number) ? number : number.toFixed(1)}%`; }
function applySettingsToControls() {
  state.settings = Core.normalizeSettings(state.settings); const settings = state.settings;
  const axis = document.querySelector(`input[name="axis"][value="${settings.axis}"]`); if (axis) axis.checked = true;
  elements.operationMode.value = settings.mode; elements.rangeStart.value = String(settings.startPercent); elements.rangeEnd.value = String(settings.endPercent); elements.amountPercent.value = String(settings.amountPercent); elements.featherPercent.value = String(settings.featherPercent);
  elements.paddingTop.value = String(settings.paddingTop); elements.paddingRight.value = String(settings.paddingRight); elements.paddingBottom.value = String(settings.paddingBottom); elements.paddingLeft.value = String(settings.paddingLeft); elements.paddingMode.value = settings.paddingMode; elements.paddingColor.value = settings.paddingColor;
  elements.cropTop.value = String(settings.cropTop); elements.cropRight.value = String(settings.cropRight); elements.cropBottom.value = String(settings.cropBottom); elements.cropLeft.value = String(settings.cropLeft);
  elements.outputFormat.value = settings.outputFormat; elements.outputQuality.value = String(Math.round(settings.outputQuality * 100)); elements.outputMaxDimension.value = String(settings.outputMaxDimension);
  elements.flipX.setAttribute("aria-pressed", String(settings.flipX)); elements.flipY.setAttribute("aria-pressed", String(settings.flipY));
  updateDynamicControls(); updateOutputs(); renderPatchList(); updateSelectionSummary(); updateEnabled();
}
function updateDynamicControls() {
  const mode = state.settings.mode; elements.amountPercent.disabled = mode === "remove";
  if (mode === "offset") { elements.amountPercent.min = "-100"; elements.amountPercent.max = "100"; elements.amountLabel.textContent = "移動量"; elements.amountHelp.textContent = "選択帯を直角方向へ循環移動します。"; }
  else if (mode === "compress") { elements.amountPercent.min = "0"; elements.amountPercent.max = "95"; elements.amountLabel.textContent = "縮める量"; elements.amountHelp.textContent = "100%に近いほど帯が細くなります。"; }
  else if (mode === "remove") { elements.amountPercent.min = "0"; elements.amountPercent.max = "100"; elements.amountLabel.textContent = "削除"; elements.amountHelp.textContent = "選択した帯を取り除き、前後を接続します。"; }
  else { elements.amountPercent.min = "0"; elements.amountPercent.max = "300"; elements.amountLabel.textContent = mode === "smear" ? "引き伸ばす量" : "追加量"; elements.amountHelp.textContent = "選択した帯の長さに対する追加量です。"; }
  elements.paddingColorRow.hidden = state.settings.paddingMode !== "solid"; elements.qualityRow.hidden = state.settings.outputFormat === "image/png"; updatePatchOptions();
}
function updateOutputs() {
  const settings = state.settings;
  elements.rangeStartOutput.textContent = formatPercent(settings.startPercent); elements.rangeEndOutput.textContent = formatPercent(settings.endPercent); elements.amountOutput.textContent = formatPercent(settings.amountPercent); elements.featherOutput.textContent = formatPercent(settings.featherPercent);
  elements.paddingTopOutput.textContent = formatPercent(settings.paddingTop); elements.paddingRightOutput.textContent = formatPercent(settings.paddingRight); elements.paddingBottomOutput.textContent = formatPercent(settings.paddingBottom); elements.paddingLeftOutput.textContent = formatPercent(settings.paddingLeft);
  elements.cropTopOutput.textContent = formatPercent(settings.cropTop); elements.cropRightOutput.textContent = formatPercent(settings.cropRight); elements.cropBottomOutput.textContent = formatPercent(settings.cropBottom); elements.cropLeftOutput.textContent = formatPercent(settings.cropLeft); elements.qualityOutput.textContent = formatPercent(Math.round(settings.outputQuality * 100));
}
