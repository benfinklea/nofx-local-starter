import * as React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppTheme } from './theme';
import AuthCheck from './AuthCheck';
import Shell from './components/Shell';
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
import { uiFlags } from './config';

export default function App(){
  // Use hash router to avoid server config; base path is set by Vite
  return (
    <AppTheme>
      <AuthCheck>
        <HashRouter>
          <Shell>
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
          </Routes>
        </Shell>
      </HashRouter>
      </AuthCheck>
    </AppTheme>
  );
}
