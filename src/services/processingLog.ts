// Phase 12: Pipeline Logger Service for lesson creation transparency
import type { ProcessingStep, ProcessingLog } from '../types';

const MAX_FIELD_LENGTH = 500;

function truncate(str: string, max: number = MAX_FIELD_LENGTH): string {
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

export class PipelineLogger {
  private lessonId: string;
  private createdAt: string;
  private steps: ProcessingStep[] = [];

  constructor(lessonId: string) {
    this.lessonId = lessonId;
    this.createdAt = new Date().toISOString();
  }

  logStep(
    stage: ProcessingStep['stage'],
    input: string,
    decision: string,
    reasoning: string,
    output: string,
    success: boolean
  ): void {
    this.steps.push({
      timestamp: new Date().toISOString(),
      stage,
      input: truncate(input),
      decision: truncate(decision),
      reasoning: truncate(reasoning),
      output: truncate(output),
      success,
    });
  }

  finalize(): ProcessingLog {
    return {
      lessonId: this.lessonId,
      createdAt: this.createdAt,
      steps: this.steps,
    };
  }
}
