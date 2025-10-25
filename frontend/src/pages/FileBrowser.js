import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ChevronRight, ChevronDown, File, Folder, Save, X, Upload, FolderPlus, FilePlus, Trash2, FolderOpen, Download } from 'lucide-react';
import Layout from '../components/Layout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const COMMON_PATHS = [
  { path: '/etc/pve/qemu-server', label: 'VM Configs' },
  { path: '/etc/pve/lxc', label: 'Container Configs' },
  { path: '/var/lib/vz', label: 'VM Storage' },
  { path: '/etc/pve', label: 'Proxmox Config' },
  { path: '/root', label: 'Root Home' }
];

const FileBrowser = ({ onLogout }) => {
  const [currentPath, setCurrentPath] = useState('/etc/pve');
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  
  // Location state
  const [location, setLocation] = useState({ type: 'host' });
  const [availableLocations, setAvailableLocations] = useState([]);
  const [showVMCredentials, setShowVMCredentials] = useState(false);
  const [vmCredentials, setVmCredentials] = useState({ username: 'root', password: '' });
  const [sessionCredentials, setSessionCredentials] = useState({}); // Store VM credentials for session
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState(null); // 'success', 'error', or null

  // Get auth token
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  // Get location payload for API calls
  const getLocationPayload = () => {
    if (location.type === 'vm' && sessionCredentials[location.id]) {
      return {
        type: 'vm',
        id: location.id,
        ssh_username: sessionCredentials[location.id].username,
        ssh_password: sessionCredentials[location.id].password
      };
    } else if (location.type === 'lxc') {
      return {
        type: 'lxc',
        id: location.id
      };
    }
    return null; // null means host
  };

  // Fetch available locations (VMs and containers)
  const fetchLocations = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/vms`, getAuthHeaders());
      setAvailableLocations(response.data);
    } catch (err) {
      console.error('Failed to fetch locations:', err);
    }
  };

  // Handle location change
  const handleLocationChange = (newLocation) => {
    if (newLocation.type === 'vm' && !sessionCredentials[newLocation.id]) {
      // Need credentials for VM
      setLocation(newLocation);
      setShowVMCredentials(true);
    } else {
      setLocation(newLocation);
      // Reset to root when changing location
      if (newLocation.type === 'host') {
        loadDirectory('/etc/pve');
      } else {
        loadDirectory('/root');
      }
    }
  };

  // Save VM credentials and proceed
  const saveVMCredentials = () => {
    setSessionCredentials({
      ...sessionCredentials,
      [location.id]: vmCredentials
    });
    setShowVMCredentials(false);
    setConnectionTestResult(null);
    loadDirectory('/root');
  };

  // Test VM SSH connection
  const testVMConnection = async () => {
    setTestingConnection(true);
    setConnectionTestResult(null);
    setError(null);
    
    try {
      const locationPayload = {
        type: 'vm',
        id: location.id,
        ssh_username: vmCredentials.username,
        ssh_password: vmCredentials.password
      };
      
      // Try to list root directory as a test
      const response = await axios.post(
        `${BACKEND_URL}/api/files/list`,
        { path: '/root', location: locationPayload },
        getAuthHeaders()
      );
      
      setConnectionTestResult('success');
      setSuccess('SSH connection successful!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setConnectionTestResult('error');
      setError(err.response?.data?.detail || 'SSH connection failed. Please check credentials.');
    } finally {
      setTestingConnection(false);
    }
  };

  // Parse path into breadcrumbs
  useEffect(() => {
    const parts = currentPath.split('/').filter(p => p);
    const crumbs = [{ name: 'root', path: '/' }];
    let accPath = '';
    parts.forEach(part => {
      accPath += '/' + part;
      crumbs.push({ name: part, path: accPath });
    });
    setBreadcrumbs(crumbs);
  }, [currentPath]);

  // Load directory
  const loadDirectory = async (path) => {
    setLoading(true);
    setError(null);
    try {
      const locationPayload = getLocationPayload();
      const response = await axios.post(
        `${BACKEND_URL}/api/files/list`,
        { path, location: locationPayload },
        getAuthHeaders()
      );
      setFiles(response.data);
      setCurrentPath(path);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  };

  // Load file content
  const loadFile = async (filePath) => {
    setLoading(true);
    setError(null);
    try {
      const locationPayload = getLocationPayload();
      const response = await axios.post(
        `${BACKEND_URL}/api/files/read`,
        { path: filePath, location: locationPayload },
        getAuthHeaders()
      );
      setFileContent(response.data.content);
      setOriginalContent(response.data.content);
      setSelectedFile(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load file');
    } finally {
      setLoading(false);
    }
  };

  // Save file
  const saveFile = async () => {
    if (!selectedFile) return;
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const locationPayload = getLocationPayload();
      await axios.post(
        `${BACKEND_URL}/api/files/write`,
        {
          path: selectedFile.path,
          content: fileContent,
          create_backup: true,
          location: locationPayload
        },
        getAuthHeaders()
      );
      setSuccess('File saved successfully!');
      setOriginalContent(fileContent);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  // Create backup
  const createBackup = async () => {
    if (!selectedFile) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const locationPayload = getLocationPayload();
      await axios.post(
        `${BACKEND_URL}/api/files/backup`,
        {
          path: selectedFile.path,
          description: `Manual backup - ${new Date().toLocaleString()}`,
          location: locationPayload
        },
        getAuthHeaders()
      );
      setSuccess('Backup created successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create backup');
    } finally {
      setLoading(false);
    }
  };

  // Close file
  const closeFile = () => {
    if (fileContent !== originalContent) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }
    setSelectedFile(null);
    setFileContent('');
    setOriginalContent('');
  };

  // Navigate to breadcrumb
  const navigateTo = (path) => {
    loadDirectory(path);
    setSelectedFile(null);
  };

  // File item click handler
  const handleFileClick = (file) => {
    if (file.type === 'directory') {
      loadDirectory(file.path);
    } else {
      loadFile(file.path);
    }
  };

  // Initial load
  useEffect(() => {
    fetchLocations();
    loadDirectory(currentPath);
  }, []);

  // Format file size
  const formatSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Layout onLogout={onLogout} currentPage="files">
      <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">File Browser</h1>
            <p className="text-gray-400">Browse and edit files on your Proxmox server</p>
          </div>

          {/* Location Selector */}
          <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg p-4 mb-4 border border-slate-700">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">LOCATION</h3>
            <select
              value={JSON.stringify(location)}
              onChange={(e) => handleLocationChange(JSON.parse(e.target.value))}
              className="w-full px-4 py-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-amber-500 focus:outline-none"
            >
              <option value={JSON.stringify({ type: 'host' })}>Proxmox Host</option>
              <optgroup label="Containers">
                {availableLocations.filter(l => l.type === 'lxc').map((loc) => (
                  <option key={loc.vmid} value={JSON.stringify({ type: 'lxc', id: loc.vmid })}>
                    Container: {loc.vmid} ({loc.name})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Virtual Machines">
                {availableLocations.filter(l => l.type === 'qemu').map((loc) => (
                  <option key={loc.vmid} value={JSON.stringify({ type: 'vm', id: loc.vmid })}>
                    VM: {loc.vmid} ({loc.name})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

        {/* Common Paths */}
        <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg p-4 mb-4 border border-slate-700">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">QUICK ACCESS</h3>
          <div className="flex flex-wrap gap-2">
            {COMMON_PATHS.map((item) => (
              <button
                key={item.path}
                onClick={() => navigateTo(item.path)}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors flex items-center gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500 text-green-400 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-12 gap-4">
          {/* File List Panel */}
          <div className="col-span-12 lg:col-span-5 bg-gray-800 rounded-lg overflow-hidden">
            {/* Breadcrumbs */}
            <div className="bg-gray-750 px-4 py-3 border-b border-gray-700">
              <div className="flex items-center gap-1 text-sm overflow-x-auto">
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.path}>
                    {idx > 0 && <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                    <button
                      onClick={() => navigateTo(crumb.path)}
                      className="text-amber-400 hover:text-amber-300 whitespace-nowrap"
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* File List */}
            <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
              {loading && !selectedFile ? (
                <div className="p-8 text-center text-gray-400">Loading...</div>
              ) : files.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No files found</div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {files.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => handleFileClick(file)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-700 transition-colors text-left"
                    >
                      {file.type === 'directory' ? (
                        <Folder className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      ) : (
                        <File className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-white truncate">{file.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          {file.size && <span>{formatSize(file.size)}</span>}
                          {file.modified && <span>{file.modified}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Editor Panel */}
          <div className="col-span-12 lg:col-span-7 bg-gray-800 rounded-lg overflow-hidden">
            {selectedFile ? (
              <>
                {/* Editor Header */}
                <div className="bg-gray-750 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <File className="w-5 h-5 text-amber-400" />
                    <div>
                      <div className="text-white font-medium">{selectedFile.path.split('/').pop()}</div>
                      <div className="text-xs text-gray-400">{selectedFile.path}</div>
                    </div>
                  </div>
                  <button
                    onClick={closeFile}
                    className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Editor Toolbar */}
                <div className="bg-gray-750 px-4 py-2 border-b border-gray-700 flex items-center gap-2">
                  <button
                    onClick={saveFile}
                    disabled={saving || fileContent === originalContent}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={createBackup}
                    disabled={loading}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Backup
                  </button>
                  {fileContent !== originalContent && (
                    <span className="text-xs text-yellow-400 ml-2">● Unsaved changes</span>
                  )}
                </div>

                {/* Editor Content */}
                <div className="p-4">
                  <textarea
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    className="w-full h-[500px] bg-gray-900 text-white font-mono text-sm p-4 rounded border border-gray-700 focus:border-amber-500 focus:outline-none resize-none"
                    spellCheck={false}
                  />
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <File className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Select a file to view or edit</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VM Credentials Modal */}
      {showVMCredentials && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-md w-full border border-gray-700">
            <div className="px-6 py-4 border-b border-gray-700">
              <h3 className="text-lg font-bold text-white">VM SSH Credentials</h3>
              <p className="text-sm text-gray-400 mt-1">
                Enter credentials to access VM {location.id}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
                <input
                  type="text"
                  value={vmCredentials.username}
                  onChange={(e) => {
                    setVmCredentials({ ...vmCredentials, username: e.target.value });
                    setConnectionTestResult(null); // Reset test result on change
                  }}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-amber-500 focus:outline-none"
                  placeholder="root"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input
                  type="password"
                  value={vmCredentials.password}
                  onChange={(e) => {
                    setVmCredentials({ ...vmCredentials, password: e.target.value });
                    setConnectionTestResult(null); // Reset test result on change
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && vmCredentials.password) {
                      testVMConnection();
                    }
                  }}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-amber-500 focus:outline-none"
                  placeholder="Enter VM password"
                />
              </div>
              
              {/* Test Connection Button */}
              <button
                onClick={testVMConnection}
                disabled={!vmCredentials.password || testingConnection}
                className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors flex items-center justify-center gap-2"
              >
                {testingConnection ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Testing Connection...
                  </>
                ) : (
                  'Test Connection'
                )}
              </button>

              {/* Connection Status */}
              {connectionTestResult === 'success' && (
                <div className="p-3 bg-green-500/10 border border-green-500 rounded">
                  <p className="text-sm text-green-400 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    SSH connection successful! You can now connect.
                  </p>
                </div>
              )}
              
              {connectionTestResult === 'error' && (
                <div className="p-3 bg-red-500/10 border border-red-500 rounded">
                  <p className="text-sm text-red-400 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Connection failed. Please check your credentials.
                  </p>
                </div>
              )}
              
              <div className="text-xs text-gray-500">
                ⚠️ Credentials will be stored for this session only
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowVMCredentials(false);
                  setLocation({ type: 'host' });
                  setConnectionTestResult(null);
                  setVmCredentials({ username: 'root', password: '' });
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveVMCredentials}
                disabled={!vmCredentials.password || connectionTestResult !== 'success'}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </Layout>
  );
};

export default FileBrowser;
