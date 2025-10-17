import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../App";
import Layout from "../components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Bot, User, Loader2 } from "lucide-react";
import { toast } from "sonner";

function AIAssistant({ onLogout }) {
  const [question, setQuestion] = useState("");
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/ai/history?limit=10`);
      setHistory(response.data);
    } catch (error) {
      // Ignore error
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
      
      // Add AI response
      setConversations(prev => [
        ...prev,
        {
          type: "ai",
          content: response.data.answer,
          commands: response.data.suggested_commands
        }
      ]);

      toast.success("AI response received");
      fetchHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to get AI response");
      setConversations(prev => prev.slice(0, -1)); // Remove user message on error
    } finally {
      setLoading(false);
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
                            <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                            {msg.commands && msg.commands.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-slate-700">
                                <p className="text-xs font-semibold mb-2 text-slate-400">Suggested Commands:</p>
                                <div className="space-y-1">
                                  {msg.commands.map((cmd, cidx) => (
                                    <code
                                      key={cidx}
                                      className="block text-xs bg-slate-950/50 p-2 rounded font-mono text-emerald-400"
                                    >
                                      {cmd}
                                    </code>
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
      </div>
    </Layout>
  );
}

export default AIAssistant;
