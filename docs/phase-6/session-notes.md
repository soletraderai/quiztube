# Phase 6: Session Notes - January 15, 2026

## Session Summary

This session attempted to implement fixes for user session and tier management issues as outlined in `session-tier-fix-plan.md`. The implementation was completed but **did not resolve the underlying issues**.

---

## What Was Done

### Pre-Implementation Discovery

Before implementing fixes, I discovered that **some fixes had already been made as uncommitted local changes**:

1. **CheckoutSuccess.tsx** - Already had the fix: `setUser(backendUserToAuthUser(backendData))` instead of `setUser(userData.user)`
2. **authStore.ts** - Already had:
   - `backendUserToAuthUser` helper function
   - Logout clearing session store via `clearLibrary()`
   - Better error handling in `initializeAuth()`
3. **main.tsx** - Had partial fix: removed setTimeout, uses async/await but still called without awaiting

These uncommitted changes were committed as:
```
73d765e fix: Address Critical Bug #1 and #2 - user state and session clearing
```

---

## Changes Made in This Session

### Commit 1: `73d765e` - Critical Bug Fixes (Pre-existing uncommitted changes)

**Files:**
- `src/pages/CheckoutSuccess.tsx`
- `src/stores/authStore.ts`
- `src/main.tsx`

**Changes:**
- Fixed `setUser(userData.user)` to `setUser(backendUserToAuthUser(backendData))` in CheckoutSuccess.tsx
- Added `backendUserToAuthUser` helper to authStore
- Added logout clearing session store
- Improved auth initialization error handling
- Removed setTimeout hack in main.tsx

---

### Commit 2: `ac0c840` - Race Conditions and Sync Reliability

**Files Modified:**

#### `src/main.tsx`
```typescript
// BEFORE: Called initializeApp() without awaiting
initializeApp();
createRoot(...).render(...)

// AFTER: Removed initialization, just renders App
// Auth initialization moved to App.tsx
createRoot(...).render(...)
```

#### `src/App.tsx`
Added two new components:

1. **AuthInitializer** - Wraps entire app, shows loading spinner while auth initializes
```typescript
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    const init = async () => {
      try {
        await useAuthStore.getState().initializeAuth();
        const { isAuthenticated, accessToken } = useAuthStore.getState();
        if (isAuthenticated() && accessToken) {
          await useSessionStore.getState().syncWithCloud();
        }
      } catch (error) {
        console.error('App initialization error:', error);
      } finally {
        setIsReady(true);
      }
    };
    init();
  }, []);

  if (!isReady || isLoading) {
    return <LoadingSpinner />;
  }
  return <>{children}</>;
}
```

2. **SyncRetryManager** - Automatically retries failed syncs when coming back online
```typescript
function SyncRetryManager() {
  const isOnline = useOnlineStatus();
  const pendingSyncCount = useSessionStore((s) => s.pendingSyncSessions.length);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  useEffect(() => {
    if (isOnline && pendingSyncCount > 0 && isAuthenticated) {
      useSessionStore.getState().retryPendingSyncs();
    }
  }, [isOnline, pendingSyncCount, isAuthenticated]);

  return null;
}
```

#### `src/stores/authStore.ts`
Changed sync behavior in `onAuthStateChange` listener:
```typescript
// BEFORE: Synced on both SIGNED_IN and INITIAL_SESSION
if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
  // ... sync always happened
  import('./sessionStore').then(({ useSessionStore }) => {
    useSessionStore.getState().syncWithCloud();
  });
}

// AFTER: Only sync on SIGNED_IN (not INITIAL_SESSION)
if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
  // ... user data fetched

  // Only sync on SIGNED_IN to avoid duplicate with AuthInitializer
  if (event === 'SIGNED_IN') {
    import('./sessionStore').then(({ useSessionStore }) => {
      useSessionStore.getState().syncWithCloud();
    });
  }
}
```

#### `src/stores/sessionStore.ts`

**Added new state fields:**
```typescript
pendingSyncSessions: string[];  // Session IDs pending sync
syncErrors: Record<string, SyncError>;  // Error tracking per session
```

**Added SyncError type:**
```typescript
interface SyncError {
  error: string;
  lastAttempt: number;
  attempts: number;
}
```

**Added new actions:**

1. `markSyncFailed(sessionId, error)` - Tracks failed syncs, max 3 retries
2. `markSyncSuccess(sessionId)` - Clears error tracking for session
3. `retryPendingSyncs()` - Retries all pending syncs

**Modified `createSession`:**
```typescript
// BEFORE: Fire-and-forget
createSession: (session) => {
  sessionApi.saveSession(session);  // Not awaited, no error tracking
  return set((state) => ({ ... }));
}

// AFTER: Optimistic update with error tracking
createSession: (session) => {
  set((state) => ({ ... }));  // Update local immediately

  sessionApi.saveSession(session)
    .then(() => get().markSyncSuccess(session.id))
    .catch((error) => get().markSyncFailed(session.id, error.message));
}
```

