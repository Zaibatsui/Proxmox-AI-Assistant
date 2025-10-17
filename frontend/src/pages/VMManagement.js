import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../App";
import Layout from "../components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Power, HardDrive } from "lucide-react";
import { toast } from "sonner";

function VMManagement({ onLogout }) {
  const [vms, setVms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVMs();
  }, []);

  const fetchVMs = async () => {
    try {
      const response = await axios.get(`${API}/vms`);
      setVms(response.data);
    } catch (error) {
      toast.error("Failed to load VMs");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    return status === "running"
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : "bg-slate-700 text-slate-400 border-slate-600";
  };

  const getTypeIcon = (type) => {
    return type === "qemu" ? Server : HardDrive;
  };

  return (
    <Layout onLogout={onLogout} currentPage="vms">
      <div className="space-y-6" data-testid="vm-management">
        <div>
          <h1 className="text-4xl font-bold text-slate-100 mb-2">VM & Container Management</h1>
          <p className="text-slate-400">View and manage virtual machines and LXC containers</p>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-12">
            <div className="animate-pulse">Loading VMs...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {vms.map((vm, idx) => {
              const Icon = getTypeIcon(vm.type);
              return (
                <Card
                  key={idx}
                  className="border-slate-800 bg-slate-900/50 backdrop-blur-sm hover:bg-slate-900/70 transition-all"
                  data-testid={`vm-card-${idx}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-2 bg-cyan-500/10 rounded-lg flex-shrink-0">
                          <Icon className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg text-slate-100 mb-1 truncate">
                            {vm.name}
                          </CardTitle>
                          <CardDescription className="text-slate-500 text-xs">
                            ID: {vm.vmid} • Node: {vm.node}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={getStatusColor(vm.status)}
                      >
                        <Power className="w-3 h-3 mr-1" />
                        {vm.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Type:</span>
                      <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700">
                        {vm.type.toUpperCase()}
                      </Badge>
                    </div>
                    
                    {vm.hostpci_devices.length > 0 ? (
                      <div className="pt-3 border-t border-slate-800">
                        <div className="text-sm text-slate-500 mb-2">PCI Passthrough:</div>
                        <div className="space-y-1">
                          {vm.hostpci_devices.map((device, didx) => (
                            <div
                              key={didx}
                              className="text-xs font-mono bg-slate-950/50 p-2 rounded border border-slate-800 text-slate-300"
                            >
                              {device.id}: {device.device}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="pt-3 border-t border-slate-800 text-sm text-slate-500 text-center">
                        No PCI devices attached
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default VMManagement;
