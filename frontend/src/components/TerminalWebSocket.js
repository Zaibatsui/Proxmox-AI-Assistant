import React, { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, X, AlertCircle, Send } from 'lucide-react';

const WS_URL = process.env.REACT_APP_BACKEND_URL?.replace('http', 'ws') || 'ws://localhost:8001';

function SimpleTerminal({ connection, containerId = null, isExpanded, onRestore }) {
  const outputRef = useRef(null);
  const wsRef = useRef(null);
  const [status, setStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState([]);
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    if (!connection) return;

    let mounted = true;
    let websocket = null;

    const connect = () => {
      setStatus('connecting');
      setOutput(prev => [...prev, { type: 'system', text: 'Connecting to terminal...' }]);

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
        setOutput(prev => [...prev, { type: 'success', text: 'Connected to terminal session' }]);
        websocket.send(JSON.stringify(connectionData));
      };

      websocket.onmessage = (event) => {
        if (!mounted) return;
        
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'output') {
            // Strip ANSI codes for simple display
            const cleanText = message.data.replace(/\x1b\[[0-9;]*m/g, '');
            setOutput(prev => [...prev, { type: 'output', text: cleanText }]);
          } else if (message.type === 'error') {
            setError(message.data);
            setStatus('error');
            setOutput(prev => [...prev, { type: 'error', text: message.data }]);
          }
        } catch (err) {
          console.error('Message parse error:', err);
        }
      };

      websocket.onerror = () => {
        if (!mounted) return;
        setStatus('error');
        setError('Connection error');
        setOutput(prev => [...prev, { type: 'error', text: 'Connection error' }]);
      };

      websocket.onclose = () => {
        if (!mounted) return;
        setStatus('disconnected');
        setOutput(prev => [...prev, { type: 'system', text: 'Connection closed' }]);
      };
    };

    connect();

    return () => {
      mounted = false;
      if (websocket) {
        try {
          websocket.close();
        } catch (e) {
          console.warn('WebSocket close error:', e);
        }
      }
    };
  }, [connection, containerId]);

  // Auto-scroll to bottom when new output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const sendCommand = () => {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Add to command history
    setCommandHistory(prev => [...prev, input]);
    setHistoryIndex(-1);

    // Send to backend
    wsRef.current.send(JSON.stringify({
      type: 'input',
      data: input + '\n'
    }));

    // Add to output display
    setOutput(prev => [...prev, { type: 'input', text: `$ ${input}` }]);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex]);
        }
      }
    }
  };

  const clearOutput = () => {
    setOutput([]);
    setError(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-t border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-slate-200">Simple Terminal</span>
          
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
        
        <div className="flex items-center gap-2">
          <button
            onClick={clearOutput}
            className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors text-slate-300"
          >
            Clear
          </button>
          {onRestore && (
            <button
              onClick={onRestore}
              className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2 flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      {/* Terminal output */}
      <div 
        ref={outputRef}
        className="flex-1 p-3 overflow-y-auto font-mono text-sm"
        style={{ minHeight: 0 }}
      >
        {output.length === 0 ? (
          <div className="text-slate-500 text-xs">
            Terminal output will appear here. Type commands below.
          </div>
        ) : (
          output.map((line, index) => (
            <div 
              key={index} 
              className={`whitespace-pre-wrap break-words mb-1 ${
                line.type === 'input' ? 'text-cyan-400' :
                line.type === 'error' ? 'text-red-400' :
                line.type === 'success' ? 'text-green-400' :
                line.type === 'system' ? 'text-yellow-400' :
                'text-slate-300'
              }`}
            >
              {line.text}
            </div>
          ))
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="text-cyan-400 font-mono text-sm">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type command and press Enter..."
            disabled={status !== 'connected'}
            className="flex-1 bg-slate-900 text-slate-200 text-sm font-mono px-2 py-1 rounded border border-slate-700 focus:border-cyan-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={sendCommand}
            disabled={!input.trim() || status !== 'connected'}
            className="p-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded transition-colors text-white"
            title="Send command (or press Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="px-3 py-1 text-xs text-slate-500 border-t border-slate-700">
          <span>↑↓ Navigate history • Enter to send • Connected to: {connection?.name || connection?.host || 'Unknown'}</span>
        </div>
      </div>
    </div>
  );
}

export default SimpleTerminal;