**Modified `updateSession`:**
```typescript
// BEFORE: Fire-and-forget
if (updates.status === 'completed') {
  sessionApi.completeSession(updatedSession);
} else {
  sessionApi.updateSession(updatedSession);
}

// AFTER: With error tracking
const syncPromise = updates.status === 'completed'
  ? sessionApi.completeSession(updatedSession)
  : sessionApi.updateSession(updatedSession);

syncPromise
  .then(() => get().markSyncSuccess(sessionId))
  .catch((error) => get().markSyncFailed(sessionId, error.message));
```

**Added `sessionApi.deleteSession`:**
```typescript
async deleteSession(localSessionId: string): Promise<void> {
  const headers = getAuthHeaders();
  if (!headers) return;

  try {
    const findResponse = await fetch(`${API_BASE}/sessions`, { headers });
    if (findResponse.ok) {
      const data = await findResponse.json();
      const cloudSession = data.sessions?.find((s: any) => {
        try {
          return s.sessionData && JSON.parse(s.sessionData).id === localSessionId;
        } catch { return false; }
      });

      if (cloudSession) {
        await fetch(`${API_BASE}/sessions/${cloudSession.id}`, {
          method: 'DELETE',
          headers,
        });
      }
    }
  } catch (error) {
    throw error;
  }
}
```

**Modified store `deleteSession`:**
```typescript
// BEFORE: Local only
deleteSession: (sessionId) => set((state) => ({ ... }))

// AFTER: Local + cloud
deleteSession: (sessionId) => {
  set((state) => ({
    library: { sessions: state.library.sessions.filter(s => s.id !== sessionId) },
    currentSession: state.currentSession?.id === sessionId ? null : state.currentSession,
    pendingSyncSessions: state.pendingSyncSessions.filter(id => id !== sessionId),
  }));

  sessionApi.deleteSession(sessionId).catch((error) => {
    console.warn(`Failed to delete session ${sessionId} from cloud:`, error);
  });
}
```

**Updated `clearLibrary`:**
```typescript
// BEFORE:
clearLibrary: () => set({
  library: { sessions: [] },
  currentSession: null,
  processingState: null,
})

// AFTER: Also clears sync tracking
clearLibrary: () => set({
  library: { sessions: [] },
  currentSession: null,
  processingState: null,
  pendingSyncSessions: [],
  syncErrors: {},
})
```

**Updated persist partialize:**
```typescript
// BEFORE:
partialize: (state) => ({
  library: state.library,
  currentSession: state.currentSession,
  migrationDismissed: state.migrationDismissed,
})

// AFTER: Persists sync tracking
partialize: (state) => ({
  library: state.library,
  currentSession: state.currentSession,
  migrationDismissed: state.migrationDismissed,
  pendingSyncSessions: state.pendingSyncSessions,
  syncErrors: state.syncErrors,
})
```

---

## Issues That May Still Exist

### 1. The Underlying Problem May Not Be What We Thought
The plan document identified bugs, but the behavior after fixes suggests the root cause may be different.

### 2. Possible Remaining Issues to Investigate

**A. Backend API `/auth/me` Response Structure**
- Need to verify exactly what the backend returns
- The `backendUserToAuthUser` function may not be mapping correctly
- Check if `tier` is actually being returned from the backend

**B. Supabase Session Handling**
- The `onAuthStateChange` listener fires multiple times
- `INITIAL_SESSION` may be firing before backend user data is fetched
- Token refresh may be overwriting tier data

**C. Database Subscription State**
- Check if the `subscriptions` table has correct data for the user
- The backend `/auth/me` endpoint queries this - verify the query is correct

**D. Race Condition in AuthInitializer**
- The `isAuthenticated()` check may be unreliable
- Zustand hydration from localStorage may interfere

**E. Possible Circular Dependencies**
- authStore imports sessionStore dynamically
- sessionStore imports authStore directly
- This could cause initialization issues

---

## Files Changed (Summary)

| File | Lines Changed |
|------|---------------|
| `src/main.tsx` | -20, +6 |
| `src/App.tsx` | +40 (new components) |
| `src/stores/authStore.ts` | +10 (sync condition change) |
| `src/stores/sessionStore.ts` | +150 (pending sync infrastructure) |

---

## Git Commits Made

```
73d765e fix: Address Critical Bug #1 and #2 - user state and session clearing
ac0c840 fix: Resolve race conditions and add session sync reliability (Phase 6)
```

---

## Next Steps to Investigate

1. **Add Logging** - Add console.logs to track:
   - What `authApi.getMe()` actually returns
   - What `backendUserToAuthUser()` produces
   - When `setUser()` is called and with what value
   - The sequence of auth events

2. **Check Backend** - Verify:
   - `/api/auth/me` endpoint returns correct tier
   - `subscriptions` table has correct data
   - JWT token contains correct user ID

3. **Test Scenarios**:
   - Fresh signup → check tier
   - Dev upgrade via `/checkout/success?dev_mode=true` → check tier
   - Logout → login → check tier persists
   - Hard refresh → check tier persists

4. **Consider Rollback** - If these changes made things worse, we may need to revert and try a different approach.

---

## Build Status

The build has **pre-existing TypeScript errors** in unrelated files:
- `src/components/ui/LearningPathCard.tsx`
- `src/components/ui/SearchInput.tsx`
- `src/components/ui/URLInput.tsx`
- `src/pages/LearningPathDetail.tsx`

These errors existed before Phase 6 changes and are not related to the session/tier fixes.
