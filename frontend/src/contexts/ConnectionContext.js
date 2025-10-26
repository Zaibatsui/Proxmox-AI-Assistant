import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const ConnectionContext = createContext();

export const useConnections = () => {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnections must be used within ConnectionProvider');
  }
  return context;
};

export const ConnectionProvider = ({ children }) => {
  const [proxmoxLocations, setProxmoxLocations] = useState([]);
  const [connectionProfiles, setConnectionProfiles] = useState([]);
  const [currentConnection, setCurrentConnection] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load all available connections on mount
  useEffect(() => {
    loadAllConnections();
  }, []);

  const loadAllConnections = async () => {
    setLoading(true);
    try {
      // Load Proxmox locations
      const proxmoxResponse = await axios.get(`${API}/api/proxmox-locations`);
      setProxmoxLocations(proxmoxResponse.data.locations || []);

      // Load connection profiles
      const profilesResponse = await axios.get(`${API}/api/connection-profiles`);
      setConnectionProfiles(profilesResponse.data.profiles || []);
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get all connections (Proxmox + Profiles) as a unified list
  const getAllConnections = (onlyAvailable = false) => {
    const all = [];
    
    // Add Proxmox locations
    proxmoxLocations.forEach(loc => {
      // Filter by availability if requested
      if (onlyAvailable && loc.status !== 'running' && loc.status !== 'available') {
        return; // Skip non-running/unavailable locations
      }
      
      all.push({
        id: loc.id,
        name: loc.name,
        type: loc.type,
        source: 'proxmox',
        icon: loc.icon,
        status: loc.status,
        vmid: loc.vmid,
        node: loc.node,
        container_id: loc.container_id,
        _original: loc
      });
    });

    // Add connection profiles (always available)
    connectionProfiles.forEach(profile => {
      all.push({
        id: profile.id,
        name: profile.name,
        type: profile.connection_type,
        source: 'profile',
        icon: 'Server',
        host: profile.host,
        port: profile.port,
        _original: profile
      });
    });

    return all;
  };

  // Quick connect to a Proxmox location
  const quickConnectProxmox = async (locationId) => {
    try {
      const response = await axios.post(`${API}/api/proxmox-locations/${locationId}/quick-connect`);
      if (response.data.success) {
        const connection = response.data.profile;
        connection.source = 'proxmox';
        connection.isTemporary = true;
        setCurrentConnection(connection);
        return { success: true, connection };
      }
    } catch (error) {
      console.error('Quick connect failed:', error);
      return { success: false, error: error.response?.data?.detail || 'Connection failed' };
    }
  };

  // Connect to a saved profile
  const connectToProfile = (profile) => {
    const connection = {
      ...profile,
      source: 'profile',
      isTemporary: false
    };
    setCurrentConnection(connection);
    return { success: true, connection };
  };

  // Connect to any connection (auto-detect type)
  const connect = async (connectionId) => {
    // Check if it's a Proxmox location
    const proxmoxLoc = proxmoxLocations.find(loc => loc.id === connectionId);
    if (proxmoxLoc) {
      return await quickConnectProxmox(connectionId);
    }

    // Check if it's a connection profile
    const profile = connectionProfiles.find(p => p.id === connectionId);
    if (profile) {
      return connectToProfile(profile);
    }

    return { success: false, error: 'Connection not found' };
  };

  // Disconnect
  const disconnect = () => {
    setCurrentConnection(null);
  };

  // Get connection by ID
  const getConnectionById = (connectionId) => {
    return getAllConnections().find(c => c.id === connectionId);
  };

  // Get formatted location string for API calls (e.g., "host", "lxc:100", "qemu:200")
  const getLocationString = (connection) => {
    if (!connection) return 'host';
    
    if (connection.source === 'proxmox') {
      if (connection.id === 'proxmox_host') return 'host';
      if (connection.type === 'lxc') return `lxc:${connection.vmid}`;
      if (connection.type === 'vm' || connection.type === 'qemu') return `qemu:${connection.vmid}`;
    }
    
    return 'host';
  };

  const value = {
    // State
    proxmoxLocations,
    connectionProfiles,
    currentConnection,
    loading,
    
    // Actions
    loadAllConnections,
    getAllConnections,
    connect,
    quickConnectProxmox,
    connectToProfile,
    disconnect,
    setCurrentConnection,
    getConnectionById,
    getLocationString,
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
};

export default ConnectionContext;
