import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session, Library, ProcessingState, CodeSnippet } from '../types';
import { useAuthStore } from './authStore';

const API_BASE = 'http://localhost:3001/api';

// Helper to get auth token
const getAuthHeaders = () => {
  const { accessToken } = useAuthStore.getState();
  if (!accessToken) return null;
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
};

// API sync functions for cloud persistence
const sessionApi = {
  // Fetch all sessions from cloud
  async fetchSessions(): Promise<Session[]> {
    const headers = getAuthHeaders();
    if (!headers) return []; // Not authenticated

    try {
      const response = await fetch(`${API_BASE}/sessions`, {
        headers,
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Parse sessionData from each cloud session
        const cloudSessions: Session[] = [];
        for (const s of data.sessions || []) {
          if (s.sessionData) {
            try {
              const sessionData = typeof s.sessionData === 'string'
                ? JSON.parse(s.sessionData)
                : s.sessionData;
              cloudSessions.push(sessionData);
            } catch (e) {
              console.warn('Failed to parse session data:', e);
            }
          }
        }
        return cloudSessions;
      }
    } catch (error) {
      console.warn('Failed to fetch cloud sessions:', error);
    }
    return [];
  },

  // Save session to database
  async saveSession(session: Session): Promise<void> {
    const headers = getAuthHeaders();
    if (!headers) return; // Not authenticated, skip cloud sync

    try {
      const response = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          videoUrl: session.video.url,
          videoId: session.video.id,
          videoTitle: session.video.title,
          videoThumbnail: session.video.thumbnailUrl,
          videoDuration: session.video.duration,
          channelId: session.video.channelId || 'unknown',
          channelName: session.video.channel,
          transcript: '', // We don't need to store full transcript
          status: session.status === 'completed' ? 'COMPLETED' : 'ACTIVE',
          localSessionId: session.id,
          sessionData: JSON.stringify(session), // Store full session as JSON
        }),
      });

      if (!response.ok) {
        console.warn('Failed to sync session to cloud:', await response.text());
        return;
      }

      // Get the created session's database ID
      const createdSession = await response.json();

      // Save knowledge base sources if available
      if (session.knowledgeBase?.sources?.length > 0 && createdSession.id) {
        try {
          await fetch(`${API_BASE}/sessions/${createdSession.id}/sources`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({
              sources: session.knowledgeBase.sources,
            }),
          });
        } catch (sourceError) {
          console.warn('Failed to save knowledge base sources:', sourceError);
        }
      }
    } catch (error) {
      console.warn('Cloud sync error:', error);
    }
  },

  // Update session in database
  async updateSession(session: Session): Promise<void> {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      // Try to find existing session by local ID
      const findResponse = await fetch(`${API_BASE}/sessions?localId=${session.id}`, {
        headers,
        credentials: 'include',
      });

      if (findResponse.ok) {
        const data = await findResponse.json();
        const existingSession = data.sessions?.find((s: any) =>
          s.sessionData && JSON.parse(s.sessionData).id === session.id
        );

        if (existingSession) {
          await fetch(`${API_BASE}/sessions/${existingSession.id}`, {
            method: 'PATCH',
            headers,
            credentials: 'include',
            body: JSON.stringify({
              status: session.status === 'completed' ? 'COMPLETED' : 'ACTIVE',
              questionsAnswered: session.score.questionsAnswered,
              questionsCorrect: session.score.topicsCompleted,
              sessionData: JSON.stringify(session),
            }),
          });
        }
      }
    } catch (error) {
      console.warn('Cloud sync update error:', error);
    }
  },

  // Complete session in database
  async completeSession(session: Session): Promise<void> {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      const findResponse = await fetch(`${API_BASE}/sessions`, {
        headers,
        credentials: 'include',
      });

      if (findResponse.ok) {
        const data = await findResponse.json();
        const existingSession = data.sessions?.find((s: any) => {
          try {
            return s.sessionData && JSON.parse(s.sessionData).id === session.id;
          } catch {
            return false;
          }
        });

        if (existingSession) {
          await fetch(`${API_BASE}/sessions/${existingSession.id}/complete`, {
            method: 'POST',
            headers,
            credentials: 'include',
          });
        }
      }

      // Log commitment progress
      await this.logCommitment(session);
    } catch (error) {
      console.warn('Cloud sync complete error:', error);
    }
  },

  // Log learning time and questions to commitment tracker
  async logCommitment(session: Session): Promise<void> {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      // Calculate time spent (estimate based on questions answered)
      // Assume average of 2 minutes per question answered
      const questionsAnswered = session.score.questionsAnswered || 0;
      const timeSpentMinutes = Math.max(1, questionsAnswered * 2);

      await fetch(`${API_BASE}/commitment/log`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          timeSpentMinutes,
          questionsAnswered,
          sessionsCompleted: 1,
        }),
      });
    } catch (error) {
      console.warn('Failed to log commitment:', error);
    }
  },

  // Delete session from database
  async deleteSession(localSessionId: string): Promise<void> {
    const headers = getAuthHeaders();
    if (!headers) return; // Not authenticated, skip cloud delete

    try {
      // Find the cloud session by local ID
      const findResponse = await fetch(`${API_BASE}/sessions`, {
        headers,
        credentials: 'include',
      });

      if (findResponse.ok) {
        const data = await findResponse.json();
        const cloudSession = data.sessions?.find((s: any) => {
          try {
            return s.sessionData && JSON.parse(s.sessionData).id === localSessionId;
          } catch {
            return false;
          }
        });

        if (cloudSession) {
          await fetch(`${API_BASE}/sessions/${cloudSession.id}`, {
            method: 'DELETE',
            headers,
            credentials: 'include',
          });
        }
      }
    } catch (error) {
      console.warn('Failed to delete session from cloud:', error);
      throw error; // Re-throw so caller can track the failure
    }
  },
};

