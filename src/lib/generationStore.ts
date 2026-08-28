import {
  DEFAULT_GENERATION_STATE,
  GENERATION_STORAGE_KEY,
  type GenerationState,
} from './generationTypes';

export async function getGenerationState(): Promise<GenerationState> {
  const result = await chrome.storage.local.get(GENERATION_STORAGE_KEY);
  return { ...DEFAULT_GENERATION_STATE, ...(result[GENERATION_STORAGE_KEY] as GenerationState | undefined) };
}

export async function setGenerationState(patch: Partial<GenerationState>): Promise<GenerationState> {
  const current = await getGenerationState();
  const next: GenerationState = { ...current, ...patch, updatedAt: Date.now() };
  await chrome.storage.local.set({ [GENERATION_STORAGE_KEY]: next });
  return next;
}

export async function resetGenerationState(): Promise<void> {
  await chrome.storage.local.set({
    [GENERATION_STORAGE_KEY]: { ...DEFAULT_GENERATION_STATE, updatedAt: Date.now() },
  });
}

export function subscribeGenerationState(listener: (state: GenerationState) => void): () => void {
  const handler = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    if (area !== 'local' || !changes[GENERATION_STORAGE_KEY]) return;
    listener({
      ...DEFAULT_GENERATION_STATE,
      ...(changes[GENERATION_STORAGE_KEY].newValue as GenerationState),
    });
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
