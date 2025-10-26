import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, X, Send, Trash2, Loader2 } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function Terminal({ connection, containerId = null, isExpanded, onRestore }) {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [workingDir, setWorkingDir] = useState('/');
  const terminalEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Auto-scroll to bottom when history changes
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  useEffect(() => {
    // Focus input when expanded
    if (isExpanded) {
      inputRef.current?.focus();
    }
  }, [isExpanded]);

  // Add welcome message when connection changes
  useEffect(() => {
    if (connection) {
      const welcomeMsg = containerId
        ? `Connected to container: ${containerId}`
        : `Connected to: ${connection.name || connection.host}`;
      
      setHistory([
        {
          type: 'system',
          content: welcomeMsg,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
      setWorkingDir('/');
    }
  }, [connection, containerId]);

  const executeCommand = async () => {
    if (!command.trim() || !connection) return;

    const timestamp = new Date().toLocaleTimeString();
    const currentCommand = command.trim();

    // Add command to history
    setHistory(prev => [...prev, {
      type: 'command',
      content: `$ ${currentCommand}`,
      timestamp
    }]);

    setCommand('');
    setLoading(true);

    try {
      // Handle special commands
      if (currentCommand.startsWith('cd ')) {
        const newDir = currentCommand.substring(3).trim();
        // Simple directory change logic
        let targetDir = newDir;
        if (!targetDir.startsWith('/')) {
          targetDir = workingDir === '/' ? `/${targetDir}` : `${workingDir}/${targetDir}`;
        }
        setWorkingDir(targetDir);
        setHistory(prev => [...prev, {
          type: 'output',
          content: `Changed directory to: ${targetDir}`,
          timestamp: new Date().toLocaleTimeString()
        }]);
        setLoading(false);
        return;
      }

      if (currentCommand === 'clear') {
        setHistory([]);
        setLoading(false);
        return;
      }

      // Execute command via API
      // Determine proper location type
      let locationType = connection.type || 'host';
      let locationId = connection.vmid || connection.id;
      
      // Map connection profile types to location types
      if (connection.source === 'profile') {
        // Connection profiles (SSH, SFTP, etc.) should use 'host' type
        locationType = 'host';
        locationId = null; // Host doesn't need an ID
      }
      
      const response = await axios.post(
        `${API}/api/execute-command`,
        {
          command: currentCommand,
          working_directory: workingDir,
          location: containerId 
            ? {
                type: 'container',
                container_id: containerId,
                host: connection.host
              }
            : {
                type: locationType,
                id: locationId,
                ssh_username: connection.ssh_username || connection.username,
                ssh_password: connection.ssh_password || connection.password
              }
        }
      );

      const output = response.data.output || response.data.stdout || '';
      const error = response.data.error || response.data.stderr || '';
      const exitCode = response.data.exit_code ?? 0;

      if (output || error) {
        setHistory(prev => [...prev, {
          type: exitCode === 0 ? 'output' : 'error',
          content: output || error,
          timestamp: new Date().toLocaleTimeString()
        }]);
      } else {
        setHistory(prev => [...prev, {
          type: 'output',
          content: '(command executed successfully, no output)',
          timestamp: new Date().toLocaleTimeString()
        }]);
      }

    } catch (error) {
      console.error('Command execution error:', error);
      setHistory(prev => [...prev, {
        type: 'error',
        content: error.response?.data?.detail || error.message || 'Command execution failed',
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeCommand();
    }
  };

  const clearHistory = () => {
    setHistory([]);
  };

  if (!isExpanded) {
    // Minimized view - vertical text
    return (
      <div
        onClick={onRestore}
        className="h-full bg-slate-900/50 border border-slate-700 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-800/50 transition-colors group"
      >
        <div className="vertical-text text-slate-400 group-hover:text-amber-400 font-medium flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 rotate-90" />
          <span>TERMINAL</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      {/* Terminal Header */}
      <div className="flex items-center justify-between p-3 bg-slate-800/50 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-5 h-5 text-amber-400" />
          <span className="text-sm font-semibold text-slate-200">Terminal</span>
          {containerId && (
            <span className="text-xs text-slate-500">
              (Container: {containerId.substring(0, 12)})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearHistory}
            className="p-1.5 hover:bg-slate-700 rounded transition-colors"
            title="Clear terminal"
          >
            <Trash2 className="w-4 h-4 text-slate-400 hover:text-amber-400" />
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-slate-950">
        {history.map((entry, index) => (
          <div key={index} className="mb-2">
            {entry.type === 'system' && (
              <div className="text-slate-500 italic">
                {entry.content}
              </div>
            )}
            {entry.type === 'command' && (
              <div className="text-amber-400 font-semibold">
                {entry.content}
              </div>
            )}
            {entry.type === 'output' && (
              <div className="text-slate-300 whitespace-pre-wrap">
                {entry.content}
              </div>
            )}
            {entry.type === 'error' && (
              <div className="text-red-400 whitespace-pre-wrap">
                {entry.content}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Executing...</span>
          </div>
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Command Input */}
      <div className="p-3 bg-slate-800/50 border-t border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-mono text-sm">$</span>
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Enter command... (working dir: ${workingDir})`}
            disabled={loading || !connection}
            className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono disabled:opacity-50"
          />
          <button
            onClick={executeCommand}
            disabled={!command.trim() || loading || !connection}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded transition-colors flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Run
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          <span>Tips: Use 'cd' to change directory, 'clear' to clear terminal, 'ls', 'pwd', etc.</span>
        </div>
      </div>
    </div>
  );
}

export default Terminal;
