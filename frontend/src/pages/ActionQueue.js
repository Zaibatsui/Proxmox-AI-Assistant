import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../App";
import Layout from "../components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Play, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

function ActionQueue({ onLogout }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActions();
  }, []);

  const fetchActions = async () => {
    try {
      const response = await axios.get(`${API}/actions`);
      setActions(response.data);
    } catch (error) {
      toast.error("Failed to load actions");
    } finally {
      setLoading(false);
    }
  };

  const executeAction = async (actionId, dryRun = true) => {
    try {
      const response = await axios.post(`${API}/actions/execute`, {
        action_id: actionId,
        dry_run: dryRun
      });
      toast.success(response.data.message);
      fetchActions();
    } catch (error) {
      toast.error("Failed to execute action");
    }
  };

  const deleteAction = async (actionId, actionType) => {
    if (!window.confirm(`Delete action "${actionType.replace(/_/g, " ").toUpperCase()}"?\n\nThis will remove it from the queue.`)) {
      return;
    }
    
    try {
      await axios.delete(`${API}/actions/${actionId}`);
      toast.success("Action deleted from queue");
      fetchActions();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete action");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "executed":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "pending":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "failed":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-slate-700 text-slate-400 border-slate-600";
    }
  };

  return (
    <Layout onLogout={onLogout} currentPage="actions">
      <div className="space-y-6" data-testid="action-queue">
        <div>
          <h1 className="text-4xl font-bold text-slate-100 mb-2">Action Queue</h1>
          <p className="text-slate-400">Review and execute pending hardware operations safely</p>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-12">
            <div className="animate-pulse">Loading actions...</div>
          </div>
        ) : actions.length === 0 ? (
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <CardContent className="pt-6 text-center text-slate-400">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No actions in queue</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {actions.map((action, idx) => (
              <Card
                key={idx}
                className="border-slate-800 bg-slate-900/50 backdrop-blur-sm"
                data-testid={`action-card-${idx}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-cyan-500/10 rounded-lg flex-shrink-0">
                        <Activity className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-slate-100 mb-1">
                          {action.action_type.replace(/_/g, " ").toUpperCase()}
                        </CardTitle>
                        <p className="text-sm text-slate-500">Target: {action.target}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={getStatusColor(action.status)}>
                      {action.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Parameters */}
                  <div>
                    <p className="text-sm text-slate-500 mb-2">Parameters:</p>
                    <div className="bg-slate-950/50 p-3 rounded border border-slate-800">
                      <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">
                        {JSON.stringify(action.parameters, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* Dry Run Output */}
                  {action.dry_run_output && (
                    <div>
                      <p className="text-sm text-slate-500 mb-2">Dry Run Output:</p>
                      <div className="bg-slate-950/50 p-3 rounded border border-slate-800">
                        <pre className="text-xs font-mono text-amber-400 whitespace-pre-wrap">
                          {action.dry_run_output}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Execution Output */}
                  {action.execution_output && (
                    <div>
                      <p className="text-sm text-slate-500 mb-2">Execution Output:</p>
                      <div className="bg-slate-950/50 p-3 rounded border border-slate-800">
                        <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap">
                          {action.execution_output}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {action.status === "pending" && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => executeAction(action.id, true)}
                        variant="outline"
                        className="bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700"
                        data-testid={`dry-run-button-${idx}`}
                      >
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Dry Run
                      </Button>
                      <Button
                        onClick={() => executeAction(action.id, false)}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white"
                        data-testid={`execute-button-${idx}`}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Execute
                      </Button>
                      <Button
                        onClick={() => deleteAction(action.id)}
                        variant="destructive"
                        className="ml-auto"
                        data-testid={`delete-button-${idx}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="text-xs text-slate-500 pt-2 border-t border-slate-800">
                    Created: {new Date(action.created_at).toLocaleString()}
                    {action.executed_at && (
                      <span className="ml-4">
                        Executed: {new Date(action.executed_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default ActionQueue;
