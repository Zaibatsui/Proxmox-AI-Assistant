import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Server, Plus, Edit2, Trash2, Check, X, Loader2, TestTube, RefreshCw, HardDrive, Package, Box } from 'lucide-react';
import { toast } from 'sonner';
import { useConnections } from '../contexts/ConnectionContext';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

function ConnectionManager({ onSelectConnection, selectedConnection }) {
  // Use centralized connection data
  const {
    proxmoxLocations,
    connectionProfiles,
    loadAllConnections: reloadConnections,
    loading: loadingConnections,
    connectionsStatus,
    connectionsCached,
    connectionsLastUpdated
  } = useConnections();
  
  const [profiles, setProfiles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [testingConnection, setTestingConnection] = useState(null);
  const [showProxmoxTab, setShowProxmoxTab] = useState(true);
  const [connectingTo, setConnectingTo] = useState(null); // Track which location is being connected
  
  const [formData, setFormData] = useState({
    name: '',
    connection_type: 'ssh',
    host: '',
    port: 22,
    username: '',
    password: '',
    private_key: '',
    base_path: '/',
    notes: ''
  });

  // Sync local profiles state with ConnectionContext
  useEffect(() => {
    if (connectionProfiles) {
      setProfiles(connectionProfiles);
    }
  }, [connectionProfiles]);
  
  // Helper to get icon for location type
  const getLocationIcon = (type) => {
    switch (type) {
      case 'host': return Server;
      case 'vm': return HardDrive;
      case 'lxc': return Package;
      case 'docker': return Box;
      default: return Server;
    }
  };
  
  // Helper to render a location card
  const renderLocation = (location) => {
    const Icon = getLocationIcon(location.type);
    const iconColor = location.type === 'docker' ? 'text-purple-400' : 'text-cyan-400';
    const isConnecting = connectingTo === location.id;
    
    return (
      <div
        key={location.id}
        className={`p-3 rounded-lg border transition-all cursor-pointer relative ${
          isConnecting
            ? 'bg-cyan-500/20 border-cyan-500/30'
            : selectedConnection?.id?.includes(location.id)
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
        }`}
        onClick={() => !isConnecting && handleQuickConnect(location)}
      >
        <div className="flex items-start gap-2">
          {isConnecting ? (
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0 mt-0.5" />
          ) : (
            <Icon className={`w-4 h-4 ${iconColor} flex-shrink-0 mt-0.5`} />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-200 truncate">
              {location.name}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-400">
                {location.type.toUpperCase()}
                {location.vmid && ` ${location.vmid}`}
              </span>
              {location.status && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  location.status === 'running'
                    ? 'bg-green-500/20 text-green-400'
                    : location.status === 'exited'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-slate-600/20 text-slate-400'
                }`}>
                  {location.status}
                </span>
              )}
              {isConnecting && (
                <span className="text-xs text-cyan-400">Connecting...</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const loadProfiles = async () => {
    // Reload profiles after creating/updating
    await reloadConnections(true);
  };
  
  const handleQuickConnect = async (location) => {
    setConnectingTo(location.id);
    toast.loading(`Connecting to ${location.name}...`, { id: 'quick-connect' });
    
    try {
      const response = await axios.post(`${API}/api/proxmox-locations/${location.id}/quick-connect`);
      if (response.data.success && onSelectConnection) {
        onSelectConnection(response.data.profile);
        toast.success(`Connected to ${location.name}`, { id: 'quick-connect' });
      }
    } catch (error) {
      console.error('Quick connect failed:', error);
      toast.error(error.response?.data?.detail || `Failed to connect to ${location.name}`, { id: 'quick-connect' });
    } finally {
      setConnectingTo(null);
    }
  };

  const handleDelete = async (profileId, profileName) => {
    if (!window.confirm(`Delete connection profile "${profileName}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`${API}/api/connection-profiles/${profileId}`);
      toast.success(`Profile "${profileName}" deleted`);
      loadProfiles(); // Reload to update cache
    } catch (error) {
      console.error('Failed to delete profile:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete profile');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingProfile) {
        // Update existing
        await axios.put(`${API}/api/connection-profiles/${editingProfile.id}`, formData);
        toast.success('Connection profile updated');
      } else {
        // Create new
        await axios.post(`${API}/api/connection-profiles`, formData);
        toast.success('Connection profile created');
      }
      
      setShowModal(false);
      resetForm();
      loadProfiles();
    } catch (error) {
      console.error('Failed to save profile:', error);
      toast.error(error.response?.data?.detail || 'Failed to save connection profile');
    }
  };

  const handleEdit = async (profile) => {
    try {
      // Load full profile with credentials
      const response = await axios.get(`${API}/api/connection-profiles/${profile.id}`);
      const fullProfile = response.data;
      
      setFormData({
        name: fullProfile.name,
        connection_type: fullProfile.connection_type,
        host: fullProfile.host,
        port: fullProfile.port,
        username: fullProfile.username,
        password: fullProfile.password || '',
        private_key: fullProfile.private_key || '',
        base_path: fullProfile.base_path || '/',
        notes: fullProfile.notes || ''
      });
      
      setEditingProfile(profile);
      setShowModal(true);
    } catch (error) {
      console.error('Failed to load profile:', error);
      toast.error('Failed to load profile details');
    }
  };

  const testConnection = async (profileId) => {
    setTestingConnection(profileId);
    try {
      const response = await axios.post(`${API}/api/connection-profiles/${profileId}/test`);
      
      if (response.data.status === 'success') {
        toast.success(response.data.message || 'Connection successful!');
      } else {
        toast.error(response.data.message || 'Connection failed');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      toast.error(error.response?.data?.detail || 'Connection test failed');
    } finally {
      setTestingConnection(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      connection_type: 'ssh',
      host: '',
      port: 22,
      username: '',
      password: '',
      private_key: '',
      base_path: '/',
      notes: ''
    });
    setEditingProfile(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Connections</h3>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="p-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
          title="Add Connection"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setShowProxmoxTab(true)}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
            showProxmoxTab
              ? 'bg-amber-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Proxmox ({proxmoxLocations.length})
        </button>
        <button
          onClick={() => setShowProxmoxTab(false)}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
            !showProxmoxTab
              ? 'bg-amber-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Profiles ({profiles.length})
        </button>
      </div>
      
      {/* Cache status and refresh button */}
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-700">
        <div className="text-xs text-slate-500">
          {connectionsCached && connectionsLastUpdated && (
            <>Cached • {connectionsLastUpdated.toLocaleTimeString()}</>
          )}
          {!connectionsCached && connectionsLastUpdated && (
            <>Updated: {connectionsLastUpdated.toLocaleTimeString()}</>
          )}
        </div>
        <button
          onClick={() => reloadConnections(true)}
          disabled={loadingConnections}
          className="p-1 hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
          title="Refresh connections"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loadingConnections ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {showProxmoxTab ? (
        // Proxmox Locations
        loadingConnections ? (
          <div className="text-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400 mx-auto" />
          </div>
        ) : proxmoxLocations.length === 0 ? (
          <div className="text-center py-4 text-slate-500 text-sm">
            No Proxmox locations. Configure Proxmox in Settings.
          </div>
        ) : (
          <div className="space-y-3">
            {/* Group by type and status */}
            {/* Proxmox Host */}
            {proxmoxLocations.filter(l => l.type === 'host').length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2 px-1">PROXMOX HOST</div>
                {proxmoxLocations.filter(l => l.type === 'host').map(renderLocation)}
              </div>
            )}
            
            {/* VMs & LXCs - Running */}
            {proxmoxLocations.filter(l => (l.type === 'vm' || l.type === 'lxc') && l.status === 'running').length > 0 && (
              <div>
                <div className="text-xs font-semibold text-emerald-400 mb-2 px-1">VMs & CONTAINERS - RUNNING</div>
                {proxmoxLocations
                  .filter(l => (l.type === 'vm' || l.type === 'lxc') && l.status === 'running')
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(renderLocation)}
              </div>
            )}
            
            {/* VMs & LXCs - Stopped */}
            {proxmoxLocations.filter(l => (l.type === 'vm' || l.type === 'lxc') && l.status !== 'running').length > 0 && (
              <details className="group">
                <summary className="text-xs font-semibold text-red-400 mb-2 px-1 cursor-pointer hover:text-red-300 flex items-center gap-1">
                  <span className="transform transition-transform group-open:rotate-90">▶</span>
                  VMs & CONTAINERS - STOPPED
                </summary>
                <div className="space-y-2 mt-2">
                  {proxmoxLocations
                    .filter(l => (l.type === 'vm' || l.type === 'lxc') && l.status !== 'running')
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(renderLocation)}
                </div>
              </details>
            )}
            
            {/* Docker Containers - Running */}
            {proxmoxLocations.filter(l => l.type === 'docker' && l.status === 'running').length > 0 && (
              <div>
                <div className="text-xs font-semibold text-purple-400 mb-2 px-1">DOCKER - RUNNING</div>
                {proxmoxLocations
                  .filter(l => l.type === 'docker' && l.status === 'running')
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(renderLocation)}
              </div>
            )}
            
            {/* Docker Containers - Stopped */}
            {proxmoxLocations.filter(l => l.type === 'docker' && l.status !== 'running').length > 0 && (
              <details className="group">
                <summary className="text-xs font-semibold text-purple-400/70 mb-2 px-1 cursor-pointer hover:text-purple-300 flex items-center gap-1">
                  <span className="transform transition-transform group-open:rotate-90">▶</span>
                  DOCKER - STOPPED
                </summary>
                <div className="space-y-2 mt-2">
                  {proxmoxLocations
                    .filter(l => l.type === 'docker' && l.status !== 'running')
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(renderLocation)}
                </div>
              </details>
            )}
          </div>
        )
      ) : (
        // Connection Profiles
        loadingConnections ? (
          <div className="text-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-amber-400 mx-auto" />
          </div>
        ) : profiles.length === 0 ? (
        <div className="text-center py-4 text-slate-500 text-sm">
          No connection profiles yet. Click + to add one.
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                selectedConnection?.id === profile.id
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
              }`}
              onClick={() => onSelectConnection(profile)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <Server className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-200 truncate">
                      {profile.name}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {profile.connection_type.toUpperCase()} • {profile.host}:{profile.port}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      testConnection(profile.id);
                    }}
                    disabled={testingConnection === profile.id}
                    className="p-1 hover:bg-slate-700 rounded transition-colors"
                    title="Test Connection"
                  >
                    {testingConnection === profile.id ? (
                      <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />
                    ) : (
                      <TestTube className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(profile);
                    }}
                    className="p-1 hover:bg-slate-700 rounded transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-3 h-3 text-slate-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(profile.id, profile.name);
                    }}
                    className="p-1 hover:bg-red-900/50 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        )
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">
                {editingProfile ? 'Edit Connection Profile' : 'Add Connection Profile'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-1 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Profile Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-amber-500 focus:outline-none"
                  placeholder="My Server"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Connection Type *
                  </label>
                  <select
                    value={formData.connection_type}
                    onChange={(e) => {
                      const type = e.target.value;
                      setFormData({ 
                        ...formData, 
                        connection_type: type,
                        port: type === 'ssh' ? 22 : type === 'ftp' ? 21 : type === 'sftp' ? 22 : 443
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="ssh">SSH</option>
                    <option value="sftp">SFTP</option>
                    <option value="ftp">FTP</option>
                    <option value="reverse_proxy">Reverse Proxy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Port *
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-amber-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Host / URL *
                </label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-amber-500 focus:outline-none"
                  placeholder={formData.connection_type === 'reverse_proxy' ? 'https://myserver.example.com' : '192.168.1.100'}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-amber-500 focus:outline-none"
                  placeholder="root"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-amber-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>

              {(formData.connection_type === 'ssh' || formData.connection_type === 'sftp') && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Private Key (Optional)
                  </label>
                  <textarea
                    value={formData.private_key}
                    onChange={(e) => setFormData({ ...formData, private_key: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-amber-500 focus:outline-none font-mono text-xs"
                    placeholder="-----BEGIN RSA PRIVATE KEY-----"
                    rows={4}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Base Path
                </label>
                <input
                  type="text"
                  value={formData.base_path}
                  onChange={(e) => setFormData({ ...formData, base_path: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-amber-500 focus:outline-none"
                  placeholder="/"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-amber-500 focus:outline-none"
                  placeholder="Additional notes..."
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
                >
                  {editingProfile ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConnectionManager;
