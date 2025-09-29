import * as React from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppTheme } from './theme';
import AuthCheck from './AuthCheck';
import ManifestShell from './components/ManifestShell';
import Dashboard from './pages/Dashboard';
import Runs from './pages/Runs';
import NewRun from './pages/NewRun';
import RunDetail from './pages/RunDetail';
import DevLinks from './pages/DevLinks';
import Models from './pages/Models';
import Settings from './pages/Settings';
import DLQ from './pages/DLQ';
import Projects from './pages/Projects';
import DevTools from './pages/DevTools';
import ResponsesDashboard from './pages/responses/ResponsesDashboard';
import ResponsesRunDetail from './pages/responses/ResponsesRunDetail';
import Builder from './pages/Builder';
import NavigationConsole from './pages/NavigationConsole';
import ResetPassword from './components/ResetPassword';
import SignupForm from './components/SignupForm';
import { uiFlags } from './config';

function AppRoutes() {
  const location = useLocation();

  // Don't require auth for reset password and signup pages
  if (location.pathname === '/reset-password') {
    return <ResetPassword />;
  }

  if (location.pathname === '/signup') {
    return <SignupForm />;
  }

  // Auth check re-enabled with new server-side authentication
  return (
    <AuthCheck>
      <ManifestShell>
        <Routes>
          <Route path="/" element={<Dashboard/>} />
          <Route path="/runs" element={<Runs/>} />
          <Route path="/runs/new" element={<NewRun/>} />
          <Route path="/runs/:id" element={<RunDetail/>} />
          {uiFlags.responses && (
            <>
              <Route path="/responses" element={<ResponsesDashboard />} />
              <Route path="/responses/:id" element={<ResponsesRunDetail />} />
            </>
          )}
          <Route path="/models" element={<Models/>} />
          <Route path="/projects" element={<Projects/>} />
          <Route path="/settings" element={<Settings/>} />
          <Route path="/dlq" element={<DLQ/>} />
          <Route path="/builder" element={<Builder/>} />
          <Route path="/dev" element={<DevLinks/>} />
          <Route path="/dev/tools" element={<DevTools/>} />
          <Route path="/dev/navigation" element={<NavigationConsole/>} />
        </Routes>
      </ManifestShell>
    </AuthCheck>
  );
}

export default function App(){
  // Use hash router to avoid server config; base path is set by Vite
  return (
    <AppTheme>
      <HashRouter>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/signup" element={<SignupForm />} />
          <Route path="/*" element={<AppRoutes />} />
        </Routes>
      </HashRouter>
    </AppTheme>
  );
}
