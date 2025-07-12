import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Mic, Camera, Upload, Bot, User, Loader2 } from "lucide-react";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface WhatsAppChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WhatsAppChatModal({
  isOpen,
  onClose,
}: WhatsAppChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "assistant",
      content: "Hi! I'm your AI financial assistant. You can send me:\n\n• Text messages about expenses\n• Photos of receipts\n• Voice messages\n\nJust describe your transaction naturally, and I'll categorize it automatically!",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const analyzeTextMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest("POST", "/api/whatsapp/chat", {
        message: text,
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Remove loading message
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      
      if (data.transaction) {
        // Transaction was created successfully
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: "assistant",
          content: `✅ Transaction recorded!\n\n**Amount:** $${data.transaction.amount}\n**Category:** ${data.analysis.category}\n**Type:** ${data.analysis.type}\n**Description:** ${data.analysis.description}\n\nConfidence: ${Math.round(data.analysis.confidence * 100)}%`,
          timestamp: new Date(),
        }]);
        
        // Refresh transaction data
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
        
        toast({
          title: "Success",
          description: "Transaction created from chat",
        });
      } else if (data.analysis) {
        // Analysis completed but no transaction created
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: "assistant",
          content: `🤖 I analyzed your message:\n\n**Amount:** $${data.analysis.amount}\n**Category:** ${data.analysis.category}\n**Type:** ${data.analysis.type}\n**Description:** ${data.analysis.description}\n\nConfidence: ${Math.round(data.analysis.confidence * 100)}%\n\nNote: Category not found in your account. Please create the category first or use the manual form.`,
          timestamp: new Date(),
        }]);
      }
    },
    onError: (error) => {
      // Remove loading message
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 500);
        return;
      }
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: "assistant",
        content: "❌ Sorry, I couldn't process your message. Please try again or use the manual transaction form.",
        timestamp: new Date(),
      }]);
    },
  });

  const processReceiptMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("receipt", file);
      
      const response = await fetch("/api/transactions/ocr", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to process receipt");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Remove loading message
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      
      if (data.createdTransactions && data.createdTransactions.length > 0) {
        const transactionsList = data.createdTransactions.map((t: any) => 
          `• $${t.amount} - ${t.description}`
        ).join('\n');
        
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: "assistant",
          content: `📸 Receipt processed successfully!\n\n**Created ${data.createdTransactions.length} transactions:**\n\n${transactionsList}\n\nConfidence: ${Math.round(data.ocrResult.confidence * 100)}%`,
          timestamp: new Date(),
        }]);
        
        // Refresh transaction data
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
        
        toast({
          title: "Success",
          description: `Created ${data.createdTransactions.length} transactions from receipt`,
        });
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: "assistant",
          content: `📸 Receipt analyzed but no transactions were created.\n\nExtracted text: ${data.ocrResult.text.slice(0, 200)}${data.ocrResult.text.length > 200 ? '...' : ''}\n\nPlease check if the receipt is clear and contains transaction information.`,
          timestamp: new Date(),
        }]);
      }
    },
    onError: (error) => {
      // Remove loading message
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: "assistant",
        content: "❌ Failed to process receipt. Please make sure the image is clear and try again.",
        timestamp: new Date(),
      }]);
    },
  });

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: inputText,
      timestamp: new Date(),
    };

    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: "assistant",
      content: "Analyzing your transaction...",
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInputText("");

    // Analyze the message
    analyzeTextMutation.mutate(inputText);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const userMessage: Message = {
        id: Date.now().toString(),
        type: "user",
        content: `📷 Uploaded receipt: ${file.name}`,
        timestamp: new Date(),
      };

      const loadingMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: "Processing receipt with OCR...",
        timestamp: new Date(),
        isLoading: true,
      };

      setMessages(prev => [...prev, userMessage, loadingMessage]);
      processReceiptMutation.mutate(file);
    }
  };

  const handleVoiceRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      // Mock voice recording - in real implementation, you would use Web Speech API
      setTimeout(() => {
        setIsRecording(false);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: "assistant",
          content: "🎤 Voice recording feature is not implemented yet. Please use text input or receipt upload.",
          timestamp: new Date(),
        }]);
      }, 2000);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] h-[600px] flex flex-col p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-3">
            <div className="bg-green-500 p-2 rounded-full">
              <i className="fab fa-whatsapp text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span>Monly AI Assistant</span>
                <Badge variant="secondary" className="text-xs">AI</Badge>
              </div>
              <DialogDescription className="text-xs text-green-600 mt-1">
                Online • Smart financial assistant
              </DialogDescription>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-3 ${
                message.type === 'user' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-white shadow-sm border'
              }`}>
                <div className="flex items-start gap-2">
                  {message.type === 'assistant' && (
                    <Bot className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  )}
                  {message.type === 'user' && (
                    <User className="h-4 w-4 text-white mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className={`text-sm whitespace-pre-wrap ${
                      message.type === 'user' ? 'text-white' : 'text-gray-800'
                    }`}>
                      {message.content}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p className={`text-xs ${
                        message.type === 'user' ? 'text-green-100' : 'text-gray-500'
                      }`}>
                        {formatTimestamp(message.timestamp)}
                      </p>
                      {message.isLoading && (
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex items-center space-x-2">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1"
              disabled={analyzeTextMutation.isPending}
            />
            
            <Button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || analyzeTextMutation.isPending}
              className="bg-green-500 hover:bg-green-600 p-2"
            >
              {analyzeTextMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={handleVoiceRecording}
              disabled={isRecording}
              className="p-2"
            >
              {isRecording ? (
                <Loader2 className="h-4 w-4 animate-spin text-red-500" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="hidden"
              disabled={processReceiptMutation.isPending}
            />
            
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={processReceiptMutation.isPending}
              className="p-2"
            >
              {processReceiptMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <div className="flex items-center justify-center mt-2">
            <p className="text-xs text-gray-500">
              💡 Try: "I spent $25 on lunch" or upload a receipt photo
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
