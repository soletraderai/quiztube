import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session, Library, ProcessingState } from '../types';
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
    } catch (error) {
      console.warn('Cloud sync complete error:', error);
    }
  },
};

interface SessionState {
  library: Library;
  currentSession: Session | null;
  processingState: ProcessingState | null;

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

      createSession: (session) => {
        // Sync to cloud database
        sessionApi.saveSession(session);
        return set((state) => ({
          library: {
            sessions: [session, ...state.library.sessions],
          },
          currentSession: session,
        }));
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

        // Sync to cloud after local update
        const updatedSession = get().library.sessions.find(s => s.id === sessionId);
        if (updatedSession) {
          if (updates.status === 'completed') {
            sessionApi.completeSession(updatedSession);
          } else {
            sessionApi.updateSession(updatedSession);
          }
        }

        return result;
      },

      deleteSession: (sessionId) =>
        set((state) => ({
          library: {
            sessions: state.library.sessions.filter((s) => s.id !== sessionId),
          },
          currentSession:
            state.currentSession?.id === sessionId ? null : state.currentSession,
        })),

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

      clearLibrary: () =>
        set({
          library: { sessions: [] },
          currentSession: null,
          processingState: null,
        }),
    }),
    {
      name: 'youtube-learning-sessions',
    }
  )
);

export { generateId };
