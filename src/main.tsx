import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { useAuthStore } from './stores/authStore'
import { useSessionStore } from './stores/sessionStore'
import './index.css'
import App from './App.tsx'

// Initialize auth and sync sessions on app startup
const initializeApp = async () => {
  try {
    // Wait for auth to initialize
    await useAuthStore.getState().initializeAuth();

    // Then sync sessions if authenticated
    const { isAuthenticated, accessToken } = useAuthStore.getState();
    if (isAuthenticated() && accessToken) {
      await useSessionStore.getState().syncWithCloud();
    }
  } catch (error) {
    console.error('App initialization error:', error);
  }
};

// Run initialization (non-blocking for initial render)
initializeApp();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