// Sync error tracking type
interface SyncError {
  error: string;
  lastAttempt: number;
  attempts: number;
}

interface SessionState {
  library: Library;
  currentSession: Session | null;
  processingState: ProcessingState | null;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  migrationDismissed: boolean;

  // Pending sync tracking
  pendingSyncSessions: string[];
  syncErrors: Record<string, SyncError>;

  // Session management
  createSession: (session: Session) => void;
  updateSession: (sessionId: string, updates: Partial<Session>) => void;
  deleteSession: (sessionId: string) => void;
  getSession: (sessionId: string) => Session | undefined;

  // Current session
  setCurrentSession: (session: Session | null) => void;

  // Processing state
  setProcessingState: (state: ProcessingState | null) => void;

  // Topic/Question updates
  updateTopic: (sessionId: string, topicIndex: number, updates: Partial<Session['topics'][0]>) => void;
  updateQuestion: (sessionId: string, topicIndex: number, questionIndex: number, updates: Partial<Session['topics'][0]['questions'][0]>) => void;

  // Score updates
  updateScore: (sessionId: string, updates: Partial<Session['score']>) => void;

  // Code snippets
  saveSnippet: (sessionId: string, snippet: Omit<CodeSnippet, 'id' | 'savedAt'>) => void;
  deleteSnippet: (sessionId: string, snippetId: string) => void;

  // Cloud sync
  syncWithCloud: () => Promise<void>;

  // Pending sync management
  markSyncFailed: (sessionId: string, error: string) => void;
  markSyncSuccess: (sessionId: string) => void;
  retryPendingSyncs: () => Promise<void>;

  // Migration
  getLocalSessionCount: () => number;
  migrateLocalSessions: () => Promise<void>;
  dismissMigration: () => void;

  // Clear all data
  clearLibrary: () => void;
}

