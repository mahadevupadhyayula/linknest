import { useState, useEffect } from 'react';
import { PageHeader, Grid, Stack, StatCard, DataTable, Badge, Card, PieChart, Tabs, EmptyState } from 'dashboard-blocks';
import { Send, Users, Mail, TrendingUp, Target, CheckCircle, Clock, MessageSquare } from 'lucide-react';

interface TemplateProps {
  workspaceId: string;
  authToken?: string;
}

interface Contact {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  tags?: any[];
  createdAt: string;
  lastSeen?: string;
  eventCount?: number;
  actions?: string[];
  journeyStats?: {
    totalEvents: number;
    emailOpens?: number;
    emailClicks?: number;
  };
}

export function OutreachPipelineDashboard({ workspaceId, authToken }: TemplateProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const __dt = typeof localStorage !== 'undefined' ? localStorage.getItem('workspace_device_token') : null;
  const authHeaders: Record<string, string> = authToken ? { 'Authorization': 'Bearer ' + authToken } : __dt ? { 'x-device-token': __dt } : {};

  useEffect(() => {
    async function fetchData() {
      try {
        const [contactsRes, eventsRes] = await Promise.all([
          fetch(`/api/crm/contacts/${workspaceId}?limit=500`, {
            credentials: 'include',
            headers: authHeaders
          }),
          fetch(`/api/crm/events?workspaceId=${workspaceId}&limit=100`, {
            credentials: 'include',
            headers: authHeaders
          })
        ]);

        const contactsData = await contactsRes.json();
        const eventsData = await eventsRes.json();

        setContacts(contactsData.contacts || []);
        setEvents(eventsData.data || []);
      } catch (err) {
        console.error('Failed to fetch outreach data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [workspaceId]);

  // Categorize contacts by status based on tags and actions
  const categorizeContacts = () => {
    const categories = {
      goodProspects: [] as Contact[],
      newUnreviewed: [] as Contact[],
      contacted: [] as Contact[],
      responded: [] as Contact[]
    };

    contacts.forEach(contact => {
      const tags = contact.tags || [];
      const tagNames = tags.map(t => typeof t === 'string' ? t.toLowerCase() : (t?.name || '').toLowerCase());
      const hasEmail = !!contact.email;
      const actions = contact.actions || [];

      // Check if contacted (has email sent action or "contacted" tag)
      const wasContacted = tagNames.some(t => t.includes('contacted') || t.includes('sent') || t.includes('outreach'));

      // Check if responded
      const hasResponded = tagNames.some(t => t.includes('respond') || t.includes('reply'));

      // Check if marked as good prospect
      const isGoodProspect = tagNames.some(t =>
        t.includes('prospect') || t.includes('qualified') || t.includes('good') || t.includes('lead')
      );

      if (hasResponded) {
        categories.responded.push(contact);
      } else if (wasContacted) {
        categories.contacted.push(contact);
      } else if (isGoodProspect) {
        categories.goodProspects.push(contact);
      } else if (hasEmail) {
        categories.newUnreviewed.push(contact);
      }
    });

    return categories;
  };

  const categories = categorizeContacts();

  // Calculate metrics
  const totalLeads = contacts.length;
  const emailsSent = categories.contacted.length + categories.responded.length;
  const responseRate = emailsSent > 0
    ? ((categories.responded.length / emailsSent) * 100).toFixed(1)
    : '0';

  // Group contacts by batch (using tags as batches)
  const batchGroups = contacts.reduce((acc, contact) => {
    const tags = contact.tags || [];
    tags.forEach(tag => {
      const tagName = typeof tag === 'string' ? tag : (tag?.name || 'Untagged');
      if (!acc[tagName]) {
        acc[tagName] = [];
      }
      acc[tagName].push(contact);
    });

    // Add contacts without tags to "Untagged" batch
    if (tags.length === 0) {
      if (!acc['Untagged']) {
        acc['Untagged'] = [];
      }
      acc['Untagged'].push(contact);
    }

    return acc;
  }, {} as Record<string, Contact[]>);

  const batches = Object.entries(batchGroups).map(([name, contacts]) => ({
    name,
    count: contacts.length,
    contacted: contacts.filter(c => {
      const tags = c.tags || [];
      const tagNames = tags.map(t => typeof t === 'string' ? t.toLowerCase() : (t?.name || '').toLowerCase());
      return tagNames.some(t => t.includes('contacted') || t.includes('sent'));
    }).length
  }));

  // Recent activity - last 10 contacts and events
  const recentContacts = [...contacts]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  const recentEvents = [...events]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  // Pie chart data for lead distribution
  const pieData = [
    { label: 'Good Prospects', value: categories.goodProspects.length, color: '#0ea5e9' },
    { label: 'New/Unreviewed', value: categories.newUnreviewed.length, color: '#94a3b8' },
    { label: 'Contacted', value: categories.contacted.length, color: '#f97068' },
    { label: 'Responded', value: categories.responded.length, color: '#10b981' }
  ].filter(d => d.value > 0);

  return (
    <Stack>
      <PageHeader
        title="Outreach Pipeline"
        subtitle="Customer development and lead tracking"
        icon={<Send className="w-5 h-5 text-sky-500" />}
      />

      {/* Pipeline Overview */}
      <Grid cols={4}>
        <StatCard
          title="Total Leads"
          value={totalLeads}
          subtitle="Discovered contacts"
          icon={<Users className="w-5 h-5 text-sky-500" />}
          loading={loading}
        />
        <StatCard
          title="Good Prospects"
          value={categories.goodProspects.length}
          subtitle={`${totalLeads > 0 ? Math.round((categories.goodProspects.length / totalLeads) * 100) : 0}% of leads`}
          icon={<Target className="w-5 h-5 text-sky-500" />}
          loading={loading}
        />
        <StatCard
          title="Emails Sent"
          value={emailsSent}
          trend={emailsSent > 0 ? 'up' : 'neutral'}
          icon={<Mail className="w-5 h-5 text-coral-500" />}
          loading={loading}
        />
        <StatCard
          title="Response Rate"
          value={`${responseRate}%`}
          subtitle={`${categories.responded.length} responses`}
          icon={<MessageSquare className="w-5 h-5 text-green-500" />}
          loading={loading}
        />
      </Grid>

      {/* Pipeline Status Breakdown */}
      <Grid cols={4}>
        <Card title="Good Prospects">
          <div className="text-3xl font-bold text-sky-500">{categories.goodProspects.length}</div>
          <p className="text-sm text-gray-600 mt-1">Qualified leads ready for outreach</p>
        </Card>
        <Card title="New/Unreviewed">
          <div className="text-3xl font-bold text-gray-500">{categories.newUnreviewed.length}</div>
          <p className="text-sm text-gray-600 mt-1">Awaiting qualification</p>
        </Card>
        <Card title="Contacted">
          <div className="text-3xl font-bold text-coral-500">{categories.contacted.length}</div>
          <p className="text-sm text-gray-600 mt-1">Outreach emails sent</p>
        </Card>
        <Card title="Responded">
          <div className="text-3xl font-bold text-green-500">{categories.responded.length}</div>
          <p className="text-sm text-gray-600 mt-1">Active conversations</p>
        </Card>
      </Grid>

      {/* Lead Quality Distribution */}
      <Card title="Lead Quality Distribution">
        {pieData.length > 0 ? (
          <PieChart data={pieData} size={300} />
        ) : (
          <EmptyState
            title="No leads yet"
            description="Start adding contacts to see distribution"
            icon={<Target className="w-8 h-8" />}
          />
        )}
      </Card>

      {/* Tabs for different views */}
      <Tabs tabs={[
        {
          id: 'batches',
          label: 'Outreach Batches',
          content: (
            <DataTable
              title="Batches Summary"
              data={batches}
              columns={[
                {
                  key: 'name',
                  header: 'Batch Name',
                  sortable: true,
                  render: (val: string) => (
                    <div className="flex items-center gap-2">
                      <Badge variant="info">{val}</Badge>
                    </div>
                  )
                },
                {
                  key: 'count',
                  header: 'Total Contacts',
                  sortable: true,
                  render: (val: number) => (
                    <span className="font-semibold">{val}</span>
                  )
                },
                {
                  key: 'contacted',
                  header: 'Contacted',
                  sortable: true,
                  render: (val: number, row: any) => (
                    <div className="flex items-center gap-2">
                      <span>{val}</span>
                      <Badge variant={val > 0 ? 'success' : 'default'}>
                        {row.count > 0 ? Math.round((val / row.count) * 100) : 0}%
                      </Badge>
                    </div>
                  )
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (_, row: any) => {
                    const isActive = row.contacted < row.count;
                    return (
                      <Badge variant={isActive ? 'warning' : 'success'}>
                        {isActive ? 'Active' : 'Completed'}
                      </Badge>
                    );
                  }
                }
              ]}
              searchable
              searchKeys={['name']}
              pageSize={10}
              loading={loading}
              emptyMessage="No batches found. Tag your contacts to organize them into batches."
            />
          )
        },
        {
          id: 'prospects',
          label: 'Good Prospects',
          content: (
            <DataTable
              title="Qualified Prospects"
              data={categories.goodProspects}
              columns={[
                { key: 'email', header: 'Email', sortable: true },
                {
                  key: 'name',
                  header: 'Name',
                  sortable: true,
                  render: (_, row: Contact) => row.firstName && row.lastName
                    ? `${row.firstName} ${row.lastName}`
                    : row.name || '-'
                },
                {
                  key: 'tags',
                  header: 'Tags',
                  render: (tags: any[]) => tags?.length ? (
                    <div className="flex gap-1 flex-wrap">
                      {tags.slice(0, 2).map((tag, i) => (
                        <Badge key={i} variant="info">
                          {typeof tag === 'string' ? tag : tag?.name || 'Tag'}
                        </Badge>
                      ))}
                      {tags.length > 2 && <Badge variant="default">+{tags.length - 2}</Badge>}
                    </div>
                  ) : '-'
                },
                {
                  key: 'createdAt',
                  header: 'Added',
                  sortable: true,
                  render: (val: string) => new Date(val).toLocaleDateString()
                }
              ]}
              searchable
              searchKeys={['email', 'name', 'firstName', 'lastName']}
              pageSize={10}
              loading={loading}
              emptyMessage="No qualified prospects yet. Tag contacts as 'prospect' or 'qualified' to see them here."
            />
          )
        },
        {
          id: 'activity',
          label: 'Recent Activity',
          content: (
            <Stack gap="md">
              <Card title="Latest Leads Added">
                {recentContacts.length > 0 ? (
                  <div className="space-y-2">
                    {recentContacts.map(contact => (
                      <div key={contact.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{contact.email}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(contact.createdAt).toLocaleString()}
                          </div>
                        </div>
                        {contact.tags && contact.tags.length > 0 && (
                          <div className="flex gap-1">
                            {contact.tags.slice(0, 2).map((tag, i) => (
                              <Badge key={i} variant="info">
                                {typeof tag === 'string' ? tag : tag?.name || 'Tag'}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No recent contacts"
                    description="New contacts will appear here"
                    icon={<Users className="w-6 h-6" />}
                  />
                )}
              </Card>

              <Card title="Recent Events">
                {recentEvents.length > 0 ? (
                  <div className="space-y-2">
                    {recentEvents.map(event => (
                      <div key={event.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{event.eventType?.replace(/_/g, ' ')}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(event.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <Badge variant="default">{event.eventType}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No recent events"
                    description="Events will appear here as they occur"
                    icon={<Clock className="w-6 h-6" />}
                  />
                )}
              </Card>
            </Stack>
          )
        }
      ]} defaultTab="batches" />
    </Stack>
  );
}
