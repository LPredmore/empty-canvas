import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/components/Dashboard';
import { PeopleList, PersonDetail } from '@/components/PeopleViews';
import { ConversationList, ConversationDetail } from '@/components/ConversationViews';
import { IssueList, IssueDetail } from '@/components/IssueViews';
import { TimelineView } from '@/components/TimelineView';
import { RulesDashboard, LegalDocDetail, AgreementDetail } from '@/components/RulesViews';
import { AssistantView } from '@/components/AssistantView';
import { Login } from '@/components/Login';
import { supabase } from '@/lib/supabase';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" replace />} />
        
        <Route path="/" element={session ? <Layout /> : <Navigate to="/login" replace />}>
          <Route index element={<Dashboard />} />
          
          <Route path="assistant" element={<AssistantView />} />
          
          <Route path="people" element={<PeopleList />} />
          <Route path="people/:id" element={<PersonDetail />} />
          
          <Route path="conversations" element={<ConversationList />} />
          <Route path="conversations/:id" element={<ConversationDetail />} />
          
          <Route path="issues" element={<IssueList />} />
          <Route path="issues/:id" element={<IssueDetail />} />

          <Route path="rules" element={<RulesDashboard />} />
          <Route path="rules/legal/:id" element={<LegalDocDetail />} />
          <Route path="rules/agreements/:id" element={<AgreementDetail />} />
          
          <Route path="timeline" element={<TimelineView />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
