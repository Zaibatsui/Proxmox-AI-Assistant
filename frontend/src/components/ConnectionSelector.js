import React, { useState, useRef, useEffect } from 'react';
import { Server, HardDrive, Package, ChevronDown, Check, Wifi, WifiOff, Box, Loader2, RefreshCw } from 'lucide-react';
import { useConnections } from '../contexts/ConnectionContext';
import { toast } from 'sonner';

function ConnectionSelector({ onConnectionChange, showInHeader = false }) {
  const { 
    getAllConnections, 
    currentConnection, 
    connect, 
    disconnect,
    loading,
    loadAllConnections: reloadConnections,
    connectionsStatus,
    connectionsCached,
    connectionsLastUpdated
  } = useConnections();
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedId, setSelectedId] = useState(null); // Track which item is being selected
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (connection) => {
    // Set selected ID immediately for visual feedback
    setSelectedId(connection.id);
    setSelecting(true);
    
    // Show toast notification
    toast.loading(`Connecting to ${connection.name}...`, { id: 'connection-toast' });
    
    // Add timeout protection (30 seconds)
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout (30s)')), 30000)
    );
    
    try {
      const result = await Promise.race([
        connect(connection.id),
        timeout
      ]);
      
      if (result.success) {
        toast.success(`Connected to ${connection.name}`, { id: 'connection-toast' });
        if (onConnectionChange) {
          onConnectionChange(result.connection);
        }
        // Close dropdown after successful connection
        setTimeout(() => setShowDropdown(false), 500);
      } else {
        // Show error with retry option if available
        const errorMsg = result.error || 'Connection failed';
        toast.error(
          result.canRetry 
            ? `${errorMsg} (Retried 2 times)` 
            : errorMsg,
          { id: 'connection-toast', duration: 5000 }
        );
      }
    } catch (error) {
      const isTimeout = error.message?.includes('timeout');
      toast.error(
        isTimeout 
          ? `Connection timeout - ${connection.name} didn't respond` 
          : `Connection error: ${error.message}`,
        { id: 'connection-toast', duration: 5000 }
      );
    } finally {
      setSelecting(false);
      setSelectedId(null);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'host': return Server;
      case 'vm': return HardDrive;
      case 'lxc': return Package;
      case 'docker': return Box;
      default: return Server;
    }
  };

  const connections = getAllConnections(true); // Only show available connections
  const Icon = currentConnection ? getIcon(currentConnection.type) : Wifi;
  
  // Filter connections based on search query
  const filteredConnections = searchQuery 
    ? connections.filter(conn => 
        conn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conn.type.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : connections;

  if (showInHeader) {
    // Compact header version
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={selecting}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors text-sm disabled:opacity-50"
        >
          {selecting ? (
            <>
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              <span className="text-slate-400">Connecting...</span>
            </>
          ) : currentConnection ? (
            <>
              <Icon className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-200 max-w-[150px] truncate">
                {currentConnection.name}
              </span>
              {currentConnection.status && (
                <span className={`w-2 h-2 rounded-full ${
                  currentConnection.status === 'running' || currentConnection.status === 'available'
                    ? 'bg-green-500'
                    : 'bg-slate-500'
                }`} />
              )}
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-slate-500" />
              <span className="text-slate-400">Select Location</span>
            </>
          )}
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>

        {showDropdown && (
          <div className="absolute top-full right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 max-h-96 flex flex-col">
            {/* Header */}
            <div className="p-3 border-b border-slate-700">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-slate-200">Select Connection</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {filteredConnections.length} location{filteredConnections.length !== 1 ? 's' : ''} 
                    {searchQuery && ` (filtered from ${connections.length})`}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    reloadConnections(true);
                  }}
                  disabled={loading}
                  className="p-1.5 hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
                  title="Refresh connections"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              {/* Search input */}
              <input
                type="text"
                placeholder="Search connections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              
              {connectionsCached && connectionsLastUpdated && (
                <div className="text-xs text-slate-500 mt-2">
                  Cached • {connectionsLastUpdated.toLocaleTimeString()}
                </div>
              )}
            </div>
            
            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1">

            {/* Connections List */}
            <div className="p-2">
              {loading ? (
                <div className="text-center py-4 text-slate-500 text-sm">Loading...</div>
              ) : filteredConnections.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">
                  {searchQuery ? `No connections matching "${searchQuery}"` : 'No connections available'}
                </div>
              ) : (
                <>
                  {/* Group by type: Host, VMs/LXCs, Docker */}
                  {filteredConnections.filter(c => c.source === 'proxmox' && c.type === 'host').length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs font-medium text-slate-400 px-2 py-1">PROXMOX HOST</div>
                      {filteredConnections.filter(c => c.source === 'proxmox' && c.type === 'host').map((conn) => {
                        const ConnIcon = getIcon(conn.type);
                        const isSelected = currentConnection?.id === conn.id;
                        const isSelecting = selectedId === conn.id;
                        
                        return (
                          <button
                            key={conn.id}
                            onClick={() => handleSelect(conn)}
                            disabled={selecting}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left disabled:opacity-50 ${
                              isSelecting
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : isSelected
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            {isSelecting ? (
                              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
                            ) : (
                              <ConnIcon className={`w-4 h-4 flex-shrink-0 ${
                                isSelected ? 'text-amber-400' : 'text-cyan-400'
                              }`} />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{conn.name}</div>
                              <span className="text-xs text-slate-500">{conn.type.toUpperCase()}</span>
                            </div>
                            {isSelecting && <span className="text-xs text-cyan-400">Connecting...</span>}
                            {isSelected && !isSelecting && <Check className="w-4 h-4 text-amber-400" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* VMs and LXCs */}
                  {filteredConnections.filter(c => c.source === 'proxmox' && (c.type === 'vm' || c.type === 'lxc')).length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs font-medium text-slate-400 px-2 py-1">VMs & CONTAINERS</div>
                      {filteredConnections.filter(c => c.source === 'proxmox' && (c.type === 'vm' || c.type === 'lxc')).map((conn) => {
                        const ConnIcon = getIcon(conn.type);
                        const isSelected = currentConnection?.id === conn.id;
                        const isSelecting = selectedId === conn.id;
                        
                        return (
                          <button
                            key={conn.id}
                            onClick={() => handleSelect(conn)}
                            disabled={selecting}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left disabled:opacity-50 ${
                              isSelecting
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : isSelected
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            {isSelecting ? (
                              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
                            ) : (
                              <ConnIcon className={`w-4 h-4 flex-shrink-0 ${
                                isSelected ? 'text-amber-400' : 'text-cyan-400'
                              }`} />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{conn.name}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-500">{conn.type.toUpperCase()}</span>
                                {conn.status && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    conn.status === 'running' || conn.status === 'available'
                                      ? 'bg-green-500/20 text-green-400'
                                      : 'bg-slate-600/20 text-slate-400'
                                  }`}>
                                    {conn.status}
                                  </span>
                                )}
                              </div>
                              {conn._original?.agent_warning && (
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="text-xs text-amber-400">⚠️ {conn._original.agent_warning}</span>
                                </div>
                              )}
                            </div>
                            {isSelecting && <span className="text-xs text-cyan-400">Connecting...</span>}
                            {isSelected && !isSelecting && <Check className="w-4 h-4 text-amber-400" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Docker Containers */}
                  {filteredConnections.filter(c => c.source === 'proxmox' && c.type === 'docker').length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs font-medium text-slate-400 px-2 py-1">DOCKER CONTAINERS</div>
                      {filteredConnections.filter(c => c.source === 'proxmox' && c.type === 'docker').map((conn) => {
                        const ConnIcon = getIcon(conn.type);
                        const isSelected = currentConnection?.id === conn.id;
                        const isSelecting = selectedId === conn.id;
                        
                        return (
                          <button
                            key={conn.id}
                            onClick={() => handleSelect(conn)}
                            disabled={selecting}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left disabled:opacity-50 ${
                              isSelecting
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : isSelected
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            {isSelecting ? (
                              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
                            ) : (
                              <ConnIcon className={`w-4 h-4 flex-shrink-0 ${
                                isSelected ? 'text-amber-400' : 'text-purple-400'
                              }`} />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{conn.name}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-500">DOCKER</span>
                                {conn.status && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    conn.status === 'running'
                                      ? 'bg-green-500/20 text-green-400'
                                      : conn.status === 'exited'
                                      ? 'bg-red-500/20 text-red-400'
                                      : 'bg-slate-600/20 text-slate-400'
                                  }`}>
                                    {conn.status}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isSelecting && <span className="text-xs text-cyan-400">Connecting...</span>}
                            {isSelected && !isSelecting && <Check className="w-4 h-4 text-amber-400" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {filteredConnections.filter(c => c.source === 'profile').length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-slate-400 px-2 py-1">PROFILES</div>
                      {filteredConnections.filter(c => c.source === 'profile').map((conn) => {
                        const ConnIcon = Server;
                        const isSelected = currentConnection?.id === conn.id;
                        const isSelecting = selectedId === conn.id;
                        
                        return (
                          <button
                            key={conn.id}
                            onClick={() => handleSelect(conn)}
                            disabled={selecting}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left disabled:opacity-50 ${
                              isSelecting
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : isSelected
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            {isSelecting ? (
                              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
                            ) : (
                              <ConnIcon className={`w-4 h-4 flex-shrink-0 ${
                                isSelected ? 'text-amber-400' : 'text-cyan-400'
                              }`} />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{conn.name}</div>
                              <span className="text-xs text-slate-500">
                                {conn.type.toUpperCase()} • {conn.host}:{conn.port}
                              </span>
                            </div>
                            {isSelecting && <span className="text-xs text-cyan-400">Connecting...</span>}
                            {isSelected && !isSelecting && <Check className="w-4 h-4 text-amber-400" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Disconnect Button */}
            {currentConnection && (
              <div className="p-2 border-t border-slate-700">
                <button
                  onClick={() => {
                    disconnect();
                    setShowDropdown(false);
                    if (onConnectionChange) onConnectionChange(null);
                  }}
                  className="w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full-width version for pages
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          {currentConnection ? (
            <>
              <Icon className="w-5 h-5 text-cyan-400" />
              <div className="text-left">
                <div className="text-sm font-medium text-slate-200">{currentConnection.name}</div>
                <div className="text-xs text-slate-500">
                  {currentConnection.type.toUpperCase()}
                  {currentConnection.host && ` • ${currentConnection.host}`}
                </div>
              </div>
            </>
          ) : (
            <>
              <WifiOff className="w-5 h-5 text-slate-500" />
              <span className="text-slate-400">No connection selected</span>
            </>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {/* Same dropdown content as header version */}
          <div className="p-3 border-b border-slate-700">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-slate-200">Select Connection</h4>
                <p className="text-xs text-slate-500 mt-1">
                  {connections.length} location{connections.length !== 1 ? 's' : ''} available
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  reloadConnections(true);
                }}
                disabled={loading}
                className="p-1.5 hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
                title="Refresh connections"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {connectionsCached && connectionsLastUpdated && (
              <div className="text-xs text-slate-500 mt-2">
                Cached • {connectionsLastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>

          <div className="p-2">
            {loading ? (
              <div className="text-center py-4 text-slate-500 text-sm">Loading...</div>
            ) : connections.length === 0 ? (
              <div className="text-center py-4 text-slate-500 text-sm">
                No connections available. Configure Proxmox in Settings.
              </div>
            ) : (
              <>
                {/* Group by type: Host, VMs/LXCs, Docker */}
                {connections.filter(c => c.source === 'proxmox' && c.type === 'host').length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-medium text-slate-400 px-2 py-1">PROXMOX HOST</div>
                    {connections.filter(c => c.source === 'proxmox' && c.type === 'host').map((conn) => {
                      const ConnIcon = getIcon(conn.type);
                      const isSelected = currentConnection?.id === conn.id;
                      const isSelecting = selectedId === conn.id;
                      
                      return (
                        <button
                          key={conn.id}
                          onClick={() => handleSelect(conn)}
                          disabled={selecting}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left disabled:opacity-50 ${
                            isSelecting
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : isSelected
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          {isSelecting ? (
                            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
                          ) : (
                            <ConnIcon className={`w-4 h-4 flex-shrink-0 ${
                              isSelected ? 'text-amber-400' : 'text-cyan-400'
                            }`} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{conn.name}</div>
                            <span className="text-xs text-slate-500">{conn.type.toUpperCase()}</span>
                          </div>
                          {isSelecting && <span className="text-xs text-cyan-400">Connecting...</span>}
                          {isSelected && !isSelecting && <Check className="w-4 h-4 text-amber-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                
                {/* VMs and LXCs */}
                {connections.filter(c => c.source === 'proxmox' && (c.type === 'vm' || c.type === 'lxc')).length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-medium text-slate-400 px-2 py-1">VMs & CONTAINERS</div>
                    {connections.filter(c => c.source === 'proxmox' && (c.type === 'vm' || c.type === 'lxc')).map((conn) => {
                      const ConnIcon = getIcon(conn.type);
                      const isSelected = currentConnection?.id === conn.id;
                      const isSelecting = selectedId === conn.id;
                      
                      return (
                        <button
                          key={conn.id}
                          onClick={() => handleSelect(conn)}
                          disabled={selecting}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left disabled:opacity-50 ${
                            isSelecting
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : isSelected
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          {isSelecting ? (
                            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
                          ) : (
                            <ConnIcon className={`w-4 h-4 flex-shrink-0 ${
                              isSelected ? 'text-amber-400' : 'text-cyan-400'
                            }`} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{conn.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-500">{conn.type.toUpperCase()}</span>
                              {conn.status && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  conn.status === 'running' || conn.status === 'available'
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-slate-600/20 text-slate-400'
                                }`}>
                                  {conn.status}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelecting && <span className="text-xs text-cyan-400">Connecting...</span>}
                          {isSelected && !isSelecting && <Check className="w-4 h-4 text-amber-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                
                {/* Docker Containers */}
                {connections.filter(c => c.source === 'proxmox' && c.type === 'docker').length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-medium text-slate-400 px-2 py-1">DOCKER CONTAINERS</div>
                    {connections.filter(c => c.source === 'proxmox' && c.type === 'docker').map((conn) => {
                      const ConnIcon = getIcon(conn.type);
                      const isSelected = currentConnection?.id === conn.id;
                      const isSelecting = selectedId === conn.id;
                      
                      return (
                        <button
                          key={conn.id}
                          onClick={() => handleSelect(conn)}
                          disabled={selecting}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left disabled:opacity-50 ${
                            isSelecting
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : isSelected
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          {isSelecting ? (
                            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
                          ) : (
                            <ConnIcon className={`w-4 h-4 flex-shrink-0 ${
                              isSelected ? 'text-amber-400' : 'text-purple-400'
                            }`} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{conn.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-500">DOCKER</span>
                              {conn.status && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  conn.status === 'running'
                                    ? 'bg-green-500/20 text-green-400'
                                    : conn.status === 'exited'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-slate-600/20 text-slate-400'
                                }`}>
                                  {conn.status}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelecting && <span className="text-xs text-cyan-400">Connecting...</span>}
                          {isSelected && !isSelecting && <Check className="w-4 h-4 text-amber-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {connections.filter(c => c.source === 'profile').length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-400 px-2 py-1">PROFILES</div>
                    {connections.filter(c => c.source === 'profile').map((conn) => {
                      const ConnIcon = Server;
                      const isSelected = currentConnection?.id === conn.id;
                      const isSelecting = selectedId === conn.id;
                      
                      return (
                        <button
                          key={conn.id}
                          onClick={() => handleSelect(conn)}
                          disabled={selecting}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left disabled:opacity-50 ${
                            isSelecting
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : isSelected
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          {isSelecting ? (
                            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
                          ) : (
                            <ConnIcon className={`w-4 h-4 flex-shrink-0 ${
                              isSelected ? 'text-amber-400' : 'text-cyan-400'
                            }`} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{conn.name}</div>
                            <span className="text-xs text-slate-500">
                              {conn.type.toUpperCase()} • {conn.host}:{conn.port}
                            </span>
                          </div>
                          {isSelecting && <span className="text-xs text-cyan-400">Connecting...</span>}
                          {isSelected && !isSelecting && <Check className="w-4 h-4 text-amber-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {currentConnection && (
            <div className="p-2 border-t border-slate-700">
              <button
                onClick={() => {
                  disconnect();
                  setShowDropdown(false);
                  if (onConnectionChange) onConnectionChange(null);
                }}
                className="w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ConnectionSelector;