const generateId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      library: { sessions: [] },
      currentSession: null,
      processingState: null,
      isSyncing: false,
      lastSyncedAt: null,
      migrationDismissed: false,
      pendingSyncSessions: [],
      syncErrors: {},

      createSession: (session) => {
        // Update local state immediately (optimistic update)
        set((state) => ({
          library: {
            sessions: [session, ...state.library.sessions],
          },
          currentSession: session,
        }));

        // Sync to cloud, track failures (non-blocking)
        sessionApi.saveSession(session)
          .then(() => {
            get().markSyncSuccess(session.id);
          })
          .catch((error) => {
            get().markSyncFailed(session.id, error.message || 'Unknown error');
          });
      },

      updateSession: (sessionId, updates) => {
        const result = set((state) => ({
          library: {
            sessions: state.library.sessions.map((s) =>
              s.id === sessionId ? { ...s, ...updates } : s
            ),
          },
          currentSession:
            state.currentSession?.id === sessionId
              ? { ...state.currentSession, ...updates }
              : state.currentSession,
        }));

        // Sync to cloud after local update (non-blocking with error tracking)
        const updatedSession = get().library.sessions.find(s => s.id === sessionId);
        if (updatedSession) {
          const syncPromise = updates.status === 'completed'
            ? sessionApi.completeSession(updatedSession)
            : sessionApi.updateSession(updatedSession);

          syncPromise
            .then(() => {
              get().markSyncSuccess(sessionId);
            })
            .catch((error) => {
              get().markSyncFailed(sessionId, error.message || 'Update sync failed');
            });
        }

        return result;
      },

      deleteSession: (sessionId) => {
        // Remove from local state immediately
        set((state) => ({
          library: {
            sessions: state.library.sessions.filter((s) => s.id !== sessionId),
          },
          currentSession:
            state.currentSession?.id === sessionId ? null : state.currentSession,
          // Also remove from pending sync if it was there
          pendingSyncSessions: state.pendingSyncSessions.filter(id => id !== sessionId),
        }));

        // Delete from cloud (non-blocking, don't track errors since session is deleted locally)
        sessionApi.deleteSession(sessionId).catch((error) => {
          console.warn(`Failed to delete session ${sessionId} from cloud:`, error);
          // Don't add to pending sync since session is already deleted locally
        });
      },

      getSession: (sessionId) => {
        const { library } = get();
        return library.sessions.find((s) => s.id === sessionId);
      },

      setCurrentSession: (session) => set({ currentSession: session }),

      setProcessingState: (processingState) => set({ processingState }),

      updateTopic: (sessionId, topicIndex, updates) =>
        set((state) => {
          const updatedSessions = state.library.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            const updatedTopics = [...s.topics];
            updatedTopics[topicIndex] = { ...updatedTopics[topicIndex], ...updates };
            return { ...s, topics: updatedTopics };
          });

          const updatedCurrent =
            state.currentSession?.id === sessionId
              ? {
                  ...state.currentSession,
                  topics: state.currentSession.topics.map((t, i) =>
                    i === topicIndex ? { ...t, ...updates } : t
                  ),
                }
              : state.currentSession;

          return {
            library: { sessions: updatedSessions },
            currentSession: updatedCurrent,
          };
        }),

      updateQuestion: (sessionId, topicIndex, questionIndex, updates) =>
        set((state) => {
          const updatedSessions = state.library.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            const updatedTopics = [...s.topics];
            const updatedQuestions = [...updatedTopics[topicIndex].questions];
            updatedQuestions[questionIndex] = {
              ...updatedQuestions[questionIndex],
              ...updates,
            };
            updatedTopics[topicIndex] = {
              ...updatedTopics[topicIndex],
              questions: updatedQuestions,
            };
            return { ...s, topics: updatedTopics };
          });

          const updatedCurrent =
            state.currentSession?.id === sessionId
              ? {
                  ...state.currentSession,
                  topics: state.currentSession.topics.map((t, ti) =>
                    ti === topicIndex
                      ? {
                          ...t,
                          questions: t.questions.map((q, qi) =>
                            qi === questionIndex ? { ...q, ...updates } : q
                          ),
                        }
                      : t
                  ),
                }
              : state.currentSession;

          return {
            library: { sessions: updatedSessions },
            currentSession: updatedCurrent,
          };
        }),

      updateScore: (sessionId, updates) =>
        set((state) => ({
          library: {
            sessions: state.library.sessions.map((s) =>
              s.id === sessionId
                ? { ...s, score: { ...s.score, ...updates } }
                : s
            ),
          },
          currentSession:
            state.currentSession?.id === sessionId
              ? {
                  ...state.currentSession,
                  score: { ...state.currentSession.score, ...updates },
                }
              : state.currentSession,
        })),

      saveSnippet: (sessionId, snippet) => {
        const newSnippet: CodeSnippet = {
          ...snippet,
          id: `snippet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          savedAt: Date.now(),
        };

        set((state) => {
          const updatedSessions = state.library.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            const existingSnippets = s.savedSnippets || [];
            return { ...s, savedSnippets: [...existingSnippets, newSnippet] };
          });

          const updatedCurrent =
            state.currentSession?.id === sessionId
              ? {
                  ...state.currentSession,
                  savedSnippets: [...(state.currentSession.savedSnippets || []), newSnippet],
                }
              : state.currentSession;

          return {
            library: { sessions: updatedSessions },
            currentSession: updatedCurrent,
          };
        });

        // Sync to cloud
        const updatedSession = get().library.sessions.find(s => s.id === sessionId);
        if (updatedSession) {
          sessionApi.updateSession(updatedSession);
        }
      },

      deleteSnippet: (sessionId, snippetId) => {
        set((state) => {
          const updatedSessions = state.library.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            return {
              ...s,
              savedSnippets: (s.savedSnippets || []).filter(snip => snip.id !== snippetId),
            };
          });

          const updatedCurrent =
            state.currentSession?.id === sessionId
              ? {
                  ...state.currentSession,
                  savedSnippets: (state.currentSession.savedSnippets || []).filter(
                    snip => snip.id !== snippetId
                  ),
                }
              : state.currentSession;

          return {
            library: { sessions: updatedSessions },
            currentSession: updatedCurrent,
          };
        });

        // Sync to cloud
        const updatedSession = get().library.sessions.find(s => s.id === sessionId);
        if (updatedSession) {
          sessionApi.updateSession(updatedSession);
        }
      },

      // Fetch sessions from cloud and merge with local sessions
      syncWithCloud: async () => {
        const { isSyncing } = get();
        if (isSyncing) return; // Prevent concurrent syncs

        set({ isSyncing: true });

        try {
          const cloudSessions = await sessionApi.fetchSessions();

          if (cloudSessions.length > 0) {
            set((state) => {
              // Create a map of local sessions by ID for quick lookup
              const localSessionMap = new Map(
                state.library.sessions.map(s => [s.id, s])
              );

              // Merge cloud sessions with local, preferring newer versions
              const mergedSessions: Session[] = [];
              const seenIds = new Set<string>();

              // First, add all cloud sessions
              for (const cloudSession of cloudSessions) {
                const localSession = localSessionMap.get(cloudSession.id);

                if (localSession) {
                  // If exists locally, use the one with more recent updates
                  // Compare by createdAt or any update indicator
                  const useCloud = cloudSession.createdAt >= localSession.createdAt;
                  mergedSessions.push(useCloud ? cloudSession : localSession);
                } else {
                  // Cloud session doesn't exist locally, add it
                  mergedSessions.push(cloudSession);
                }
                seenIds.add(cloudSession.id);
              }

              // Add local sessions that aren't in cloud
              for (const localSession of state.library.sessions) {
                if (!seenIds.has(localSession.id)) {
                  mergedSessions.push(localSession);
                }
              }

              // Sort by createdAt descending (newest first)
              mergedSessions.sort((a, b) => b.createdAt - a.createdAt);

              return {
                library: { sessions: mergedSessions },
                lastSyncedAt: Date.now(),
              };
            });
          }
        } catch (error) {
          console.warn('Failed to sync with cloud:', error);
        } finally {
          set({ isSyncing: false });
        }
      },

      // Mark a session as failed to sync
      markSyncFailed: (sessionId: string, error: string) => {
        set((state) => {
          const existingError = state.syncErrors[sessionId];
          const attempts = (existingError?.attempts || 0) + 1;

          // Only track if under max retry attempts (3)
          if (attempts > 3) {
            console.error(`Session ${sessionId} failed to sync after ${attempts} attempts. Giving up.`);
            // Remove from pending after max retries
            return {
              pendingSyncSessions: state.pendingSyncSessions.filter(id => id !== sessionId),
              syncErrors: {
                ...state.syncErrors,
                [sessionId]: { error, lastAttempt: Date.now(), attempts },
              },
            };
          }

          return {
            pendingSyncSessions: state.pendingSyncSessions.includes(sessionId)
              ? state.pendingSyncSessions
              : [...state.pendingSyncSessions, sessionId],
            syncErrors: {
              ...state.syncErrors,
              [sessionId]: { error, lastAttempt: Date.now(), attempts },
            },
          };
        });
      },

      // Mark a session as successfully synced
      markSyncSuccess: (sessionId: string) => {
        set((state) => {
          const { [sessionId]: _, ...remainingErrors } = state.syncErrors;
          return {
            pendingSyncSessions: state.pendingSyncSessions.filter(id => id !== sessionId),
            syncErrors: remainingErrors,
          };
        });
      },

      // Retry syncing all pending sessions
      retryPendingSyncs: async () => {
        const { pendingSyncSessions, library, syncErrors } = get();
        if (pendingSyncSessions.length === 0) return;

        console.log(`Retrying sync for ${pendingSyncSessions.length} sessions...`);

        for (const sessionId of pendingSyncSessions) {
          const session = library.sessions.find(s => s.id === sessionId);
          if (!session) {
            // Session no longer exists, remove from pending
            get().markSyncSuccess(sessionId);
            continue;
          }

          const errorInfo = syncErrors[sessionId];
          if (errorInfo && errorInfo.attempts >= 3) {
            console.warn(`Skipping session ${sessionId} - max retries exceeded`);
            continue;
          }

          try {
            await sessionApi.saveSession(session);
            get().markSyncSuccess(sessionId);
            console.log(`Successfully synced session ${sessionId}`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            get().markSyncFailed(sessionId, errorMessage);
            console.warn(`Failed to retry sync for session ${sessionId}:`, error);
          }
        }
      },

      // Get count of local sessions (for migration prompt)
      getLocalSessionCount: () => {
        const { library } = get();
        return library.sessions.length;
      },

      // Migrate all local sessions to the cloud
      migrateLocalSessions: async () => {
        const { library, isSyncing } = get();
        if (isSyncing) return;

        set({ isSyncing: true });

        const failedSessions: string[] = [];
        const successfulSessions: string[] = [];

        try {
          // Upload each local session to the cloud, handling partial failures
          for (const session of library.sessions) {
            try {
              // Validate session has required fields before migration
              if (!session.id || !session.video || !session.createdAt) {
                console.warn('Skipping invalid/corrupted session:', session.id);
                failedSessions.push(session.id || 'unknown');
                continue;
              }

              await sessionApi.saveSession(session);
              successfulSessions.push(session.id);
            } catch (sessionError) {
              console.error(`Failed to migrate session ${session.id}:`, sessionError);
              failedSessions.push(session.id);
            }
          }

          // Clear local session data after migration attempt
          // (settings remain in localStorage)
          set({
            library: { sessions: [] },
            currentSession: null,
            lastSyncedAt: Date.now(),
            migrationDismissed: true
          });

          // If some sessions failed, report them
          if (failedSessions.length > 0 && successfulSessions.length === 0) {
            throw new Error(`Migration failed for all ${failedSessions.length} sessions`);
          } else if (failedSessions.length > 0) {
            console.warn(`Migration partially complete: ${successfulSessions.length} succeeded, ${failedSessions.length} failed`);
          }
        } catch (error) {
          console.error('Migration failed:', error);
          throw error;
        } finally {
          set({ isSyncing: false });
        }
      },

      // Dismiss migration prompt without migrating
      dismissMigration: () => {
        set({ migrationDismissed: true });
      },

      clearLibrary: () =>
        set({
          library: { sessions: [] },
          currentSession: null,
          processingState: null,
          pendingSyncSessions: [],
          syncErrors: {},
        }),
    }),
    {
      name: 'youtube-learning-sessions',
      partialize: (state) => ({
        library: state.library,
        currentSession: state.currentSession,
        migrationDismissed: state.migrationDismissed,
        pendingSyncSessions: state.pendingSyncSessions,
        syncErrors: state.syncErrors,
      }),
    }
  )
);

export { generateId };
