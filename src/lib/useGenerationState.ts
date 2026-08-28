import { useEffect, useState } from 'react';
import { DEFAULT_GENERATION_STATE, type GenerationState } from './generationTypes';
import { getGenerationState, subscribeGenerationState } from './generationStore';
import { useActiveTabId } from './useActiveTabId';

export function useGenerationState(): GenerationState {
  const tabId = useActiveTabId();
  const [state, setState] = useState<GenerationState>(DEFAULT_GENERATION_STATE);

  useEffect(() => {
    if (tabId == null) {
      setState(DEFAULT_GENERATION_STATE);
      return;
    }

    let mounted = true;
    getGenerationState(tabId).then((value) => {
      if (mounted) setState(value);
    });
    const unsubscribe = subscribeGenerationState(tabId, (value) => {
      if (mounted) setState(value);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [tabId]);

  return { ...state, tabId };
}
