'use client';

import React, { useState, useEffect, useRef } from 'react';
import { signIn, signOut } from 'next-auth/react';
import BreathingCircle from '@/components/BreathingCircle';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showBreathing, setShowBreathing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check session on mount
  useEffect(() => {
    fetchSession();
  }, []);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data && data.user) {
        setSession(data);
      } else {
        setSession(null);
      }
    } catch (err) {
      console.error('Error fetching session:', err);
    } finally {
      setLoadingSession(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });
      if (res?.error) {
        setAuthError('Invalid credentials. Please try again.');
      } else {
        await fetchSession();
      }
    } catch (err) {
      setAuthError('An unexpected error occurred.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || sending) return;

    const userMessageContent = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    const temporaryUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessageContent,
    };

    setMessages((prev) => [...prev, temporaryUserMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessageContent, sessionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.isCrisis) {
        setShowBreathing(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '* **Error**: Sorry, something went wrong. Please check your connection and try again.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Format responses to preserve double-spaced bullet lists
  const formatMessageContent = (content: string) => {
    // Split by newlines
    const lines = content.split('\n');
    return (
      <div className="space-y-4">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          // Check if it is a bullet line (starts with * or -)
          if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
            // Remove the bullet character and format bold tags
            let cleanText = trimmed.replace(/^[\*\-\s]+/, '');
            
            // Basic bold markdown parser **text** -> <strong>text</strong>
            const parts = [];
            let lastIndex = 0;
            const regex = /\*\*(.*?)\*\*/g;
            let match;
            
            while ((match = regex.exec(cleanText)) !== null) {
              if (match.index > lastIndex) {
                parts.push(cleanText.substring(lastIndex, match.index));
              }
              parts.push(<strong key={match.index} className="font-semibold text-[var(--text-primary)]">{match[1]}</strong>);
              lastIndex = regex.lastIndex;
            }
            
            if (lastIndex < cleanText.length) {
              parts.push(cleanText.substring(lastIndex));
            }

            return (
              <ul key={idx} className="list-disc pl-5 space-y-1">
                <li className="text-[var(--text-primary)] leading-relaxed">
                  {parts.length > 0 ? parts : cleanText}
                </li>
              </ul>
            );
          }

          // Otherwise return as standard text block
          return (
            <p key={idx} className="leading-relaxed">
              {trimmed}
            </p>
          );
        })}
      </div>
    );
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <p className="font-sans text-[var(--text-secondary)] animate-pulse">Entering Sanctuary...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4 py-12">
        <div className="glass-panel w-full max-w-md p-8 rounded-[24px] border border-[var(--border-light)] shadow-elevated">
          <h2 className="font-serif text-3xl font-semibold mb-6 text-center text-[var(--text-primary)]">
            Welcome to Infinity
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-8 text-center leading-relaxed">
            Please log in with your credentials to access the mental health companion.
          </p>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full font-sans bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-[16px] px-4 py-3 text-sm focus:outline-none focus-visible:outline focus-visible:outline-[var(--accent-healing)] transition-all"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full font-sans bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-[16px] px-4 py-3 text-sm focus:outline-none focus-visible:outline focus-visible:outline-[var(--accent-healing)] transition-all"
                placeholder="••••••••"
              />
            </div>
            {authError && (
              <p className="text-xs text-[var(--error)] font-medium text-center">{authError}</p>
            )}
            <button
              type="submit"
              className="w-full font-sans font-semibold py-3 px-4 rounded-[16px] bg-[var(--accent-healing)] text-white hover:opacity-95 transition-opacity focus-visible:outline focus-visible:outline-[var(--accent-healing)]"
            >
              Enter Sanctuary
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col font-sans">
      {/* Header */}
      <header className="glass-panel sticky top-0 z-20 w-full px-6 py-4 flex items-center justify-between border-b border-[var(--border-light)]">
        <div className="flex items-center gap-3">
          <span className="w-3.5 h-3.5 rounded-full bg-[var(--accent-healing)] animate-pulse" />
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Infinity
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowBreathing(!showBreathing)}
            className={`font-sans text-xs font-semibold py-2 px-4 rounded-[16px] border border-[var(--border-light)] transition-all focus-visible:outline focus-visible:outline-[var(--accent-healing)] ${
              showBreathing ? 'bg-[var(--accent-healing)] text-white' : 'hover:bg-[var(--bg-secondary)]'
            }`}
            aria-label={showBreathing ? 'Close breathing simulator' : 'Open breathing simulator'}
          >
            {showBreathing ? 'Close Breath' : 'Take a Breath'}
          </button>
          <button
            onClick={() => signOut({ redirect: false }).then(() => fetchSession())}
            className="font-sans text-xs font-semibold py-2 px-4 rounded-[16px] hover:bg-[var(--bg-secondary)] border border-[var(--border-light)] transition-all focus-visible:outline focus-visible:outline-[var(--accent-healing)]"
            aria-label="Logout"
          >
            Leave
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 py-8 flex flex-col md:flex-row gap-8 relative">
        {/* Chat Interface */}
        <section className={`flex-1 flex flex-col min-h-[60vh] max-h-[80vh] glass-panel rounded-[24px] border border-[var(--border-light)] p-6 transition-all duration-300 ${
          showBreathing ? 'md:max-w-[60%]' : 'w-full'
        }`}>
          {/* Conversation History */}
          <div 
            className="flex-1 overflow-y-auto space-y-6 pr-2 mb-4 scrollbar-thin"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <h3 className="font-serif text-xl font-medium mb-2 text-[var(--text-primary)]">
                  Welcome to a space of quiet reflection.
                </h3>
                <p className="text-sm text-[var(--text-secondary)] max-w-md leading-relaxed">
                  How are you feeling today? Share your thoughts, anxiety levels, or symptoms, and we will reference safe guidelines to support you.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] ${
                    msg.role === 'user'
                      ? 'chat-bubble-user ml-auto p-4 rounded-[24px] rounded-br-[4px]'
                      : 'chat-bubble-agent mr-auto p-5 rounded-[24px] rounded-bl-[4px] border border-[var(--border-light)]'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wider font-semibold mb-2 opacity-60">
                    {msg.role === 'user' ? 'You' : 'Companion'}
                  </span>
                  <div className="text-sm">
                    {msg.role === 'user' ? msg.content : formatMessageContent(msg.content)}
                  </div>
                </div>
              ))
            )}

            {sending && (
              <div className="chat-bubble-agent mr-auto p-5 rounded-[24px] rounded-bl-[4px] border border-[var(--border-light)] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Form Input */}
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Share what is on your mind..."
              className="flex-1 font-sans bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-[16px] px-4 py-3 text-sm focus:outline-none focus-visible:outline focus-visible:outline-[var(--accent-healing)] transition-all"
              disabled={sending}
              aria-label="Chat input message"
            />
            <button
              type="submit"
              disabled={sending || !inputMessage.trim()}
              className="font-sans font-semibold py-3 px-6 rounded-[16px] bg-[var(--accent-healing)] text-white hover:opacity-95 disabled:opacity-50 transition-all focus-visible:outline focus-visible:outline-[var(--accent-healing)]"
            >
              Send
            </button>
          </form>
        </section>

        {/* Breathing Circle Side Drawer */}
        {showBreathing && (
          <aside className="w-full md:w-[380px] flex-shrink-0 animate-fade-in">
            <BreathingCircle onClose={() => setShowBreathing(false)} />
          </aside>
        )}
      </main>
    </div>
  );
}
