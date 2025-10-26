import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  ChevronRight, File, Folder, Save, X, Upload, FolderPlus, 
  Download, Edit2, Trash2, Copy, Loader2, RefreshCw, Maximize2, Minimize2, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

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

function FilePane({ 
  paneId, 
  connection, 
  onFileSelect,
  onRequestCopy,
  draggedFile,
  onDragStart,
  onDrop,
  isExpanded,
  onToggleExpand,
  style,
  onTransferFile  // New prop for transfer functionality
}) {
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingFile, setEditingFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Reset state when connection changes
    setFiles([]);
    setSelectedFile(null);
    setEditingFile(null);
    setFileContent('');
    setLoading(false);
    
    if (connection) {
      setCurrentPath(connection.base_path || '/');
      loadDirectory(connection.base_path || '/');
    }
  }, [connection?.id]); // Track by ID to ensure proper updates

  const loadDirectory = async (path) => {
    if (!connection) {
      setFiles([]);
      return;
    }
    
    setLoading(true);
    setFiles([]); // Clear old files immediately
    
    try {
      let response;
      
      // Check if this is a Proxmox location or a connection profile
      if (connection.source === 'proxmox' || connection.vmid) {
        // Use the generic files endpoint with location parameter
        response = await axios.post(
          `${API}/api/files/list`,
          { path },
          {
            params: {
              location_type: connection.type,
              location_id: connection.vmid || connection.id
            }
          }
        );
      } else {
        // Use the connection profile endpoint
        response = await axios.post(
          `${API}/api/connection-profiles/${connection.id}/files/list`,
          null,
          { params: { path } }
        );
      }
      
      setFiles(response.data.files || response.data || []);
      setCurrentPath(path);
    } catch (error) {
      console.error('Failed to load directory:', error);
      setFiles([]); // Ensure files are cleared on error
      toast.error(error.response?.data?.detail || 'Failed to load directory. Connection may be unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = async (file) => {
    if (file.type === 'directory') {
      const newPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
      loadDirectory(newPath);
    } else {
      setSelectedFile(file);
      await loadFileContent(file);
    }
  };

  const loadFileContent = async (file) => {
    const filePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
    
    try {
      let response;
      
      // Check if this is a Proxmox location or a connection profile
      if (connection.source === 'proxmox' || connection.vmid) {
        // Use the generic files endpoint with location parameter
        response = await axios.post(
          `${API}/api/files/read`,
          { path: filePath },
          {
            params: {
              location_type: connection.type,
              location_id: connection.vmid || connection.id
            }
          }
        );
      } else {
        // Use the connection profile endpoint
        response = await axios.post(
          `${API}/api/connection-profiles/${connection.id}/files/read`,
          null,
          { params: { path: filePath } }
        );
      }
      
      setFileContent(response.data.content || '');
    } catch (error) {
      console.error('Failed to load file:', error);
      toast.error('Failed to load file content');
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    
    const filePath = currentPath === '/' ? `/${editingFile.name}` : `${currentPath}/${editingFile.name}`;
    
    try {
      await axios.post(
        `${API}/api/connection-profiles/${connection.id}/files/write`,
        null,
        { params: { path: filePath, content: fileContent } }
      );
      
      toast.success('File saved successfully');
      setEditingFile(null);
      loadDirectory(currentPath);
    } catch (error) {
      console.error('Failed to save file:', error);
      toast.error(error.response?.data?.detail || 'Failed to save file');
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
    
    setUploadProgress({ current: 0, total: totalChunks, fileName: file.name });
    
    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        // Convert chunk to base64
        const reader = new FileReader();
        const chunkData = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target.result.split(',')[1]);
          reader.readAsDataURL(chunk);
        });
        
        await axios.post(
          `${API}/api/connection-profiles/${connection.id}/files/upload`,
          {
            path: uploadPath,
            chunk_data: chunkData,
            chunk_index: i,
            total_chunks: totalChunks,
            file_name: file.name
          }
        );
        
        setUploadProgress({ current: i + 1, total: totalChunks, fileName: file.name });
      }
      
      toast.success(`File "${file.name}" uploaded successfully`);
      setUploadProgress(null);
      loadDirectory(currentPath);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(error.response?.data?.detail || 'Upload failed');
      setUploadProgress(null);
    }
  };

  const handleDownload = async (file) => {
    const filePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
    
    try {
      window.open(
        `${API}/api/connection-profiles/${connection.id}/files/download?path=${encodeURIComponent(filePath)}`,
        '_blank'
      );
      toast.success('Download started');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Download failed');
    }
  };

  const handleDelete = async (file) => {
    if (!window.confirm(`Are you sure you want to delete "${file.name}"?`)) return;
    
    const filePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
    
    try {
      await axios.post(
        `${API}/api/connection-profiles/${connection.id}/files/delete`,
        null,
        { params: { path: filePath } }
      );
      
      toast.success('File deleted');
      loadDirectory(currentPath);
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error(error.response?.data?.detail || 'Delete failed');
    }
  };

  const handleCreateFolder = async () => {
    const folderName = prompt('Enter folder name:');
    if (!folderName) return;
    
    const folderPath = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`;
    
    try {
      await axios.post(
        `${API}/api/connection-profiles/${connection.id}/files/mkdir`,
        null,
        { params: { path: folderPath } }
      );
      
      toast.success('Folder created');
      loadDirectory(currentPath);
    } catch (error) {
      console.error('Create folder failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to create folder');
    }
  };

  const navigateUp = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = '/' + parts.join('/');
    loadDirectory(newPath || '/');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDropOnPane = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedFile && onDrop) {
      onDrop(draggedFile, connection, currentPath);
    }
  };

  if (!connection) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900/50 rounded-lg border border-slate-700">
        <div className="text-center text-slate-500">
          <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a connection to browse files</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col bg-slate-900/80 rounded-lg border border-slate-700 overflow-hidden"
      style={style}
      onDragOver={handleDragOver}
      onDrop={handleDropOnPane}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {style?.width !== '5%' && (
            <>
              <button
                onClick={navigateUp}
                disabled={currentPath === '/'}
                className="p-1.5 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                title="Up one level"
              >
                <ChevronRight className="w-4 h-4 text-slate-400 rotate-180" />
              </button>
              
              <div className="flex-1 px-2 py-1 bg-slate-800 rounded text-xs text-slate-300 truncate">
                {currentPath}
              </div>
              
              <button
                onClick={() => loadDirectory(currentPath)}
                disabled={loading}
                className="p-1.5 hover:bg-slate-700 rounded"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </>
          )}
          
          {style?.width === '5%' && (
            <div 
              className="flex-1 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-700/50 py-4 rounded transition-colors"
              onClick={onToggleExpand}
              title="Click to restore"
            >
              <span className="text-xs text-slate-400 font-medium writing-mode-vertical mb-2">
                {paneId === 'left' ? 'LEFT' : 'RIGHT'}
              </span>
              <Maximize2 className="w-4 h-4 text-slate-500" />
            </div>
          )}
          
          {style?.width !== '5%' && (
            <button
              onClick={onToggleExpand}
              className="p-1.5 hover:bg-slate-700 rounded"
              title={style?.width === '95%' ? "Restore" : "Maximize"}
            >
              {style?.width === '95%' ? (
                <Minimize2 className="w-4 h-4 text-amber-400" />
              ) : (
                <Maximize2 className="w-4 h-4 text-slate-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Only show content when this pane is not minimized (width > 5%) */}
      {style?.width !== '5%' && (
        <>
          {/* Action Bar */}
          <div className="flex items-center gap-1 p-2 border-b border-slate-700 bg-slate-800/30">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded flex items-center gap-1"
              title="Upload File"
            >
              <Upload className="w-3 h-3" />
              Upload
            </button>
            <button
              onClick={handleCreateFolder}
              className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded flex items-center gap-1"
              title="New Folder"
            >
              <FolderPlus className="w-3 h-3" />
              Folder
            </button>
          </div>

          {/* Upload Progress */}
          {uploadProgress && (
            <div className="p-2 bg-amber-500/10 border-b border-amber-500/30">
              <div className="text-xs text-amber-400 mb-1">
                Uploading {uploadProgress.fileName}: {uploadProgress.current}/{uploadProgress.total} chunks
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div 
                  className="bg-amber-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Empty directory
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {files.map((file, idx) => (
              <div
                key={idx}
                draggable
                onDragStart={() => onDragStart && onDragStart(file, connection, currentPath)}
                className={`flex items-center justify-between p-2 hover:bg-slate-800/50 cursor-pointer group ${
                  selectedFile?.name === file.name ? 'bg-slate-800/50' : ''
                }`}
                onClick={() => handleFileClick(file)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {file.type === 'directory' ? (
                    <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  ) : (
                    <File className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                  <span className="text-sm text-slate-300 truncate">{file.name}</span>
                </div>
                
                {file.type !== 'directory' && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onTransferFile) {
                          onTransferFile(file, currentPath);
                        }
                      }}
                      className="p-1 hover:bg-amber-700 rounded"
                      title={`Transfer to ${paneId === 'left' ? 'right' : 'left'} pane`}
                      disabled={!onTransferFile}
                    >
                      <ArrowRight className={`w-3 h-3 text-amber-400 ${paneId === 'right' ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFile(file);
                        setSelectedFile(file);
                        loadFileContent(file);
                      }}
                      className="p-1 hover:bg-slate-700 rounded"
                      title="Edit"
                    >
                      <Edit2 className="w-3 h-3 text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(file);
                      }}
                      className="p-1 hover:bg-slate-700 rounded"
                      title="Download"
                    >
                      <Download className="w-3 h-3 text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file);
                      }}
                      className="p-1 hover:bg-red-900/50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* File Editor Modal */}
      {editingFile && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 z-10">
          <div className="bg-slate-900 rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col border border-slate-700">
            <div className="flex items-center justify-between p-3 border-b border-slate-700">
              <h3 className="text-sm font-semibold text-slate-200">{editingFile.name}</h3>
              <button
                onClick={() => setEditingFile(null)}
                className="p-1 hover:bg-slate-800 rounded"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            
            <textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              className="flex-1 p-4 bg-slate-950 text-white font-mono text-xs border-0 focus:outline-none resize-none"
            />
            
            <div className="flex justify-end gap-2 p-3 border-t border-slate-700">
              <button
                onClick={() => setEditingFile(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFile}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

export default FilePane;
