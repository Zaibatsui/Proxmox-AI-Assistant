import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../App";
import Layout from "../components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  
  // Command and VM action proposals
  const [pendingCommand, setPendingCommand] = useState(null);
  const [pendingVMAction, setPendingVMAction] = useState(null);
  
  // Location awareness
  const [currentLocation, setCurrentLocation] = useState({ type: 'host', label: 'Proxmox Host' });
  const [availableLocations, setAvailableLocations] = useState([]);
  
  // VM Credentials management
  const [showVMCredentials, setShowVMCredentials] = useState(false);
  const [vmCredentials, setVmCredentials] = useState({ username: 'root', password: '' });
  const [sessionCredentials, setSessionCredentials] = useState({}); // Store VM credentials for session

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

    // Check if we need VM credentials
    if (currentLocation.type === 'vm' && !sessionCredentials[currentLocation.id]) {
      setShowVMCredentials(true);
      return;
    }

    setLoading(true);
    const userQuestion = question;
    setQuestion("");

    // Add location context to the question if not on host
    let contextualQuestion = userQuestion;
    const requestPayload = { question: contextualQuestion };
    
    if (currentLocation.type !== 'host') {
      const locationStr = currentLocation.type === 'lxc' 
        ? `lxc:${currentLocation.id}` 
        : `vm:${currentLocation.id}`;
      contextualQuestion = `[Working on ${currentLocation.label} (location: ${locationStr})] ${userQuestion}`;
      requestPayload.question = contextualQuestion;
      
      // Add SSH credentials for VMs
      if (currentLocation.type === 'vm' && sessionCredentials[currentLocation.id]) {
        requestPayload.ssh_username = sessionCredentials[currentLocation.id].username;
        requestPayload.ssh_password = sessionCredentials[currentLocation.id].password;
        requestPayload.vm_id = currentLocation.id;
      }
    }

    // Add user message to conversations
    setConversations(prev => [...prev, { type: "user", content: userQuestion }]);

    try {
      const response = await axios.post(`${API}/ai/query`, requestPayload);
      
      // Check for proposals in the response
      let fileEditProposal = null;
      let commandProposal = null;
      let vmActionProposal = null;
      
      try {
        const answer = response.data.answer;
        
        // Check for file edit proposal
        if (answer.includes('"type": "file_edit_proposal"')) {
          const match = answer.match(/"type":\s*"file_edit_proposal"[^}]*}(?:[^}]*})*/);
          if (match) {
            try {
              fileEditProposal = JSON.parse('{' + match[0]);
            } catch (e) {
              console.error("Error parsing file edit proposal:", e);
            }
          }
        }
        
        // Check for command execution proposal
        if (answer.includes('"type": "command_execution_proposal"')) {
          const match = answer.match(/"type":\s*"command_execution_proposal"[^}]*}(?:[^}]*})*/);
          if (match) {
            try {
              commandProposal = JSON.parse('{' + match[0]);
            } catch (e) {
              console.error("Error parsing command proposal:", e);
            }
          }
        }
        
        // Check for VM action proposal
        if (answer.includes('"type": "vm_action_proposal"')) {
          const match = answer.match(/"type":\s*"vm_action_proposal"[^}]*}(?:[^}]*})*/);
          if (match) {
            try {
              vmActionProposal = JSON.parse('{' + match[0]);
            } catch (e) {
              console.error("Error parsing VM action proposal:", e);
            }
          }
        }
      } catch (e) {
        console.error("Error parsing proposals:", e);
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
          fileEditProposal: fileEditProposal,
          commandProposal: commandProposal,
          vmActionProposal: vmActionProposal
        }
      ]);

      // Handle proposals
      if (fileEditProposal) {
        setPendingFileEdit(fileEditProposal);
        setEditableContent(fileEditProposal.new_content);
        toast.info("AI proposes a file edit. Review and confirm to execute.");
      } else if (commandProposal) {
        setPendingCommand(commandProposal);
        toast.info(`AI proposes a command execution (${commandProposal.risk_level} risk). Review and confirm.`);
      } else if (vmActionProposal) {
        setPendingVMAction(vmActionProposal);
        toast.info(`AI proposes VM action: ${vmActionProposal.action} (${vmActionProposal.risk_level} risk). Review and confirm.`);
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

  const executeCommand = async () => {
    if (!pendingCommand) return;

    setExecuting(true);
    try {
      await axios.post(`${API}/execute-command`, {
        command: pendingCommand.command,
        location: pendingCommand.location
      });
      toast.success(`Command executed successfully!`);
      setPendingCommand(null);
      setConversations(prev => [
        ...prev,
        {
          type: "system",
          content: `✅ Command executed: ${pendingCommand.command}`
        }
      ]);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to execute command");
    } finally {
      setExecuting(false);
    }
  };

  const cancelCommand = () => {
    setPendingCommand(null);
    toast.info("Command execution cancelled");
  };

  const executeVMAction = async () => {
    if (!pendingVMAction) return;

    setExecuting(true);
    try {
      await axios.post(`${API}/vm-action`, {
        action: pendingVMAction.action,
        vmid: pendingVMAction.vmid,
        vm_config: pendingVMAction.vm_config
      });
      toast.success(`VM action ${pendingVMAction.action} executed successfully!`);
      setPendingVMAction(null);
      setConversations(prev => [
        ...prev,
        {
          type: "system",
          content: `✅ VM Action executed: ${pendingVMAction.action} on VM ${pendingVMAction.vmid || 'new'}`
        }
      ]);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to execute VM action");
    } finally {
      setExecuting(false);
    }
  };

  const cancelVMAction = () => {
    setPendingVMAction(null);
    toast.info("VM action cancelled");
  };

  const saveVMCredentials = () => {
    if (!vmCredentials.password) {
      toast.error("Password is required");
      return;
    }
    setSessionCredentials({
      ...sessionCredentials,
      [currentLocation.id]: vmCredentials
    });
    setShowVMCredentials(false);
    toast.success("Credentials saved for this session");
    // After saving credentials, proceed with the question
    if (question.trim()) {
      handleAsk();
    }
  };

  const handleLocationChange = (loc) => {
    setCurrentLocation(loc);
    toast.info(`Switched to: ${loc.label}`);
    
    // Check if we need credentials for this VM
    if (loc.type === 'vm' && !sessionCredentials[loc.id]) {
      setShowVMCredentials(true);
    }
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
      <div className="h-[calc(100vh-6rem)] flex flex-col" data-testid="ai-assistant">
        <div className="mb-4 flex-shrink-0">
          <h1 className="text-3xl font-bold text-slate-100 mb-1">AI Assistant</h1>
          <p className="text-sm text-slate-400">Ask questions about hardware passthrough, IOMMU, and driver configuration</p>
        </div>

        {/* Location Selector */}
        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Server className="w-4 h-4" />
                Working on:
              </label>
              <select
                value={JSON.stringify(currentLocation)}
                onChange={(e) => {
                  const loc = JSON.parse(e.target.value);
                  handleLocationChange(loc);
                }}
                className="flex-1 px-3 py-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-cyan-500 focus:outline-none"
              >
                <option value={JSON.stringify({ type: 'host', label: 'Proxmox Host' })}>
                  Proxmox Host
                </option>
                <optgroup label="Containers">
                  {availableLocations.filter(l => l.type === 'lxc').map((loc) => (
                    <option 
                      key={loc.vmid} 
                      value={JSON.stringify({ type: 'lxc', id: loc.vmid, label: `Container ${loc.vmid} (${loc.name})` })}
                    >
                      Container: {loc.vmid} ({loc.name})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Virtual Machines">
                  {availableLocations.filter(l => l.type === 'qemu').map((loc) => (
                    <option 
                      key={loc.vmid} 
                      value={JSON.stringify({ type: 'vm', id: loc.vmid, label: `VM ${loc.vmid} (${loc.name})` })}
                    >
                      VM: {loc.vmid} ({loc.name})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              💡 AI will know you're working on {currentLocation.label} and use the correct location for file operations
            </p>
          </CardContent>
        </Card>

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

        {/* Command Execution Confirmation Modal */}
        {pendingCommand && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl border-slate-700 bg-slate-900 max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    pendingCommand.risk_level === 'critical' ? 'bg-red-500/20' :
                    pendingCommand.risk_level === 'high' ? 'bg-orange-500/20' :
                    pendingCommand.risk_level === 'medium' ? 'bg-yellow-500/20' : 'bg-green-500/20'
                  }`}>
                    <AlertCircle className={`w-6 h-6 ${
                      pendingCommand.risk_level === 'critical' ? 'text-red-400' :
                      pendingCommand.risk_level === 'high' ? 'text-orange-400' :
                      pendingCommand.risk_level === 'medium' ? 'text-yellow-400' : 'text-green-400'
                    }`} />
                  </div>
                  <div>
                    <CardTitle className="text-white">Command Execution Approval Required</CardTitle>
                    <Badge className={`mt-1 ${
                      pendingCommand.risk_level === 'critical' ? 'bg-red-500/20 text-red-400' :
                      pendingCommand.risk_level === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      pendingCommand.risk_level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
                    }`}>
                      {pendingCommand.risk_level.toUpperCase()} RISK
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Command Details */}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">Command:</h3>
                    <pre className="bg-slate-800 p-3 rounded text-cyan-400 text-sm overflow-x-auto">
                      {pendingCommand.command}
                    </pre>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-1">Location:</h3>
                    <p className="text-slate-400 text-sm">{pendingCommand.location || 'Proxmox Host'}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-1">Purpose:</h3>
                    <p className="text-slate-300 text-sm">{pendingCommand.purpose}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-1">Expected Outcome:</h3>
                    <p className="text-slate-300 text-sm">{pendingCommand.expected_outcome}</p>
                  </div>

                  {/* Risk Factors */}
                  {pendingCommand.risk_factors && pendingCommand.risk_factors.length > 0 && (
                    <div className={`p-3 rounded-lg ${
                      pendingCommand.risk_level === 'critical' ? 'bg-red-500/10 border border-red-500/30' :
                      pendingCommand.risk_level === 'high' ? 'bg-orange-500/10 border border-orange-500/30' :
                      pendingCommand.risk_level === 'medium' ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-green-500/10 border border-green-500/30'
                    }`}>
                      <h3 className="text-sm font-semibold text-slate-200 mb-2">⚠️ Risk Assessment:</h3>
                      <ul className="space-y-1">
                        {pendingCommand.risk_factors.map((factor, idx) => (
                          <li key={idx} className="text-sm text-slate-300">• {factor}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t border-slate-700">
                  <Button
                    onClick={cancelCommand}
                    variant="outline"
                    className="flex-1"
                    disabled={executing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={executeCommand}
                    disabled={executing}
                    className={`flex-1 text-white ${
                      pendingCommand.risk_level === 'critical' ? 'bg-red-600 hover:bg-red-700' :
                      pendingCommand.risk_level === 'high' ? 'bg-orange-600 hover:bg-orange-700' :
                      'bg-cyan-600 hover:bg-cyan-700'
                    }`}
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
              </CardContent>
            </Card>
          </div>
        )}

        {/* VM Action Confirmation Modal */}
        {pendingVMAction && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl border-slate-700 bg-slate-900">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    pendingVMAction.risk_level === 'critical' ? 'bg-red-500/20' :
                    pendingVMAction.risk_level === 'medium' ? 'bg-yellow-500/20' : 'bg-green-500/20'
                  }`}>
                    <Server className={`w-6 h-6 ${
                      pendingVMAction.risk_level === 'critical' ? 'text-red-400' :
                      pendingVMAction.risk_level === 'medium' ? 'text-yellow-400' : 'text-green-400'
                    }`} />
                  </div>
                  <div>
                    <CardTitle className="text-white">VM Action Approval Required</CardTitle>
                    <Badge className={`mt-1 ${
                      pendingVMAction.risk_level === 'critical' ? 'bg-red-500/20 text-red-400' :
                      pendingVMAction.risk_level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
                    }`}>
                      {pendingVMAction.risk_level.toUpperCase()} RISK
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-1">Action:</h3>
                    <p className="text-cyan-400 text-lg font-semibold">{pendingVMAction.action.toUpperCase()}</p>
                  </div>

                  {pendingVMAction.vmid && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-300 mb-1">Target VM/Container:</h3>
                      <p className="text-slate-300 text-sm">ID: {pendingVMAction.vmid}</p>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-1">Reason:</h3>
                    <p className="text-slate-300 text-sm">{pendingVMAction.reason}</p>
                  </div>

                  {pendingVMAction.vm_config && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-300 mb-2">Configuration:</h3>
                      <pre className="bg-slate-800 p-3 rounded text-sm text-slate-300 overflow-x-auto">
                        {JSON.stringify(pendingVMAction.vm_config, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Risk Factors */}
                  {pendingVMAction.risk_factors && pendingVMAction.risk_factors.length > 0 && (
                    <div className={`p-3 rounded-lg ${
                      pendingVMAction.risk_level === 'critical' ? 'bg-red-500/10 border border-red-500/30' :
                      pendingVMAction.risk_level === 'medium' ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-green-500/10 border border-green-500/30'
                    }`}>
                      <h3 className="text-sm font-semibold text-slate-200 mb-2">⚠️ Risk Assessment:</h3>
                      <ul className="space-y-1">
                        {pendingVMAction.risk_factors.map((factor, idx) => (
                          <li key={idx} className="text-sm text-slate-300">• {factor}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t border-slate-700">
                  <Button
                    onClick={cancelVMAction}
                    variant="outline"
                    className="flex-1"
                    disabled={executing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={executeVMAction}
                    disabled={executing}
                    className={`flex-1 text-white ${
                      pendingVMAction.risk_level === 'critical' ? 'bg-red-600 hover:bg-red-700' :
                      'bg-cyan-600 hover:bg-cyan-700'
                    }`}
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
              </CardContent>
            </Card>
          </div>
        )}

        {/* VM Credentials Modal */}
        {showVMCredentials && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md border-slate-700 bg-slate-900">
              <CardHeader>
                <CardTitle className="text-white">VM SSH Credentials Required</CardTitle>
                <p className="text-sm text-slate-400 mt-2">
                  Enter SSH credentials to access VM {currentLocation.id} ({currentLocation.label})
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="vm-username" className="text-slate-200">Username</Label>
                  <Input
                    id="vm-username"
                    value={vmCredentials.username}
                    onChange={(e) => setVmCredentials({ ...vmCredentials, username: e.target.value })}
                    placeholder="root"
                    className="mt-1 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="vm-password" className="text-slate-200">Password</Label>
                  <Input
                    id="vm-password"
                    type="password"
                    value={vmCredentials.password}
                    onChange={(e) => setVmCredentials({ ...vmCredentials, password: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && vmCredentials.password) {
                        saveVMCredentials();
                      }
                    }}
                    placeholder="Enter VM password"
                    className="mt-1 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={saveVMCredentials}
                    disabled={!vmCredentials.password}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    Save & Continue
                  </Button>
                  <Button
                    onClick={() => {
                      setShowVMCredentials(false);
                      setCurrentLocation({ type: 'host', label: 'Proxmox Host' });
                      toast.info("Switched back to Proxmox Host");
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
                
                <p className="text-xs text-slate-500 mt-4">
                  ⚠️ Credentials will be stored for this session only and are not saved permanently.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default AIAssistant;
