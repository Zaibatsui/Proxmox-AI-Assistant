import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../App";
import Layout from "../components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileText, Activity, Settings as SettingsIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

function AuditLog({ onLogout }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await axios.get(`${API}/audit?limit=100`);
      setLogs(response.data);
    } catch (error) {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    if (action.includes("config")) return SettingsIcon;
    if (action.includes("action")) return Activity;
    if (action.includes("delete")) return Trash2;
    return FileText;
  };

  const getActionColor = (action) => {
    if (action.includes("delete")) return "text-red-400";
    if (action.includes("execute")) return "text-emerald-400";
    if (action.includes("config")) return "text-cyan-400";
    return "text-slate-400";
  };

  return (
    <Layout onLogout={onLogout} currentPage="audit">
      <div className="space-y-6" data-testid="audit-log">
        <div>
          <h1 className="text-4xl font-bold text-slate-100 mb-2">Audit Log</h1>
          <p className="text-slate-400">Complete history of all system operations and changes</p>
        </div>

        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Activity History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center text-slate-400 py-12">
                <div className="animate-pulse">Loading logs...</div>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center text-slate-400 py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No audit logs yet</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="p-6 space-y-3">
                  {logs.map((log, idx) => {
                    const Icon = getActionIcon(log.action);
                    const color = getActionColor(log.action);
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-4 p-4 bg-slate-950/30 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
                        data-testid={`log-item-${idx}`}
                      >
                        <div className={`p-2 rounded-lg bg-slate-900 flex-shrink-0 ${color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <h3 className="text-sm font-semibold text-slate-200">
                              {log.action.replace(/_/g, " ").toUpperCase()}
                            </h3>
                            <span className="text-xs text-slate-500 whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                          {Object.keys(log.details).length > 0 && (
                            <div className="bg-slate-900/50 p-2 rounded text-xs font-mono text-slate-400">
                              {JSON.stringify(log.details, null, 2)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default AuditLog;
