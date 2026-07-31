"use strict";

function loadImageFromUrl(url) { return new Promise((resolve, reject) => { const image = new Image(); image.decoding = "async"; image.onload = () => resolve(image); image.onerror = () => reject(new Error("画像を復号できませんでした。ファイルが壊れていないか確認してください。")); image.src = url; }); }
function releaseImage() { if (state.objectUrl) URL.revokeObjectURL(state.objectUrl); state.image = null; state.objectUrl = null; state.fileName = "image"; state.sourceWidth = 0; state.sourceHeight = 0; }

async function loadFile(file) {
  const token = ++state.loadToken;
  try {
    setStatus("画像の実データを確認しています。", "info"); setFieldsets(false);
    const buffer = await file.arrayBuffer(); const header = Core.inspectImageHeader(buffer); Core.validateFileMetadata(file, header); if (token !== state.loadToken) return;
    const nextUrl = URL.createObjectURL(file); let nextImage;
    try { nextImage = await loadImageFromUrl(nextUrl); } catch (error) { URL.revokeObjectURL(nextUrl); throw error; }
    if (token !== state.loadToken) { URL.revokeObjectURL(nextUrl); return; }
    const pixels = nextImage.naturalWidth * nextImage.naturalHeight;
    if (nextImage.naturalWidth <= 0 || nextImage.naturalHeight <= 0 || pixels > Core.LIMITS.maxSourcePixels) { URL.revokeObjectURL(nextUrl); throw new Error("復号後の画像サイズが安全上限を超えています。"); }
    releaseImage(); state.image = nextImage; state.objectUrl = nextUrl; state.fileName = file.name || "image"; state.sourceWidth = nextImage.naturalWidth; state.sourceHeight = nextImage.naturalHeight;
    state.settings = Core.normalizeSettings(Object.assign({}, Core.DEFAULTS, { amountPercent: 0, outputFormat: header.mimeType, outputQuality: state.settings.outputQuality, outputMaxDimension: state.settings.outputMaxDimension }));
    state.history = [snapshot(state.settings)]; state.historyIndex = 0; state.selection = null; resetPatchForm(); applySettingsToControls();
    setStatus("画像を読み込みました。左の元画像で直したい場所を囲んでください。", "success"); scheduleRender();
  } catch (error) { elements.imageInput.value = ""; updateEnabled(); handleError(error, "画像を読み込めませんでした。"); }
}

function canvasToBlob(canvas, type, quality) { return new Promise((resolve, reject) => { canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("画像データを作成できませんでした。")), type, quality); }); }

async function createSampleFile() {
  const canvas = document.createElement("canvas"); canvas.width = 960; canvas.height = 640; const context = canvas.getContext("2d", { alpha: false });
  const sky = context.createLinearGradient(0, 0, 0, 420); sky.addColorStop(0, "#87c8ee"); sky.addColorStop(1, "#eaf5fb"); context.fillStyle = sky; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#d7b67a"; context.fillRect(0, 420, canvas.width, 220); context.fillStyle = "#436e45"; context.fillRect(0, 390, canvas.width, 52);
  context.fillStyle = "#f5efe5"; context.fillRect(245, 205, 470, 250); context.fillStyle = "#8e4d37"; context.beginPath(); context.moveTo(210, 235); context.lineTo(480, 70); context.lineTo(750, 235); context.closePath(); context.fill();
  context.fillStyle = "#4e7392"; context.fillRect(310, 280, 100, 110); context.fillRect(550, 280, 100, 110); context.fillStyle = "#6a4934"; context.fillRect(455, 310, 70, 145);
  context.fillStyle = "#d84d4d"; context.beginPath(); context.arc(670, 335, 24, 0, Math.PI * 2); context.fill(); context.fillStyle = "#ffffff"; context.font = "700 28px system-ui"; context.fillText("この赤い丸を囲んで修正を試せます", 190, 555);
  const blob = await canvasToBlob(canvas, "image/png"); canvas.width = 1; canvas.height = 1; return new File([blob], "sample-scene.png", { type: "image/png" });
}

async function loadSample() {
  try { elements.sampleButton.disabled = true; setStatus("サンプル画像を端末内で作成しています。", "info"); await loadFile(await createSampleFile()); elements.helpPanel.hidden = true; elements.helpButton.setAttribute("aria-expanded", "false"); }
  catch (error) { handleError(error, "サンプル画像を作成できませんでした。"); }
  finally { elements.sampleButton.disabled = false; }
}

function clearImage() {
  state.loadToken += 1; releaseImage(); state.history = []; state.historyIndex = -1; state.selection = null; state.editingPatchId = null; elements.imageInput.value = "";
  for (const canvas of [elements.beforeCanvas, elements.afterCanvas]) { canvas.width = 1; canvas.height = 1; canvas.hidden = true; }
  elements.beforeEmpty.hidden = false; elements.afterEmpty.hidden = false; elements.dimensionText.textContent = "画像はまだ選ばれていません";
  resetPatchForm(); updateEnabled(); setStatus("画像を外しました。新しい画像を選べます。", "success");
}

