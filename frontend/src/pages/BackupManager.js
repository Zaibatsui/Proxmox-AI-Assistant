import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Archive, RotateCcw, Trash2, Eye, Search, Filter } from 'lucide-react';
import Layout from '../components/Layout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const BackupManager = ({ onLogout }) => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [previewContent, setPreviewContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  // Load all backups
  const loadBackups = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/backups`,
        getAuthHeaders()
      );
      setBackups(response.data.backups);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  // Preview backup content
  const previewBackup = async (backup) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/files/read`,
        { path: backup.backup_path },
        getAuthHeaders()
      );
      setPreviewContent(response.data.content);
      setSelectedBackup(backup);
      setShowPreview(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load backup content');
    } finally {
      setLoading(false);
    }
  };

  // Restore backup
  const restoreBackup = async (backupId) => {
    if (!window.confirm('Are you sure you want to restore this backup? The current file will be backed up first.')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/backups/restore`,
        { backup_id: backupId },
        getAuthHeaders()
      );
      setSuccess(`Backup restored successfully! ${response.data.file_path}`);
      setShowPreview(false);
      loadBackups();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to restore backup');
    } finally {
      setLoading(false);
    }
  };

  // Delete backup
  const deleteBackup = async (backupId) => {
    if (!window.confirm('Are you sure you want to delete this backup? This cannot be undone.')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await axios.delete(
        `${BACKEND_URL}/api/backups/${backupId}`,
        getAuthHeaders()
      );
      setSuccess('Backup deleted successfully!');
      setShowPreview(false);
      loadBackups();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete backup');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadBackups();
  }, []);

  // Filter backups
  const filteredBackups = backups.filter(backup =>
    backup.file_path.toLowerCase().includes(searchTerm.toLowerCase()) ||
    backup.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format file size
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format date
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  // Get change type badge color
  const getChangeTypeBadge = (type) => {
    const colors = {
      edit: 'bg-amber-500/20 text-amber-400',
      delete: 'bg-red-500/20 text-red-400',
      manual: 'bg-green-500/20 text-green-400',
      restore: 'bg-purple-500/20 text-purple-400'
    };
    return colors[type] || 'bg-gray-500/20 text-gray-400';
  };

  return (
    <Layout onLogout={onLogout} currentPage="backups">
      <div className="min-h-screen p-6 bg-gray-900">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Archive className="w-8 h-8 text-amber-400" />
              Backup Manager
          </h1>
          <p className="text-gray-400">View and restore file backups</p>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500 text-green-400 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        {/* Search and Filter */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search backups by file path or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <button
              onClick={loadBackups}
              disabled={loading}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white rounded transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Backups Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {loading && backups.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Loading backups...</div>
          ) : filteredBackups.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              {searchTerm ? 'No backups match your search' : 'No backups found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-750 border-b border-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">File</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Size</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">User</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredBackups.map((backup) => (
                    <tr key={backup.id} className="hover:bg-gray-750 transition-colors">
                      <td className="px-4 py-3 text-sm text-white">
                        <div className="font-medium">{backup.file_path.split('/').pop()}</div>
                        <div className="text-xs text-gray-500 truncate" style={{ maxWidth: '200px' }}>
                          {backup.file_path}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {backup.description}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getChangeTypeBadge(backup.change_type)}`}>
                          {backup.change_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {formatSize(backup.file_size)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {formatDate(backup.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {backup.username}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => previewBackup(backup)}
                            className="p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => restoreBackup(backup.id)}
                            className="p-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors"
                            title="Restore"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteBackup(backup.id)}
                            className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Total Count */}
        <div className="mt-4 text-sm text-gray-400 text-center">
          Showing {filteredBackups.length} of {backups.length} backups
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && selectedBackup && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Backup Preview</h3>
                <p className="text-sm text-gray-400">{selectedBackup.file_path}</p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-6">
              <pre className="bg-gray-900 text-gray-300 p-4 rounded font-mono text-sm overflow-auto">
                {previewContent}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => restoreBackup(selectedBackup.id)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Restore This Backup
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </Layout>
  );
};

export default BackupManager;
