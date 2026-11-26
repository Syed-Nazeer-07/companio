import { TaskPlan } from '../types';
import { TaskPlanner } from './taskPlanner';
import { TaskExecutor } from './taskExecutor';
export { runWithActionDeadline, actionTimeoutMs } from './taskExecutor';

// Stable public facade: planning never executes native actions.
export class AgentEngine extends TaskPlanner {
  private readonly executor = new TaskExecutor();
  cancelActiveTask() { return this.executor.cancelActiveTask(); }
  executePlan(plan: TaskPlan, onProgress: (plan: TaskPlan) => void) {
    return this.executor.executePlan(plan, onProgress);
  }
}
export const agentEngine = new AgentEngine();
