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
import { Server, Save, Trash2, CheckCircle, Palette, Check, ChevronDown, Key } from "lucide-react";
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
  }, []);
  
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
          ssh_username: response.data.ssh_username || "root",
          ssh_password: "" // Don't show password
        });
        // Test connection automatically after loading config
        testConnection();
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
    if (!formData.host || !formData.api_token_name || !formData.api_token_secret) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API}/proxmox/config`, formData);
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
                  <Label htmlFor="api_token_secret" className="text-slate-200">API Token Secret</Label>
                  <Input
                    id="api_token_secret"
                    data-testid="token-secret-input"
                    type="password"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={formData.api_token_secret}
                    onChange={(e) => setFormData({ ...formData, api_token_secret: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500">The secret value provided when creating the token</p>
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
                  <Label htmlFor="ssh_username" className="text-slate-200">SSH Username</Label>
                  <Input
                    id="ssh_username"
                    type="text"
                    placeholder="root"
                    value={formData.ssh_username}
                    onChange={(e) => setFormData({ ...formData, ssh_username: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500">SSH username for accessing Proxmox host</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ssh_password" className="text-slate-200">SSH Password</Label>
                  <Input
                    id="ssh_password"
                    type="password"
                    placeholder="Enter SSH password"
                    value={formData.ssh_password}
                    onChange={(e) => setFormData({ ...formData, ssh_password: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500">Optional: Leave empty if using SSH keys</p>
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
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    {saving ? (
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
                {/* Primary Color */}
                <div>
                  <Label className="text-slate-200 mb-3 block">Primary Color</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Object.entries(themes).map(([key, theme]) => (
                      <button
                        key={key}
                        onClick={async () => {
                          const success = await updateTheme(key, background, cardStyle, null);
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

                {/* Background Color */}
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
                          const success = await updateTheme(currentTheme, bg.key, cardStyle, null);
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
                          const success = await updateTheme(currentTheme, background, style.key, null);
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
