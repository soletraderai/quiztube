import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import ErrorBoundary from './ErrorBoundary';
import OfflineBanner from './OfflineBanner';
import PageTransition from './PageTransition';
import HelpPanel from './HelpPanel';
import MaterialIcon from './MaterialIcon';
import type { ParsedTranscriptSegment } from '../../types';

const SIDEBAR_COLLAPSED_KEY = 'quiztube-sidebar-collapsed';

// Phase 7 F2: Transcript context data for help panel
interface TranscriptContextData {
  transcriptSegments?: ParsedTranscriptSegment[];
  currentTimestampStart?: number;
  currentTimestampEnd?: number;
  videoUrl?: string;
}

// Context for help panel
interface HelpContextType {
  openHelp: (context?: string) => void;
  closeHelp: () => void;
  isHelpOpen: boolean;
  // Phase 7 F2: Methods to set transcript context
  setTranscriptContext: (data: TranscriptContextData) => void;
  clearTranscriptContext: () => void;
}

const HelpContext = createContext<HelpContextType | null>(null);

export function useHelpContext() {
  const context = useContext(HelpContext);
  if (!context) {
    throw new Error('useHelpContext must be used within a SidebarLayout');
  }
  return context;
}

export default function SidebarLayout() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return stored === 'true';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpContext, setHelpContext] = useState('default');
  // Phase 7 F2: Transcript context state
  const [transcriptContext, setTranscriptContextState] = useState<TranscriptContextData>({});

  // Determine help context based on current route
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/session/') && path.includes('/active')) {
      setHelpContext('session');
    } else if (path.includes('/review')) {
      setHelpContext('review');
    } else if (path.includes('/library')) {
      setHelpContext('library');
    } else if (path.includes('/dashboard')) {
      setHelpContext('dashboard');
    } else {
      setHelpContext('default');
    }
  }, [location.pathname]);

  const openHelp = (context?: string) => {
    if (context) setHelpContext(context);
    setHelpOpen(true);
  };

  const closeHelp = () => setHelpOpen(false);

  // Phase 7 F2: Methods to manage transcript context
  const setTranscriptContext = useCallback((data: TranscriptContextData) => {
    setTranscriptContextState(data);
  }, []);

  const clearTranscriptContext = useCallback(() => {
    setTranscriptContextState({});
  }, []);

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close mobile menu on escape key
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
      // Cmd/Ctrl + B to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const helpContextValue: HelpContextType = {
    openHelp,
    closeHelp,
    isHelpOpen: helpOpen,
    // Phase 7 F2: Include transcript context methods
    setTranscriptContext,
    clearTranscriptContext,
  };

  return (
    <HelpContext.Provider value={helpContextValue}>
      <div className="min-h-screen bg-background">
        {/* Offline Banner */}
        <OfflineBanner />

        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="skip-link"
        >
          Skip to main content
        </a>

        {/* Sidebar Navigation */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
          onHelpClick={() => openHelp()}
        />

        {/* Mobile Header */}
        <header className="fixed top-0 left-0 right-0 h-14 bg-[#1a1a1a] border-b border-white/10 flex items-center justify-between px-4 z-20 md:hidden">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-white/70 hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <MaterialIcon name="menu" size="lg" />
          </button>
          <span className="font-heading font-bold text-white">QuizTube</span>
          <button
            onClick={() => openHelp()}
            className="p-2 text-white/70 hover:text-white transition-colors"
            aria-label="Get help"
          >
            <MaterialIcon name="help_outline" size="lg" />
          </button>
        </header>

        {/* Main Content Area */}
        <main
          id="main-content"
          className={`transition-all duration-300 ease-in-out min-h-screen bg-eg-paper dot-grid-subtle ${
            sidebarCollapsed ? 'md:ml-16' : 'md:ml-60'
          } pt-14 md:pt-0`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
            <ErrorBoundary>
              <PageTransition>
                <Outlet />
              </PageTransition>
            </ErrorBoundary>
          </div>
        </main>

        {/* Help Panel */}
        <HelpPanel
          isOpen={helpOpen}
          onClose={closeHelp}
          context={helpContext}
          // Phase 7 F2: Pass transcript context props
          transcriptSegments={transcriptContext.transcriptSegments}
          currentTimestampStart={transcriptContext.currentTimestampStart}
          currentTimestampEnd={transcriptContext.currentTimestampEnd}
          videoUrl={transcriptContext.videoUrl}
        />
      </div>
    </HelpContext.Provider>
  );
}
