import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase/config.ts';
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import {
  Bot,
  Send,
  User,
  X,
  Sparkles,
  RefreshCw,
  Shield,
  Zap,
  Minimize2,
  Maximize2,
  Trash2,
  HelpCircle,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  model?: string;
}

interface GeminiChatbotModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextInfo?: any;
}

export const GeminiChatbotModal: React.FC<GeminiChatbotModalProps> = ({
  isOpen,
  onClose,
  contextInfo,
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('fp_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [
      {
        id: 'msg_welcome',
        role: 'model',
        content: `Hello! I am **FactoryGuard AI**, your intelligent security co-pilot for Feng Qun Manufacturing Complex.\n\nI can help you with:\n- Visitor clearance procedures and safety regulations\n- Mandatory PPE requirements by factory sector\n- Gate pass validation and expired pass handling\n- Emergency evacuation muster protocols\n\nHow can I assist your gate duty today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<'gemini-3.5-flash' | 'gemini-3.1-flash-lite'>('gemini-3.5-flash');
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  // Save history to localStorage and Firestore
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('fp_chat_history', JSON.stringify(messages));
    }
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // Save user message to Firestore if user ID available
    if (user?.id) {
      try {
        addDoc(collection(db, 'users', user.id, 'chat_messages'), {
          role: 'user',
          content: text,
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      } catch {}
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          model: selectedModel,
          contextInfo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gemini service error');
      }

      const botMsg: ChatMessage = {
        id: 'msg_' + (Date.now() + 1),
        role: 'model',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: data.model || selectedModel,
      };

      setMessages((prev) => [...prev, botMsg]);

      // Save bot response to Firestore
      if (user?.id) {
        try {
          addDoc(collection(db, 'users', user.id, 'chat_messages'), {
            role: 'model',
            content: data.reply,
            timestamp: new Date().toISOString(),
          }).catch(() => {});
        } catch {}
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: 'msg_err_' + Date.now(),
        role: 'model',
        content: `⚠️ **Service Alert**: ${err.message || 'Unable to reach Gemini AI.'} Please verify safety protocol documentation directly.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    const welcomeMsg: ChatMessage = {
      id: 'msg_welcome_' + Date.now(),
      role: 'model',
      content: `Conversation reset. Ready for your security queries.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([welcomeMsg]);
    localStorage.removeItem('fp_chat_history');
  };

  const suggestionChips = [
    'PPE requirements for warehouse Sectors 1-4?',
    'How do I handle an expired visitor pass?',
    'Emergency evacuation muster procedure',
    'Delivery truck gate inspection steps',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {/* Minimized Bubble */}
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-2xl border border-emerald-500/50 cursor-pointer animate-in zoom-in-90"
        >
          <div className="h-8 w-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="text-xs font-bold text-white flex items-center gap-1">
              <span>FactoryGuard AI</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            </div>
            <div className="text-[10px] text-slate-400">Click to expand chat</div>
          </div>
        </button>
      ) : (
        /* Full Chat Interface */
        <div className="w-[92vw] sm:w-[420px] h-[580px] bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-700/80 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shadow-inner">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-black text-white">FactoryGuard AI</h3>
                  <span className="text-[9px] uppercase font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded">
                    Co-Pilot
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Security & Gate Operations Assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                title="Clear Chat History"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                title="Minimize"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Model Selector Bar */}
          <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-emerald-400" />
              <span>Model:</span>
            </span>
            <div className="flex gap-1 bg-slate-800 p-0.5 rounded-lg">
              <button
                onClick={() => setSelectedModel('gemini-3.5-flash')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                  selectedModel === 'gemini-3.5-flash'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                gemini-3.5-flash (General)
              </button>
              <button
                onClick={() => setSelectedModel('gemini-3.1-flash-lite')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                  selectedModel === 'gemini-3.1-flash-lite'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                3.1-flash-lite (Fast)
              </button>
            </div>
          </div>

          {/* Messages Scrollable Thread */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 scrollbar-thin">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'model' && (
                  <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-none shadow-md'
                      : 'bg-slate-800/90 text-slate-100 rounded-bl-none border border-slate-700/80 shadow'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
                  <div
                    className={`mt-1 text-[9px] font-mono flex items-center justify-between gap-2 ${
                      msg.role === 'user' ? 'text-emerald-200' : 'text-slate-400'
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                    {msg.model && <span>{msg.model}</span>}
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div className="h-7 w-7 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5 items-center text-slate-400 text-xs">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 animate-spin" />
                </div>
                <div className="bg-slate-800/80 px-3 py-2 rounded-2xl border border-slate-700 text-xs flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>FactoryGuard is consulting security protocol...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="px-3 py-2 bg-slate-950/70 border-t border-slate-800/80 flex gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
            {suggestionChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(chip)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg border border-slate-700/80 whitespace-nowrap transition cursor-pointer text-[10px]"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-3 bg-slate-950 border-t border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask FactoryGuard AI about gate security, passes, safety..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 rounded-xl font-bold transition shadow cursor-pointer shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
