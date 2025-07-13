import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { isUnauthorizedError } from '@/lib/authUtils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Loader2, Send, Bot, X, Minimize2, Maximize2, Mic, MicOff, Camera } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  type: 'user' | 'ai';
  timestamp: Date;
  isError?: boolean;
  transaction?: any;
}

interface ChatWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function ChatWidget({ isOpen, onToggle }: ChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hi! 👋 I\'m Monly AI, your smart financial assistant. Tell me about your expenses and I\'ll automatically track them for you!\n\nTry saying: "I spent $25 on lunch at McDonald\'s"',
      type: 'ai',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/chat/process', {
        message,
        type: 'text'
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        const aiMessage: Message = {
          id: Date.now().toString(),
          text: data.message,
          type: 'ai',
          timestamp: new Date(),
          transaction: data.transaction
        };
        setMessages(prev => [...prev, aiMessage]);
        
        queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
        queryClient.invalidateQueries({ queryKey: ['/api/analytics/dashboard'] });
        
        toast({
          title: '✨ Transaction Created!',
          description: 'Your expense has been tracked successfully',
          className: 'bg-green-50 border-green-200',
        });
      } else {
        const aiMessage: Message = {
          id: Date.now().toString(),
          text: data.message,
          type: 'ai',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: '🔐 Session Expired',
          description: 'Please login again to continue',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/auth';
        }, 2000);
        return;
      }
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: '❌ Sorry, I couldn\'t process your message. Please try again or check your internet connection.',
        type: 'ai',
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    },
  });

  const sendVoiceMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      // Get auth token for manual fetch with FormData
      const token = localStorage.getItem('auth-token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch('/api/chat/voice', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        const aiMessage: Message = {
          id: Date.now().toString(),
          text: data.message,
          type: 'ai',
          timestamp: new Date(),
          transaction: data.transaction
        };
        setMessages(prev => [...prev, aiMessage]);
        
        queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
        queryClient.invalidateQueries({ queryKey: ['/api/analytics/dashboard'] });
        
        toast({
          title: '🎤 Voice Processed!',
          description: 'Your voice message was processed successfully',
          className: 'bg-green-50 border-green-200',
        });
      } else {
        const aiMessage: Message = {
          id: Date.now().toString(),
          text: data.message || 'Sorry, I couldn\'t understand that audio.',
          type: 'ai',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
      }
    },
    onError: (error) => {
      console.error('Voice mutation error:', error);
      
      // Check for authentication errors
      if (error.message.includes('401:') || error.message.includes('403:') || 
          error.message.includes('Access token required') || 
          error.message.includes('Invalid or expired token')) {
        toast({
          title: '🔐 Session Expired',
          description: 'Please login again to continue',
          variant: 'destructive',
        });
        setTimeout(() => {
          localStorage.removeItem('auth-token');
          localStorage.removeItem('auth-user');
          window.location.href = '/auth';
        }, 2000);
        return;
      }
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: '❌ Sorry, I couldn\'t process your voice message. Please try again or check your microphone.',
        type: 'ai',
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: '🎤 Voice Error',
        description: 'Unable to process voice message',
        variant: 'destructive',
      });
    },
  });

  const sendImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      
      // Get auth token for manual fetch with FormData
      const token = localStorage.getItem('auth-token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch('/api/chat/image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        const aiMessage: Message = {
          id: Date.now().toString(),
          text: data.message,
          type: 'ai',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
        
        queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
        queryClient.invalidateQueries({ queryKey: ['/api/analytics/dashboard'] });
        
        toast({
          title: '📸 Receipt Processed!',
          description: 'Your receipt was analyzed successfully',
          className: 'bg-green-50 border-green-200',
        });
      } else {
        const aiMessage: Message = {
          id: Date.now().toString(),
          text: data.message || 'Sorry, I couldn\'t process that image.',
          type: 'ai',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
      }
    },
    onError: (error) => {
      console.error('Image mutation error:', error);
      
      // Check for authentication errors
      if (error.message.includes('401:') || error.message.includes('403:') || 
          error.message.includes('Access token required') || 
          error.message.includes('Invalid or expired token')) {
        toast({
          title: '🔐 Session Expired',
          description: 'Please login again to continue',
          variant: 'destructive',
        });
        setTimeout(() => {
          localStorage.removeItem('auth-token');
          localStorage.removeItem('auth-user');
          window.location.href = '/auth';
        }, 2000);
        return;
      }
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: '❌ Sorry, I couldn\'t process your image. Please try uploading a clearer receipt.',
        type: 'ai',
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: '📸 Image Error',
        description: 'Unable to process image',
        variant: 'destructive',
      });
    },
  });

  const handleSendMessage = () => {
    if (!input.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      type: 'user',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    sendMessageMutation.mutate(input);
    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // Add user voice message
        const userMessage: Message = {
          id: Date.now().toString(),
          text: '🎤 Voice message...',
          type: 'user',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        
        // Process voice with AI
        sendVoiceMutation.mutate(audioBlob);
        
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      toast({
        title: '🎤 Microphone Error',
        description: 'Unable to access microphone',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: '📸 Invalid File',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: '📸 File Too Large',
        description: 'Please upload an image smaller than 10MB',
        variant: 'destructive',
      });
      return;
    }

    // Add user image message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: `📸 Uploaded: ${file.name}`,
      type: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Process image with AI
    sendImageMutation.mutate(file);

    // Reset file input
    event.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Card className={`w-96 bg-white shadow-2xl border-0 overflow-hidden transition-all duration-300 ${isMinimized ? 'h-16' : 'h-[32rem]'}`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-blue-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white text-lg">
                🤖
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full"></div>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Monly AI</h3>
              <p className="text-xs text-emerald-100">Always here to help ✨</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-white hover:bg-white/20 p-1 h-8 w-8"
            >
              {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="text-white hover:bg-white/20 p-1 h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="h-80 overflow-y-auto p-4 bg-gray-50 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.type === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0">
                      🤖
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] p-3 rounded-2xl text-sm ${
                      message.type === 'user'
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-br-sm'
                        : message.isError
                        ? 'bg-red-50 border border-red-200 text-red-700 rounded-bl-sm'
                        : message.transaction
                        ? 'bg-green-50 border border-green-200 text-green-700 rounded-bl-sm'
                        : 'bg-white border border-gray-200 text-gray-700 rounded-bl-sm shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-line">{message.text}</p>
                    <p className="text-xs opacity-60 mt-1">
                      {message.timestamp.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                  {message.type === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      👤
                    </div>
                  )}
                </div>
              ))}
              {sendMessageMutation.isPending && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0">
                    🤖
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm p-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                      <span className="text-sm text-gray-600">AI is analyzing...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t bg-white p-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Tell me about your expense..."
                    disabled={sendMessageMutation.isPending}
                    className="border-gray-300 focus:border-emerald-500 focus:ring-emerald-500 rounded-2xl"
                  />
                </div>
                
                <Button
                  type="button"
                  variant={isRecording ? "destructive" : "outline"}
                  size="icon"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={sendVoiceMutation.isPending}
                  className="rounded-full"
                >
                  {sendVoiceMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isRecording ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sendImageMutation.isPending}
                  className="rounded-full"
                >
                  {sendImageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>

                <Button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!input.trim() || sendMessageMutation.isPending}
                  className="bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 rounded-full px-4"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInput("I spent $25 on lunch")}
                  className="text-xs text-gray-600 hover:bg-gray-100 rounded-full"
                >
                  🍽️ Lunch
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInput("I paid $50 for gas")}
                  className="text-xs text-gray-600 hover:bg-gray-100 rounded-full"
                >
                  ⛽ Gas
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInput("I earned $500 from freelancing")}
                  className="text-xs text-gray-600 hover:bg-gray-100 rounded-full"
                >
                  💼 Income
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// Floating Action Button to open chat
export function ChatFAB({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 shadow-2xl z-40 transition-all duration-300 hover:scale-110"
      size="icon"
    >
      <Bot className="w-8 h-8 text-white" />
    </Button>
  );
}

export default function ChatAI() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <>
      {isChatOpen ? (
        <ChatWidget isOpen={isChatOpen} onToggle={() => setIsChatOpen(false)} />
      ) : (
        <ChatFAB onClick={() => setIsChatOpen(true)} />
      )}
    </>
  );
}
