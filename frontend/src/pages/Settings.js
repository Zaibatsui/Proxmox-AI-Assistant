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
  const { currentTheme, background, cardStyle, updateTheme, themes } = useTheme();
  const [config, setConfig] = useState(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState(null);
  const [openaiKey, setOpenaiKey] = useState("");
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

  useEffect(() => {
    fetchConfig();
    fetchAPIKeys();
  }, []);

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
      }
    } catch (error) {
      // No config yet
    } finally {
      setLoading(false);
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
      fetchConfig();
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Proxmox API Configuration */}
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/10 rounded-lg">
                    <Server className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <CardTitle className="text-slate-100">Proxmox API Configuration</CardTitle>
                    <CardDescription className="text-slate-400">
                      Connect to your Proxmox server via API token
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="host" className="text-slate-200">Proxmox Host</Label>
                  <Input
                    id="host"
                    data-testid="host-input"
                    type="text"
                    placeholder="https://192.168.1.100:8006"
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

                {/* SSH Credentials Section */}
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-semibold text-slate-200">SSH Credentials (for Device Scanning)</h3>
                  </div>
                  <p className="text-xs text-slate-400">Required to scan hardware devices from Proxmox host</p>
                  
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
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white"
                    data-testid="save-button"
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-pulse">●</span> Saving...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Save className="w-4 h-4" />
                        Save Configuration
                      </span>
                    )}
                  </Button>
                  {config && (
                    <Button
                      onClick={handleDelete}
                      variant="destructive"
                      data-testid="delete-button"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-slate-100 text-sm">Configuration Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {config ? (
                  <>
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-semibold">Connected</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-slate-500">Host:</span>
                        <p className="text-slate-300 break-all">{config.host}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Token:</span>
                        <p className="text-slate-300 break-all">{config.api_token_name}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">SSL Verify:</span>
                        <p className="text-slate-300">{config.verify_ssl ? "Enabled" : "Disabled"}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-slate-500 text-sm">
                    No configuration saved yet. Fill in the form and click Save.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm mt-6">
              <CardHeader>
                <CardTitle className="text-slate-100 text-sm">How to Create API Token</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside">
                  <li>Log into Proxmox web interface</li>
                  <li>Go to Datacenter → Permissions → API Tokens</li>
                  <li>Click "Add" to create a new token</li>
                  <li>Select user (e.g., root@pam)</li>
                  <li>Enter a Token ID</li>
                  <li>Uncheck "Privilege Separation" for full access</li>
                  <li>Copy the secret immediately (shown only once)</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* AI Configuration */}
        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(var(--theme-primary-rgb), 0.1)' }}>
                <Key className="w-5 h-5 theme-icon" />
              </div>
              <div>
                <CardTitle className="text-slate-100">AI Configuration</CardTitle>
                <CardDescription className="text-slate-400">
                  Configure your OpenAI API key for AI Assistant feature
                </CardDescription>
              </div>
            </div>
          </CardHeader>
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
        </Card>

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
    </Layout>
  );
}

export default Settings;
