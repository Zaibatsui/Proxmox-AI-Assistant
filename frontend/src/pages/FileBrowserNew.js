import React, { useState } from 'react';
import Layout from '../components/Layout';
import ConnectionManager from '../components/ConnectionManager';
import FilePane from '../components/FilePane';
import { ArrowRightLeft } from 'lucide-react';
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

  return (
    <Layout onLogout={onLogout} currentPage="files">
      <div className="h-[calc(100vh-6rem)] flex flex-col">
        {/* Header */}
        <div className="mb-4 flex-shrink-0">
          <h1 className="text-3xl font-bold text-slate-100 mb-1">File Browser</h1>
          <p className="text-sm text-slate-400">Dual-pane file manager with upload/download</p>
        </div>

        {/* Main Content */}
        <div className="flex-1 grid grid-cols-12 gap-4 overflow-hidden">
          {/* Left Sidebar - Connection Manager */}
          <div className="col-span-12 lg:col-span-2 overflow-y-auto">
            <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg p-3 border border-slate-700">
              <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase">Left Pane</h3>
              <ConnectionManager
                selectedConnection={leftConnection}
                onSelectConnection={setLeftConnection}
              />
            </div>
            
            <div className="mt-4 bg-slate-900/80 backdrop-blur-sm rounded-lg p-3 border border-slate-700">
              <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase">Right Pane</h3>
              <ConnectionManager
                selectedConnection={rightConnection}
                onSelectConnection={setRightConnection}
              />
            </div>
          </div>

          {/* File Browser Panes */}
          <div className="col-span-12 lg:col-span-10 flex gap-3 overflow-hidden">
            {/* Left Pane */}
            <FilePane
              paneId="left"
              connection={leftConnection}
              draggedFile={draggedFile}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
            />

            {/* Swap Button */}
            <div className="flex items-center">
              <button
                onClick={handleSwapConnections}
                disabled={!leftConnection && !rightConnection}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed group"
                title="Swap connections"
              >
                <ArrowRightLeft className="w-5 h-5 text-slate-400 group-hover:text-amber-400 transition-colors" />
              </button>
            </div>

            {/* Right Pane */}
            <FilePane
              paneId="right"
              connection={rightConnection}
              draggedFile={draggedFile}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-4 flex-shrink-0 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
          <p className="text-xs text-amber-400/80">
            <strong>💡 Tips:</strong> Drag files between panes to copy • Click folders to navigate • Use toolbar buttons for upload/download • Test your reverse proxy connections!
          </p>
        </div>
      </div>
    </Layout>
  );
}

export default FileBrowserNew;
