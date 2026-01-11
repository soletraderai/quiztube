import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/ui/Layout';
import ErrorBoundary from './components/ui/ErrorBoundary';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Library from './pages/Library';
import SessionOverview from './pages/SessionOverview';
import ActiveSession from './pages/ActiveSession';
import SessionNotes from './pages/SessionNotes';
import NotFound from './pages/NotFound';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import EmailVerification from './pages/EmailVerification';

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

          {/* App routes with layout */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="settings" element={<Settings />} />
            <Route path="library" element={<Library />} />
            <Route path="session/:sessionId/overview" element={<SessionOverview />} />
            <Route path="session/:sessionId/active" element={<ActiveSession />} />
            <Route path="session/:sessionId/notes" element={<SessionNotes />} />
            <Route path="404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
