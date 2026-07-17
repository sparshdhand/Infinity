'use client';

import React, { useState, useEffect, useRef } from 'react';
import { signIn, signOut } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PaperPlaneRight, 
  Plus, 
  Trash, 
  SignOut, 
  Wind, 
  Eye, 
  EyeSlash, 
  List, 
  X, 
  ChatTeardrop,
  ShieldCheck,
  Sparkle
} from '@phosphor-icons/react';
import BreathingCircle from '@/components/BreathingCircle';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

interface SessionPreview {
  id: string;
  triageDate: string;
  diagnoses: string[];
  severity: string | null;
  updatedAt: string;
}

export default function ChatPage() {
  // Session & Authentication
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [preAuthPrompt, setPreAuthPrompt] = useState('');

  // Chat & Sidebar State
  const [sessions, setSessions] = useState<SessionPreview[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showBreathing, setShowBreathing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load session on mount
  useEffect(() => {
    fetchSession();
  }, []);

  // Track mouse coordinates for interactive glow when not authenticated
  useEffect(() => {
    if (session) return;
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [session]);

  // Auto-send prompt entered pre-auth once login succeeds
  useEffect(() => {
    if (session && preAuthPrompt.trim()) {
      handleSendMessage(undefined, preAuthPrompt);
      setPreAuthPrompt('');
    }
  }, [session, preAuthPrompt]);

  // When session is found, load the sidebar list of chats
  useEffect(() => {
    if (session) {
      fetchSessionsList();
    }
  }, [session]);

  // When active session changes, load messages for that session
  useEffect(() => {
    if (activeSessionId) {
      fetchMessagesForSession(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  // Scroll to bottom when messages or loading changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

  const fetchSessionsList = async () => {
    try {
      const res = await fetch('/api/chat');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  };

  const fetchMessagesForSession = async (sessId: string) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/chat?sessionId=${sessId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoggingIn(true);
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });
      if (res?.error) {
        setAuthError('We couldn\'t find that account. Check your email and password.');
      } else {
        await fetchSession();
      }
    } catch (err) {
      setAuthError('An unexpected error occurred.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleCreateNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setIsSidebarOpen(false);
  };

  const handleDeleteSession = async (sessId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('This conversation and its history will be permanently removed. Proceed?')) {
      return;
    }
    try {
      const res = await fetch(`/api/chat?sessionId=${sessId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessId));
        if (activeSessionId === sessId) {
          setActiveSessionId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    e?.preventDefault();
    const textToSend = customText || inputMessage.trim();
    if (!textToSend || sending) return;

    setInputMessage('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setSending(true);

    const temporaryUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
    };

    setMessages(prev => [...prev, temporaryUserMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend, sessionId: activeSessionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      // If we started a new session, update lists and set active ID
      if (data.sessionId && activeSessionId !== data.sessionId) {
        setActiveSessionId(data.sessionId);
        fetchSessionsList();
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.isCrisis) {
        setShowBreathing(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
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

  // Auto-grow input text area
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Grouping sessions for the sidebar
  const getGroupedSessions = () => {
    const today: SessionPreview[] = [];
    const yesterday: SessionPreview[] = [];
    const older: SessionPreview[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

    sessions.forEach(sess => {
      const time = new Date(sess.updatedAt || sess.triageDate).getTime();
      if (time >= todayStart) {
        today.push(sess);
      } else if (time >= yesterdayStart) {
        yesterday.push(sess);
      } else {
        older.push(sess);
      }
    });

    return { today, yesterday, older };
  };

  // Parse citations [text](cite:Source|Excerpt) and markdown bold text dynamically
  const parseMarkdown = (text: string) => {
    const citeRegex = /\[([^\]]+)\]\(cite:([^|]+)\|([^)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    const parseBold = (plainText: string, keyPrefix: string) => {
      const boldRegex = /\*\*(.*?)\*\*/g;
      const boldParts = [];
      let bLastIndex = 0;
      let bMatch;

      while ((bMatch = boldRegex.exec(plainText)) !== null) {
        if (bMatch.index > bLastIndex) {
          boldParts.push(plainText.substring(bLastIndex, bMatch.index));
        }
        boldParts.push(
          <strong key={`${keyPrefix}-b-${bMatch.index}`} className="font-semibold text-[var(--text-primary)]">
            {bMatch[1]}
          </strong>
        );
        bLastIndex = boldRegex.lastIndex;
      }
      if (bLastIndex < plainText.length) {
        boldParts.push(plainText.substring(bLastIndex));
      }
      return boldParts.length > 0 ? boldParts : plainText;
    };

    while ((match = citeRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        const plainSegment = text.substring(lastIndex, matchIndex);
        const parsed = parseBold(plainSegment, `plain-${matchIndex}`);
        if (Array.isArray(parsed)) {
          parts.push(...(parsed as any));
        } else {
          parts.push(parsed);
        }
      }

      const highlightedText = match[1];
      const sourceName = match[2];
      const excerpt = match[3];

      parts.push(
        <span key={`cite-${matchIndex}`} className="relative group inline cursor-help">
          <span className="bg-[oklch(0.72_0.04_150_/_0.15)] dark:bg-[oklch(0.68_0.06_150_/_0.18)] border-b-2 border-dotted border-[var(--accent-healing)] px-0.5 rounded-[3px] text-[var(--text-primary)] hover:bg-[oklch(0.72_0.04_150_/_0.25)] transition-colors inline">
            {highlightedText}
          </span>
          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-64 md:w-80 p-3.5 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-[16px] shadow-elevated opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 text-xs text-[var(--text-primary)] leading-relaxed whitespace-normal break-words font-sans">
            <span className="flex items-center gap-1.5 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-healing)]" />
              <strong className="text-[10px] uppercase tracking-wider text-[var(--accent-healing)]">
                Verified Medical Source
              </strong>
            </span>
            <strong className="block text-[11px] text-[var(--text-primary)] mb-1">
              Source: {sourceName}
            </strong>
            <span className="block italic text-[var(--text-secondary)] text-[11px] border-t border-[var(--border-light)] pt-1.5 mt-1.5">
              "{excerpt}"
            </span>
          </span>
        </span>
      );

      lastIndex = citeRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      const remainingSegment = text.substring(lastIndex);
      const parsed = parseBold(remainingSegment, 'rem');
      if (Array.isArray(parsed)) {
        parts.push(...(parsed as any));
      } else {
        parts.push(parsed);
      }
    }

    return parts.length > 0 ? parts : text;
  };

  // Helper formatting for custom double-spaced bullet lists and inline markdown
  const formatMessageContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-4">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            const cleanText = trimmed.substring(2).trim();
            return (
              <ul key={idx} className="list-disc pl-5 space-y-1">
                <li className="text-[var(--text-primary)] leading-relaxed">
                  {parseMarkdown(cleanText)}
                </li>
              </ul>
            );
          }

          return (
            <p key={idx} className="leading-relaxed">
              {parseMarkdown(trimmed)}
            </p>
          );
        })}
      </div>
    );
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-2 border-[var(--accent-healing)] border-t-transparent animate-spin" />
          <p className="font-sans text-[var(--text-secondary)] animate-pulse text-sm">Entering Sanctuary...</p>
        </div>
      </div>
    );
  }

  // Not Logged In -> Full Scrollable Onboarding Landing Page + Popup Card
  if (!session) {
    return (
      <div 
        className="h-screen w-screen flex flex-col bg-[var(--bg-primary)] overflow-y-auto scroll-smooth relative"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
      >
        {/* Ambient background drifting gradient orbs */}
        <div className="ambient-orbs-container absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="orb orb-1 absolute rounded-full bg-[var(--accent-healing)] blur-[80px]" style={{ width: 450, height: 450, left: '10%', top: '15%' }} />
          <div className="orb orb-2 absolute rounded-full bg-[oklch(0.65_0.05_220)] blur-[80px]" style={{ width: 400, height: 400, right: '15%', bottom: '10%' }} />
          <div className="orb orb-3 absolute rounded-full bg-[var(--accent-crisis)] blur-[80px]" style={{ width: 350, height: 350, left: '45%', top: '50%' }} />
        </div>

        {/* Cursor Glow Tracker Blob */}
        <div 
          className="glow-blob pointer-events-none absolute rounded-full z-10 transition-all duration-100"
          style={{
            width: 600,
            height: 600,
            background: 'radial-gradient(circle, oklch(0.72 0.04 150 / 0.15) 0%, transparent 70%)',
            left: mousePos.x,
            top: mousePos.y,
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Sticky Header Nav */}
        <nav className="sticky top-0 flex justify-between items-center px-6 md:px-12 py-4 border-b border-[var(--border-light)] z-20 bg-[var(--card-bg)] backdrop-blur-md">
          <div className="flex items-center gap-2 font-serif text-xl font-semibold text-[var(--text-primary)]">
            <span className="w-3.5 h-3.5 rounded-full bg-[var(--accent-healing)]" />
            <span>Infinity</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#prompts" className="hidden sm:inline text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Prompts</a>
            <a href="#compare" className="hidden sm:inline text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Comparison</a>
            <a href="#features" className="hidden sm:inline text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Capabilities</a>
            <a href="#limitations" className="hidden sm:inline text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Limitations</a>
            <button 
              onClick={() => setShowLoginModal(true)} 
              className="text-xs font-semibold py-2 px-5 rounded-full border border-[var(--border-light)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent-healing)] text-[var(--text-primary)] transition-all hover:scale-[1.03]"
            >
              Sign In
            </button>
          </div>
        </nav>

        {/* Main Onboarding Content */}
        <div className="flex-1 max-w-[1000px] mx-auto px-6 md:px-12 pb-36 z-10 relative w-full box-border">
          {/* Hero Banner */}
          <section className="text-center py-20 md:py-24">
            <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight mb-6 leading-tight text-[var(--text-primary)]">
              Your space of quiet reflection.
            </h1>
            <p className="text-base md:text-lg leading-relaxed text-[var(--text-secondary)] mb-10 max-w-[560px] mx-auto">
              Infinity is an organic non-clinical mental health sanctuary designed to help you triage anxiety, panic, and burnout using structured guidance and breathing aids.
            </p>
            <button 
              onClick={() => setShowLoginModal(true)} 
              className="font-sans font-semibold py-4 px-9 rounded-full bg-[var(--accent-healing)] text-white hover:opacity-95 hover:scale-[1.03] transition-all hover:shadow-[0_8px_24px_oklch(0.72_0.04_150_/_0.3)] active:scale-[0.97]"
            >
              Enter Sanctuary
            </button>
          </section>

          {/* 1. Example Prompts Section */}
          <section className="mt-20 scroll-mt-24" id="prompts">
            <h2 className="font-serif text-2xl font-normal text-center mb-10 text-[var(--text-primary)]">Example Prompts</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div 
                onClick={() => {
                  setPreAuthPrompt("I am having an active panic attack right now. Help me calm my body down.");
                  setShowLoginModal(true);
                }}
                className="bg-[var(--card-bg)] border border-[var(--border-light)] rounded-[20px] p-6 cursor-pointer backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-[var(--accent-healing)] hover:shadow-sm"
              >
                <div className="text-sm font-bold text-[var(--text-primary)] mb-2.5">Panic Support</div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed m-0">"I am having an active panic attack right now. Help me calm my body down."</p>
              </div>
              <div 
                onClick={() => {
                  setPreAuthPrompt("Guide me through a box breathing exercise to slow down my heart rate.");
                  setShowLoginModal(true);
                }}
                className="bg-[var(--card-bg)] border border-[var(--border-light)] rounded-[20px] p-6 cursor-pointer backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-[var(--accent-healing)] hover:shadow-sm"
              >
                <div className="text-sm font-bold text-[var(--text-primary)] mb-2.5">Breathing Regulator</div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed m-0">"Guide me through a box breathing exercise to slow down my heart rate."</p>
              </div>
              <div 
                onClick={() => {
                  setPreAuthPrompt("I feel overwhelmed and exhausted by work pressure. Help me parse this.");
                  setShowLoginModal(true);
                }}
                className="bg-[var(--card-bg)] border border-[var(--border-light)] rounded-[20px] p-6 cursor-pointer backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-[var(--accent-healing)] hover:shadow-sm"
              >
                <div className="text-sm font-bold text-[var(--text-primary)] mb-2.5">Burnout Check-in</div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed m-0">"I feel overwhelmed and exhausted by work pressure. Help me parse this."</p>
              </div>
            </div>
          </section>

          {/* 2. AI Comparison Matrix */}
          <section className="mt-24 scroll-mt-24" id="compare">
            <h2 className="font-serif text-2xl font-normal text-center mb-10 text-[var(--text-primary)]">Infinity vs General AI Models</h2>
            <div className="compare-table-container">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Feature Capability</th>
                    <th>General AI Models</th>
                    <th style={{ color: 'var(--accent-healing)' }}>Infinity Sanctuary</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Triage Flow</strong></td>
                    <td className="text-[var(--text-secondary)]">Generic prompts or alarmist disclaimers.</td>
                    <td style={{ color: 'var(--accent-healing)', fontWeight: 600 }}>Verified medical guidelines mapping.</td>
                  </tr>
                  <tr>
                    <td><strong>Visual Focus</strong></td>
                    <td className="text-[var(--text-secondary)]">Densely formatted text blocks.</td>
                    <td style={{ color: 'var(--accent-healing)', fontWeight: 600 }}>Clean, double-spaced narrow bullet lists.</td>
                  </tr>
                  <tr>
                    <td><strong>Breathing Aids</strong></td>
                    <td className="text-[var(--text-secondary)]">Text instructions only.</td>
                    <td style={{ color: 'var(--accent-healing)', fontWeight: 600 }}>Interactive visual box breathing circle.</td>
                  </tr>
                  <tr>
                    <td><strong>Session Privacy</strong></td>
                    <td className="text-[var(--text-secondary)]">Used for training models.</td>
                    <td style={{ color: 'var(--accent-healing)', fontWeight: 600 }}>Encrypted private JWT session records.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 3. Capabilities Section */}
          <section className="mt-24 scroll-mt-24" id="features">
            <h2 className="font-serif text-2xl font-normal text-center mb-10 text-[var(--text-primary)]">What We Do Best</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center bg-[var(--card-bg)] border border-[var(--border-light)] rounded-[20px] p-8 backdrop-blur-md">
                <ShieldCheck size={32} className="text-[var(--accent-healing)] mb-4 inline-block" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2.5">Anxiety Triage</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed m-0">Structuring non-clinical support pathways to calm overstimulated autonomic responses.</p>
              </div>
              <div className="text-center bg-[var(--card-bg)] border border-[var(--border-light)] rounded-[20px] p-8 backdrop-blur-md">
                <Sparkle size={32} className="text-[var(--accent-healing)] mb-4 inline-block" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2.5">Tactile Focus</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed m-0">Reducing digital glare and cognitive load using highly curated, spacing-heavy typography.</p>
              </div>
              <div className="text-center bg-[var(--card-bg)] border border-[var(--border-light)] rounded-[20px] p-8 backdrop-blur-md">
                <Wind size={32} className="text-[var(--accent-healing)] mb-4 inline-block" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2.5">Rhythm Reset</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed m-0">Syncing mental focus through expandable inhale/hold cycles to trigger vagus nerves.</p>
              </div>
            </div>
          </section>

          {/* 4. Limitations Section */}
          <section className="mt-24 scroll-mt-24" id="limitations">
            <h2 className="font-serif text-2xl font-normal text-center mb-10 text-[var(--text-primary)]">Safety & Limitations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[var(--card-bg)] border border-[var(--accent-crisis)] rounded-[20px] p-8 backdrop-blur-md text-center">
                <span className="text-3xl mb-4 inline-block">⚠️</span>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2.5">Non-Clinical Support</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed m-0">Infinity is a comforting tool for panic narrowing, not a medical clinic or emergency service substitute.</p>
              </div>
              <div className="bg-[var(--card-bg)] border border-[var(--accent-crisis)] rounded-[20px] p-8 backdrop-blur-md text-center">
                <span className="text-3xl mb-4 inline-block">🔐</span>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2.5">Authentication Required</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed m-0">To save conversation progress securely and prevent session conflicts, users must register via email or Google.</p>
              </div>
            </div>
          </section>
        </div>

        {/* Floating Sticky Bottom prompt bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)] to-transparent pt-8 pb-8 px-6 md:px-12 z-20">
          <div className="max-w-[700px] mx-auto flex items-end gap-3 bg-[var(--chat-bar-bg)] border border-[var(--border-light)] rounded-[24px] p-2 shadow-sm backdrop-blur-md">
            <textarea
              rows={1}
              value={preAuthPrompt}
              onChange={(e) => setPreAuthPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (preAuthPrompt.trim()) {
                    setShowLoginModal(true);
                  }
                }
              }}
              placeholder="Share what is on your mind..."
              className="flex-1 font-sans bg-transparent border-none px-3 py-3 text-sm focus:outline-none text-[var(--text-primary)] placeholder-[var(--text-secondary)] min-h-[44px] max-h-[80px] resize-none overflow-y-auto"
            />
            <button
              onClick={() => {
                if (preAuthPrompt.trim()) {
                  setShowLoginModal(true);
                }
              }}
              className="shrink-0 w-10 h-10 rounded-full bg-[var(--accent-healing)] text-white hover:opacity-95 flex items-center justify-center transition-all focus:outline-none"
            >
              <PaperPlaneRight size={18} weight="bold" />
            </button>
          </div>
        </div>

        {/* Popup Glassmorphism Sign-In Modal Overlay */}
        <AnimatePresence>
          {showLoginModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-[4px] z-[100] flex items-center justify-center p-6"
              onClick={() => setShowLoginModal(false)}
            >
              <motion.div 
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                className="login-card w-full max-w-[400px] bg-[var(--card-bg)] border border-[var(--border-light)] shadow-elevated rounded-[28px] p-8 box-border relative"
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  onClick={() => setShowLoginModal(false)}
                  className="close-card-btn absolute top-5 right-5 w-7 h-7 rounded-full border border-[var(--border-light)] bg-[var(--input-bg)] text-[var(--text-primary)] cursor-pointer flex items-center justify-center font-bold transition-all hover:bg-[var(--bg-tertiary)] hover:scale-[1.1]"
                  aria-label="Close dialog"
                >
                  <X size={14} />
                </button>

                <h2 className="font-serif text-2xl font-normal text-center mt-3 mb-2 text-[var(--text-primary)]">
                  Welcome to Infinity Health.
                </h2>
                <p className="text-center text-xs text-[var(--text-secondary)] mb-6">
                  A quiet space, just for you. Sign in to proceed.
                </p>

                {/* GOOGLE SIGN IN ON TOP */}
                <button
                  onClick={() => signIn('google')}
                  className="w-full font-sans font-semibold py-3 px-4 rounded-[12px] bg-[var(--input-bg)] border border-[var(--border-light)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:scale-[1.02] hover:border-[oklch(0.65_0.05_220)] hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 mb-4"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  <span>Sign in with Google</span>
                </button>

                <div className="divider-text flex items-center justify-between gap-3 text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] mb-4">
                  <span className="h-px flex-1 bg-[var(--border-light)]" />
                  <span>or continue with email</span>
                  <span className="h-px flex-1 bg-[var(--border-light)]" />
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full font-sans rounded-[12px] px-4 py-3 text-sm form-input"
                      placeholder="user@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full font-sans rounded-[12px] px-4 py-3 text-sm pr-11 form-input"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {authError && (
                    <p className="text-xs text-[var(--error)] font-medium m-0">{authError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loggingIn}
                    className="w-full font-sans font-semibold py-3 px-4 rounded-[12px] bg-[var(--accent-healing)] text-white hover:opacity-95 hover:scale-[1.02] hover:shadow-[0_4px_12px_oklch(0.72_0.04_150_/_0.25)] active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                  >
                    {loggingIn ? (
                      <>
                        <div className="w-4 h-4 rounded-full border border-white border-t-transparent animate-spin" />
                        <span>Entering...</span>
                      </>
                    ) : (
                      'Enter Sanctuary'
                    )}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Grouped conversations preview list
  const { today, yesterday, older } = getGroupedSessions();

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--bg-primary)] overflow-hidden font-sans">
      {/* Header Toolbar */}
      <header className="glass-panel shrink-0 h-14 px-5 flex items-center justify-between border-b border-[var(--border-light)] z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden p-1.5 -ml-1 rounded-[8px] hover:bg-[var(--bg-secondary)]"
            aria-label="Toggle sidebar list"
          >
            <List size={20} />
          </button>
          
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-healing)]" />
            <h1 className="font-serif text-lg font-semibold text-[var(--text-primary)]">
              Infinity
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBreathing(!showBreathing)}
            className={`flex items-center gap-2 font-sans text-xs font-semibold py-1.5 px-3.5 rounded-[8px] border transition-all ${
              showBreathing 
                ? 'bg-[var(--accent-healing)] text-white border-transparent' 
                : 'border-[var(--border-light)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]'
            }`}
          >
            <Wind size={15} />
            <span className="hidden sm:inline">{showBreathing ? 'Close Breath' : 'Breathe'}</span>
          </button>

          <button
            onClick={() => signOut({ redirect: false }).then(() => fetchSession())}
            className="flex items-center gap-1.5 font-sans text-xs font-semibold py-1.5 px-3.5 rounded-[8px] border border-[var(--border-light)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]"
          >
            <SignOut size={15} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* App Shell Core Layout */}
      <div className="flex-1 flex relative overflow-hidden">
        
        {/* Sidebar Container */}
        <aside
          className={`
            absolute md:static inset-y-0 left-0 w-70 md:w-64 shrink-0 bg-[var(--bg-sidebar)] border-r border-[var(--border-light)] z-30 flex flex-col transition-transform duration-250 ease-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          {/* Sidebar Action */}
          <div className="p-3 border-b border-[var(--border-light)]">
            <button
              onClick={handleCreateNewChat}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-[8px] bg-[var(--bg-tertiary)] hover:bg-[color-mix(in_oklch,var(--accent-healing)_10%,var(--bg-tertiary))] border border-[var(--border-light)] text-sm font-medium text-[var(--text-primary)] transition-colors"
            >
              <Plus size={16} />
              <span>New Conversation</span>
            </button>
          </div>

          {/* Conversations Preview List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-4 scrollbar-thin">
            {sessions.length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--text-secondary)] mt-8">
                No past conversations.
              </div>
            ) : (
              <>
                {today.length > 0 && (
                  <div>
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] px-3 mb-1.5">Today</span>
                    <div className="space-y-1">
                      {today.map(s => renderSidebarItem(s))}
                    </div>
                  </div>
                )}
                {yesterday.length > 0 && (
                  <div>
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] px-3 mb-1.5">Yesterday</span>
                    <div className="space-y-1">
                      {yesterday.map(s => renderSidebarItem(s))}
                    </div>
                  </div>
                )}
                {older.length > 0 && (
                  <div>
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] px-3 mb-1.5">Older</span>
                    <div className="space-y-1">
                      {older.map(s => renderSidebarItem(s))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Mobile Scrim overlay */}
        {isSidebarOpen && (
          <div 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden absolute inset-0 bg-black/40 backdrop-blur-[1px] z-20"
          />
        )}

        {/* Main Chat Viewport */}
        <main className="flex-1 flex flex-col bg-[var(--bg-primary)] overflow-hidden relative">
          
          {/* Message Area */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-thin">
            {loadingHistory ? (
              <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 rounded-full border-2 border-[var(--accent-healing)] border-t-transparent animate-spin" />
                  <span className="text-xs text-[var(--text-secondary)]">Loading conversation...</span>
                </div>
              </div>
            ) : messages.length === 0 ? (
              // Empty State with suggest options
              <div className="h-full max-w-[600px] mx-auto flex flex-col items-center justify-center text-center px-4">
                <div className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-light)] flex items-center justify-center mb-6">
                  <ChatTeardrop size={22} className="text-[var(--accent-healing)]" />
                </div>
                <h3 className="font-serif text-2xl font-normal mb-3 text-[var(--text-primary)]">
                  What's on your mind?
                </h3>
                <p className="text-sm text-[var(--text-secondary)] max-w-sm leading-relaxed mb-8">
                  Share your thoughts, symptoms, or symptoms of anxiety. Safe medical references will guide our support.
                </p>

                <div className="flex flex-wrap justify-center gap-2.5">
                  <button 
                    onClick={() => handleSendMessage(undefined, "I am feeling anxious")}
                    className="text-xs font-semibold py-2 px-4 rounded-[8px] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-light)] text-[var(--text-primary)] transition-colors"
                  >
                    I'm feeling anxious
                  </button>
                  <button 
                    onClick={() => handleSendMessage(undefined, "I need to talk to someone")}
                    className="text-xs font-semibold py-2 px-4 rounded-[8px] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-light)] text-[var(--text-primary)] transition-colors"
                  >
                    I need to talk
                  </button>
                  <button 
                    onClick={() => handleSendMessage(undefined, "Help me sleep")}
                    className="text-xs font-semibold py-2 px-4 rounded-[8px] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-light)] text-[var(--text-primary)] transition-colors"
                  >
                    Help me sleep
                  </button>
                </div>
              </div>
            ) : (
              // Active Conversation Thread
              <div className="max-w-[700px] mx-auto space-y-4">
                {messages.map((msg, index) => {
                  const isUser = msg.role === 'user';
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-4 shadow-sm ${
                          isUser ? 'chat-bubble-user' : 'chat-bubble-agent'
                        }`}
                      >
                        <div className="text-sm">
                          {isUser ? msg.content : formatMessageContent(msg.content)}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {sending && (
                  <div className="flex justify-start">
                    <div className="chat-bubble-agent p-4 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] dot-pulse" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] dot-pulse" style={{ animationDelay: '200ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] dot-pulse" style={{ animationDelay: '400ms' }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Sticky Bottom Input Bar */}
          <div className="shrink-0 border-t border-[var(--border-light)] px-4 py-3 bg-[var(--bg-primary)] z-10">
            <form onSubmit={(e) => handleSendMessage(e)} className="max-w-[700px] mx-auto flex items-end gap-3">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Share what is on your mind..."
                className="flex-1 font-sans bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-[12px] px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent-healing)] transition-colors min-h-[44px] max-h-[120px] resize-none overflow-y-auto"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !inputMessage.trim()}
                className="shrink-0 w-11 h-11 rounded-full bg-[var(--accent-healing)] text-white hover:opacity-95 disabled:opacity-40 flex items-center justify-center transition-all focus:outline-none"
              >
                <PaperPlaneRight size={18} weight="bold" />
              </button>
            </form>
          </div>
        </main>

        {/* Breathing Circle Side Overlay Panel */}
        <AnimatePresence>
          {showBreathing && (
            <motion.aside
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
              className="absolute md:static inset-y-0 right-0 w-full md:w-[380px] shrink-0 z-40 bg-[var(--bg-sidebar)] border-l border-[var(--border-light)] p-6"
            >
              <BreathingCircle onClose={() => setShowBreathing(false)} />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  // Helper rendering for sidebar conversation items
  function renderSidebarItem(sess: SessionPreview) {
    const isActive = activeSessionId === sess.id;
    const desc = sess.diagnoses && sess.diagnoses.length > 0 
      ? sess.diagnoses.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ') 
      : 'Coping Session';

    return (
      <div
        key={sess.id}
        onClick={() => {
          setActiveSessionId(sess.id);
          setIsSidebarOpen(false);
        }}
        className={`sidebar-item flex items-center justify-between p-3 rounded-[8px] cursor-pointer ${
          isActive 
            ? 'bg-[var(--sidebar-item-active)] border-l-2 border-[var(--sidebar-item-active-border)]' 
            : 'hover:bg-[var(--sidebar-item-hover)]'
        }`}
      >
        <div className="flex-1 min-w-0 pr-2">
          <span className="block text-xs font-semibold text-[var(--text-primary)] truncate">
            {desc}
          </span>
          <span className="block text-[10px] text-[var(--text-secondary)] mt-1">
            {new Date(sess.updatedAt || sess.triageDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <button
          onClick={(e) => handleDeleteSession(sess.id, e)}
          className="p-1 rounded-[4px] text-[var(--text-secondary)] hover:text-[var(--error)] hover:bg-[var(--bg-secondary)]"
          aria-label="Delete chat conversation"
        >
          <Trash size={14} />
        </button>
      </div>
    );
  }
}
