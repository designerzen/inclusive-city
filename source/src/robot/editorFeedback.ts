import type { AbilityId } from './abilities';
import type { FunctionId } from './functions';

export type EditorFeedback =
  | { type: 'ability'; id: AbilityId; previous: number; value: number }
  | { type: 'function'; id: FunctionId; enabled: boolean; swapEnabled: FunctionId; swapDisabled: FunctionId }
  | { type: 'reset' };
