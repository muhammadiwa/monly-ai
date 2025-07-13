import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Send, 
  Mic, 
  MicOff, 
  Image as ImageIcon, 
  Bot, 
  User, 
  Loader2,
  Upload,
  CheckCircle,
  AlertCircle,
  Camera
} from "lucide-react";

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  messageType: 'text' | 'voice' | 'image';
  transactionCreated?: boolean;
  imageUrl?: string;
}

interface TransactionResult {
  success: boolean;
  transaction?: any;
  message: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'ai',
      content: 'Hi! I\'m your AI assistant. You can tell me about your expenses like "I spent $20 on lunch" or send me receipts, and I\'ll automatically create transactions for you! 🤖💰',
      timestamp: new Date(),
      messageType: 'text'
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Chat AI mutation for text messages
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/chat/process", {
        message,
        type: 'text'
      });
      return response.json();
    },
    onSuccess: (data: TransactionResult) => {
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: data.message,
        timestamp: new Date(),
        messageType: 'text',
        transactionCreated: data.success
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      if (data.success && data.transaction) {
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
        
        toast({
          title: "💰 Transaction Created!",
          description: `Added ${data.transaction.type}: ${data.transaction.description} (${data.transaction.amount})`,
          className: "bg-green-50 border-green-200",
        });
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "🔐 Session Expired",
          description: "Please login again to continue",
          variant: "destructive",
        });
        return;
      }
      
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: "Sorry, I couldn't process that message. Could you try rephrasing it?",
        timestamp: new Date(),
        messageType: 'text'
      };
      
      setMessages(prev => [...prev, aiMessage]);
    },
  });

  // Voice processing mutation
  const voiceMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.wav");
      
      const response = await fetch("/api/chat/voice", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to process voice message");
      }
      
      return response.json();
    },
    onSuccess: (data: TransactionResult & { transcription?: string }) => {
      // Add transcription as user message if available
      if (data.transcription) {
        const userMessage: ChatMessage = {
          id: (Date.now() - 1).toString(),
          type: 'user',
          content: `🎤 "${data.transcription}"`,
          timestamp: new Date(),
          messageType: 'voice'
        };
        setMessages(prev => [...prev, userMessage]);
      }
      
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: data.message,
        timestamp: new Date(),
        messageType: 'text',
        transactionCreated: data.success
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      if (data.success && data.transaction) {
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
        
        toast({
          title: "🎤 Voice Transaction Created!",
          description: `Added from voice: ${data.transaction.description}`,
          className: "bg-green-50 border-green-200",
        });
      }
    },
    onError: () => {
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: "Sorry, I couldn't process that voice message. Please try again.",
        timestamp: new Date(),
        messageType: 'text'
      };
      
      setMessages(prev => [...prev, aiMessage]);
    },
  });

  // Image processing mutation
  const imageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      
      const response = await fetch("/api/chat/image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to process image");
      }
      
      return response.json();
    },
    onSuccess: (data: TransactionResult & { imageUrl?: string }) => {
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: data.message,
        timestamp: new Date(),
        messageType: 'text',
        transactionCreated: data.success
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
        
        toast({
          title: "📷 Image Transaction Created!",
          description: "Transaction extracted from image successfully",
          className: "bg-green-50 border-green-200",
        });
      }
    },
    onError: () => {
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: "Sorry, I couldn't process that image. Please make sure it's a clear receipt or transaction record.",
        timestamp: new Date(),
        messageType: 'text'
      };
      
      setMessages(prev => [...prev, aiMessage]);
    },
  });

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
      messageType: 'text'
    };
    
    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(inputMessage);
    setInputMessage("");
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (event) => {
        setAudioChunks(prev => [...prev, event.data]);
      };
      
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        voiceMutation.mutate(audioBlob);
        setAudioChunks([]);
      };
      
      setMediaRecorder(recorder);
      setIsRecording(true);
      recorder.start();
      
      toast({
        title: "🎤 Recording Started",
        description: "Speak your transaction details...",
        className: "bg-blue-50 border-blue-200",
      });
    } catch (error) {
      toast({
        title: "🚫 Recording Failed",
        description: "Could not access microphone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setMediaRecorder(null);
      
      toast({
        title: "⏹️ Recording Stopped",
        description: "Processing your voice message...",
        className: "bg-yellow-50 border-yellow-200",
      });
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Add user message showing the image
      const imageUrl = URL.createObjectURL(file);
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: "📷 Uploaded receipt/transaction image",
        timestamp: new Date(),
        messageType: 'image',
        imageUrl
      };
      
      setMessages(prev => [...prev, userMessage]);
      imageMutation.mutate(file);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-lg">
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-full">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">AI Transaction Assistant</h1>
          <p className="text-sm text-gray-600">Smart expense tracking through conversation</p>
        </div>
        <div className="ml-auto">
          <Badge variant="outline" className="bg-white/50">
            🤖 AI Powered
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 bg-gray-50/30">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.type === 'ai' && (
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-full h-fit">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}
              
              <div
                className={`max-w-[70%] ${
                  message.type === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border shadow-sm'
                } rounded-2xl p-3`}
              >
                {message.imageUrl && (
                  <img
                    src={message.imageUrl}
                    alt="Uploaded receipt"
                    className="max-w-full h-auto rounded-lg mb-2"
                  />
                )}
                
                <p className="text-sm leading-relaxed">{message.content}</p>
                
                <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                  <span>{formatTime(message.timestamp)}</span>
                  
                  {message.transactionCreated && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      <span>Transaction created</span>
                    </div>
                  )}
                  
                  {message.messageType === 'voice' && (
                    <div className="flex items-center gap-1">
                      <Mic className="h-3 w-3" />
                      <span>Voice</span>
                    </div>
                  )}
                  
                  {message.messageType === 'image' && (
                    <div className="flex items-center gap-1">
                      <Camera className="h-3 w-3" />
                      <span>Image</span>
                    </div>
                  )}
                </div>
              </div>
              
              {message.type === 'user' && (
                <div className="bg-blue-500 p-2 rounded-full h-fit">
                  <User className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          ))}
          
          {(chatMutation.isPending || voiceMutation.isPending || imageMutation.isPending) && (
            <div className="flex gap-3 justify-start">
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-full h-fit">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-white border shadow-sm rounded-2xl p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-gray-600">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t bg-white">
        <div className="flex gap-2 mb-3">
          {/* Voice Recording Button */}
          <Button
            type="button"
            variant={isRecording ? "destructive" : "outline"}
            size="sm"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={voiceMutation.isPending}
            className="px-3"
          >
            {isRecording ? (
              <>
                <MicOff className="h-4 w-4" />
                <span className="ml-1 text-xs">Stop</span>
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                <span className="ml-1 text-xs">Voice</span>
              </>
            )}
          </Button>

          {/* Image Upload Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={imageMutation.isPending}
            className="px-3"
          >
            <ImageIcon className="h-4 w-4" />
            <span className="ml-1 text-xs">Image</span>
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your expense... (e.g., 'I spent $20 on lunch at McDonald's')"
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={chatMutation.isPending}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || chatMutation.isPending}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            {chatMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        <div className="mt-2 text-xs text-gray-500 text-center">
          💡 Try: "I bought coffee for $5", "Spent 50k on groceries", or upload a receipt photo
        </div>
      </div>
    </div>
  );
}
