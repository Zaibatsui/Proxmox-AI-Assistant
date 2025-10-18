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
    return (
      <Card
        key={idx}
        className="border-slate-800 bg-slate-900/50 backdrop-blur-sm hover:bg-slate-900/70 transition-all"
      >
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg flex-shrink-0">
              <Icon className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base text-slate-100 mb-1 break-words">
                {device.device_name}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700 text-xs">
                  {device.device_type}
                </Badge>
                <span className="text-xs text-slate-500 font-mono">{device.pci_address}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <span className="text-slate-500">Vendor ID</span>
              <p className="text-slate-300 font-mono bg-slate-950/50 px-2 py-1 rounded">{device.vendor_id}</p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-500">Device ID</span>
              <p className="text-slate-300 font-mono bg-slate-950/50 px-2 py-1 rounded">{device.device_id}</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">IOMMU Group</span>
              <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                {device.iommu_group || "N/A"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Driver</span>
              <Badge
                variant="outline"
                className={`${getDriverBadgeColor(device.current_driver)} text-xs`}
              >
                {device.current_driver || "None"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderDeviceGroup = (title, icon, deviceList, isOpen, setOpen, colorClass) => {
    const filteredDevices = filterDevices(deviceList);
    if (filteredDevices.length === 0 && typeFilter !== "all") return null;
    
    const IconComponent = icon;
    
    return (
      <Collapsible open={isOpen} onOpenChange={setOpen}>
        <Card className={`border-slate-800 bg-slate-900/50 backdrop-blur-sm ${colorClass}`}>
          <CollapsibleTrigger className="w-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${colorClass.replace('border-l-4 border-l-', 'bg-')}/10`}>
                    <IconComponent className={`w-5 h-5 ${colorClass.replace('border-l-4 border-l-', 'text-')}`} />
                  </div>
                  <div className="text-left">
                    <CardTitle className="text-slate-100">{title}</CardTitle>
                    <CardDescription className="text-slate-400">
                      {filteredDevices.length} device{filteredDevices.length !== 1 ? 's' : ''} detected
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-slate-800 text-slate-300 border-slate-700">
                    {filteredDevices.length}
                  </Badge>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {filteredDevices.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No devices in this category</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
