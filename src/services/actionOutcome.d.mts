export type ActionOutcome = {
  kind: 'verified' | 'unverified' | 'error';
  message: string;
};
export declare function classifyActionOutcome(result: unknown, label?: string): ActionOutcome;
