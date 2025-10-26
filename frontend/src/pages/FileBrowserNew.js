import React, { useState } from 'react';
import Layout from '../components/Layout';
import ConnectionManager from '../components/ConnectionManager';
import FilePane from '../components/FilePane';
import { ArrowRightLeft, X } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

function FileBrowserNew({ onLogout }) {
  const [leftConnection, setLeftConnection] = useState(null);
  const [rightConnection, setRightConnection] = useState(null);
  const [draggedFile, setDraggedFile] = useState(null);
  const [leftPaneExpanded, setLeftPaneExpanded] = useState(false);
  const [rightPaneExpanded, setRightPaneExpanded] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const handleDragStart = (file, connection, currentPath) => {
    setDraggedFile({ file, connection, currentPath });
  };

  const handleDrop = async (draggedData, destConnection, destPath) => {
    if (!draggedData || !destConnection) return;
    
    const { file, connection: sourceConnection, currentPath: sourcePath } = draggedData;
    
    // Build full paths
    const sourceFilePath = sourcePath === '/' ? `/${file.name}` : `${sourcePath}/${file.name}`;
    const destFilePath = destPath === '/' ? `/${file.name}` : `${destPath}/${file.name}`;
    
    try {
      await axios.post(`${API}/files/copy`, {
        source_path: sourceFilePath,
        dest_path: destFilePath,
        source_location: {
          type: sourceConnection.connection_type,
          id: sourceConnection.id
        },
        dest_location: {
          type: destConnection.connection_type,
          id: destConnection.id
        }
      });
      
      toast.success(`Copied "${file.name}" successfully`);
      setDraggedFile(null);
    } catch (error) {
      console.error('Copy failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to copy file');
    }
  };

  const handleSwapConnections = () => {
    const temp = leftConnection;
    setLeftConnection(rightConnection);
    setRightConnection(temp);
  };

  const [showConnectionManager, setShowConnectionManager] = useState(false);
  const [selectingForPane, setSelectingForPane] = useState(null); // 'left' or 'right'

  const handleSelectConnection = (connection) => {
    if (selectingForPane === 'left') {
      setLeftConnection(connection);
    } else if (selectingForPane === 'right') {
      setRightConnection(connection);
    }
    // When selectingForPane is null (from Manage Connections button), just close the modal
    // The connection will be used when clicking on a profile from the modal
    if (selectingForPane) {
      setShowConnectionManager(false);
      setSelectingForPane(null);
    }
  };

  return (
    <Layout onLogout={onLogout} currentPage="files">
      <div className="h-[calc(100vh-6rem)] flex flex-col">
        {/* Header */}
        <div className="mb-3 flex-shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 mb-1">File Browser</h1>
            <p className="text-sm text-slate-400">Dual-pane file manager</p>
          </div>
          
          <button
            onClick={() => {
              setSelectingForPane(null);
              setShowConnectionManager(true);
            }}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm"
          >
            Manage Connections
          </button>
        </div>

        {/* Connection Selection Bar */}
        <div className="mb-3 flex gap-2 flex-shrink-0">
          <div className="flex-1 bg-slate-900/80 backdrop-blur-sm rounded-lg p-2 border border-slate-700">
            <div className="text-xs text-slate-500 mb-1">Left Pane:</div>
            {leftConnection ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-200">{leftConnection.name}</span>
                <button
                  onClick={() => {
                    setSelectingForPane('left');
                    setShowConnectionManager(true);
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300"
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setSelectingForPane('left');
                  setShowConnectionManager(true);
                }}
                className="text-sm text-slate-400 hover:text-amber-400"
              >
                Select Connection...
              </button>
            )}
          </div>

          <button
            onClick={handleSwapConnections}
            disabled={!leftConnection && !rightConnection}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed group"
            title="Swap connections"
          >
            <ArrowRightLeft className="w-5 h-5 text-slate-400 group-hover:text-amber-400 transition-colors" />
          </button>

          <div className="flex-1 bg-slate-900/80 backdrop-blur-sm rounded-lg p-2 border border-slate-700">
            <div className="text-xs text-slate-500 mb-1">Right Pane:</div>
            {rightConnection ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-200">{rightConnection.name}</span>
                <button
                  onClick={() => {
                    setSelectingForPane('right');
                    setShowConnectionManager(true);
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300"
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setSelectingForPane('right');
                  setShowConnectionManager(true);
                }}
                className="text-sm text-slate-400 hover:text-amber-400"
              >
                Select Connection...
              </button>
            )}
          </div>
        </div>

        {/* File Browser Panes */}
        <div className="flex-1 flex gap-3 overflow-hidden">
          <FilePane
            paneId="left"
            connection={leftConnection}
            draggedFile={draggedFile}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            isExpanded={leftPaneExpanded}
            onToggleExpand={() => {
              if (leftPaneExpanded) {
                setLeftPaneExpanded(false);
              } else {
                setLeftPaneExpanded(true);
                setRightPaneExpanded(false);
              }
            }}
            style={{
              width: leftPaneExpanded ? '95%' : (rightPaneExpanded ? '5%' : '50%'),
              transition: 'width 0.3s ease-in-out'
            }}
          />

          <FilePane
            paneId="right"
            connection={rightConnection}
            draggedFile={draggedFile}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            isExpanded={rightPaneExpanded}
            onToggleExpand={() => {
              if (rightPaneExpanded) {
                setRightPaneExpanded(false);
              } else {
                setRightPaneExpanded(true);
                setLeftPaneExpanded(false);
              }
            }}
            style={{
              width: rightPaneExpanded ? '95%' : (leftPaneExpanded ? '5%' : '50%'),
              transition: 'width 0.3s ease-in-out'
            }}
          />
        </div>

        {/* Connection Manager Modal */}
        {showConnectionManager && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-slate-700">
              <div className="p-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
                <h3 className="text-lg font-semibold text-slate-100">
                  {selectingForPane ? `Select Connection for ${selectingForPane === 'left' ? 'Left' : 'Right'} Pane` : 'Manage Connections'}
                </h3>
                <button
                  onClick={() => {
                    setShowConnectionManager(false);
                    setSelectingForPane(null);
                  }}
                  className="p-1 hover:bg-slate-800 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="p-4">
                <ConnectionManager
                  selectedConnection={selectingForPane === 'left' ? leftConnection : selectingForPane === 'right' ? rightConnection : null}
                  onSelectConnection={handleSelectConnection}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default FileBrowserNew;
