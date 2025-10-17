import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../App";
import Layout from "../components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cpu, RefreshCw, HardDrive, Usb, Wifi, MonitorStop } from "lucide-react";
import { toast } from "sonner";

function DeviceScanner({ onLogout }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastScan, setLastScan] = useState(null);

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
      case "NVMe": return HardDrive;
      case "Ethernet": return Wifi;
      default: return Cpu;
    }
  };

  const getDriverBadgeColor = (driver) => {
    if (!driver) return "bg-slate-700 text-slate-300";
    if (driver.includes("vfio")) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  };

  return (
    <Layout onLogout={onLogout} currentPage="devices">
      <div className="space-y-6" data-testid="device-scanner">
        <div className="flex items-center justify-between">
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
          <div className="text-sm text-slate-400">
            Last scan: {new Date(lastScan).toLocaleString()}
          </div>
        )}

        {devices.length === 0 && !loading && (
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <CardContent className="pt-6 text-center text-slate-400">
              <Cpu className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No devices scanned yet. Click "Scan Devices" to start.</p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {devices.map((device, idx) => {
            const Icon = getDeviceIcon(device.device_type);
            return (
              <Card
                key={idx}
                className="border-slate-800 bg-slate-900/50 backdrop-blur-sm hover:bg-slate-900/70 transition-all"
                data-testid={`device-card-${idx}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 bg-cyan-500/10 rounded-lg flex-shrink-0">
                        <Icon className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg text-slate-100 mb-1 truncate">
                          {device.device_name}
                        </CardTitle>
                        <CardDescription className="text-slate-500 text-xs">
                          {device.pci_address}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-slate-800 text-slate-300 border-slate-700 flex-shrink-0"
                    >
                      {device.device_type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">Vendor ID:</span>
                      <p className="text-slate-300 font-mono">{device.vendor_id}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Device ID:</span>
                      <p className="text-slate-300 font-mono">{device.device_id}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">IOMMU Group:</span>
                      <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                        {device.iommu_group || "N/A"}
                      </Badge>
                    </div>
                    {device.current_driver && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">Driver:</span>
                        <Badge
                          variant="outline"
                          className={getDriverBadgeColor(device.current_driver)}
                        >
                          {device.current_driver}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

export default DeviceScanner;