const presets = {
  headroom: { axis: "vertical", mode: "smear", startPercent: 2, endPercent: 8, amountPercent: 40, paddingTop: 28, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, paddingMode: "edge" },
  "side-space": { axis: "horizontal", mode: "stretch", startPercent: 40, endPercent: 60, amountPercent: 0, paddingTop: 0, paddingRight: 24, paddingBottom: 0, paddingLeft: 24, paddingMode: "mirror" },
  "remove-strip": { axis: "vertical", mode: "remove", startPercent: 42, endPercent: 58, amountPercent: 100, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
  "mirror-texture": { axis: "horizontal", mode: "mirror", startPercent: 30, endPercent: 55, amountPercent: 180, featherPercent: 0, paddingMode: "mirror" },
  "compress-center": { axis: "vertical", mode: "compress", startPercent: 28, endPercent: 72, amountPercent: 45, featherPercent: 1.5 },
  "glitch-shift": { axis: "vertical", mode: "offset", startPercent: 38, endPercent: 55, amountPercent: 18, featherPercent: 0 }
};
function applyPreset(name) { if (!presets[name]) return; state.settings = Core.normalizeSettings(Object.assign({}, state.settings, presets[name])); applySettingsToControls(); commitHistory("目的別の設定を適用しました。右の結果を確認してください。"); scheduleRender(); }
function undo() { restoreHistory(state.historyIndex - 1); setStatus("1つ前の状態へ戻しました。", "success"); }
function redo() { restoreHistory(state.historyIndex + 1); setStatus("取り消した状態をやり直しました。", "success"); }
function resetSettings() { state.settings = Core.normalizeSettings(Object.assign({}, Core.DEFAULTS, { amountPercent: 0 })); state.selection = null; resetPatchForm(); applySettingsToControls(); commitHistory("編集設定と部分修正を初期状態へ戻しました。"); scheduleRender(); }
function rotate(delta) { state.settings.rotation = (state.settings.rotation + delta + 360) % 360; state.settings = Core.normalizeSettings(state.settings); applySettingsToControls(); commitHistory(); scheduleRender(); }
function toggleFlip(key, button) { state.settings[key] = !state.settings[key]; state.settings = Core.normalizeSettings(state.settings); button.setAttribute("aria-pressed", String(state.settings[key])); commitHistory(); scheduleRender(); }

async function createOutputBlob() {
  const result = Render.renderResult(state.image, state.sourceWidth, state.sourceHeight, state.settings, { maximumDimension: state.settings.outputMaxDimension, pixelLimit: profile.exportPixelLimit });
  const actualPixels = result.canvas.width * result.canvas.height;
  if (result.canvas.width > Core.LIMITS.maxOutputDimension || result.canvas.height > Core.LIMITS.maxOutputDimension || !Number.isSafeInteger(actualPixels) || actualPixels > profile.exportPixelLimit) { result.canvas.width = 1; result.canvas.height = 1; throw new Error("保存画像の実寸が端末の安全上限を超えています。最大の縦横を下げてください。"); }
  let exportCanvas = result.canvas;
  if (state.settings.outputFormat === "image/jpeg") {
    const flattened = document.createElement("canvas"); flattened.width = exportCanvas.width; flattened.height = exportCanvas.height; const context = flattened.getContext("2d", { alpha: false });
    context.fillStyle = state.settings.paddingColor || "#ffffff"; context.fillRect(0, 0, flattened.width, flattened.height); context.drawImage(exportCanvas, 0, 0); exportCanvas.width = 1; exportCanvas.height = 1; exportCanvas = flattened;
  }
  const quality = state.settings.outputFormat === "image/png" ? undefined : state.settings.outputQuality; const blob = await canvasToBlob(exportCanvas, state.settings.outputFormat, quality);
  if (blob.type && blob.type !== state.settings.outputFormat) throw new Error("このブラウザは選択した保存形式に対応していません。別の形式を選んでください。");
  exportCanvas.width = 1; exportCanvas.height = 1; return blob;
}

async function withOutputBlob(actionName, handler) {
  if (!state.image || state.exporting) return; state.exporting = true; updateEnabled(); setStatus(`${actionName}用の画像を作成しています。`, "info");
  try { const blob = await createOutputBlob(); await handler(blob); setStatus(`${actionName}が完了しました。位置情報などの付加情報は引き継いでいません。`, "success"); }
  catch (error) { handleError(error, `${actionName}に失敗しました。`); }
  finally { state.exporting = false; updateEnabled(); }
}
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.rel = "noopener"; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1500); }
function downloadImage() { withOutputBlob("保存", async (blob) => downloadBlob(blob, Core.buildDownloadName(state.fileName, blob.type || state.settings.outputFormat))); }
function shareImage() { withOutputBlob("共有", async (blob) => { const file = new File([blob], Core.buildDownloadName(state.fileName, blob.type), { type: blob.type }); if (!navigator.canShare || !navigator.canShare({ files: [file] })) throw new Error("この端末では画像ファイルの共有を利用できません。保存を使用してください。"); await navigator.share({ files: [file], title: "Pixel Reframe Lab" }); }); }
function downloadRecipe() { const blob = new Blob([Core.serializeRecipe(state.settings)], { type: "application/json" }); downloadBlob(blob, "pixel-reframe-recipe.json"); setStatus("設定レシピを保存しました。画像データは含まれていません。", "success"); }
async function importRecipe(file) {
  try { if (!file || file.size > Core.LIMITS.maximumRecipeBytes) throw new Error(`レシピファイルは${Math.round(Core.LIMITS.maximumRecipeBytes / 1024)}KB以下にしてください。`); state.settings = Core.parseRecipe(await file.text()); state.selection = null; resetPatchForm(); applySettingsToControls(); commitHistory("設定レシピを読み込みました。"); scheduleRender(); }
  catch (error) { handleError(error, "設定レシピを読み込めませんでした。"); }
  finally { elements.recipeInput.value = ""; }
}
