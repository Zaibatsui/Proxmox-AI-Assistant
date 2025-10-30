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
  const [connectionsStatus, setConnectionsStatus] = useState('loading'); // 'loading', 'success', 'failed', 'empty'
  const [connectionsCached, setConnectionsCached] = useState(false);
  const [connectionsLastUpdated, setConnectionsLastUpdated] = useState(null);

  // Load all available connections on mount (only if authenticated)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      loadAllConnections();
    } else {
      setLoading(false);
    }
  }, []);

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
            console.log('Using cached connections data (from ConnectionContext)');
            setProxmoxLocations(cachedData.locations || []);
            setConnectionProfiles(cachedData.profiles || []);
            
            // Set status
            if (cachedData.locations.length === 0 && cachedData.profiles.length === 0) {
              setConnectionsStatus('empty');
            } else {
              setConnectionsStatus('success');
            }
            setConnectionsCached(true);
            setConnectionsLastUpdated(new Date(parseInt(timestamp)));
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.log('Cache read failed, loading fresh data');
      }
    }
    
    // Load fresh data
    setLoading(true);
    setConnectionsCached(false);
    setConnectionsStatus('loading');
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token found, skipping connection load');
        setProxmoxLocations([]);
        setConnectionProfiles([]);
        setConnectionsStatus('empty');
        setLoading(false);
        return;
      }

      console.log('Loading fresh connections data...');

      // Load Proxmox locations
      const proxmoxResponse = await axios.get(`${API}/api/proxmox-locations`);
      const locations = proxmoxResponse.data.locations || [];
      setProxmoxLocations(locations);

      // Load connection profiles
      const profilesResponse = await axios.get(`${API}/api/connection-profiles`);
      const profiles = profilesResponse.data.profiles || [];
      setConnectionProfiles(profiles);
      
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
      
      setConnectionsLastUpdated(new Date());
      console.log(`Loaded ${locations.length} locations and ${profiles.length} profiles`);
    } catch (error) {
      console.error('Failed to load connections:', error);
      setConnectionsStatus('failed');
      // Set empty arrays on error
      setProxmoxLocations([]);
      setConnectionProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  // Get all connections (Proxmox + Profiles) as a unified list
  const getAllConnections = (onlyAvailable = false) => {
    const all = [];
    
    // Add Proxmox locations (with safety check)
    if (Array.isArray(proxmoxLocations)) {
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
    }

    // Add connection profiles (always available, with safety check)
    if (Array.isArray(connectionProfiles)) {
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
    }

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
    // Check if it's a Proxmox location (with safety check)
    if (Array.isArray(proxmoxLocations)) {
      const proxmoxLoc = proxmoxLocations.find(loc => loc.id === connectionId);
      if (proxmoxLoc) {
        return await quickConnectProxmox(connectionId);
      }
    }

    // Check if it's a connection profile (with safety check)
    if (Array.isArray(connectionProfiles)) {
      const profile = connectionProfiles.find(p => p.id === connectionId);
      if (profile) {
        return connectToProfile(profile);
      }
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
