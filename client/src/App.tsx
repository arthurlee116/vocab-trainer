import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import { useAuthStore } from './store/useAuthStore';
import AppLayout from './components/AppLayout';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import ConfirmWordsPage from './pages/ConfirmWordsPage';
import VocabularyDetailsPage from './pages/VocabularyDetailsPage';
import QuizPage from './pages/QuizPage';
import ReportPage from './pages/ReportPage';
import HistoryPage from './pages/HistoryPage';
import { usePracticeStore } from './store/usePracticeStore';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { mode, initializing } = useAuthStore();
  if (initializing) {
    return <div className="page-loading">正在加载...</div>;
  }
  if (mode === 'unauthenticated') {
    return <Navigate to="/" replace />;
  }
  return children;
};

const RequireWords = ({ children }: { children: ReactNode }) => {
  const { words } = usePracticeStore();
  if (!words.length) {
    return <Navigate to="/practice/upload" replace />;
  }
  return children;
};

const RequireSuperJson = ({ children }: { children: ReactNode }) => {
  const { superJson } = usePracticeStore();
  if (!superJson) {
    return <Navigate to="/practice/confirm" replace />;
  }
  return children;
};

const RequireSession = ({ children }: { children: ReactNode }) => {
  const { sessionId } = usePracticeStore();
  if (!sessionId) {
    return <Navigate to="/practice/confirm" replace />;
  }
  return children;
};

const RequireDetailsReady = ({ children }: { children: ReactNode }) => {
  const { detailsStatus, vocabDetails } = usePracticeStore();
  if (detailsStatus !== 'ready' || !vocabDetails?.length) {
    return <Navigate to="/practice/details" replace />;
  }
  return children;
};

const RequireResult = ({ children }: { children: ReactNode }) => {
  const { lastResult } = usePracticeStore();
  if (!lastResult) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

function App() {
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/practice/upload"
          element={
            <ProtectedRoute>
              <AppLayout>
                <UploadPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/practice/confirm"
          element={
            <ProtectedRoute>
              <RequireWords>
                <AppLayout>
                  <ConfirmWordsPage />
                </AppLayout>
              </RequireWords>
            </ProtectedRoute>
          }
        />
        <Route
          path="/practice/details"
          element={
            <ProtectedRoute>
              <RequireWords>
                <RequireSession>
                  <AppLayout fullWidth>
                    <VocabularyDetailsPage />
                  </AppLayout>
                </RequireSession>
              </RequireWords>
            </ProtectedRoute>
          }
        />
        <Route
          path="/practice/run"
          element={
            <ProtectedRoute>
              <RequireSuperJson>
                <RequireDetailsReady>
                  <AppLayout fullWidth>
                    <QuizPage />
                  </AppLayout>
                </RequireDetailsReady>
              </RequireSuperJson>
            </ProtectedRoute>
          }
        />
        <Route
          path="/practice/report"
          element={
            <ProtectedRoute>
              <RequireResult>
                <AppLayout>
                  <ReportPage />
                </AppLayout>
              </RequireResult>
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <AppLayout>
                <HistoryPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
