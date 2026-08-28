import {
  DEFAULT_GENERATION_STATE,
  generationStorageKey,
  GENERATION_STORAGE_PREFIX,
  type GenerationState,
} from './generationTypes';

export async function getGenerationState(tabId: number): Promise<GenerationState> {
  const key = generationStorageKey(tabId);
  const result = await chrome.storage.local.get(key);
  return {
    ...DEFAULT_GENERATION_STATE,
    ...(result[key] as GenerationState | undefined),
    tabId,
  };
}

export async function setGenerationState(
  tabId: number,
  patch: Partial<GenerationState>
): Promise<GenerationState> {
  const current = await getGenerationState(tabId);
  const next: GenerationState = {
    ...current,
    ...patch,
    tabId,
    updatedAt: Date.now(),
  };
  await chrome.storage.local.set({ [generationStorageKey(tabId)]: next });
  return next;
}

export async function resetGenerationState(tabId: number): Promise<void> {
  await chrome.storage.local.remove(generationStorageKey(tabId));
}

export async function removeGenerationState(tabId: number): Promise<void> {
  await chrome.storage.local.remove(generationStorageKey(tabId));
}

export function subscribeGenerationState(
  tabId: number,
  listener: (state: GenerationState) => void
): () => void {
  const key = generationStorageKey(tabId);
  const handler = (changes: { [name: string]: chrome.storage.StorageChange }, area: string) => {
    if (area !== 'local' || !changes[key]) return;
    const value = changes[key].newValue as GenerationState | undefined;
    listener(value ? { ...DEFAULT_GENERATION_STATE, ...value, tabId } : { ...DEFAULT_GENERATION_STATE, tabId });
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

export function isGenerationStorageKey(key: string): boolean {
  return key.startsWith(GENERATION_STORAGE_PREFIX);
}
