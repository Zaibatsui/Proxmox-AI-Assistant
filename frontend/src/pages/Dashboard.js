import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../App";
import Layout from "../components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Cpu, Activity, MessageSquare, Server, Archive, FolderOpen, 
  CheckCircle, XCircle, Clock, TrendingUp, FileText, Database,
  PlayCircle, AlertCircle, Key
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

function Dashboard({ onLogout }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [vms, setVms] = useState([]);
  const [backups, setBackups] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [connections, setConnections] = useState({
    proxmox: 'unknown',
    ssh: 'unknown',
    openai: 'unknown'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchAllData = async () => {
    try {
      await Promise.all([
        fetchStats(),
        fetchVMs(),
        fetchBackups(),
        fetchAuditLog(),
        fetchConnectionStatus()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Stats fetch error:', error);
    }
  };

  const fetchVMs = async () => {
    try {
      const response = await axios.get(`${API}/vms`);
      setVms(response.data);
    } catch (error) {
      console.error('VMs fetch error:', error);
    }
  };

  const fetchBackups = async () => {
    try {
      const response = await axios.get(`${API}/backups`);
      setBackups(response.data.backups || []);
    } catch (error) {
      console.error('Backups fetch error:', error);
    }
  };

  const fetchAuditLog = async () => {
    try {
      const response = await axios.get(`${API}/audit?limit=5`);
      setAuditLog(response.data);
    } catch (error) {
      console.error('Audit log fetch error:', error);
    }
  };

  const fetchConnectionStatus = async () => {
    try {
      const [configRes, keysRes] = await Promise.all([
        axios.get(`${API}/proxmox-config`),
        axios.get(`${API}/api-keys`)
      ]);
      
      setConnections({
        proxmox: configRes.data ? 'connected' : 'disconnected',
        ssh: configRes.data?.ssh_username ? 'connected' : 'disconnected',
        openai: keysRes.data?.has_openai_key ? 'connected' : 'disconnected'
      });
    } catch (error) {
      console.error('Connection status fetch error:', error);
    }
  };

  // Calculate stats
  const runningVMs = vms.filter(vm => vm.status === 'running').length;
  const stoppedVMs = vms.filter(vm => vm.status === 'stopped').length;
  const recentBackups = backups.filter(b => {
    const backupDate = new Date(b.created_at);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return backupDate > dayAgo;
  }).length;

  const quickStatsCards = [
    {
      title: "VMs & Containers",
      value: vms.length,
      subtitle: `${runningVMs} running, ${stoppedVMs} stopped`,
      icon: Server,
      color: "cyan",
      action: () => navigate("/vms")
    },
    {
      title: "File Backups",
      value: backups.length,
      subtitle: `${recentBackups} in last 24h`,
      icon: Archive,
      color: "emerald",
      action: () => navigate("/backups")
    },
    {
      title: "AI Conversations",
      value: stats?.ai_conversations || 0,
      subtitle: "Total queries",
      icon: MessageSquare,
      color: "purple",
      action: () => navigate("/assistant")
    },
    {
      title: "Devices Detected",
      value: stats?.device_count || 0,
      subtitle: "Hardware devices",
      icon: Cpu,
      color: "amber",
      action: () => navigate("/devices")
    }
  ];

  const quickAccessButtons = [
    {
      label: "Browse Host Files",
      icon: FolderOpen,
      action: () => navigate("/files"),
      color: "cyan"
    },
    {
      label: "Ask AI Assistant",
      icon: MessageSquare,
      action: () => navigate("/assistant"),
      color: "purple"
    },
    {
      label: "View Backups",
      icon: Archive,
      action: () => navigate("/backups"),
      color: "emerald"
    },
    {
      label: "Manage VMs",
      icon: Server,
      action: () => navigate("/vms"),
      color: "blue"
    }
  ];

  const getConnectionIcon = (status) => {
    if (status === 'connected') return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    if (status === 'disconnected') return <XCircle className="w-4 h-4 text-red-400" />;
    return <AlertCircle className="w-4 h-4 text-amber-400" />;
  };

  const getConnectionBadge = (status) => {
    if (status === 'connected') return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (status === 'disconnected') return "bg-red-500/10 text-red-400 border-red-500/20";
    return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  };

  const formatRelativeTime = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getActionIcon = (action) => {
    if (action.includes('file_read')) return <FileText className="w-4 h-4" />;
    if (action.includes('file_write') || action.includes('file_edit')) return <FileText className="w-4 h-4 text-amber-400" />;
    if (action.includes('backup')) return <Archive className="w-4 h-4 text-emerald-400" />;
    if (action.includes('ai_')) return <MessageSquare className="w-4 h-4 text-purple-400" />;
    return <Activity className="w-4 h-4" />;
  };

  return (
    <Layout onLogout={onLogout} currentPage="dashboard">
      <div className="space-y-6" data-testid="dashboard">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-slate-100 mb-2">Dashboard</h1>
          <p className="text-slate-400">Welcome to Proxmox AI Admin v2.0</p>
        </div>

        {/* At-a-Glance Status Bar */}
        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
          <CardContent>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  {getConnectionIcon(connections.proxmox)}
                  <span className="text-sm text-slate-300">Proxmox API</span>
                </div>
                <div className="flex items-center gap-2">
                  {getConnectionIcon(connections.ssh)}
                  <span className="text-sm text-slate-300">SSH Access</span>
                </div>
                <div className="flex items-center gap-2">
                  {getConnectionIcon(connections.openai)}
                  <span className="text-sm text-slate-300">OpenAI API</span>
                </div>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Last updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickStatsCards.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <Card
                key={idx}
                className="border-slate-800 bg-slate-900/50 backdrop-blur-sm hover:bg-slate-900/70 transition-all cursor-pointer group"
                onClick={stat.action}
              >
                <CardContent>
                  <div className="flex items-start justify-between" style={{ marginBottom: 'calc(1rem * var(--layout-density))' }}>
                    <div className={`p-3 rounded-lg bg-${stat.color}-500/10`}>
                      <Icon className={`w-5 h-5 text-${stat.color}-400`} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-3xl font-bold text-slate-100">
                      {loading ? (
                        <span className="animate-pulse">--</span>
                      ) : (
                        stat.value
                      )}
                    </div>
                    <div className="text-sm font-medium text-slate-300">{stat.title}</div>
                    <div className="text-xs text-slate-500">{stat.subtitle}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Access Shortcuts */}
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-slate-100">Quick Access</CardTitle>
              <CardDescription className="text-slate-400">Jump to key features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickAccessButtons.map((btn, idx) => {
                const Icon = btn.icon;
                return (
                  <Button
                    key={idx}
                    onClick={btn.action}
                    variant="ghost"
                    className="w-full justify-start h-auto py-3 px-4 hover:bg-slate-800"
                  >
                    <div className={`p-2 rounded-lg bg-${btn.color}-500/10 mr-3`}>
                      <Icon className={`w-4 h-4 text-${btn.color}-400`} />
                    </div>
                    <span className="text-slate-200">{btn.label}</span>
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          {/* Recent Activity Feed */}
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-slate-100">Recent Activity</CardTitle>
              <CardDescription className="text-slate-400">Latest actions and events</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="h-12 bg-slate-800 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : auditLog.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLog.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors">
                      <div className="mt-1">
                        {getActionIcon(log.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-200 font-medium">
                          {log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {JSON.stringify(log.details).slice(0, 60)}...
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 whitespace-nowrap">
                        {formatRelativeTime(log.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="ghost"
                className="w-full mt-4 text-cyan-400 hover:text-cyan-300"
                onClick={() => navigate('/audit')}
              >
                View Full Audit Log →
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* System Overview */}
        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-slate-100">System Overview</CardTitle>
            <CardDescription className="text-slate-400">
              VMs, Containers, and Resource Status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : vms.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Server className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No VMs or containers configured</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate('/settings')}
                >
                  Configure Proxmox Connection
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vms.slice(0, 6).map((vm, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer"
                    onClick={() => navigate('/vms')}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-200">{vm.name}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        vm.status === 'running' 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {vm.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {vm.type === 'lxc' ? 'Container' : 'Virtual Machine'} • ID: {vm.vmid}
                    </div>
                  </div>
                ))}
                {vms.length > 6 && (
                  <div
                    className="p-4 rounded-lg bg-slate-800/30 border border-slate-700 border-dashed hover:bg-slate-800/50 transition-colors cursor-pointer flex items-center justify-center"
                    onClick={() => navigate('/vms')}
                  >
                    <span className="text-sm text-slate-400">
                      +{vms.length - 6} more
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default Dashboard;
