// Query hooks
export { useCommitment, type CommitmentData } from './queries/useCommitment';
export { useLearningInsights, type LearningInsights } from './queries/useLearningInsights';
export { useDueTopics, type DueTopic } from './queries/useDueTopics';
export {
  useGoals,
  useGoalSuggestions,
  type Goal,
  type GoalSuggestion,
  type Milestone,
  type GoalStatus,
} from './queries/useGoals';

// Mutation hooks
export {
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  type CreateGoalInput,
  type UpdateGoalInput,
} from './mutations/useGoalMutations';

// Timed Session hooks
export {
  useTimedSessionHistory,
  useActiveTimedSession,
  useCreateTimedSession,
  useUpdateTimedSession,
  useTimedSessionQuestions,
} from './queries/useTimedSessions';

// Utility hooks
export { useDebounce } from './useDebounce';
export { useOnlineStatus } from './useOnlineStatus';
export { useDocumentTitle, APP_NAME } from './useDocumentTitle';
