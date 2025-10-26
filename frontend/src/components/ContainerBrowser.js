import React, { useState, useEffect } from 'react';
import { Box, Server, X, RefreshCw, Loader2, Circle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function ContainerBrowser({ connection, onSelectContainer, onClose }) {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (connection) {
      fetchContainers();
    }
  }, [connection]);

  const fetchContainers = async () => {
    if (!connection) return;

    setLoading(true);
    try {
      // Determine location_type from connection
      // For Proxmox locations, default to 'lxc' if type is undefined
      let locationType = connection.type || 'lxc';
      
      // If connection has specific indicators, use those
      if (connection.name && connection.name.toLowerCase().includes('vm')) {
        locationType = 'vm';
      } else if (connection.name && connection.name.toLowerCase().includes('ct')) {
        locationType = 'lxc';
      }

      console.log('Fetching containers with:', {
        location_type: locationType,
        location_id: String(connection.vmid || connection.id),
        connection: connection
      });

      const response = await axios.post(
        `${API}/api/containers/list`,
        {
          location_type: locationType,
          location_id: String(connection.vmid || connection.id),
          all_containers: true
        }
      );

      setContainers(response.data.containers || []);
    } catch (error) {
      console.error('Failed to fetch containers:', error);
      
      // Handle Pydantic validation errors properly
      let errorMessage = 'Failed to load containers. Ensure Docker is running and Portainer Agent is installed on port 9001.';
      if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          // Pydantic validation errors
          errorMessage = error.response.data.detail.map(err => `${err.loc?.join('.')}: ${err.msg}`).join(', ');
        }
      }
      
      toast.error(errorMessage);
      setContainers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleContainerClick = (container) => {
    onSelectContainer({
      ...connection,
      containerId: container.id,
      containerName: container.name,
      name: `${connection.name} → ${container.name}`,
      type: 'container'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Box className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-slate-100">
              Docker Containers on {connection?.name}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchContainers}
              disabled={loading}
              className="p-2 hover:bg-slate-800 rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Container List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading containers...
            </div>
          ) : containers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center">
              <Box className="w-12 h-12 mb-4 opacity-50" />
              <p className="font-medium">No containers found</p>
              <p className="text-sm mt-2">
                Make sure Docker is running and Portainer Agent is installed on port 9001
              </p>
              <button
                onClick={fetchContainers}
                className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {containers.map((container) => (
                <button
                  key={container.id}
                  onClick={() => handleContainerClick(container)}
                  className="w-full p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Circle
                        className={`w-3 h-3 flex-shrink-0 ${
                          container.state === 'running'
                            ? 'text-emerald-400 fill-emerald-400'
                            : 'text-slate-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-200 truncate">
                          {container.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-1">
                          {container.image}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          container.state === 'running'
                            ? 'bg-emerald-600/20 text-emerald-400'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {container.state}
                      </span>
                      <span className="text-xs text-slate-500">ID: {container.id}</span>
                    </div>
                  </div>
                  {container.status && (
                    <div className="text-xs text-slate-500 mt-2 truncate">
                      {container.status}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/30">
          <div className="text-xs text-slate-500">
            <p>💡 Click a container to browse its filesystem and execute commands</p>
            <p className="mt-1">Requires Portainer Agent running on port 9001</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContainerBrowser;
