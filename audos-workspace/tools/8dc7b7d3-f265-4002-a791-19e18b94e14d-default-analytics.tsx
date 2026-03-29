import { useState, useEffect } from 'react';
import { PageHeader, Grid, Stack, StatCard, DataTable, Badge, BarChart, PieChart } from 'dashboard-blocks';
import { BarChart3, Eye, Mail, TrendingUp } from 'lucide-react';

interface TemplateProps {
  workspaceId: string;
  authToken?: string;
}

export function AnalyticsDashboard({ workspaceId, authToken }: TemplateProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [eventCounts, setEventCounts] = useState<any>({});
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const __dt = typeof localStorage !== 'undefined' ? localStorage.getItem('workspace_device_token') : null;
  const authHeaders: Record<string, string> = authToken ? { 'Authorization': 'Bearer ' + authToken } : __dt ? { 'x-device-token': __dt } : {};

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/crm/events?workspaceId=${workspaceId}&limit=500`, { credentials: 'include', headers: authHeaders });
        const data = await res.json();
        const evts = data.events || [];
        setEvents(evts);
        
        const counts: Record<string, number> = {};
        const daily: Record<string, number> = {};
        
        evts.forEach((e: any) => {
          counts[e.type] = (counts[e.type] || 0) + 1;
          const day = new Date(e.createdAt).toLocaleDateString('en-US', { weekday: 'short' });
          daily[day] = (daily[day] || 0) + 1;
        });
        
        setEventCounts(counts);
        setDailyData(Object.entries(daily).map(([label, value]) => ({ label, value: value as number })));
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [workspaceId]);

  const pieData = Object.entries(eventCounts).map(([label, value]) => ({
    label,
    value: value as number
  }));

  const recentEvents = events.slice(0, 20);

  return (
    <Stack>
      <PageHeader 
        title="Analytics Dashboard" 
        subtitle="Event tracking and funnel analysis"
      />
      
      <Grid cols={4}>
        <StatCard 
          title="Total Events" 
          value={events.length} 
          icon={<BarChart3 className="w-5 h-5" />}
        />
        <StatCard 
          title="Page Views" 
          value={eventCounts['page_view'] || 0}
          icon={<Eye className="w-5 h-5" />}
        />
        <StatCard 
          title="CTA Clicks" 
          value={eventCounts['cta_click'] || 0}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard 
          title="Email Submits" 
          value={eventCounts['email_submit'] || 0}
          icon={<Mail className="w-5 h-5" />}
        />
      </Grid>

      <Grid cols={2}>
        <BarChart 
          title="Events by Day" 
          data={dailyData}
          color="#3b82f6"
        />
        <PieChart 
          title="Events by Type" 
          data={pieData}
        />
      </Grid>

      <DataTable
        title="Recent Events"
        data={recentEvents}
        columns={[
          { key: 'type', header: 'Event Type', render: (val: string) => <Badge variant="info">{val}</Badge> },
          { key: 'page', header: 'Page' },
          { key: 'createdAt', header: 'Time', render: (val: string) => {
            if (!val) return '-';
            const date = new Date(val);
            return isNaN(date.getTime()) ? '-' : date.toLocaleString();
          }}
        ]}
        pageSize={10}
        loading={loading}
        emptyMessage="No events tracked yet."
      />
    </Stack>
  );
}
