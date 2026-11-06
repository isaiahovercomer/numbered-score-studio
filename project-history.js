// 只儲存已通過樂譜驗證的 JSON；音檔、圖片和服務金鑰不屬於草稿。
export const DRAFT_KEY = 'numbered-score-studio.draft.v1';
export function createHistory(initial, limit = 40) {
  let entries = [structuredClone(initial)], cursor = 0;
  return {
    record(value) {
      if (JSON.stringify(value) === JSON.stringify(entries[cursor])) return false;
      entries = entries.slice(0, cursor + 1);
      entries.push(structuredClone(value));
      if (entries.length > limit) entries.shift();
      cursor = entries.length - 1;
      return true;
    },
    undo() { if (cursor > 0) return structuredClone(entries[--cursor]); },
    redo() { if (cursor < entries.length - 1) return structuredClone(entries[++cursor]); },
    get current() { return structuredClone(entries[cursor]); },
    get canUndo() { return cursor > 0; },
    get canRedo() { return cursor < entries.length - 1; }
  };
}
export function readDraft(storage, validate) {
  const raw = storage.getItem(DRAFT_KEY);
  if (!raw) return null;
  const data = JSON.parse(raw);
  if (data.version !== 1 || !Array.isArray(data.versions) || data.versions.length > 20)
    throw Error('草稿格式不支援');
  validate(data.draft.score);
  for (const v of data.versions) validate(v.project.score);
  return data;
}
export function saveDraft(storage, draft, versions) {
  storage.setItem(DRAFT_KEY, JSON.stringify({version: 1, draft, versions: versions.slice(-20)}));
}
