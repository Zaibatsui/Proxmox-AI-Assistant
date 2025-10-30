import React, { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, X, AlertCircle, Loader2 } from 'lucide-react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

const WS_URL = process.env.REACT_APP_BACKEND_URL?.replace('http', 'ws') || 'ws://localhost:8001';

function TerminalWebSocket({ connection, containerId = null, isExpanded, onRestore }) {
  const terminalRef = useRef(null);
  const terminalInstance = useRef(null);
  const fitAddon = useRef(null);
  const ws = useRef(null);
  const isMounted = useRef(true);
  const isTerminalReady = useRef(false);
  const isFitting = useRef(false);
  const resizeTimeout = useRef(null);
  const [status, setStatus] = useState('disconnected'); // disconnected, connecting, connected, error
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!connection || !terminalRef.current) return;

    isMounted.current = true;
    isTerminalReady.current = false;

    // Initialize xterm.js with fixed dimensions
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cols: 80,  // Fixed columns
      rows: 24,  // Fixed rows
      theme: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
        black: '#1e293b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f1f5f9',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#f8fafc'
      },
      scrollback: 1000,
      allowProposedApi: true
    });

    // Add addons - skip FitAddon for now
    // const fit = new FitAddon();
    // term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());

    // Open terminal
    term.open(terminalRef.current);
    
    terminalInstance.current = term;
    // fitAddon.current = fit;
    
    // Use requestAnimationFrame for better timing with browser rendering
    requestAnimationFrame(() => {
      if (!isMounted.current) return;
      
      requestAnimationFrame(() => {
        if (!isMounted.current) return;
        
        // Check if terminal is ready
        if (term && term.element && term.buffer && term.buffer.active) {
          isTerminalReady.current = true;
          console.log('Terminal ready without FitAddon');
          
          // Connect WebSocket immediately - no need to wait for fit
          setTimeout(() => {
            if (isMounted.current && isTerminalReady.current) {
              connectWebSocket(term);
            }
          }, 100);
        } else {
          console.warn('Terminal not ready after RAF, proceeding anyway');
          isTerminalReady.current = true;
          setTimeout(() => {
            if (isMounted.current) {
              connectWebSocket(term);
            }
          }, 100);
        }
      });
    });

    // Handle window resize - disabled for now without FitAddon
    const handleResize = () => {
      // TODO: Re-enable when FitAddon is stable
      console.log('Resize event - FitAddon disabled');
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      isMounted.current = false;
      isTerminalReady.current = false;
      isFitting.current = false;
      window.removeEventListener('resize', handleResize);
      
      if (resizeTimeout.current) {
        clearTimeout(resizeTimeout.current);
      }
      
      if (ws.current) {
        ws.current.close();
      }
      
      if (terminalInstance.current) {
        try {
          terminalInstance.current.dispose();
        } catch (err) {
          console.warn('Terminal dispose error:', err);
        }
        terminalInstance.current = null;
      }
      
      fitAddon.current = null;
    };
  }, [connection, containerId]);

  const connectWebSocket = (term) => {
    if (!term || !isMounted.current || !isTerminalReady.current) return;
    
    setStatus('connecting');
    setError(null);

    // Helper to safely write to terminal
    const safeWrite = (data) => {
      if (term && term.element && term.buffer && isMounted.current && isTerminalReady.current) {
        try {
          term.write(data);
        } catch (err) {
          console.warn('Terminal write failed:', err);
        }
      }
    };

    // Build connection data
    const connectionData = {
      token: localStorage.getItem('token'), // Add JWT token for authentication
      type: connection.type || 'host',
      vmid: connection.vmid,
      container_id: containerId || connection.container_id,
      ssh_host: connection.ssh_host,
      ssh_port: connection.ssh_port || 22,
      ssh_username: connection.ssh_username || connection.username,
      ssh_password: connection.ssh_password || connection.password
    };

    // Create WebSocket connection
    const websocket = new WebSocket(`${WS_URL}/api/terminal/ws`);
    ws.current = websocket;

    websocket.onopen = () => {
      console.log('Terminal WebSocket connected');
      setStatus('connected');
      // Send connection info
      websocket.send(JSON.stringify(connectionData));
      safeWrite('\r\n\x1b[1;32mConnected to terminal session\x1b[0m\r\n');
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'output') {
          safeWrite(message.data);
        } else if (message.type === 'error') {
          safeWrite(`\r\n\x1b[1;31mError: ${message.data}\x1b[0m\r\n`);
          setError(message.data);
          setStatus('error');
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    websocket.onerror = (err) => {
      console.error('WebSocket error:', err);
      setStatus('error');
      setError('WebSocket connection error');
      safeWrite('\r\n\x1b[1;31mConnection error\x1b[0m\r\n');
    };

    websocket.onclose = () => {
      console.log('Terminal WebSocket disconnected');
      setStatus('disconnected');
      safeWrite('\r\n\x1b[1;33mConnection closed\x1b[0m\r\n');
    };

    // Handle terminal input
    term.onData((data) => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
          type: 'input',
          data: data
        }));
      }
    });
  };

  const reconnect = () => {
    if (terminalInstance.current && isMounted.current && isTerminalReady.current) {
      try {
        terminalInstance.current.clear();
        connectWebSocket(terminalInstance.current);
      } catch (err) {
        console.error('Reconnect failed:', err);
        setError('Failed to reconnect');
      }
    }
  };

  return (
    <div className={`flex flex-col bg-slate-900 border-t border-slate-700 overflow-hidden ${
      isExpanded ? 'h-full' : 'h-64'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-slate-200">
            Terminal {containerId && `(${containerId.substring(0, 12)})`}
          </span>
          
          {/* Status indicator */}
          <div className="flex items-center gap-1.5">
            {status === 'connecting' && (
              <>
                <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
                <span className="text-xs text-yellow-400">Connecting...</span>
              </>
            )}
            {status === 'connected' && (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-green-400">Connected</span>
              </>
            )}
            {status === 'disconnected' && (
              <>
                <div className="w-2 h-2 rounded-full bg-slate-500" />
                <span className="text-xs text-slate-400">Disconnected</span>
              </>
            )}
            {status === 'error' && (
              <>
                <AlertCircle className="w-3 h-3 text-red-400" />
                <span className="text-xs text-red-400">Error</span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {status === 'error' && (
            <button
              onClick={reconnect}
              className="px-2 py-1 text-xs bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors"
            >
              Reconnect
            </button>
          )}
          {onRestore && (
            <button
              onClick={onRestore}
              className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400"
              title="Minimize terminal"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      {/* Terminal container */}
      <div 
        ref={terminalRef} 
        className="flex-1 overflow-auto"
        style={{ 
          minHeight: '200px',
          maxHeight: '100%',
          width: '100%'
        }}
      />

      {/* Connection info footer */}
      <div className="px-3 py-1.5 bg-slate-800 border-t border-slate-700 flex items-center justify-between text-xs text-slate-500">
        <span>
          {connection?.name || connection?.host || 'Unknown'} 
          {connection?.vmid && ` (${connection.type?.toUpperCase()} ${connection.vmid})`}
        </span>
        <span className="text-slate-600">
          WebSocket Terminal • Press Ctrl+C to interrupt
        </span>
      </div>
    </div>
  );
}

export default TerminalWebSocket;
