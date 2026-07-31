"use strict";

function updatePatchOptions() {
  const mode = elements.patchMode.value;
  elements.patchModeHelp.textContent = PATCH_HELP[mode] || "選択範囲へ修正を適用します。";
  elements.cloneOptions.hidden = !["clone", "mirror-x", "mirror-y", "smear"].includes(mode);
  elements.blurOptions.hidden = mode !== "blur";
  elements.mosaicOptions.hidden = mode !== "mosaic";
  elements.colorOptions.hidden = mode !== "solid";
  elements.sourceOffsetXOutput.textContent = formatPercent(elements.sourceOffsetX.value);
  elements.sourceOffsetYOutput.textContent = formatPercent(elements.sourceOffsetY.value);
  elements.blurRadiusOutput.textContent = `${elements.blurRadius.value}px`;
  elements.blockSizeOutput.textContent = `${elements.blockSize.value}px`;
  elements.patchOpacityOutput.textContent = formatPercent(elements.patchOpacity.value);
}

function updateSelectionSummary() {
  if (!state.selection) {
    elements.selectionSummary.textContent = "範囲はまだ選ばれていません。";
    for (const input of [elements.selectionX, elements.selectionY, elements.selectionWidth, elements.selectionHeight]) { input.value = ""; input.disabled = true; }
    return;
  }
  const s = state.selection;
  elements.selectionSummary.textContent = `左 ${formatPercent(s.x)}、上 ${formatPercent(s.y)}、幅 ${formatPercent(s.width)}、高さ ${formatPercent(s.height)}`;
  elements.selectionX.value = String(Math.round(s.x * 10) / 10); elements.selectionY.value = String(Math.round(s.y * 10) / 10);
  elements.selectionWidth.value = String(Math.round(s.width * 10) / 10); elements.selectionHeight.value = String(Math.round(s.height * 10) / 10);
  for (const input of [elements.selectionX, elements.selectionY, elements.selectionWidth, elements.selectionHeight]) input.disabled = false;
}

function updateSelectionFromNumbers() {
  if (!state.selection) return;
  const normalized = Core.normalizePatch({ x: Number(elements.selectionX.value), y: Number(elements.selectionY.value), width: Number(elements.selectionWidth.value), height: Number(elements.selectionHeight.value) }, 0);
  state.selection = { x: normalized.x, y: normalized.y, width: normalized.width, height: normalized.height };
  updateSelectionSummary(); updateEnabled(); scheduleRender();
}

function readPatchDraft() {
  if (!state.selection) return null;
  return Core.normalizePatch({
    id: state.editingPatchId || `patch-${Date.now().toString(36)}`, mode: elements.patchMode.value,
    x: state.selection.x, y: state.selection.y, width: state.selection.width, height: state.selection.height,
    sourceOffsetX: Number(elements.sourceOffsetX.value), sourceOffsetY: Number(elements.sourceOffsetY.value),
    opacity: Number(elements.patchOpacity.value) / 100, blockSize: Number(elements.blockSize.value), blurRadius: Number(elements.blurRadius.value), color: elements.patchColor.value
  }, 0);
}

function getPreviewSettings() {
  const settings = Core.normalizeSettings(state.settings); const draft = readPatchDraft(); if (!draft) return settings;
  const patches = settings.patches.slice(); const index = state.editingPatchId ? patches.findIndex((patch) => patch.id === state.editingPatchId) : -1;
  if (index >= 0) patches[index] = draft; else if (patches.length < Core.LIMITS.maximumPatches) patches.push(draft);
  return Core.normalizeSettings(Object.assign({}, settings, { patches }));
}

function populatePatchForm(patch) {
  const normalized = Core.normalizePatch(patch, 0); elements.patchMode.value = normalized.mode;
  elements.sourceOffsetX.value = String(normalized.sourceOffsetX); elements.sourceOffsetY.value = String(normalized.sourceOffsetY);
  elements.patchOpacity.value = String(Math.round(normalized.opacity * 100)); elements.blockSize.value = String(normalized.blockSize);
  elements.blurRadius.value = String(normalized.blurRadius); elements.patchColor.value = normalized.color; updatePatchOptions();
}

function resetPatchForm() {
  populatePatchForm(Core.DEFAULT_PATCH); state.editingPatchId = null; elements.patchApply.textContent = "部分修正を追加";
  elements.patchCancelEdit.hidden = true; elements.patchDelete.hidden = true; renderPatchList(); updateEnabled();
}

function renderPatchList() {
  elements.patchList.textContent = "";
  if (state.settings.patches.length === 0) {
    const item = document.createElement("li"); item.className = "empty-list"; item.textContent = "まだありません。"; elements.patchList.appendChild(item); return;
  }
  state.settings.patches.forEach((patch, index) => {
    const item = document.createElement("li"); item.dataset.selected = String(patch.id === state.editingPatchId);
    const description = document.createElement("div"); description.className = "patch-description";
    const title = document.createElement("strong"); title.textContent = `${index + 1}. ${PATCH_LABELS[patch.mode] || patch.mode}`;
    const detail = document.createElement("span"); detail.textContent = `左${Math.round(patch.x)}% 上${Math.round(patch.y)}% 幅${Math.round(patch.width)}% 高さ${Math.round(patch.height)}%`;
    description.append(title, detail);
    const button = document.createElement("button"); button.type = "button"; button.textContent = patch.id === state.editingPatchId ? "編集中" : "選ぶ"; button.addEventListener("click", () => editPatch(patch.id));
    item.append(description, button); elements.patchList.appendChild(item);
  });
}

function editPatch(id) {
  const patch = state.settings.patches.find((item) => item.id === id); if (!patch) return;
  state.editingPatchId = id; state.selection = { x: patch.x, y: patch.y, width: patch.width, height: patch.height };
  populatePatchForm(patch); elements.patchApply.textContent = "選択中の修正を更新"; elements.patchCancelEdit.hidden = false; elements.patchDelete.hidden = false;
  applySettingsToControls(); scheduleRender();
}

function applyPatchDraft() {
  const draft = readPatchDraft(); if (!draft) return;
  const patches = state.settings.patches.slice(); const index = state.editingPatchId ? patches.findIndex((patch) => patch.id === state.editingPatchId) : -1;
  if (index >= 0) patches[index] = draft;
  else {
    if (patches.length >= Core.LIMITS.maximumPatches) { setStatus(`部分修正は${Core.LIMITS.maximumPatches}個までです。不要な修正を削除してください。`, "error"); return; }
    patches.push(draft);
  }
  state.settings = Core.normalizeSettings(Object.assign({}, state.settings, { patches }));
  commitHistory(index >= 0 ? "部分修正を更新しました。" : "部分修正を追加しました。"); state.selection = null;
  resetPatchForm(); applySettingsToControls(); scheduleRender();
}

function deleteEditingPatch() {
  if (!state.editingPatchId) return;
  state.settings = Core.normalizeSettings(Object.assign({}, state.settings, { patches: state.settings.patches.filter((patch) => patch.id !== state.editingPatchId) }));
  state.selection = null; commitHistory("選択中の部分修正を削除しました。"); resetPatchForm(); applySettingsToControls(); scheduleRender();
}

function clearAllPatches() {
  if (state.settings.patches.length === 0) return;
  state.settings = Core.normalizeSettings(Object.assign({}, state.settings, { patches: [] })); state.selection = null;
  commitHistory("部分修正をすべて削除しました。"); resetPatchForm(); applySettingsToControls(); scheduleRender();
}
