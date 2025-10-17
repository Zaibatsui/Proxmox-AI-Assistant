import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../App";
import Layout from "../components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cpu, Activity, MessageSquare, Clock, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

function Dashboard({ onLogout }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/stats`);
      setStats(response.data);
    } catch (error) {
      toast.error("Failed to load dashboard stats");
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    {
      title: "Devices Detected",
      value: stats?.device_count || 0,
      icon: Cpu,
      color: "cyan",
      action: () => navigate("/devices")
    },
    {
      title: "Pending Actions",
      value: stats?.pending_actions || 0,
      icon: Activity,
      color: "amber",
      action: () => navigate("/actions")
    },
    {
      title: "AI Conversations",
      value: stats?.ai_conversations || 0,
      icon: MessageSquare,
      color: "emerald",
      action: () => navigate("/assistant")
    }
  ];

  return (
    <Layout onLogout={onLogout} currentPage="dashboard">
      <div className="space-y-8" data-testid="dashboard">
        <div>
          <h1 className="text-4xl font-bold text-slate-100 mb-2">Dashboard</h1>
          <p className="text-slate-400">Welcome to Proxmox AI Admin - Your intelligent hardware management assistant</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statsCards.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <Card
                key={idx}
                className={`border-slate-800 bg-slate-900/50 backdrop-blur-sm hover:bg-slate-900/70 transition-all cursor-pointer group`}
                onClick={stat.action}
                data-testid={`stat-card-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 bg-${stat.color}-500/10 rounded-lg`}>
                    <Icon className={`w-4 h-4 text-${stat.color}-400`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-3xl font-bold text-slate-100">
                      {loading ? (
                        <span className="animate-pulse">--</span>
                      ) : (
                        stat.value
                      )}
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-1 transition-all" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-slate-100">Quick Actions</CardTitle>
              <CardDescription className="text-slate-400">Common tasks to get started</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => navigate("/devices")}
                className="w-full justify-start bg-slate-800 hover:bg-slate-700 text-slate-100"
                data-testid="scan-devices-button"
              >
                <Cpu className="w-4 h-4 mr-2" />
                Scan Hardware Devices
              </Button>
              <Button
                onClick={() => navigate("/assistant")}
                className="w-full justify-start bg-slate-800 hover:bg-slate-700 text-slate-100"
                data-testid="ask-ai-button"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Ask AI Assistant
              </Button>
              <Button
                onClick={() => navigate("/vms")}
                className="w-full justify-start bg-slate-800 hover:bg-slate-700 text-slate-100"
                data-testid="view-vms-button"
              >
                <Activity className="w-4 h-4 mr-2" />
                View VM Configurations
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-slate-100">Getting Started</CardTitle>
              <CardDescription className="text-slate-400">Setup your Proxmox connection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-slate-300 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-cyan-400 text-xs font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-200">Configure Proxmox API</p>
                    <p className="text-slate-400 text-xs">Add your Proxmox server credentials in Settings</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-cyan-400 text-xs font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-200">Scan Your Hardware</p>
                    <p className="text-slate-400 text-xs">Detect PCI devices and IOMMU groups</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-cyan-400 text-xs font-bold">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-200">Ask AI for Help</p>
                    <p className="text-slate-400 text-xs">Get intelligent suggestions for passthrough configuration</p>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => navigate("/settings")}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
                data-testid="goto-settings-button"
              >
                Go to Settings
              </Button>
            </CardContent>
          </Card>
        </div>

        {stats?.last_scan && (
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>Last hardware scan: {new Date(stats.last_scan).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

export default Dashboard;
