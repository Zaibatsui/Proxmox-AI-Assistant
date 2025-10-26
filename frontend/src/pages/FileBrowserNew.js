import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import ConnectionManager from '../components/ConnectionManager';
import FilePane from '../components/FilePane';
import Terminal from '../components/Terminal';
import ContainerBrowser from '../components/ContainerBrowser';
import { ArrowRightLeft, X, Monitor, Terminal as TerminalIcon, Box } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useConnections } from '../contexts/ConnectionContext';

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
  const { currentConnection } = useConnections();
  const [leftConnection, setLeftConnection] = useState(null);
  const [rightConnection, setRightConnection] = useState(null);
  const [draggedFile, setDraggedFile] = useState(null);
  const [leftPaneExpanded, setLeftPaneExpanded] = useState(false);
  const [rightPaneExpanded, setRightPaneExpanded] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [rightPaneMode, setRightPaneMode] = useState('files'); // 'files' or 'terminal'
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [showContainerBrowser, setShowContainerBrowser] = useState(false);
  const [containerBrowserFor, setContainerBrowserFor] = useState(null); // 'left' or 'right'

  // Auto-set left pane when global connection changes
  useEffect(() => {
    if (currentConnection && !leftConnection) {
      setLeftConnection(currentConnection);
    }
  }, [currentConnection]);

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
      toast.success(`Left pane: ${connection.name}`);
    } else if (selectingForPane === 'right') {
      setRightConnection(connection);
      toast.success(`Right pane: ${connection.name}`);
    }
    // When selectingForPane is null (from Manage Connections button), just close the modal
    // The connection will be used when clicking on a profile from the modal
    if (selectingForPane) {
      setShowConnectionManager(false);
      setSelectingForPane(null);
    }
  };

  const handleSelectContainer = (containerConnection) => {
    if (containerBrowserFor === 'left') {
      setLeftConnection(containerConnection);
      setSelectedContainer(containerConnection.containerId);
      toast.success(`Left pane: ${containerConnection.name}`);
    } else if (containerBrowserFor === 'right') {
      setRightConnection(containerConnection);
      setSelectedContainer(containerConnection.containerId);
      toast.success(`Right pane: ${containerConnection.name}`);
    }
  };

  const handleTransferFile = async (file, sourcePath, fromPane) => {
    const targetConnection = fromPane === 'left' ? rightConnection : leftConnection;
    const sourceConnection = fromPane === 'left' ? leftConnection : rightConnection;
    
    if (!targetConnection) {
      toast.error(`Please select a connection for the ${fromPane === 'left' ? 'right' : 'left'} pane first`);
      return;
    }
    
    if (!sourceConnection) {
      toast.error('Source connection not available');
      return;
    }
    
    setTransferring(true);
    
    try {
      // Step 1: Download from source
      const filePath = sourcePath === '/' ? `/${file.name}` : `${sourcePath}/${file.name}`;
      
      toast.info(`Downloading ${file.name} from ${fromPane} pane...`);
      
      const downloadResponse = await axios.get(
        `${API}/api/connection-profiles/${sourceConnection.id}/files/download`,
        {
          params: { path: filePath },
          responseType: 'blob'
        }
      );
      
      // Step 2: Upload to target
      toast.info(`Uploading ${file.name} to ${fromPane === 'left' ? 'right' : 'left'} pane...`);
      
      const fileContent = await downloadResponse.data.arrayBuffer();
      
      // Safe base64 encoding for binary files
      const arrayBufferToBase64 = (buffer) => {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      };
      
      // Upload to target in chunks
      const chunkSize = 1024 * 1024; // 1MB chunks
      const totalChunks = Math.ceil(fileContent.byteLength / chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileContent.byteLength);
        const chunk = fileContent.slice(start, end);
        const chunkBase64 = arrayBufferToBase64(chunk);
        
        await axios.post(
          `${API}/api/connection-profiles/${targetConnection.id}/files/upload`,
          {
            path: sourcePath,
            chunk_data: chunkBase64,
            chunk_index: i,
            total_chunks: totalChunks,
            file_name: file.name
          }
        );
        
        // Show progress for multiple chunks
        if (totalChunks > 1) {
          toast.info(`Uploading chunk ${i + 1}/${totalChunks}...`, { id: 'upload-progress' });
        }
      }
      
      toast.success(`Successfully transferred ${file.name}`);
    } catch (error) {
      console.error('Transfer failed:', error);
      toast.error(error.response?.data?.detail || `Failed to transfer file: ${error.message}`);
    } finally {
      setTransferring(false);
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
                <div className="flex items-center gap-2">
                  {(leftConnection.type === 'vm' || leftConnection.type === 'lxc' || leftConnection.type === 'qemu') && (
                    <button
                      onClick={() => {
                        setContainerBrowserFor('left');
                        setShowContainerBrowser(true);
                      }}
                      className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      title="View Docker containers"
                    >
                      <Box className="w-3 h-3" />
                      Containers
                    </button>
                  )}
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
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-slate-500">Right Pane:</div>
              <div className="flex gap-1">
                <button
                  onClick={() => setRightPaneMode('files')}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    rightPaneMode === 'files'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-amber-400'
                  }`}
                  title="File Browser"
                >
                  <Monitor className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setRightPaneMode('terminal')}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    rightPaneMode === 'terminal'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-amber-400'
                  }`}
                  title="Terminal"
                >
                  <TerminalIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
            {rightPaneMode === 'files' ? (
              rightConnection ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-200">{rightConnection.name}</span>
                  <div className="flex items-center gap-2">
                    {(rightConnection.type === 'vm' || rightConnection.type === 'lxc' || rightConnection.type === 'qemu') && (
                      <button
                        onClick={() => {
                          setContainerBrowserFor('right');
                          setShowContainerBrowser(true);
                        }}
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        title="View Docker containers"
                      >
                        <Box className="w-3 h-3" />
                        Containers
                      </button>
                    )}
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
              )
            ) : (
              <div className="text-sm text-slate-200">
                {leftConnection ? `Terminal: ${leftConnection.name}` : 'No connection'}
              </div>
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
              // If right pane is expanded (meaning left is at 5%), restore to 50/50
              if (rightPaneExpanded) {
                setLeftPaneExpanded(false);
                setRightPaneExpanded(false);
              } else if (leftPaneExpanded) {
                // If left is expanded (95%), minimize it back to 50/50
                setLeftPaneExpanded(false);
              } else {
                // If both at 50%, expand left to 95%
                setLeftPaneExpanded(true);
                setRightPaneExpanded(false);
              }
            }}
            onTransferFile={(file, path) => handleTransferFile(file, path, 'left')}
            onShowContainers={() => {
              setContainerBrowserFor('left');
              setShowContainerBrowser(true);
            }}
            style={{
              width: leftPaneExpanded ? '95%' : (rightPaneExpanded ? '5%' : '50%'),
              transition: 'width 0.3s ease-in-out'
            }}
          />

          {rightPaneMode === 'files' ? (
            <FilePane
              paneId="right"
              connection={rightConnection}
              draggedFile={draggedFile}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              isExpanded={rightPaneExpanded}
              onToggleExpand={() => {
                // If left pane is expanded (meaning right is at 5%), restore to 50/50
                if (leftPaneExpanded) {
                  setLeftPaneExpanded(false);
                  setRightPaneExpanded(false);
                } else if (rightPaneExpanded) {
                  // If right is expanded (95%), minimize it back to 50/50
                  setRightPaneExpanded(false);
                } else {
                  // If both at 50%, expand right to 95%
                  setRightPaneExpanded(true);
                  setLeftPaneExpanded(false);
                }
              }}
              onTransferFile={(file, path) => handleTransferFile(file, path, 'right')}
              onShowContainers={() => {
                setContainerBrowserFor('right');
                setShowContainerBrowser(true);
              }}
              style={{
                width: rightPaneExpanded ? '95%' : (leftPaneExpanded ? '5%' : '50%'),
                transition: 'width 0.3s ease-in-out'
              }}
            />
          ) : (
            <div
              style={{
                width: rightPaneExpanded ? '95%' : (leftPaneExpanded ? '5%' : '50%'),
                transition: 'width 0.3s ease-in-out'
              }}
            >
              <Terminal
                connection={leftConnection}
                containerId={selectedContainer}
                isExpanded={!leftPaneExpanded}
                onRestore={() => {
                  setLeftPaneExpanded(false);
                  setRightPaneExpanded(false);
                }}
              />
            </div>
          )}
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

        {/* Container Browser Modal */}
        {showContainerBrowser && (
          <ContainerBrowser
            connection={containerBrowserFor === 'left' ? leftConnection : rightConnection}
            onSelectContainer={handleSelectContainer}
            onClose={() => {
              setShowContainerBrowser(false);
              setContainerBrowserFor(null);
            }}
          />
        )}
      </div>
    </Layout>
  );
}

export default FileBrowserNew;
