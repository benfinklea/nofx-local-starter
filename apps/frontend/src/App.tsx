import * as React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppTheme } from './theme';
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

export default function App(){
  // Use hash router to avoid server config; base path is set by Vite
  return (
    <AppTheme>
      <HashRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<Dashboard/>} />
            <Route path="/runs" element={<Runs/>} />
            <Route path="/runs/new" element={<NewRun/>} />
            <Route path="/runs/:id" element={<RunDetail/>} />
            <Route path="/models" element={<Models/>} />
            <Route path="/projects" element={<Projects/>} />
            <Route path="/settings" element={<Settings/>} />
            <Route path="/dlq" element={<DLQ/>} />
            <Route path="/dev" element={<DevLinks/>} />
            <Route path="/dev/tools" element={<DevTools/>} />
          </Routes>
        </Shell>
      </HashRouter>
    </AppTheme>
  );
}
