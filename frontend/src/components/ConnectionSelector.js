import React, { useState, useRef, useEffect } from 'react';
import { Server, HardDrive, Package, ChevronDown, Check, Wifi, WifiOff, Box } from 'lucide-react';
import { useConnections } from '../contexts/ConnectionContext';

function ConnectionSelector({ onConnectionChange, showInHeader = false }) {
  const { 
    getAllConnections, 
    currentConnection, 
    connect, 
    disconnect,
    loading 
  } = useConnections();
  
  const [showDropdown, setShowDropdown] = useState(false);
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
    const result = await connect(connection.id);
    if (result.success) {
      setShowDropdown(false);
      if (onConnectionChange) {
        onConnectionChange(result.connection);
      }
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'host': return Server;
      case 'vm': return HardDrive;
      case 'lxc': return Package;
      case 'docker': return Package;
      default: return Server;
    }
  };

  const connections = getAllConnections(true); // Only show available connections
  const Icon = currentConnection ? getIcon(currentConnection.type) : Wifi;

  if (showInHeader) {
    // Compact header version
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors text-sm"
        >
          {currentConnection ? (
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
          <div className="absolute top-full right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
            {/* Header */}
            <div className="p-3 border-b border-slate-700">
              <h4 className="text-sm font-semibold text-slate-200">Select Connection</h4>
              <p className="text-xs text-slate-500 mt-1">
                {connections.length} location{connections.length !== 1 ? 's' : ''} available
              </p>
            </div>

            {/* Connections List */}
            <div className="p-2">
              {loading ? (
                <div className="text-center py-4 text-slate-500 text-sm">Loading...</div>
              ) : connections.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">
                  No connections available
                </div>
              ) : (
                <>
                  {/* Group by source */}
                  <div className="mb-2">
                    <div className="text-xs font-medium text-slate-400 px-2 py-1">PROXMOX</div>
                    {connections.filter(c => c.source === 'proxmox').map((conn) => {
                      const ConnIcon = getIcon(conn.type);
                      const isSelected = currentConnection?.id === conn.id;
                      
                      return (
                        <button
                          key={conn.id}
                          onClick={() => handleSelect(conn)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                            isSelected
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <ConnIcon className={`w-4 h-4 flex-shrink-0 ${
                            isSelected ? 'text-amber-400' : 'text-cyan-400'
                          }`} />
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
                          {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                        </button>
                      );
                    })}
                  </div>

                  {connections.filter(c => c.source === 'profile').length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-slate-400 px-2 py-1">PROFILES</div>
                      {connections.filter(c => c.source === 'profile').map((conn) => {
                        const ConnIcon = Server;
                        const isSelected = currentConnection?.id === conn.id;
                        
                        return (
                          <button
                            key={conn.id}
                            onClick={() => handleSelect(conn)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                              isSelected
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            <ConnIcon className={`w-4 h-4 flex-shrink-0 ${
                              isSelected ? 'text-amber-400' : 'text-cyan-400'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{conn.name}</div>
                              <span className="text-xs text-slate-500">
                                {conn.type.toUpperCase()} • {conn.host}:{conn.port}
                              </span>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-amber-400" />}
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
            <h4 className="text-sm font-semibold text-slate-200">Select Connection</h4>
            <p className="text-xs text-slate-500 mt-1">
              {connections.length} location{connections.length !== 1 ? 's' : ''} available
            </p>
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
                <div className="mb-2">
                  <div className="text-xs font-medium text-slate-400 px-2 py-1">PROXMOX</div>
                  {connections.filter(c => c.source === 'proxmox').map((conn) => {
                    const ConnIcon = getIcon(conn.type);
                    const isSelected = currentConnection?.id === conn.id;
                    
                    return (
                      <button
                        key={conn.id}
                        onClick={() => handleSelect(conn)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                          isSelected
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <ConnIcon className={`w-4 h-4 flex-shrink-0 ${
                          isSelected ? 'text-amber-400' : 'text-cyan-400'
                        }`} />
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
                        {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                      </button>
                    );
                  })}
                </div>

                {connections.filter(c => c.source === 'profile').length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-400 px-2 py-1">PROFILES</div>
                    {connections.filter(c => c.source === 'profile').map((conn) => {
                      const ConnIcon = Server;
                      const isSelected = currentConnection?.id === conn.id;
                      
                      return (
                        <button
                          key={conn.id}
                          onClick={() => handleSelect(conn)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                            isSelected
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <ConnIcon className={`w-4 h-4 flex-shrink-0 ${
                            isSelected ? 'text-amber-400' : 'text-cyan-400'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{conn.name}</div>
                            <span className="text-xs text-slate-500">
                              {conn.type.toUpperCase()} • {conn.host}:{conn.port}
                            </span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-amber-400" />}
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
