import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../App";
import Layout from "../components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Cpu, RefreshCw, HardDrive, Usb, Wifi, MonitorStop, Filter, ChevronDown, Zap } from "lucide-react";
import { toast } from "sonner";

function DeviceScanner({ onLogout }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  
  // Collapsible state for each device type
  const [gpuOpen, setGpuOpen] = useState(true);
  const [storageOpen, setStorageOpen] = useState(false);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [usbOpen, setUsbOpen] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);

  useEffect(() => {
    fetchLatestScan();
  }, []);

  const fetchLatestScan = async () => {
    try {
      const response = await axios.get(`${API}/devices/latest`);
      if (response.data) {
        setDevices(response.data.devices);
        setLastScan(response.data.scan_timestamp);
      }
    } catch (error) {
      // No previous scan
    }
  };

  const handleScan = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/devices/scan`);
      setDevices(response.data.devices);
      setLastScan(response.data.scan_timestamp);
      toast.success(`Scan complete! Found ${response.data.devices.length} devices`);
    } catch (error) {
      toast.error("Failed to scan devices");
    } finally {
      setLoading(false);
    }
  };

  const getDeviceIcon = (type) => {
    switch (type) {
      case "VGA": return MonitorStop;
      case "USB": return Usb;
      case "NVMe":
      case "Storage": return HardDrive;
      case "Ethernet": return Wifi;
      case "Audio": return Zap;
      default: return Cpu;
    }
  };

  const getDriverBadgeColor = (driver) => {
    if (!driver) return "bg-slate-700 text-slate-300 border-slate-600";
    if (driver.includes("vfio")) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  };

  // Group devices by type
  const groupedDevices = {
    GPU: devices.filter(d => d.device_type === "VGA"),
    Storage: devices.filter(d => ["NVMe", "Storage", "SATA"].includes(d.device_type)),
    Network: devices.filter(d => ["Ethernet", "Network"].includes(d.device_type)),
    USB: devices.filter(d => d.device_type === "USB"),
    Other: devices.filter(d => !["VGA", "NVMe", "Storage", "SATA", "Ethernet", "Network", "USB"].includes(d.device_type))
  };

  // Apply filters
  const filterDevices = (deviceList) => {
    let filtered = deviceList;
    
    if (driverFilter !== "all") {
      if (driverFilter === "vfio") {
        filtered = filtered.filter(d => d.current_driver && d.current_driver.includes("vfio"));
      } else if (driverFilter === "bound") {
        filtered = filtered.filter(d => d.current_driver);
      } else if (driverFilter === "unbound") {
        filtered = filtered.filter(d => !d.current_driver);
      }
    }
    
    return filtered.sort((a, b) => a.device_name.localeCompare(b.device_name));
  };

  const renderDeviceCard = (device, idx) => {
    const Icon = getDeviceIcon(device.device_type);
    const hasDriver = device.current_driver;
    const isVfio = hasDriver && device.current_driver.includes("vfio");
    
    return (
      <Card
        key={idx}
        className={`border-slate-700 bg-gradient-to-br ${
          isVfio
            ? 'from-emerald-900/20 to-slate-900/80 hover:from-emerald-900/30' 
            : hasDriver
            ? 'from-blue-900/20 to-slate-900/80 hover:from-blue-900/30'
            : 'from-slate-900/80 to-slate-800/50 hover:from-slate-800/90'
        } backdrop-blur-sm hover:to-slate-700/50 transition-all relative overflow-hidden`}
        data-testid={`device-card-${idx}`}
      >
        <div className={`absolute top-0 right-0 w-32 h-32 ${
          isVfio ? 'bg-emerald-500/5' : hasDriver ? 'bg-blue-500/5' : 'bg-slate-500/5'
        } rounded-full blur-3xl`} />
        <CardHeader className="pb-3 relative">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className={`p-2.5 rounded-xl ${
                isVfio
                  ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/20' 
                  : hasDriver
                  ? 'bg-gradient-to-br from-blue-500/20 to-blue-600/10 ring-1 ring-blue-500/20'
                  : 'bg-gradient-to-br from-amber-500/20 to-amber-600/10 ring-1 ring-amber-500/20'
              } flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${
                  isVfio ? 'text-emerald-400' : hasDriver ? 'text-blue-400' : 'text-amber-400'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg text-slate-100 mb-1 leading-tight">
                  {device.device_name}
                </CardTitle>
                <CardDescription className="text-slate-500 text-xs">
                  PCI: {device.pci_address} • Type: {device.device_type}
                </CardDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className={getDriverBadgeColor(device.current_driver)}
            >
              {device.current_driver || "No Driver"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Vendor and Device IDs Section - Improved */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500"></div>
                <span className="text-xs font-medium text-slate-400">Vendor ID</span>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2">
                <p className="text-sm font-mono text-cyan-400 font-semibold tracking-wide">{device.vendor_id}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                <span className="text-xs font-medium text-slate-400">Device ID</span>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2">
                <p className="text-sm font-mono text-purple-400 font-semibold tracking-wide">{device.device_id}</p>
              </div>
            </div>
          </div>
          
          {/* Additional Info */}
          <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-800">
            <span className="text-slate-500">IOMMU Group:</span>
            <Badge 
              variant="outline" 
              className="bg-slate-800 text-slate-300 border-slate-700"
            >
              {device.iommu_group || "N/A"}
            </Badge>
          </div>
          
          {device.subsystem && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Subsystem:</span>
              <span className="text-slate-300 text-xs font-mono">{device.subsystem}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderDeviceGroup = (title, icon, deviceList, isOpen, setOpen, colorClass) => {
    const filteredDevices = filterDevices(deviceList);
    if (filteredDevices.length === 0 && typeFilter !== "all") return null;
    
    const IconComponent = icon;
    
    // Get color based on colorClass
    const getGroupColor = () => {
      if (colorClass.includes('cyan')) return { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400' };
      if (colorClass.includes('blue')) return { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400' };
      if (colorClass.includes('green')) return { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400' };
      if (colorClass.includes('purple')) return { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400' };
      return { bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-400' };
    };
    
    const colors = getGroupColor();
    
    return (
      <Collapsible open={isOpen} onOpenChange={setOpen}>
        <Card className={`border-slate-800 bg-slate-900/50 backdrop-blur-sm hover:bg-slate-900/70 transition-all ${colorClass} shadow-lg`}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="hover:bg-slate-800/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 ${colors.bg} rounded-xl ring-1 ${colors.border}`}>
                    <IconComponent className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <div className="text-left">
                    <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
                    <CardDescription className="text-slate-400 text-sm">
                      {filteredDevices.length} device{filteredDevices.length !== 1 ? 's' : ''} detected
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={`${colors.bg} ${colors.text} border ${colors.border} font-semibold`}>
                    {filteredDevices.length}
                  </Badge>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {filteredDevices.length === 0 ? (
                <div className="text-center py-12">
                  <IconComponent className={`w-12 h-12 mx-auto mb-3 ${colors.text} opacity-30`} />
                  <p className="text-slate-500">No devices in this category</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  {filteredDevices.map((device, idx) => renderDeviceCard(device, `${title}-${idx}`))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  };

  return (
    <Layout onLogout={onLogout} currentPage="devices">
      <div className="space-y-6" data-testid="device-scanner">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-100 mb-2">Hardware Scanner</h1>
            <p className="text-slate-400">Detect PCI devices, IOMMU groups, and driver bindings</p>
          </div>
          <Button
            onClick={handleScan}
            disabled={loading}
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
            data-testid="scan-button"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Scanning...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Scan Devices
              </span>
            )}
          </Button>
        </div>

        {lastScan && (
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="text-sm text-slate-400">
              Last scan: {new Date(lastScan).toLocaleString()} • {devices.length} device{devices.length !== 1 ? 's' : ''} found
            </div>
            
            {/* Filters */}
            {devices.length > 0 && (
              <div className="flex items-center gap-3">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={driverFilter}
                  onChange={(e) => setDriverFilter(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">All Drivers</option>
                  <option value="vfio">VFIO Only</option>
                  <option value="bound">Driver Bound</option>
                  <option value="unbound">No Driver</option>
                </select>
              </div>
            )}
          </div>
        )}

        {devices.length === 0 && !loading && (
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <CardContent className="py-12 text-center text-slate-400">
              <Cpu className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg mb-2">No devices scanned yet</p>
              <p className="text-sm text-slate-500">Click "Scan Devices" to detect hardware on your Proxmox host</p>
            </CardContent>
          </Card>
        )}

        {devices.length > 0 && (
          <div className="space-y-4">
            {renderDeviceGroup("Graphics Cards (GPU)", MonitorStop, groupedDevices.GPU, gpuOpen, setGpuOpen, "border-l-4 border-l-cyan-500")}
            {renderDeviceGroup("Storage Devices", HardDrive, groupedDevices.Storage, storageOpen, setStorageOpen, "border-l-4 border-l-blue-500")}
            {renderDeviceGroup("Network Controllers", Wifi, groupedDevices.Network, networkOpen, setNetworkOpen, "border-l-4 border-l-green-500")}
            {renderDeviceGroup("USB Controllers", Usb, groupedDevices.USB, usbOpen, setUsbOpen, "border-l-4 border-l-purple-500")}
            {renderDeviceGroup("Other Devices", Cpu, groupedDevices.Other, otherOpen, setOtherOpen, "border-l-4 border-l-slate-600")}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default DeviceScanner;
