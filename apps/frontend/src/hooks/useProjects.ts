import * as React from 'react';
import { listProjects, type Project } from '../lib/api';

export function useProjects() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [projectId, setProjectId] = React.useState<string>(() => localStorage.getItem('projectId') || 'default');
  const selected = React.useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    listProjects().then(rows => { if (mounted) { setProjects(rows); setLoading(false); } }).catch(()=>{ if(mounted){ setLoading(false);} });
    return () => { mounted = false; };
  }, []);

  const select = React.useCallback((id: string) => {
    setProjectId(id);
    try { localStorage.setItem('projectId', id); } catch {}
  }, []);

  return { projects, loading, projectId, selected, select };
}

