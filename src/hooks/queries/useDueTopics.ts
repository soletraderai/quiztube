import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryClient';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

export interface DueTopic {
  id: string;
  topicName: string;
  videoTitle: string;
  videoThumbnail: string;
  masteryLevel: string;
  dueAt: string;
}

/**
 * Hook to fetch topics due for review (spaced repetition)
 * Returns a count and list of topics that are due for review
 */
export function useDueTopics() {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: queryKeys.topics.due(),
    queryFn: () => api.get<DueTopic[]>('/topics/due-for-review'),
    enabled: isAuthenticated(),
  });
}
