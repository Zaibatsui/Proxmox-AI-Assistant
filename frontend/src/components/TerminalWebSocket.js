import React, { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, X, AlertCircle } from 'lucide-react';
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import './TerminalWebSocket.css';

const WS_URL = process.env.REACT_APP_BACKEND_URL?.replace('http', 'ws') || 'ws://localhost:8001';

function TerminalWebSocket({ connection, containerId = null, isExpanded, onRestore }) {
  const containerRef = useRef(null);
  const terminalRef = useRef(null);
  const wsRef = useRef(null);
  const [status, setStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!connection || !containerRef.current) return;

    let terminal = null;
    let mounted = true;
    let websocket = null;

    const initTerminal = () => {
      try {
        // Create terminal with explicit fixed size
        terminal = new Terminal({
          cols: 100,
          rows: 30,
          cursorBlink: true,
          fontSize: 13,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          theme: {
            background: '#0f172a',
            foreground: '#e2e8f0',
            cursor: '#38bdf8',
          },
          scrollback: 1000,
          convertEol: true,
        });

        // Open terminal in container
        terminal.open(containerRef.current);
        terminalRef.current = terminal;
        
        // Mark as ready after a short delay
        setTimeout(() => {
          if (mounted) {
            setIsReady(true);
            connectWebSocket(terminal);
          }
        }, 100);

      } catch (err) {
        console.error('Terminal init error:', err);
        setError('Failed to initialize terminal');
      }
    };

    const connectWebSocket = (term) => {
      if (!term || !mounted) return;

      setStatus('connecting');

      const token = localStorage.getItem('token');
      const connectionData = {
        token,
        type: connection.type || 'host',
        vmid: connection.vmid,
        container_id: containerId || connection.container_id,
        ssh_host: connection.ssh_host,
        ssh_port: connection.ssh_port || 22,
        ssh_username: connection.ssh_username || connection.username,
        ssh_password: connection.ssh_password || connection.password
      };

      websocket = new WebSocket(`${WS_URL}/api/terminal/ws`);
      wsRef.current = websocket;

      websocket.onopen = () => {
        if (!mounted) return;
        setStatus('connected');
        websocket.send(JSON.stringify(connectionData));
        
        setTimeout(() => {
          if (term && mounted) {
            try {
              term.write('\r\n\x1b[1;32mConnected to terminal session\x1b[0m\r\n');
            } catch (e) {
              console.warn('Write failed:', e);
            }
          }
        }, 100);
      };

      websocket.onmessage = (event) => {
        if (!mounted || !term) return;
        
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'output' && term) {
            setTimeout(() => {
              if (mounted && term) {
                try {
                  term.write(message.data);
                } catch (e) {
                  console.warn('Write failed:', e);
                }
              }
            }, 0);
          } else if (message.type === 'error') {
            setError(message.data);
            setStatus('error');
            setTimeout(() => {
              if (mounted && term) {
                try {
                  term.write(`\r\n\x1b[1;31mError: ${message.data}\x1b[0m\r\n`);
                } catch (e) {
                  console.warn('Write failed:', e);
                }
              }
            }, 0);
          }
        } catch (err) {
          console.error('Message parse error:', err);
        }
      };

      websocket.onerror = () => {
        if (!mounted) return;
        setStatus('error');
        setError('Connection error');
      };

      websocket.onclose = () => {
        if (!mounted) return;
        setStatus('disconnected');
      };

      // Handle terminal input
      if (term) {
        term.onData((data) => {
          if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
              type: 'input',
              data: data
            }));
          }
        });
      }
    };

    // Initialize after a small delay to ensure DOM is ready
    setTimeout(initTerminal, 50);

    // Cleanup
    return () => {
      mounted = false;
      
      if (websocket) {
        try {
          websocket.close();
        } catch (e) {
          console.warn('WebSocket close error:', e);
        }
      }
      
      if (terminal) {
        try {
          terminal.dispose();
        } catch (e) {
          console.warn('Terminal dispose error:', e);
        }
      }
    };
  }, [connection, containerId]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border-t border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-slate-200">Terminal</span>
          
          <div className="flex items-center gap-1.5">
            {status === 'connected' && (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-green-400">Connected</span>
              </>
            )}
            {status === 'connecting' && (
              <span className="text-xs text-yellow-400">Connecting...</span>
            )}
            {status === 'disconnected' && (
              <span className="text-xs text-slate-400">Disconnected</span>
            )}
            {status === 'error' && (
              <>
                <AlertCircle className="w-3 h-3 text-red-400" />
                <span className="text-xs text-red-400">Error</span>
              </>
            )}
          </div>
        </div>
        
        {onRestore && (
          <button
            onClick={onRestore}
            className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2 flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      {/* Terminal container with fixed dimensions */}
      <div 
        ref={containerRef}
        className="terminal-container flex-1 bg-slate-900"
      />

      {/* Footer */}
      <div className="px-3 py-1.5 bg-slate-800 border-t border-slate-700 flex items-center justify-between text-xs text-slate-500 flex-shrink-0">
        <span>
          {connection?.name || connection?.host || 'Unknown'}
        </span>
        <span className="text-slate-600">
          WebSocket Terminal
        </span>
      </div>
    </div>
  );
}

export default TerminalWebSocket;
