import React from 'react';
import { Terminal as TerminalIcon, X, AlertCircle, Download } from 'lucide-react';

function TerminalWebSocket({ connection, containerId = null, isExpanded, onRestore }) {
  return (
    <div className="flex flex-col h-full bg-slate-900 border-t border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-slate-200">Terminal</span>
          
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Not Available</span>
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

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="mb-4">
            <TerminalIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          </div>
          
          <h3 className="text-lg font-medium text-slate-300 mb-2">
            Terminal Feature Requires xterm Package
          </h3>
          
          <p className="text-sm text-slate-400 mb-4">
            The terminal functionality requires the xterm package to be installed in your local environment.
          </p>
          
          <div className="bg-slate-800 rounded-lg p-4 mb-4">
            <p className="text-xs text-slate-500 mb-2">To enable terminal, run:</p>
            <code className="block bg-slate-950 text-green-400 p-3 rounded text-xs font-mono">
              yarn add xterm@5.3.0
            </code>
          </div>
          
          <div className="text-xs text-slate-500">
            <p className="mb-1">Connected to: {connection?.name || connection?.host || 'Unknown'}</p>
            {containerId && <p>Container ID: {containerId}</p>}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 bg-slate-800 border-t border-slate-700 text-xs text-slate-500 flex-shrink-0">
        <span>Terminal feature disabled - xterm package not found</span>
      </div>
    </div>
  );
}

export default TerminalWebSocket;
