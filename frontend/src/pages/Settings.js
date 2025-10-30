import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../App";
import Layout from "../components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Server, Save, Trash2, CheckCircle, Palette, Check, ChevronDown, Key, Edit, HardDrive, Package, Box, Network, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "../contexts/ThemeContext";

function Settings({ onLogout }) {
  const { 
    currentTheme, background, cardStyle, updateTheme, themes,
    primaryColor, secondaryColor, sidebarBgColor, headerBgColor,
    layoutDensity, borderRadius, shadowIntensity, sidebarWidth
  } = useTheme();
  const [config, setConfig] = useState(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState(null);
  const [openaiKey, setOpenaiKey] = useState("");
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [apiTestStatus, setApiTestStatus] = useState(null);
  const [sshTestStatus, setSshTestStatus] = useState(null);
  const [testingApi, setTestingApi] = useState(false);
  const [testingSsh, setTestingSsh] = useState(false);
  const [apiConfigOpen, setApiConfigOpen] = useState(false);
  const [sshConfigOpen, setSshConfigOpen] = useState(false);
  const [aiConfigOpen, setAiConfigOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [formData, setFormData] = useState({
    host: "",
    api_token_name: "",
    api_token_secret: "",
    verify_ssl: false,
    ssh_username: "root",
    ssh_password: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sshConfigs, setSshConfigs] = useState([]);
  const [sshFormData, setSshFormData] = useState({
    name: "Proxmox Host SSH",
    host: "proxmox.zaibatsui.co.uk",
    port: 22,
    username: "root",
    password: ""
  });
  const [savingSsh, setSavingSsh] = useState(false);
  
  // Connections Management state
  const [proxmoxLocations, setProxmoxLocations] = useState([]);
  const [locationCredentials, setLocationCredentials] = useState({});
  const [connectionProfiles, setConnectionProfiles] = useState([]);
  const [editingLocation, setEditingLocation] = useState(null);
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [credentialForm, setCredentialForm] = useState({
    ssh_host: '',
    ssh_port: 22,
    ssh_username: '',
    ssh_password: ''
  });
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [connectionsStatus, setConnectionsStatus] = useState('loading'); // 'loading', 'success', 'failed', 'empty'
  const [connectionsCached, setConnectionsCached] = useState(false);
  const [connectionsLastUpdated, setConnectionsLastUpdated] = useState(null);
  
  // Collapsible subsection state for connections
  const [vmRunningOpen, setVmRunningOpen] = useState(true);
  const [vmStoppedOpen, setVmStoppedOpen] = useState(false);
  const [lxcRunningOpen, setLxcRunningOpen] = useState(true);
  const [lxcStoppedOpen, setLxcStoppedOpen] = useState(false);
  
  // Advanced appearance state
  const [customPrimary, setCustomPrimary] = useState("");
  const [customSecondary, setCustomSecondary] = useState("");
  const [customSidebarBg, setCustomSidebarBg] = useState("");
  const [customHeaderBg, setCustomHeaderBg] = useState("");
  
  // Helper functions for RGB/Hex conversion
  const rgbToHex = (rgb) => {
    if (!rgb) return "#000000";
    const [r, g, b] = rgb.split(',').map(s => parseInt(s.trim()));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };
  
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
  };

  useEffect(() => {
    fetchConfig();
    fetchAPIKeys();
    fetchSSHConfigs();
    // Auto-test connections on page load
    testConnection();
    // Auto-load connections on page load with caching
    loadAllConnections();
  }, []);
  
  // Remove the old useEffect that only loaded on connectionsOpen
  // Now connections are always loaded on mount
  
  useEffect(() => {
    // Initialize custom colors from theme context
    if (primaryColor) setCustomPrimary(rgbToHex(primaryColor));
    if (secondaryColor) setCustomSecondary(rgbToHex(secondaryColor));
    if (sidebarBgColor) setCustomSidebarBg(rgbToHex(sidebarBgColor));
    if (headerBgColor) setCustomHeaderBg(rgbToHex(headerBgColor));
  }, [primaryColor, secondaryColor, sidebarBgColor, headerBgColor]);

  const fetchConfig = async () => {
    try {
      const response = await axios.get(`${API}/proxmox/config`);
      if (response.data) {
        setConfig(response.data);
        setFormData({
          host: response.data.host,
          api_token_name: response.data.api_token_name,
          api_token_secret: "", // Don't show secret
          verify_ssl: response.data.verify_ssl,
          ssh_username: "root", // Default value, SSH config is now separate
          ssh_password: "" // Don't show password
        });
        // Don't auto-test connection on load - let user trigger it manually
        // This prevents slow page loads due to connection timeouts
      }
    } catch (error) {
      // No config yet
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setTestingApi(true);
    setTestingSsh(true);
    try {
      const response = await axios.post(`${API}/proxmox/test-connection`);
      setConnectionStatus(response.data);
      setApiTestStatus(response.data.api);
      setSshTestStatus(response.data.ssh);
    } catch (error) {
      const errorData = {
        api: { status: "failed", error: error.response?.data?.detail || "Configuration not found" },
        ssh: { status: "failed", error: "Configuration not found" }
      };
      setConnectionStatus(errorData);
      setApiTestStatus(errorData.api);
      setSshTestStatus(errorData.ssh);
    } finally {
      setTestingConnection(false);
      setTestingApi(false);
      setTestingSsh(false);
    }
  };

  const loadAllConnections = async (forceRefresh = false) => {
    // Check cache first (unless force refresh)
    const CACHE_KEY = 'proxmox_connections_cache';
    const CACHE_TIMESTAMP_KEY = 'proxmox_connections_timestamp';
    
    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        const timestamp = sessionStorage.getItem(CACHE_TIMESTAMP_KEY);
        
        if (cached && timestamp) {
          const cacheAge = Date.now() - parseInt(timestamp);
          // Use cache if less than 5 minutes old
          if (cacheAge < 5 * 60 * 1000) {
            const cachedData = JSON.parse(cached);
            console.log('Using cached connections data');
            setProxmoxLocations(cachedData.locations || []);
            setConnectionProfiles(cachedData.profiles || []);
            
            // Build credentials map
            const credsMap = {};
            (cachedData.locations || []).forEach(loc => {
              if (loc.ssh_username) {
                credsMap[`${loc.type}_${loc.vmid}`] = {
                  ssh_host: loc.ssh_host,
                  ssh_port: loc.ssh_port || 22,
                  ssh_username: loc.ssh_username,
                  hasPassword: !!loc.ssh_password
                };
              }
            });
            setLocationCredentials(credsMap);
            
            // Set status based on cached data
            if (cachedData.locations.length === 0) {
              setConnectionsStatus('empty');
            } else {
              setConnectionsStatus('success');
            }
            setConnectionsCached(true);
            return;
          }
        }
      } catch (error) {
        console.log('Cache read failed, loading fresh data');
      }
    }
    
    // Load fresh data
    setLoadingConnections(true);
    setConnectionsCached(false);
    setConnectionsStatus('loading');
    
    try {
      console.log('Loading fresh connections data...');
      
      // Load Proxmox locations
      const locationsRes = await axios.get(`${API}/proxmox-locations`);
      console.log('Proxmox locations response:', locationsRes.data);
      const locations = locationsRes.data.locations || [];
      setProxmoxLocations(locations);
      
      // Load connection profiles
      const profilesRes = await axios.get(`${API}/connection-profiles`);
      console.log('Connection profiles response:', profilesRes.data);
      const profiles = profilesRes.data.profiles || [];
      setConnectionProfiles(profiles);
      
      // Build credentials map for quick lookup
      const credsMap = {};
      locations.forEach(loc => {
        if (loc.ssh_username) {
          credsMap[`${loc.type}_${loc.vmid}`] = {
            ssh_host: loc.ssh_host,
            ssh_port: loc.ssh_port || 22,
            ssh_username: loc.ssh_username,
            hasPassword: !!loc.ssh_password
          };
        }
      });
      setLocationCredentials(credsMap);
      
      // Cache the data
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ locations, profiles }));
        sessionStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
      } catch (error) {
        console.warn('Failed to cache connections data:', error);
      }
      
      // Set status
      if (locations.length === 0 && profiles.length === 0) {
        setConnectionsStatus('empty');
      } else {
        setConnectionsStatus('success');
      }
      
      console.log(`Loaded ${locations.length} locations and ${profiles.length} profiles`);
    } catch (error) {
      console.error('Failed to load connections:', error);
      console.error('Error response:', error.response);
      setConnectionsStatus('failed');
      toast.error(error.response?.data?.detail || 'Failed to load connections');
    } finally {
      setLoadingConnections(false);
    }
  };

  const handleEditCredentials = (location) => {
    setEditingLocation(location);
    const key = `${location.type}_${location.vmid}`;
    const existingCreds = locationCredentials[key];
    
    setCredentialForm({
      ssh_host: existingCreds?.ssh_host || '',
      ssh_port: existingCreds?.ssh_port || 22,
      ssh_username: existingCreds?.ssh_username || 'root',
      ssh_password: ''
    });
    setShowCredentialModal(true);
  };

  const handleSaveCredentials = async () => {
    if (!credentialForm.ssh_host || !credentialForm.ssh_username || !credentialForm.ssh_password) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await axios.post(`${API}/location-credentials`, {
        location_type: editingLocation.type,
        location_id: editingLocation.vmid.toString(),
        ssh_host: credentialForm.ssh_host,
        ssh_port: credentialForm.ssh_port,
        ssh_username: credentialForm.ssh_username,
        ssh_password: credentialForm.ssh_password
      });

      toast.success('Credentials saved successfully');
      setShowCredentialModal(false);
      setEditingLocation(null);
      loadAllConnections(true); // Force refresh, invalidating cache
    } catch (error) {
      console.error('Failed to save credentials:', error);
      toast.error(error.response?.data?.detail || 'Failed to save credentials');
    }
  };

  const handleDeleteCredentials = async (location) => {
    if (!confirm(`Delete SSH credentials for ${location.name}?`)) return;

    try {
      await axios.delete(`${API}/location-credentials/${location.type}/${location.vmid}`);
      toast.success('Credentials deleted');
      loadAllConnections(true); // Force refresh, invalidating cache
    } catch (error) {
      console.error('Failed to delete credentials:', error);
      toast.error('Failed to delete credentials');
    }
  };

  const testApiConnection = async () => {
    setTestingApi(true);
    try {
      const response = await axios.post(`${API}/proxmox/test-connection`);
      setApiTestStatus(response.data.api);
      toast.success(response.data.api.status === "success" ? "API Connected!" : "API Connection Failed");
    } catch (error) {
      setApiTestStatus({ status: "failed", error: error.response?.data?.detail || "Connection failed" });
      toast.error("API Connection Failed");
    } finally {
      setTestingApi(false);
    }
  };

  const testSshConnection = async () => {
    setTestingSsh(true);
    try {
      const response = await axios.post(`${API}/proxmox/test-connection`);
      setSshTestStatus(response.data.ssh);
      toast.success(response.data.ssh.status === "success" ? "SSH Connected!" : "SSH Connection Failed");
    } catch (error) {
      setSshTestStatus({ status: "failed", error: error.response?.data?.detail || "Connection failed" });
      toast.error("SSH Connection Failed");
    } finally {
      setTestingSsh(false);
    }
  };

  const handleSave = async () => {
    // For new config, all fields required
    // For existing config (update), api_token_secret is optional
    const isUpdate = config !== null;
    
    if (!formData.host || !formData.api_token_name) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    // Only require api_token_secret for new configs
    if (!isUpdate && !formData.api_token_secret) {
      toast.error("API Token Secret is required for new configuration");
      return;
    }

    setSaving(true);
    try {
      // If updating and no secret provided, don't send it
      const dataToSend = { ...formData };
      if (isUpdate && !formData.api_token_secret) {
        delete dataToSend.api_token_secret;
      }
      
      if (isUpdate) {
        // Use PUT for updates
        await axios.put(`${API}/proxmox/config`, dataToSend);
      } else {
        // Use POST for new configs
        await axios.post(`${API}/proxmox/config`, dataToSend);
      }
      
      toast.success("Configuration saved successfully");
      await fetchConfig();
      // Test connection after saving
      await testConnection();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const fetchAPIKeys = async () => {
    try {
      const response = await axios.get(`${API}/api-keys`);
      setApiKeys(response.data);
    } catch (error) {
      // Ignore error
    }
  };

  const handleSaveAPIKeys = async () => {
    if (!openaiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    try {
      await axios.post(`${API}/api-keys`, { openai_api_key: openaiKey });
      toast.success("API key saved successfully");
      setOpenaiKey("");
      fetchAPIKeys();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save API key");
    }
  };

  const handleDeleteAPIKeys = async () => {
    if (!window.confirm("Are you sure you want to delete your API keys?")) {
      return;
    }

    try {
      await axios.delete(`${API}/api-keys`);
      toast.success("API keys deleted");
      setApiKeys(null);
    } catch (error) {
      toast.error("Failed to delete API keys");
    }
  };

  const fetchSSHConfigs = async () => {
    try {
      const response = await axios.get(`${API}/ssh/configs`);
      setSshConfigs(response.data || []);
      
      // If there's at least one config, populate the form with it
      if (response.data && response.data.length > 0) {
        const firstConfig = response.data[0];
        setSshFormData({
          name: firstConfig.name,
          host: firstConfig.host,
          port: firstConfig.port,
          username: firstConfig.username,
          password: "" // Don't show password
        });
      }
    } catch (error) {
      // No configs yet
    }
  };

  const handleSaveSSH = async () => {
    if (!sshFormData.host || !sshFormData.username) {
      toast.error("Please fill in host and username");
      return;
    }

    setSavingSsh(true);
    try {
      // Check if we're updating an existing config or creating new one
      if (sshConfigs.length > 0) {
        // Update first config
        const configId = sshConfigs[0].id;
        const dataToSend = { ...sshFormData };
        if (!dataToSend.password) {
          delete dataToSend.password; // Don't send empty password on update
        }
        await axios.put(`${API}/ssh/configs/${configId}`, dataToSend);
        toast.success("SSH configuration updated successfully");
      } else {
        // Create new config
        if (!sshFormData.password) {
          toast.error("Password is required for new SSH configuration");
          setSavingSsh(false);
          return;
        }
        await axios.post(`${API}/ssh/configs`, sshFormData);
        toast.success("SSH configuration created successfully");
      }
      
      await fetchSSHConfigs();
      // Test SSH connection after saving
      await testSshConnection();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save SSH configuration");
    } finally {
      setSavingSsh(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete the Proxmox configuration?")) {
      return;
    }

    try {
      await axios.delete(`${API}/proxmox/config`);
      toast.success("Configuration deleted");
      setConfig(null);
      setFormData({
        host: "",
        api_token_name: "",
        api_token_secret: "",
        verify_ssl: false,
        ssh_username: "root",
        ssh_password: ""
      });
    } catch (error) {
      toast.error("Failed to delete configuration");
    }
  };

  if (loading) {
    return (
      <Layout onLogout={onLogout} currentPage="settings">
        <div className="text-center text-slate-400 py-12">
          <div className="animate-pulse">Loading settings...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout onLogout={onLogout} currentPage="settings">
      <div className="space-y-6" data-testid="settings">
        <div>
          <h1 className="text-4xl font-bold text-slate-100 mb-2">Settings</h1>
          <p className="text-slate-400">Configure Proxmox API connection and preferences</p>
        </div>

        <div className="space-y-6">
        
        {/* Connections Management - Collapsible - FIRST SECTION */}
        <Collapsible open={connectionsOpen} onOpenChange={setConnectionsOpen}>
          <Card className={`border-slate-800 bg-slate-900/50 backdrop-blur-sm ${
            connectionsStatus === 'success' 
              ? 'border-l-4 border-l-emerald-500'
              : connectionsStatus === 'failed'
              ? 'border-l-4 border-l-red-500'
              : connectionsStatus === 'empty'
              ? 'border-l-4 border-l-orange-500'
              : ''
          }`}>
            <CollapsibleTrigger className="w-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      connectionsStatus === 'success'
                        ? 'bg-emerald-500/10'
                        : connectionsStatus === 'failed'
                        ? 'bg-red-500/10'
                        : connectionsStatus === 'empty'
                        ? 'bg-orange-500/10'
                        : 'bg-cyan-500/10'
                    }`}>
                      <Network className={`w-5 h-5 ${
                        connectionsStatus === 'success'
                          ? 'text-emerald-400'
                          : connectionsStatus === 'failed'
                          ? 'text-red-400'
                          : connectionsStatus === 'empty'
                          ? 'text-orange-400'
                          : 'text-cyan-400'
                      }`} />
                    </div>
                    <div className="text-left">
                      <CardTitle className="text-slate-100">Connections Management</CardTitle>
                      <CardDescription className="text-slate-400">
                        {connectionsStatus === 'success' && "✅ Connections Loaded"}
                        {connectionsStatus === 'failed' && "❌ Failed to Load"}
                        {connectionsStatus === 'empty' && "⚠️ No Connections Configured"}
                        {connectionsStatus === 'loading' && "Loading connections..."}
                        {connectionsCached && connectionsStatus !== 'loading' && " (Cached)"}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!loadingConnections && proxmoxLocations.length > 0 && (
                      <span className={`flex items-center gap-2 px-3 py-1 rounded-full border text-sm ${
                        connectionsStatus === 'success'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                      }`}>
                        <CheckCircle className="w-4 h-4" />
                        {proxmoxLocations.length} Locations
                      </span>
                    )}
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${connectionsOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6">
                {/* Refresh Button */}
                <div className="flex justify-between items-center pb-2 border-b border-slate-700">
                  <div className="text-xs text-slate-500">
                    {connectionsCached && "Using cached data • "}
                    Last updated: {new Date().toLocaleTimeString()}
                  </div>
                  <Button
                    onClick={() => loadAllConnections(true)}
                    disabled={loadingConnections}
                    variant="outline"
                    size="sm"
                    className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300 text-xs"
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${loadingConnections ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
                
                {loadingConnections ? (
                  <div className="text-center py-8 text-slate-400">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-cyan-400" />
                    Loading connections...
                  </div>
                ) : (
                  <>
                    {/* Proxmox Host */}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                        <Server className="w-4 h-4" />
                        Proxmox Host
                      </h3>
                      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              apiTestStatus?.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'
                            }`}></div>
                            <div>
                              <div className="text-slate-200 font-medium">Proxmox Server</div>
                              <div className="text-xs text-slate-500 mt-1">
                                Configured via Proxmox API & SSH Configuration below
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded border ${
                              apiTestStatus?.status === 'success' 
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 border-red-500/30'
                            }`}>
                              {apiTestStatus?.status === 'success' ? 'Running' : 'Stopped'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* VMs - Grouped by Running/Stopped */}
                    {proxmoxLocations.filter(loc => loc.type === 'vm').length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                          <HardDrive className="w-4 h-4" />
                          Virtual Machines ({proxmoxLocations.filter(loc => loc.type === 'vm').length})
                        </h3>
                        
                        {/* Running VMs */}
                        {(() => {
                          const runningVMs = proxmoxLocations
                            .filter(loc => loc.type === 'vm' && loc.status === 'running')
                            .sort((a, b) => a.name.localeCompare(b.name));
                          
                          return runningVMs.length > 0 ? (
                            <Collapsible open={vmRunningOpen} onOpenChange={setVmRunningOpen} className="mb-2">
                              <CollapsibleTrigger className="w-full">
                                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-lg border border-emerald-500/20 transition-colors">
                                  <ChevronDown className={`w-4 h-4 text-emerald-400 transition-transform ${vmRunningOpen ? 'rotate-180' : ''}`} />
                                  <span className="text-sm font-medium text-emerald-400">Running ({runningVMs.length})</span>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="space-y-2 mt-2">
                                  {runningVMs.map(location => {
                                    const key = `${location.type}_${location.vmid}`;
                                    const hasCreds = locationCredentials[key];
                                    return (
                                      <div key={location.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3 flex-1">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                            <div className="flex-1">
                                              <div className="text-slate-200 font-medium">{location.name}</div>
                                              <div className="text-xs text-slate-500 mt-1">
                                                VM ID: {location.vmid} • Status: running
                                                {hasCreds && ` • SSH: ${hasCreds.ssh_username}@${hasCreds.ssh_host}:${hasCreds.ssh_port}`}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {hasCreds ? (
                                              <>
                                                <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                                                  SSH Configured
                                                </span>
                                                <button
                                                  onClick={() => handleEditCredentials(location)}
                                                  className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400"
                                                  title="Edit SSH credentials"
                                                >
                                                  <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                  onClick={() => handleDeleteCredentials(location)}
                                                  className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400"
                                                  title="Delete SSH credentials"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              </>
                                            ) : (
                                              <button
                                                onClick={() => handleEditCredentials(location)}
                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded flex items-center gap-1"
                                              >
                                                <Key className="w-3 h-3" />
                                                Add SSH
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ) : null;
                        })()}
                        
                        {/* Stopped VMs */}
                        {(() => {
                          const stoppedVMs = proxmoxLocations
                            .filter(loc => loc.type === 'vm' && loc.status !== 'running')
                            .sort((a, b) => a.name.localeCompare(b.name));
                          
                          return stoppedVMs.length > 0 ? (
                            <Collapsible open={vmStoppedOpen} onOpenChange={setVmStoppedOpen}>
                              <CollapsibleTrigger className="w-full">
                                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/5 hover:bg-red-500/10 rounded-lg border border-red-500/20 transition-colors">
                                  <ChevronDown className={`w-4 h-4 text-red-400 transition-transform ${vmStoppedOpen ? 'rotate-180' : ''}`} />
                                  <span className="text-sm font-medium text-red-400">Stopped ({stoppedVMs.length})</span>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="space-y-2 mt-2">
                                  {stoppedVMs.map(location => {
                                    const key = `${location.type}_${location.vmid}`;
                                    const hasCreds = locationCredentials[key];
                                    return (
                                      <div key={location.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3 flex-1">
                                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                            <div className="flex-1">
                                              <div className="text-slate-200 font-medium">{location.name}</div>
                                              <div className="text-xs text-slate-500 mt-1">
                                                VM ID: {location.vmid} • Status: {location.status}
                                                {hasCreds && ` • SSH: ${hasCreds.ssh_username}@${hasCreds.ssh_host}:${hasCreds.ssh_port}`}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {hasCreds ? (
                                              <>
                                                <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                                                  SSH Configured
                                                </span>
                                                <button
                                                  onClick={() => handleEditCredentials(location)}
                                                  className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400"
                                                  title="Edit SSH credentials"
                                                >
                                                  <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                  onClick={() => handleDeleteCredentials(location)}
                                                  className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400"
                                                  title="Delete SSH credentials"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              </>
                                            ) : (
                                              <button
                                                onClick={() => handleEditCredentials(location)}
                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded flex items-center gap-1"
                                              >
                                                <Key className="w-3 h-3" />
                                                Add SSH
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ) : null;
                        })()}
                      </div>
                    )}

                    {/* LXC Containers - Grouped by Running/Stopped */}
                    {proxmoxLocations.filter(loc => loc.type === 'lxc').length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          LXC Containers ({proxmoxLocations.filter(loc => loc.type === 'lxc').length})
                        </h3>
                        
                        {/* Running LXCs */}
                        {(() => {
                          const runningLXCs = proxmoxLocations
                            .filter(loc => loc.type === 'lxc' && loc.status === 'running')
                            .sort((a, b) => a.name.localeCompare(b.name));
                          
                          return runningLXCs.length > 0 ? (
                            <Collapsible open={lxcRunningOpen} onOpenChange={setLxcRunningOpen} className="mb-2">
                              <CollapsibleTrigger className="w-full">
                                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-lg border border-emerald-500/20 transition-colors">
                                  <ChevronDown className={`w-4 h-4 text-emerald-400 transition-transform ${lxcRunningOpen ? 'rotate-180' : ''}`} />
                                  <span className="text-sm font-medium text-emerald-400">Running ({runningLXCs.length})</span>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="space-y-2 mt-2">
                                  {runningLXCs.map(location => {
                                    const key = `${location.type}_${location.vmid}`;
                                    const hasCreds = locationCredentials[key];
                                    return (
                                      <div key={location.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3 flex-1">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                            <div className="flex-1">
                                              <div className="text-slate-200 font-medium">{location.name}</div>
                                              <div className="text-xs text-slate-500 mt-1">
                                                CT ID: {location.vmid} • Status: running
                                                {hasCreds && ` • SSH: ${hasCreds.ssh_username}@${hasCreds.ssh_host}:${hasCreds.ssh_port}`}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {hasCreds ? (
                                              <>
                                                <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                                                  SSH Configured
                                                </span>
                                                <button
                                                  onClick={() => handleEditCredentials(location)}
                                                  className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400"
                                                  title="Edit SSH credentials"
                                                >
                                                  <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                  onClick={() => handleDeleteCredentials(location)}
                                                  className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400"
                                                  title="Delete SSH credentials"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              </>
                                            ) : (
                                              <button
                                                onClick={() => handleEditCredentials(location)}
                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded flex items-center gap-1"
                                              >
                                                <Key className="w-3 h-3" />
                                                Add SSH
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ) : null;
                        })()}
                        
                        {/* Stopped LXCs */}
                        {(() => {
                          const stoppedLXCs = proxmoxLocations
                            .filter(loc => loc.type === 'lxc' && loc.status !== 'running')
                            .sort((a, b) => a.name.localeCompare(b.name));
                          
                          return stoppedLXCs.length > 0 ? (
                            <Collapsible open={lxcStoppedOpen} onOpenChange={setLxcStoppedOpen}>
                              <CollapsibleTrigger className="w-full">
                                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/5 hover:bg-red-500/10 rounded-lg border border-red-500/20 transition-colors">
                                  <ChevronDown className={`w-4 h-4 text-red-400 transition-transform ${lxcStoppedOpen ? 'rotate-180' : ''}`} />
                                  <span className="text-sm font-medium text-red-400">Stopped ({stoppedLXCs.length})</span>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="space-y-2 mt-2">
                                  {stoppedLXCs.map(location => {
                                    const key = `${location.type}_${location.vmid}`;
                                    const hasCreds = locationCredentials[key];
                                    return (
                                      <div key={location.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3 flex-1">
                                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                            <div className="flex-1">
                                              <div className="text-slate-200 font-medium">{location.name}</div>
                                              <div className="text-xs text-slate-500 mt-1">
                                                CT ID: {location.vmid} • Status: {location.status}
                                                {hasCreds && ` • SSH: ${hasCreds.ssh_username}@${hasCreds.ssh_host}:${hasCreds.ssh_port}`}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {hasCreds ? (
                                              <>
                                                <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                                                  SSH Configured
                                                </span>
                                                <button
                                                  onClick={() => handleEditCredentials(location)}
                                                  className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400"
                                                  title="Edit SSH credentials"
                                                >
                                                  <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                  onClick={() => handleDeleteCredentials(location)}
                                                  className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400"
                                                  title="Delete SSH credentials"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              </>
                                            ) : (
                                              <button
                                                onClick={() => handleEditCredentials(location)}
                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded flex items-center gap-1"
                                              >
                                                <Key className="w-3 h-3" />
                                                Add SSH
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ) : null;
                        })()}
                      </div>
                    )}

                    {/* Connection Profiles (SFTP/FTP/SSH) */}
                    {connectionProfiles.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                          <Network className="w-4 h-4" />
                          Connection Profiles ({connectionProfiles.length})
                        </h3>
                        <div className="space-y-2">
                          {connectionProfiles.map(profile => (
                            <div key={profile.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-slate-200 font-medium">{profile.name}</div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    {profile.connection_type.toUpperCase()} • {profile.host}:{profile.port}
                                  </div>
                                </div>
                                <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded border border-purple-500/30">
                                  Profile
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-slate-500 mt-3">
                          Manage connection profiles in File Browser → Manage Connections
                        </div>
                      </div>
                    )}

                    {proxmoxLocations.length === 0 && (
                      <div className="text-center py-8 text-slate-400">
                        <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No Proxmox locations found</p>
                        <p className="text-xs mt-2">Configure Proxmox API below to see VMs and containers</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
            
            {/* Proxmox API Configuration Card - Collapsible */}
            <Collapsible open={apiConfigOpen} onOpenChange={setApiConfigOpen}>
              <Card className={`border-slate-800 bg-slate-900/50 backdrop-blur-sm ${
                apiTestStatus 
                  ? apiTestStatus.status === "success"
                    ? "border-l-4 border-l-emerald-500"
                    : "border-l-4 border-l-red-500"
                  : ""
              }`}>
                <CollapsibleTrigger className="w-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          apiTestStatus?.status === "success" 
                            ? "bg-emerald-500/10" 
                            : apiTestStatus?.status === "failed"
                            ? "bg-red-500/10"
                            : "bg-cyan-500/10"
                        }`}>
                          <Server className={`w-5 h-5 ${
                            apiTestStatus?.status === "success"
                              ? "text-emerald-400"
                              : apiTestStatus?.status === "failed"
                              ? "text-red-400"
                              : "text-cyan-400"
                          }`} />
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-slate-100">Proxmox API Configuration</CardTitle>
                          <CardDescription className="text-slate-400">
                            {apiTestStatus?.status === "success" && "✅ Connected to Proxmox"}
                            {apiTestStatus?.status === "failed" && "❌ Connection Failed"}
                            {!apiTestStatus && "Connect to your Proxmox server via API token"}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* API Status Badge */}
                        {apiTestStatus && (
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                            apiTestStatus.status === "success" 
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}>
                            {apiTestStatus.status === "success" ? (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                <span>Connected</span>
                              </>
                            ) : (
                              <>
                                <span className="text-lg">✕</span>
                                <span>Failed</span>
                              </>
                            )}
                          </div>
                        )}
                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${apiConfigOpen ? "rotate-180" : ""}`} />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="host" className="text-slate-200">Proxmox Host</Label>
                  <Input
                    id="host"
                    data-testid="host-input"
                    type="text"
                    placeholder="https://proxmox.zaibatsui.co.uk"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500">Full URL including protocol and port</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api_token_name" className="text-slate-200">API Token Name</Label>
                  <Input
                    id="api_token_name"
                    data-testid="token-name-input"
                    type="text"
                    placeholder="root@pam!token-name"
                    value={formData.api_token_name}
                    onChange={(e) => setFormData({ ...formData, api_token_name: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500">Format: user@realm!token-id</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api_token_secret" className="text-slate-200">
                    API Token Secret {config && <span className="text-slate-500 font-normal text-xs">(Optional for updates)</span>}
                  </Label>
                  <Input
                    id="api_token_secret"
                    data-testid="token-secret-input"
                    type="password"
                    placeholder={config ? "Leave empty to keep existing secret" : "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}
                    value={formData.api_token_secret}
                    onChange={(e) => setFormData({ ...formData, api_token_secret: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500">
                    {config 
                      ? "Leave empty to keep the existing secret" 
                      : "The secret value provided when creating the token"
                    }
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-lg border border-slate-800">
                  <div>
                    <Label htmlFor="verify_ssl" className="text-slate-200 cursor-pointer">Verify SSL Certificate</Label>
                    <p className="text-xs text-slate-500">Disable for self-signed certificates</p>
                  </div>
                  <Switch
                    id="verify_ssl"
                    data-testid="verify-ssl-switch"
                    checked={formData.verify_ssl}
                    onCheckedChange={(checked) => setFormData({ ...formData, verify_ssl: checked })}
                  />
                </div>

                {/* API Error Display */}
                {apiTestStatus && apiTestStatus.error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm font-semibold text-red-400 mb-1">Connection Error:</p>
                    <p className="text-xs text-red-300">{apiTestStatus.error}</p>
                    {apiTestStatus.error.includes("Unauthorized") && (
                      <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded">
                        <p className="text-xs font-semibold text-orange-400 mb-1">⚠️ Common Fix:</p>
                        <p className="text-xs text-orange-300">Enable "Privilege Separation" checkbox in Proxmox when creating/editing your API token</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
                    data-testid="save-button"
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-pulse">●</span> Saving...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Save className="w-4 h-4" />
                        Save API Config
                      </span>
                    )}
                  </Button>
                  <Button
                    onClick={testApiConnection}
                    disabled={testingApi || !config}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    {testingApi ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-pulse">●</span> Testing...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Test API
                      </span>
                    )}
                  </Button>
                </div>

                {/* How to Create API Token Guide */}
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-100 mb-3">How to Create API Token</h3>
                  <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside">
                    <li>Log into Proxmox web interface</li>
                    <li>Go to Datacenter → Permissions → API Tokens</li>
                    <li>Click "Add" to create a new token</li>
                    <li>Select user (e.g., root@pam)</li>
                    <li>Enter a Token ID</li>
                    <li className="font-semibold text-orange-400">✓ CHECK "Privilege Separation" (REQUIRED!)</li>
                    <li>Copy the secret immediately (shown only once)</li>
                  </ol>
                </div>
              </CardContent>
                </CollapsibleContent>
            </Card>
            </Collapsible>

            {/* SSH Configuration Card - Collapsible */}
            <Collapsible open={sshConfigOpen} onOpenChange={setSshConfigOpen}>
              <Card className={`border-slate-800 bg-slate-900/50 backdrop-blur-sm ${
                sshTestStatus 
                  ? sshTestStatus.status === "success"
                    ? "border-l-4 border-l-emerald-500"
                    : "border-l-4 border-l-orange-500"
                  : ""
              }`}>
                <CollapsibleTrigger className="w-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          sshTestStatus?.status === "success" 
                            ? "bg-emerald-500/10" 
                            : sshTestStatus?.status === "failed"
                            ? "bg-orange-500/10"
                            : "bg-cyan-500/10"
                        }`}>
                          <Server className={`w-5 h-5 ${
                            sshTestStatus?.status === "success"
                              ? "text-emerald-400"
                              : sshTestStatus?.status === "failed"
                              ? "text-orange-400"
                              : "text-cyan-400"
                          }`} />
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-slate-100">SSH Configuration</CardTitle>
                          <CardDescription className="text-slate-400">
                            {sshTestStatus?.status === "success" && "✅ SSH Connected"}
                            {sshTestStatus?.status === "failed" && "⚠️ SSH Failed (Optional)"}
                            {!sshTestStatus && "Required for device scanning (lspci commands)"}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* SSH Status Badge */}
                        {sshTestStatus && (
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                            sshTestStatus.status === "success" 
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-orange-500/10 text-orange-400"
                          }`}>
                            {sshTestStatus.status === "success" ? (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                <span>Connected</span>
                              </>
                            ) : (
                              <>
                                <span className="text-lg">!</span>
                                <span>Failed</span>
                              </>
                            )}
                          </div>
                        )}
                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${sshConfigOpen ? "rotate-180" : ""}`} />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ssh_host" className="text-slate-200">SSH Host</Label>
                  <Input
                    id="ssh_host"
                    type="text"
                    placeholder="proxmox.zaibatsui.co.uk or 145.40.178.205"
                    value={sshFormData.host}
                    onChange={(e) => setSshFormData({ ...sshFormData, host: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500">Hostname or IP address of SSH server</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ssh_port" className="text-slate-200">SSH Port</Label>
                  <Input
                    id="ssh_port"
                    type="number"
                    placeholder="22"
                    value={sshFormData.port}
                    onChange={(e) => setSshFormData({ ...sshFormData, port: parseInt(e.target.value) || 22 })}
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500">SSH port (default: 22)</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ssh_username" className="text-slate-200">SSH Username</Label>
                  <Input
                    id="ssh_username"
                    type="text"
                    placeholder="root"
                    value={sshFormData.username}
                    onChange={(e) => setSshFormData({ ...sshFormData, username: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500">SSH username for accessing Proxmox host</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ssh_password" className="text-slate-200">
                    SSH Password {sshConfigs.length > 0 && <span className="text-slate-500 font-normal text-xs">(Optional for updates)</span>}
                  </Label>
                  <Input
                    id="ssh_password"
                    type="password"
                    placeholder={sshConfigs.length > 0 ? "Leave empty to keep existing password" : "Enter SSH password"}
                    value={sshFormData.password}
                    onChange={(e) => setSshFormData({ ...sshFormData, password: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500">
                    {sshConfigs.length > 0 
                      ? "Leave empty to keep existing password" 
                      : "SSH password (or use SSH keys)"
                    }
                  </p>
                </div>

                {/* SSH Error Display */}
                {sshTestStatus && sshTestStatus.error && (
                  <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                    <p className="text-sm font-semibold text-orange-400 mb-1">SSH Connection Error:</p>
                    <p className="text-xs text-orange-300">{sshTestStatus.error}</p>
                    <p className="text-xs text-slate-400 mt-2">Note: SSH is only required for device scanning. VM management works via API only.</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleSaveSSH}
                    disabled={savingSsh}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    {savingSsh ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-pulse">●</span> Saving...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Save className="w-4 h-4" />
                        Save SSH Config
                      </span>
                    )}
                  </Button>
                  <Button
                    onClick={testSshConnection}
                    disabled={testingSsh || !config}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    {testingSsh ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-pulse">●</span> Testing...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Test SSH
                      </span>
                    )}
                  </Button>
                </div>

                {config && (
                  <Button
                    onClick={handleDelete}
                    variant="destructive"
                    className="w-full"
                    data-testid="delete-button"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All Configuration
                  </Button>
                )}
              </CardContent>
                </CollapsibleContent>
            </Card>
            </Collapsible>

        {/* SSH Credential Edit Modal */}
        {showCredentialModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowCredentialModal(false)}>
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-slate-200 mb-4">
                SSH Credentials for {editingLocation?.name}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-300">Host / IP Address</Label>
                  <Input
                    value={credentialForm.ssh_host}
                    onChange={(e) => setCredentialForm({...credentialForm, ssh_host: e.target.value})}
                    placeholder="192.168.1.100"
                    className="bg-slate-800 border-slate-700 text-slate-200"
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label className="text-slate-300">Username</Label>
                    <Input
                      value={credentialForm.ssh_username}
                      onChange={(e) => setCredentialForm({...credentialForm, ssh_username: e.target.value})}
                      placeholder="root"
                      className="bg-slate-800 border-slate-700 text-slate-200"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Port</Label>
                    <Input
                      type="number"
                      value={credentialForm.ssh_port}
                      onChange={(e) => setCredentialForm({...credentialForm, ssh_port: parseInt(e.target.value)})}
                      placeholder="22"
                      className="bg-slate-800 border-slate-700 text-slate-200"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-slate-300">Password</Label>
                  <Input
                    type="password"
                    value={credentialForm.ssh_password}
                    onChange={(e) => setCredentialForm({...credentialForm, ssh_password: e.target.value})}
                    placeholder="••••••••"
                    className="bg-slate-800 border-slate-700 text-slate-200"
                  />
                </div>
              </div>
              
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  onClick={() => setShowCredentialModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCredentials}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Credentials
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Configuration - Collapsible */}
        <Collapsible open={aiConfigOpen} onOpenChange={setAiConfigOpen}>
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      apiKeys?.has_openai_key
                        ? "bg-emerald-500/10"
                        : "bg-cyan-500/10"
                    }`}>
                      <Key className={`w-5 h-5 ${
                        apiKeys?.has_openai_key
                          ? "text-emerald-400"
                          : "text-cyan-400"
                      }`} />
                    </div>
                    <div className="text-left">
                      <CardTitle className="text-slate-100">AI Configuration</CardTitle>
                      <CardDescription className="text-slate-400">
                        {apiKeys?.has_openai_key && "✅ OpenAI API Key Configured"}
                        {!apiKeys?.has_openai_key && "Configure your OpenAI API key for AI Assistant feature"}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {apiKeys && (
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                        apiKeys.has_openai_key
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-slate-700 text-slate-400"
                      }`}>
                        {apiKeys.has_openai_key ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>Configured</span>
                          </>
                        ) : (
                          <>
                            <span className="text-lg">✕</span>
                            <span>Not Set</span>
                          </>
                        )}
                      </div>
                    )}
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${aiConfigOpen ? 'transform rotate-180' : ''}`} />
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
            {apiKeys && apiKeys.has_openai_key ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">API Key Configured</span>
                  </div>
                  <p className="text-sm text-slate-300">
                    Key: {apiKeys.openai_key_preview}
                  </p>
                </div>
                <Button
                  onClick={handleDeleteAPIKeys}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete API Key
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-sm text-amber-400">
                    No API key configured. Add your OpenAI API key to use the AI Assistant feature.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openai_key" className="text-slate-200">
                    OpenAI API Key
                  </Label>
                  <Input
                    id="openai_key"
                    type="password"
                    placeholder="sk-proj-..."
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500">
                    Get your API key from: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="theme-text hover:underline">platform.openai.com/api-keys</a>
                  </p>
                </div>
                <Button
                  onClick={handleSaveAPIKeys}
                  className="theme-btn-primary text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save API Key
                </Button>
              </div>
            )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* App Theme Settings - Collapsible */}
        <Collapsible open={themeOpen} onOpenChange={setThemeOpen}>
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(var(--theme-primary-rgb), 0.1)' }}>
                      <Palette className="w-5 h-5 theme-icon" />
                    </div>
                    <div className="text-left">
                      <CardTitle className="text-slate-100">App Appearance</CardTitle>
                      <CardDescription className="text-slate-400">
                        Customize colors, backgrounds, and card styles
                      </CardDescription>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 transition-transform ${
                      themeOpen ? "transform rotate-180" : ""
                    }`}
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6 pt-0">
                {/* Theme Presets */}
                <div>
                  <Label className="text-slate-200 mb-3 block">Color Presets</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Object.entries(themes).map(([key, theme]) => (
                      <button
                        key={key}
                        onClick={async () => {
                          // Reset custom colors to match theme preset
                          setCustomPrimary(rgbToHex(theme.primaryLight));
                          setCustomSecondary(rgbToHex(theme.accent));
                          setCustomSidebarBg("");
                          setCustomHeaderBg("");
                          
                          const success = await updateTheme(
                            key, background, cardStyle, null,
                            theme.primaryLight, theme.accent, null, null,
                            layoutDensity, borderRadius, shadowIntensity, sidebarWidth
                          );
                          if (success) {
                            toast.success(`Theme changed to ${theme.name}`);
                          } else {
                            toast.error("Failed to update theme");
                          }
                        }}
                        className={`relative group p-4 rounded-lg border-2 transition-all ${
                          currentTheme === key
                            ? "border-slate-400 bg-slate-800"
                            : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                        }`}
                        data-testid={`theme-${key}`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div
                            className="w-12 h-12 rounded-full"
                            style={{ backgroundColor: `rgb(${theme.primaryLight})` }}
                          />
                          <span className="text-xs font-medium text-slate-200">
                            {theme.name}
                          </span>
                          {currentTheme === key && (
                            <div className="absolute top-2 right-2">
                              <Check className="w-4 h-4 text-emerald-400" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Colors */}
                <div className="space-y-4 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-200">Custom Colors</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-200 text-xs mb-2 block">Primary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={customPrimary || "#3b82f6"}
                          onChange={(e) => {
                            setCustomPrimary(e.target.value);
                            updateTheme(
                              currentTheme, background, cardStyle, null,
                              hexToRgb(e.target.value), secondaryColor, sidebarBgColor, headerBgColor,
                              layoutDensity, borderRadius, shadowIntensity, sidebarWidth
                            );
                          }}
                          className="w-20 h-10 cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={customPrimary || "#3b82f6"}
                          onChange={(e) => {
                            setCustomPrimary(e.target.value);
                            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                              updateTheme(
                                currentTheme, background, cardStyle, null,
                                hexToRgb(e.target.value), secondaryColor, sidebarBgColor, headerBgColor,
                                layoutDensity, borderRadius, shadowIntensity, sidebarWidth
                              );
                            }
                          }}
                          className="flex-1 bg-slate-700 border-slate-600 text-slate-100"
                          placeholder="#3b82f6"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-slate-200 text-xs mb-2 block">Secondary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={customSecondary || "#6366f1"}
                          onChange={(e) => {
                            setCustomSecondary(e.target.value);
                            updateTheme(
                              currentTheme, background, cardStyle, null,
                              primaryColor, hexToRgb(e.target.value), sidebarBgColor, headerBgColor,
                              layoutDensity, borderRadius, shadowIntensity, sidebarWidth
                            );
                          }}
                          className="w-20 h-10 cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={customSecondary || "#6366f1"}
                          onChange={(e) => {
                            setCustomSecondary(e.target.value);
                            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                              updateTheme(
                                currentTheme, background, cardStyle, null,
                                primaryColor, hexToRgb(e.target.value), sidebarBgColor, headerBgColor,
                                layoutDensity, borderRadius, shadowIntensity, sidebarWidth
                              );
                            }
                          }}
                          className="flex-1 bg-slate-700 border-slate-600 text-slate-100"
                          placeholder="#6366f1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-slate-200 text-xs mb-2 block">Sidebar Background</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={customSidebarBg || "#0f172a"}
                          onChange={(e) => {
                            setCustomSidebarBg(e.target.value);
                            updateTheme(
                              currentTheme, background, cardStyle, null,
                              primaryColor, secondaryColor, hexToRgb(e.target.value), headerBgColor,
                              layoutDensity, borderRadius, shadowIntensity, sidebarWidth
                            );
                          }}
                          className="w-20 h-10 cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={customSidebarBg || "#0f172a"}
                          onChange={(e) => {
                            setCustomSidebarBg(e.target.value);
                            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                              updateTheme(
                                currentTheme, background, cardStyle, null,
                                primaryColor, secondaryColor, hexToRgb(e.target.value), headerBgColor,
                                layoutDensity, borderRadius, shadowIntensity, sidebarWidth
                              );
                            }
                          }}
                          className="flex-1 bg-slate-700 border-slate-600 text-slate-100"
                          placeholder="#0f172a"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-slate-200 text-xs mb-2 block">Header Background</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={customHeaderBg || "#0f172a"}
                          onChange={(e) => {
                            setCustomHeaderBg(e.target.value);
                            updateTheme(
                              currentTheme, background, cardStyle, null,
                              primaryColor, secondaryColor, sidebarBgColor, hexToRgb(e.target.value),
                              layoutDensity, borderRadius, shadowIntensity, sidebarWidth
                            );
                          }}
                          className="w-20 h-10 cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={customHeaderBg || "#0f172a"}
                          onChange={(e) => {
                            setCustomHeaderBg(e.target.value);
                            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                              updateTheme(
                                currentTheme, background, cardStyle, null,
                                primaryColor, secondaryColor, sidebarBgColor, hexToRgb(e.target.value),
                                layoutDensity, borderRadius, shadowIntensity, sidebarWidth
                              );
                            }
                          }}
                          className="flex-1 bg-slate-700 border-slate-600 text-slate-100"
                          placeholder="#0f172a"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Background Style */}
                <div>
                  <Label className="text-slate-200 mb-3 block">Background Style</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: "dark", name: "Dark", bg: "#020617" },
                      { key: "darker", name: "Darker", bg: "#000000" },
                      { key: "midnight", name: "Midnight", bg: "#0c1222" }
                    ].map((bg) => (
                      <button
                        key={bg.key}
                        onClick={async () => {
                          const success = await updateTheme(
                            currentTheme, bg.key, cardStyle, null,
                            primaryColor, secondaryColor, sidebarBgColor, headerBgColor,
                            layoutDensity, borderRadius, shadowIntensity, sidebarWidth
                          );
                          if (success) {
                            toast.success(`Background changed to ${bg.name}`);
                          }
                        }}
                        className={`relative p-4 rounded-lg border-2 transition-all ${
                          background === bg.key
                            ? "border-slate-400 bg-slate-800"
                            : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                        }`}
                        data-testid={`bg-${bg.key}`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div
                            className="w-full h-12 rounded"
                            style={{ backgroundColor: bg.bg }}
                          />
                          <span className="text-xs font-medium text-slate-200">
                            {bg.name}
                          </span>
                          {background === bg.key && (
                            <div className="absolute top-2 right-2">
                              <Check className="w-4 h-4 text-emerald-400" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Card Style */}
                <div>
                  <Label className="text-slate-200 mb-3 block">Card Style</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: "glass", name: "Glass", desc: "Translucent blur" },
                      { key: "solid", name: "Solid", desc: "Opaque cards" },
                      { key: "bordered", name: "Bordered", desc: "Clear borders" }
                    ].map((style) => (
                      <button
                        key={style.key}
                        onClick={async () => {
                          const success = await updateTheme(
                            currentTheme, background, style.key, null,
                            primaryColor, secondaryColor, sidebarBgColor, headerBgColor,
                            layoutDensity, borderRadius, shadowIntensity, sidebarWidth
                          );
                          if (success) {
                            toast.success(`Card style changed to ${style.name}`);
                          }
                        }}
                        className={`relative p-4 rounded-lg border-2 transition-all ${
                          cardStyle === style.key
                            ? "border-slate-400 bg-slate-800"
                            : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                        }`}
                        data-testid={`card-${style.key}`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-full h-12 rounded bg-slate-700 flex items-center justify-center text-2xl">
                            {style.key === "glass" && "▢"}
                            {style.key === "solid" && "■"}
                            {style.key === "bordered" && "□"}
                          </div>
                          <span className="text-xs font-medium text-slate-200">
                            {style.name}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {style.desc}
                          </span>
                          {cardStyle === style.key && (
                            <div className="absolute top-2 right-2">
                              <Check className="w-4 h-4 text-emerald-400" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Layout Density */}
                <div>
                  <Label className="text-slate-200 mb-3 block">Layout Density</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: "compact", name: "Compact", desc: "Tight spacing" },
                      { key: "comfortable", name: "Comfortable", desc: "Balanced" },
                      { key: "spacious", name: "Spacious", desc: "Loose spacing" }
                    ].map((density) => (
                      <button
                        key={density.key}
                        onClick={async () => {
                          const success = await updateTheme(
                            currentTheme, background, cardStyle, null,
                            primaryColor, secondaryColor, sidebarBgColor, headerBgColor,
                            density.key, borderRadius, shadowIntensity, sidebarWidth
                          );
                          if (success) {
                            toast.success(`Density changed to ${density.name}`);
                          }
                        }}
                        className={`relative p-4 rounded-lg border-2 transition-all ${
                          layoutDensity === density.key
                            ? "border-slate-400 bg-slate-800"
                            : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="text-slate-200 text-lg">⊞</div>
                          <span className="text-xs font-medium text-slate-200">
                            {density.name}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {density.desc}
                          </span>
                          {layoutDensity === density.key && (
                            <div className="absolute top-2 right-2">
                              <Check className="w-4 h-4 text-emerald-400" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Border Radius */}
                <div>
                  <Label className="text-slate-200 mb-3 block">Border Radius</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: "sharp", name: "Sharp", desc: "No rounding" },
                      { key: "rounded", name: "Rounded", desc: "Soft edges" },
                      { key: "very-rounded", name: "Very Rounded", desc: "Smooth curves" }
                    ].map((radius) => (
                      <button
                        key={radius.key}
                        onClick={async () => {
                          const success = await updateTheme(
                            currentTheme, background, cardStyle, null,
                            primaryColor, secondaryColor, sidebarBgColor, headerBgColor,
                            layoutDensity, radius.key, shadowIntensity, sidebarWidth
                          );
                          if (success) {
                            toast.success(`Border radius changed to ${radius.name}`);
                          }
                        }}
                        className={`relative p-4 rounded-lg border-2 transition-all ${
                          borderRadius === radius.key
                            ? "border-slate-400 bg-slate-800"
                            : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div
                            className="w-12 h-12 bg-slate-600"
                            style={{
                              borderRadius: radius.key === "sharp" ? "0" : radius.key === "rounded" ? "0.5rem" : "1rem"
                            }}
                          />
                          <span className="text-xs font-medium text-slate-200">
                            {radius.name}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {radius.desc}
                          </span>
                          {borderRadius === radius.key && (
                            <div className="absolute top-2 right-2">
                              <Check className="w-4 h-4 text-emerald-400" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shadow Intensity */}
                <div>
                  <Label className="text-slate-200 mb-3 block">Shadow Intensity</Label>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { key: "none", name: "None" },
                      { key: "subtle", name: "Subtle" },
                      { key: "medium", name: "Medium" },
                      { key: "strong", name: "Strong" }
                    ].map((shadow) => (
                      <button
                        key={shadow.key}
                        onClick={async () => {
                          const success = await updateTheme(
                            currentTheme, background, cardStyle, null,
                            primaryColor, secondaryColor, sidebarBgColor, headerBgColor,
                            layoutDensity, borderRadius, shadow.key, sidebarWidth
                          );
                          if (success) {
                            toast.success(`Shadow changed to ${shadow.name}`);
                          }
                        }}
                        className={`relative p-4 rounded-lg border-2 transition-all ${
                          shadowIntensity === shadow.key
                            ? "border-slate-400 bg-slate-800"
                            : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-xs font-medium text-slate-200">
                            {shadow.name}
                          </span>
                          {shadowIntensity === shadow.key && (
                            <div className="absolute top-2 right-2">
                              <Check className="w-4 h-4 text-emerald-400" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sidebar Width */}
                <div>
                  <Label className="text-slate-200 mb-3 block">Sidebar Width: {sidebarWidth}px</Label>
                  <Input
                    type="range"
                    min="200"
                    max="400"
                    step="8"
                    value={sidebarWidth}
                    onChange={(e) => {
                      const width = parseInt(e.target.value);
                      updateTheme(
                        currentTheme, background, cardStyle, null,
                        primaryColor, secondaryColor, sidebarBgColor, headerBgColor,
                        layoutDensity, borderRadius, shadowIntensity, width
                      );
                    }}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>Narrow (200px)</span>
                    <span>Wide (400px)</span>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
        </div>
      </div>
    </Layout>
  );
}

export default Settings;
