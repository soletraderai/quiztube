import { useState } from 'react';
import type { ProcessingLog } from '../../types';

interface ProcessingLogViewProps {
  processingLog: ProcessingLog;
}

const STAGE_LABELS: Record<string, string> = {
  transcript_fetch: 'Transcript Extraction',
  url_detection: 'Source Detection',
  source_extraction: 'Source Summarization',
  content_analysis: 'Content Analysis',
  question_generation: 'Question Generation',
};

export function ProcessingLogView({ processingLog }: ProcessingLogViewProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  return (
    <div className="border-2 border-black bg-white">
      <div className="p-3 border-b-2 border-black bg-gray-50">
        <h3 className="font-bold text-sm">How this lesson was built</h3>
        <p className="text-xs text-gray-500">
          {processingLog.steps.length} processing steps •{' '}
          {new Date(processingLog.createdAt).toLocaleString()}
        </p>
      </div>
      <div>
        {processingLog.steps.map((step, index) => (
          <div key={index} className="border-b border-gray-200 last:border-b-0">
            <button
              onClick={() => setExpandedStep(expandedStep === index ? null : index)}
              className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 text-left"
              aria-expanded={expandedStep === index}
            >
              <span className={`text-sm ${step.success ? 'text-green-600' : 'text-red-600'}`}>
                {step.success ? '✓' : '✗'}
              </span>
              <span className="font-medium text-sm flex-1">
                {STAGE_LABELS[step.stage] || step.stage}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(step.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-xs">{expandedStep === index ? '▲' : '▼'}</span>
            </button>
            {expandedStep === index && (
              <div className="px-3 pb-3 space-y-2 bg-gray-50">
                <div>
                  <span className="text-xs font-bold text-gray-500">Input:</span>
                  <p className="text-xs font-mono text-gray-700">{step.input}</p>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500">Decision:</span>
                  <p className="text-xs font-mono text-gray-700">{step.decision}</p>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500">Reasoning:</span>
                  <p className="text-xs font-mono text-gray-700">{step.reasoning}</p>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500">Output:</span>
                  <p className="text-xs font-mono text-gray-700">{step.output}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
