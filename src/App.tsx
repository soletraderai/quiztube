import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/ui/Layout';
import SidebarLayout from './components/ui/SidebarLayout';
import ErrorBoundary from './components/ui/ErrorBoundary';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Library from './pages/Library';
import Feed from './pages/Feed';
import Goals from './pages/Goals';
import SessionOverview from './pages/SessionOverview';
import ActiveSession from './pages/ActiveSession';
import SessionNotes from './pages/SessionNotes';
import NotFound from './pages/NotFound';
import Pricing from './pages/Pricing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import EmailVerification from './pages/EmailVerification';
import Unsubscribe from './pages/Unsubscribe';
import CheckoutSuccess from './pages/CheckoutSuccess';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import ReviewSession from './pages/ReviewSession';
import KnowledgeMap from './pages/KnowledgeMap';
import TimedSessions from './pages/TimedSessions';
import TimedSessionActive from './pages/TimedSessionActive';
import TimedSessionResults from './pages/TimedSessionResults';
import TimedSessionHistory from './pages/TimedSessionHistory';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import AuthCallback from './pages/AuthCallback';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Auth routes - no layout */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email/:token" element={<EmailVerification />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Public routes with top navbar (old Layout) */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="terms" element={<Terms />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="404" element={<NotFound />} />
          </Route>

          {/* App routes with sidebar navigation */}
          <Route element={<SidebarLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="settings" element={<Settings />} />
            <Route path="library" element={<Library />} />
            <Route path="feed" element={<Feed />} />
            <Route path="goals" element={<Goals />} />
            <Route path="review" element={<ReviewSession />} />
            <Route path="knowledge-map" element={<KnowledgeMap />} />
            <Route path="timed-sessions" element={<TimedSessions />} />
            <Route path="timed-sessions/history" element={<TimedSessionHistory />} />
            <Route path="timed-sessions/:sessionId/active" element={<TimedSessionActive />} />
            <Route path="timed-sessions/:sessionId/results" element={<TimedSessionResults />} />
            <Route path="session/:sessionId/overview" element={<SessionOverview />} />
            <Route path="session/:sessionId/active" element={<ActiveSession />} />
            <Route path="session/:sessionId/notes" element={<SessionNotes />} />
            <Route path="checkout/success" element={<CheckoutSuccess />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
