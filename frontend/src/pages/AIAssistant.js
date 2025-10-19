import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../App";
import Layout from "../components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Bot, User, Loader2, CheckCircle, ArrowRight, Server, HardDrive, Cpu } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function AIAssistant({ onLogout }) {
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [pendingFileEdit, setPendingFileEdit] = useState(null);
  const [editableContent, setEditableContent] = useState("");
  const [executing, setExecuting] = useState(false);
  
  // Location awareness
  const [currentLocation, setCurrentLocation] = useState({ type: 'host', label: 'Proxmox Host' });
  const [availableLocations, setAvailableLocations] = useState([]);

  useEffect(() => {
    fetchHistory();
    fetchLocations();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/ai/history?limit=10`);
      setHistory(response.data);
    } catch (error) {
      // Ignore error
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await axios.get(`${API}/vms`);
      setAvailableLocations(response.data);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;

    setLoading(true);
    const userQuestion = question;
    setQuestion("");

    // Add user message to conversations
    setConversations(prev => [...prev, { type: "user", content: userQuestion }]);

    try {
      const response = await axios.post(`${API}/ai/query`, { question: userQuestion });
      
      // Check for file edit proposal in the response
      let fileEditProposal = null;
      try {
        // Check if the answer contains file edit proposal markers
        if (response.data.answer.includes('"type": "file_edit_proposal"') || 
            response.data.answer.includes('propose_file_edit')) {
          // Try to extract the proposal from the tool response
          const proposalMatch = response.data.answer.match(/"type":\s*"file_edit_proposal"[^}]*}(?:[^}]*})*(?:[^}]*})*(?:[^}]*})*(?:[^}]*})*(?:[^}]*})*(?:[^}]*})*(?:[^}]*})*(?:[^}]*})*/);
          if (proposalMatch) {
            try {
              fileEditProposal = JSON.parse('{' + proposalMatch[0]);
            } catch (e) {
              // If parsing fails, look for individual fields
              const pathMatch = response.data.answer.match(/"path":\s*"([^"]*)"/);
              const contentMatch = response.data.answer.match(/"new_content":\s*"([^"]*)"/);
              const reasonMatch = response.data.answer.match(/"reason":\s*"([^"]*)"/);
              
              if (pathMatch && contentMatch && reasonMatch) {
                fileEditProposal = {
                  type: "file_edit_proposal",
                  path: pathMatch[1],
                  new_content: contentMatch[1].replace(/\\n/g, '\n'),
                  reason: reasonMatch[1],
                  requires_confirmation: true
                };
              }
            }
          }
        }
      } catch (e) {
        console.error("Error parsing file edit proposal:", e);
      }
      
      // Check if actions were created
      const hasActions = response.data.answer.includes("ACTIONS:");
      
      // Add AI response
      setConversations(prev => [
        ...prev,
        {
          type: "ai",
          content: response.data.answer,
          commands: response.data.suggested_commands,
          hasActions: hasActions,
          fileEditProposal: fileEditProposal
        }
      ]);

      if (fileEditProposal) {
        setPendingFileEdit(fileEditProposal);
        setEditableContent(fileEditProposal.new_content);
        toast.info("AI proposes a file edit. Review and confirm to execute.");
      } else if (hasActions) {
        toast.success("AI created actionable steps! Check the Actions page to execute them.", {
          duration: 5000
        });
      } else {
        toast.success("AI response received");
      }
      
      fetchHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to get AI response");
      setConversations(prev => prev.slice(0, -1)); // Remove user message on error
    } finally {
      setLoading(false);
    }
  };

  const executeFileEdit = async () => {
    if (!pendingFileEdit) return;
    
    setExecuting(true);
    try {
      await axios.post(`${API}/ai/execute-file-edit`, {
        path: pendingFileEdit.path,
        content: editableContent
      });
      
      toast.success(`File ${pendingFileEdit.path} updated successfully!`);
      setPendingFileEdit(null);
      setEditableContent("");
      
      // Add confirmation message to conversation
      setConversations(prev => [
        ...prev,
        {
          type: "system",
          content: `✅ File edit executed: ${pendingFileEdit.path}`
        }
      ]);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to execute file edit");
    } finally {
      setExecuting(false);
    }
  };

  const cancelFileEdit = () => {
    setPendingFileEdit(null);
    setEditableContent("");
    toast.info("File edit cancelled");
  };

  const loadHistoryItem = (item) => {
    setConversations([
      { type: "user", content: item.question },
      {
        type: "ai",
        content: item.answer,
        commands: item.suggested_commands
      }
    ]);
  };

  return (
    <Layout onLogout={onLogout} currentPage="assistant">
      <div className="h-[calc(100vh-8rem)] flex flex-col" data-testid="ai-assistant">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-slate-100 mb-2">AI Assistant</h1>
          <p className="text-slate-400">Ask questions about hardware passthrough, IOMMU, and driver configuration</p>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
          {/* Chat Area */}
          <div className="lg:col-span-3 flex flex-col min-h-0">
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm flex-1 flex flex-col min-h-0">
              <CardHeader className="border-b border-slate-800 flex-shrink-0">
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Conversation
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0 min-h-0">
                <ScrollArea className="flex-1 p-6">
                  {conversations.length === 0 ? (
                    <div className="text-center text-slate-500 py-12">
                      <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Ask me anything about Proxmox hardware management!</p>
                      <p className="text-sm mt-2">Examples:</p>
                      <ul className="text-sm mt-2 space-y-1">
                        <li>• How do I passthrough a GPU to a VM?</li>
                        <li>• What is IOMMU group isolation?</li>
                        <li>• How to bind a device to vfio-pci driver?</li>
                      </ul>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {conversations.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex gap-3 ${msg.type === "user" ? "justify-end" : "justify-start"}`}
                          data-testid={`message-${idx}`}
                        >
                          {msg.type === "ai" && (
                            <div className="p-2 bg-cyan-500/10 rounded-lg h-fit flex-shrink-0">
                              <Bot className="w-5 h-5 text-cyan-400" />
                            </div>
                          )}
                          <div
                            className={`max-w-[80%] rounded-lg p-4 ${
                              msg.type === "user"
                                ? "bg-cyan-600 text-white"
                                : "bg-slate-800 text-slate-200"
                            }`}
                          >
                            {msg.type === "user" ? (
                              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                            ) : (
                              <div className="prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    h1: ({node, ...props}) => <h1 className="text-xl font-bold text-cyan-400 mb-3 flex items-center gap-2" {...props}><Server className="w-5 h-5" />{props.children}</h1>,
                                    h2: ({node, ...props}) => <h2 className="text-lg font-bold text-cyan-400 mb-2 mt-4 flex items-center gap-2" {...props}><Cpu className="w-4 h-4" />{props.children}</h2>,
                                    h3: ({node, ...props}) => <h3 className="text-base font-semibold text-slate-100 mb-2 mt-3" {...props} />,
                                    ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 my-2 text-slate-300" {...props} />,
                                    ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1 my-2 text-slate-300" {...props} />,
                                    li: ({node, ...props}) => <li className="text-slate-300 leading-relaxed" {...props} />,
                                    p: ({node, ...props}) => <p className="text-slate-300 leading-relaxed mb-2" {...props} />,
                                    code: ({node, inline, ...props}) => 
                                      inline ? (
                                        <code className="bg-slate-900/70 text-cyan-400 px-2 py-0.5 rounded text-sm font-mono" {...props} />
                                      ) : (
                                        <code className="block bg-slate-900/70 text-emerald-400 p-3 rounded text-sm font-mono overflow-x-auto" {...props} />
                                      ),
                                    pre: ({node, ...props}) => <pre className="bg-slate-900/70 p-3 rounded my-2 overflow-x-auto" {...props} />,
                                    strong: ({node, ...props}) => <strong className="font-bold text-slate-100" {...props} />,
                                    em: ({node, ...props}) => <em className="italic text-cyan-300" {...props} />,
                                    a: ({node, ...props}) => <a className="text-cyan-400 hover:text-cyan-300 underline" {...props} />,
                                    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-cyan-500 pl-4 my-2 text-slate-400 italic" {...props} />,
                                    table: ({node, ...props}) => <table className="w-full border-collapse border border-slate-700 my-3" {...props} />,
                                    th: ({node, ...props}) => <th className="border border-slate-700 px-3 py-2 bg-slate-900 text-cyan-400 font-semibold text-left" {...props} />,
                                    td: ({node, ...props}) => <td className="border border-slate-700 px-3 py-2 text-slate-300" {...props} />,
                                  }}
                                >
                                  {msg.content}
                                </ReactMarkdown>
                              </div>
                            )}
                            {msg.hasActions && (
                              <div className="mt-3 pt-3 border-t border-slate-700">
                                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                                  <CheckCircle className="w-4 h-4" />
                                  <p className="text-sm font-semibold">Actions Created!</p>
                                </div>
                                <Button
                                  onClick={() => navigate("/actions")}
                                  size="sm"
                                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                                >
                                  View & Execute Actions <ArrowRight className="w-4 h-4 ml-1" />
                                </Button>
                              </div>
                            )}
                            {msg.commands && msg.commands.length > 0 && !msg.hasActions && (
                              <div className="mt-3 pt-3 border-t border-slate-700">
                                <p className="text-xs font-semibold mb-2 text-slate-400">Suggested Steps:</p>
                                <div className="space-y-1">
                                  {msg.commands.map((cmd, cidx) => (
                                    <div
                                      key={cidx}
                                      className="text-xs bg-slate-950/50 p-2 rounded text-slate-300"
                                    >
                                      • {cmd}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          {msg.type === "user" && (
                            <div className="p-2 bg-slate-700 rounded-lg h-fit flex-shrink-0">
                              <User className="w-5 h-5 text-slate-300" />
                            </div>
                          )}
                        </div>
                      ))}
                      {loading && (
                        <div className="flex gap-3 justify-start">
                          <div className="p-2 bg-cyan-500/10 rounded-lg h-fit">
                            <Bot className="w-5 h-5 text-cyan-400" />
                          </div>
                          <div className="bg-slate-800 text-slate-200 rounded-lg p-4">
                            <Loader2 className="w-5 h-5 animate-spin" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
                <div className="p-4 border-t border-slate-800 flex-shrink-0">
                  <div className="flex gap-2">
                    <Textarea
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAsk();
                        }
                      }}
                      placeholder="Ask a question... (Shift+Enter for new line)"
                      className="flex-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 resize-none"
                      rows={2}
                      disabled={loading}
                      data-testid="question-input"
                    />
                    <Button
                      onClick={handleAsk}
                      disabled={loading || !question.trim()}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white h-auto"
                      data-testid="send-button"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* History Sidebar */}
          <div className="lg:col-span-1">
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm h-full flex flex-col">
              <CardHeader className="border-b border-slate-800 flex-shrink-0">
                <CardTitle className="text-slate-100 text-sm">Recent History</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 min-h-0">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-2">
                    {history.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => loadHistoryItem(item)}
                        className="w-full text-left p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors group"
                        data-testid={`history-item-${idx}`}
                      >
                        <p className="text-sm text-slate-300 line-clamp-2 group-hover:text-cyan-400 transition-colors">
                          {item.question}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </p>
                      </button>
                    ))}
                    {history.length === 0 && (
                      <p className="text-sm text-slate-500 text-center py-4">No history yet</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* File Edit Confirmation Modal */}
        {pendingFileEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-700">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-700">
                <h3 className="text-lg font-bold text-white">Confirm File Edit</h3>
                <p className="text-sm text-slate-400 mt-1">{pendingFileEdit.path}</p>
                <div className="mt-2 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded">
                  <p className="text-sm text-cyan-300">
                    <strong>Reason:</strong> {pendingFileEdit.reason}
                  </p>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-auto p-6">
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-300">
                    Review and Edit Content:
                  </label>
                  <span className="text-xs text-slate-500">
                    {editableContent.length} characters
                  </span>
                </div>
                <textarea
                  value={editableContent}
                  onChange={(e) => setEditableContent(e.target.value)}
                  className="w-full h-96 bg-slate-900 text-white font-mono text-sm p-4 rounded border border-slate-700 focus:border-cyan-500 focus:outline-none resize-none"
                  spellCheck={false}
                />
                <p className="text-xs text-yellow-400 mt-2">
                  ⚠️ A backup will be created automatically before applying changes
                </p>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-end gap-3">
                <Button
                  onClick={cancelFileEdit}
                  variant="outline"
                  disabled={executing}
                  className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
                >
                  Cancel
                </Button>
                <Button
                  onClick={executeFileEdit}
                  disabled={executing}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  {executing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirm & Execute
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default AIAssistant;
