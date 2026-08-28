import { useEffect, useState } from 'react';
import { DEFAULT_GENERATION_STATE, type GenerationState } from './generationTypes';
import { getGenerationState, subscribeGenerationState } from './generationStore';

export function useGenerationState(): GenerationState {
  const [state, setState] = useState<GenerationState>(DEFAULT_GENERATION_STATE);

  useEffect(() => {
    let mounted = true;
    getGenerationState().then((value) => {
      if (mounted) setState(value);
    });
    const unsubscribe = subscribeGenerationState((value) => {
      if (mounted) setState(value);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return state;
}
