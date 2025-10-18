import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../App";
import Layout from "../components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Server, Power, HardDrive, ChevronDown, Filter } from "lucide-react";
import { toast } from "sonner";

function VMManagement({ onLogout }) {
  const [vms, setVms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningOpen, setRunningOpen] = useState(true);
  const [stoppedOpen, setStoppedOpen] = useState(false);
  const [nodeFilter, setNodeFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState({});

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

  const handleVMAction = async (vm, action) => {
    const key = `${vm.vmid}-${action}`;
    setActionLoading(prev => ({ ...prev, [key]: true }));
    
    try {
      const endpoint = action === "force-stop" ? "force-stop" : action;
      await axios.post(`${API}/vms/${vm.vmid}/${endpoint}`, null, {
        params: { node: vm.node, vm_type: vm.type }
      });
      
      toast.success(`${action === "force-stop" ? "Force stop" : action.charAt(0).toUpperCase() + action.slice(1)} command sent to ${vm.name}`);
      
      // Refresh VM list after a short delay
      setTimeout(() => fetchVMs(), 2000);
    } catch (error) {
      toast.error(`Failed to ${action} ${vm.name}: ${error.response?.data?.detail || error.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
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

  // Get unique nodes
  const nodes = [...new Set(vms.map(vm => vm.node))];

  // Filter and sort VMs
  const filterAndSort = (status) => {
    return vms
      .filter(vm => vm.status === status)
      .filter(vm => nodeFilter === "all" || vm.node === nodeFilter)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const runningVMs = filterAndSort("running");
  const stoppedVMs = filterAndSort("stopped");

  const renderVMCard = (vm, idx) => {
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
  };

  return (
    <Layout onLogout={onLogout} currentPage="vms">
      <div className="space-y-6" data-testid="vm-management">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-100 mb-2">VM & Container Management</h1>
            <p className="text-slate-400">View and manage virtual machines and LXC containers</p>
          </div>

          {/* Node Filter */}
          {nodes.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={nodeFilter}
                onChange={(e) => setNodeFilter(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Nodes</option>
                {nodes.map(node => (
                  <option key={node} value={node}>{node}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-12">
            <div className="animate-pulse">Loading VMs...</div>
          </div>
        ) : vms.length === 0 ? (
          <Card className="border-slate-800 bg-slate-900/50">
            <CardContent className="py-12 text-center">
              <p className="text-slate-400">No VMs or containers found</p>
              <p className="text-slate-500 text-sm mt-2">Create a VM in Proxmox to see it here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Running VMs Section */}
            <Collapsible open={runningOpen} onOpenChange={setRunningOpen}>
              <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm border-l-4 border-l-emerald-500">
                <CollapsibleTrigger className="w-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                          <Power className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-slate-100">Running</CardTitle>
                          <CardDescription className="text-slate-400">
                            {runningVMs.length} VM{runningVMs.length !== 1 ? 's' : ''} / Container{runningVMs.length !== 1 ? 's' : ''} online
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                          {runningVMs.length}
                        </Badge>
                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${runningOpen ? "rotate-180" : ""}`} />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    {runningVMs.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">No running VMs</p>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {runningVMs.map((vm, idx) => renderVMCard(vm, `running-${idx}`))}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Stopped VMs Section */}
            <Collapsible open={stoppedOpen} onOpenChange={setStoppedOpen}>
              <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm border-l-4 border-l-slate-600">
                <CollapsibleTrigger className="w-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-700/30 rounded-lg">
                          <Power className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-slate-100">Stopped</CardTitle>
                          <CardDescription className="text-slate-400">
                            {stoppedVMs.length} VM{stoppedVMs.length !== 1 ? 's' : ''} / Container{stoppedVMs.length !== 1 ? 's' : ''} offline
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-slate-700 text-slate-400 border-slate-600">
                          {stoppedVMs.length}
                        </Badge>
                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${stoppedOpen ? "rotate-180" : ""}`} />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    {stoppedVMs.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">No stopped VMs</p>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {stoppedVMs.map((vm, idx) => renderVMCard(vm, `stopped-${idx}`))}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default VMManagement;
