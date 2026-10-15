/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowUp, 
  RotateCcw, 
  Copy, 
  Check, 
  Volume2, 
  VolumeX, 
  Square,
  AlertCircle,
  Languages,
  ChevronDown
} from 'lucide-react';
import { MarkdownView } from './components/MarkdownView';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  error?: boolean;
}

interface LanguageOption {
  code: string;
  name: string;
  native: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'auto', name: 'Auto-detect', native: 'Auto-detect 🌐' },
  { code: 'Hindi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'Hinglish', name: 'Hinglish', native: 'Hinglish' },
  { code: 'English', name: 'English', native: 'English' },
  { code: 'Bengali', name: 'Bengali', native: 'বাংলা' },
  { code: 'Tamil', name: 'Tamil', native: 'தமிழ்' },
  { code: 'Telugu', name: 'Telugu', native: 'తెలుగు' },
  { code: 'Marathi', name: 'Marathi', native: 'मराठी' },
  { code: 'Gujarati', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'Kannada', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'Malayalam', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'Punjabi', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'Odia', name: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'Urdu', name: 'Urdu', native: 'اردو' },
];

const PROMPTS = [
  {
    icon: '♻️',
    title: 'Plastic & Waste',
    desc: 'Simple swaps to reduce single-use plastic',
    query: 'What are the easiest and most effective ways to reduce plastic waste at home?',
  },
  {
    icon: '💧',
    title: 'Save Water Daily',
    desc: 'Practical habits to conserve water',
    query: 'Ghar par rozana paani bachane ke practical aur aasan tarike batayein.',
  },
  {
    icon: '⚡',
    title: 'Energy & Electricity',
    desc: 'Lower your power bill and footprint',
    query: 'How can I make my home more energy-efficient and save on electricity bills?',
  },
  {
    icon: '🍂',
    title: 'Kitchen Composting',
    desc: 'Turn wet food scraps into rich soil',
    query: 'दैनिक रसोई के कचरे (wet waste) से घर पर खाद कैसे बनाएं?',
  },
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedLang, setSelectedLang] = useState<string>('auto');
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/health');
        setIsOnline(res.ok);
      } catch {
        setIsOnline(false);
      }
    }
    checkStatus();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setIsLangOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isBusy]);

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setIsBusy(false);
      setMessages((prev) =>
        prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
      );
    }
  };

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    }

    const userMsgId = `u-${Date.now()}`;
    const botMsgId = `b-${Date.now()}`;

    const userMsg: Message = {
      id: userMsgId,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    const initialBotMsg: Message = {
      id: botMsgId,
      role: 'model',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, initialBotMsg]);
    setInputValue('');
    setIsBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const historyPayload = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload,
          stream: true,
          language: selectedLang,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Streaming unavailable');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data: ')) continue;
          const dataStr = t.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              accumulated += parsed.text;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === botMsgId ? { ...msg, content: accumulated, isStreaming: true } : msg
                )
              );
            }
          } catch (e: any) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMsgId
            ? { ...msg, content: accumulated.trim() || 'No response generated.', isStreaming: false }
            : msg
        )
      );
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMsgId
            ? {
                ...msg,
                content: 'Unable to reach the assistant right now. Please check your connection and try again.',
                isStreaming: false,
                error: true,
              }
            : msg
        )
      );
    } finally {
      setIsBusy(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleSpeak = (id: string, text: string) => {
    if (!('speechSynthesis' in window)) return;
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const clean = text.replace(/[*#`_]/g, '');
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.0;

    if (selectedLang === 'Hindi') u.lang = 'hi-IN';
    else if (selectedLang === 'Bengali') u.lang = 'bn-IN';
    else if (selectedLang === 'Tamil') u.lang = 'ta-IN';
    else if (selectedLang === 'Telugu') u.lang = 'te-IN';
    else if (selectedLang === 'Marathi') u.lang = 'mr-IN';
    else u.lang = 'en-IN';

    u.onend = () => setSpeakingId(null);
    u.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(u);
  };

  const handleClear = () => {
    if (speakingId && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    }
    setMessages([]);
    setInputValue('');
  };

  const currentLang = LANGUAGES.find((l) => l.code === selectedLang) || LANGUAGES[0];
  const hasMessages = messages.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f9f6] text-[#1a3826] font-sans antialiased">
      {/* Refined Minimal Header */}
      <header className="h-16 px-4 sm:px-8 flex items-center justify-between bg-white/80 border-b border-[#e5ebe4] sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#e7f2e9] text-[#205c3b] flex items-center justify-center text-lg select-none">
            🌿
          </div>
          <span className="font-semibold text-[17px] tracking-tight text-[#163a25]">
            EcoGuide
          </span>
          <span className="hidden sm:inline text-xs text-[#738778] font-normal">
            · Green Assistant
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Selector */}
          <div className="relative" ref={langDropdownRef}>
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-white border border-[#d6e2d7] text-[#205c3b] hover:bg-[#eef5ef] transition-colors cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-[#205c3b]" />
              <span className="max-w-[90px] truncate">{currentLang.native}</span>
              <ChevronDown className="w-3 h-3 text-[#738778]" />
            </button>

            {isLangOpen && (
              <div className="absolute right-0 mt-1.5 w-48 max-h-64 overflow-y-auto bg-white border border-[#dce6dd] rounded-xl shadow-lg z-50 p-1">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setSelectedLang(l.code);
                      setIsLangOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      selectedLang === l.code
                        ? 'bg-[#e7f2e9] text-[#205c3b] font-semibold'
                        : 'text-[#1a3826] hover:bg-[#f3f7f4]'
                    }`}
                  >
                    <span>{l.native}</span>
                    <span className="text-[10px] text-[#738778]">{l.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reset / New Chat */}
          {hasMessages && (
            <button
              onClick={handleClear}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-full text-xs font-medium text-[#5f7465] hover:text-[#205c3b] hover:bg-[#eaf2eb] transition-colors flex items-center gap-1 cursor-pointer"
              title="Start a new chat"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          )}

          {/* Quiet Status Dot */}
          <div
            className="flex items-center gap-1.5 text-[11px] text-[#55695a] px-2.5 py-1 rounded-full bg-[#edf4ee]"
            title={isOnline ? 'Gemini AI connected' : 'Connecting...'}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-[#205c3b]' : 'bg-amber-500'
              }`}
            />
            <span className="font-medium hidden sm:inline">
              {isOnline ? 'Online' : 'Reconnecting'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-[760px] mx-auto px-4 pt-6 pb-4 flex-1 flex flex-col justify-between">
        <div className="flex-1">
          {/* Clean Welcome State */}
          {!hasMessages && (
            <div className="pt-4 pb-8 sm:py-10 animate-rise">
              <div className="text-center max-w-lg mx-auto mb-8">
                <div className="w-12 h-12 rounded-2xl bg-[#e7f2e9] text-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
                  🌍
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#163a25] mb-2">
                  Small questions, greener choices.
                </h1>
                <p className="text-sm text-[#667a6c] leading-relaxed">
                  Your quiet guide to sustainable living, conservation, and daily eco-habits. 
                  Ask in any Indian language or English.
                </p>
              </div>

              {/* 4 Clean Topic Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => ask(p.query)}
                    className="p-4 rounded-2xl bg-white border border-[#e2eae1] text-left hover:border-[#a8cbb0] hover:shadow-[0_4px_16px_rgba(32,92,59,0.04)] transition-all cursor-pointer group flex items-start gap-3"
                  >
                    <span className="text-2xl select-none group-hover:scale-105 transition-transform">
                      {p.icon}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-[#163a25] group-hover:text-[#205c3b] transition-colors mb-0.5">
                        {p.title}
                      </h3>
                      <p className="text-xs text-[#708475] leading-normal">
                        {p.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Quick Language Switcher Bar */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                <span className="text-xs text-[#738778] mr-1">Language:</span>
                {LANGUAGES.slice(0, 7).map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setSelectedLang(l.code)}
                    className={`text-xs px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
                      selectedLang === l.code
                        ? 'bg-[#205c3b] text-white font-medium'
                        : 'bg-white text-[#455c4c] border border-[#d8e4d9] hover:bg-[#edf5ee]'
                    }`}
                  >
                    {l.native}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active Chat Thread */}
          {hasMessages && (
            <div className="space-y-4 py-3 pb-8" aria-live="polite">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 items-start ${
                    m.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {m.role !== 'user' && (
                    <div className="w-8 h-8 rounded-xl bg-[#e7f2e9] text-[#205c3b] flex items-center justify-center text-sm shrink-0 select-none mt-1">
                      🌿
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-4 text-[14px] leading-relaxed relative group transition-shadow ${
                      m.role === 'user'
                        ? 'bg-[#205c3b] text-white rounded-tr-xs shadow-xs'
                        : m.error
                        ? 'bg-rose-50 text-rose-950 border border-rose-200 rounded-tl-xs'
                        : 'bg-white text-[#1a3826] border border-[#e2eae1] rounded-tl-xs shadow-xs'
                    }`}
                  >
                    {m.role === 'user' ? (
                      <p className="whitespace-pre-wrap font-normal">{m.content}</p>
                    ) : (
                      <>
                        {m.content ? (
                          <MarkdownView content={m.content} />
                        ) : m.isStreaming ? (
                          <div className="flex items-center gap-1.5 py-1">
                            <span className="text-xs text-[#738778]">Thinking</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#205c3b] animate-bounce" />
                            <span className="w-1.5 h-1.5 rounded-full bg-[#205c3b] animate-bounce [animation-delay:0.15s]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-[#205c3b] animate-bounce [animation-delay:0.3s]" />
                          </div>
                        ) : null}

                        {/* Subtle Action Buttons for Bot Responses */}
                        {m.content && !m.isStreaming && (
                          <div className="mt-2.5 pt-2 border-t border-[#f0f4ef] flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleSpeak(m.id, m.content)}
                              className="p-1 text-[#738778] hover:text-[#205c3b] hover:bg-[#edf5ee] rounded transition-colors"
                              title={speakingId === m.id ? 'Stop listening' : 'Listen'}
                            >
                              {speakingId === m.id ? (
                                <VolumeX className="w-3.5 h-3.5 text-[#205c3b]" />
                              ) : (
                                <Volume2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleCopy(m.id, m.content)}
                              className="p-1 text-[#738778] hover:text-[#205c3b] hover:bg-[#edf5ee] rounded transition-colors"
                              title="Copy response"
                            >
                              {copiedId === m.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {m.error && (
                      <div className="mt-3 pt-2 border-t border-rose-200 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-rose-700">
                          <AlertCircle className="w-3.5 h-3.5" /> Response interrupted
                        </span>
                        <button
                          onClick={() => {
                            const last = [...messages].reverse().find((x) => x.role === 'user');
                            if (last) ask(last.content);
                          }}
                          className="px-2.5 py-1 bg-rose-600 text-white rounded-md font-medium hover:bg-rose-700 transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Clean Sticky Composer */}
        <div className="sticky bottom-0 bg-[#f7f9f6] pt-2 pb-3 z-20">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(inputValue);
            }}
            className="bg-white border border-[#d8e2d8] rounded-2xl p-1.5 pl-4 flex items-center gap-2 shadow-[0_4px_20px_rgba(20,50,30,0.04)] focus-within:border-[#7fb38d] focus-within:shadow-[0_4px_24px_rgba(20,50,30,0.07)] transition-all"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask anything about sustainable living or eco-habits..."
              disabled={isBusy}
              className="flex-1 min-w-0 py-2.5 bg-transparent border-none outline-none text-[#163a25] placeholder:text-[#91a395] text-sm"
            />

            {isBusy ? (
              <button
                type="button"
                onClick={handleStop}
                className="w-9 h-9 rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                title="Stop generation"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="w-9 h-9 rounded-xl bg-[#205c3b] hover:bg-[#1a4a30] text-white flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-[#205c3b] shrink-0 cursor-pointer"
                title="Send"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </form>

          <p className="text-center text-[11px] text-[#788c7d] mt-2">
            EcoGuide · Responds in your selected language or script
          </p>
        </div>
      </main>
    </div>
  );
}
