import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  User,
  Send,
  Sparkles,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Zap,
  Cpu,
  Layers,
  Wrench,
  FileCheck2,
  FileText,
  HelpCircle,
  Database,
  ArrowDownCircle,
  Clock,
  ChevronDown,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { AlkesItem, PemeliharaanItem, PerbaikanItem, BeritaAcaraPenarikan, Teknisi, ChatMessage, AiExpertRole } from '../types';

interface AiChatViewProps {
  currentTeknisi: Teknisi;
  inventaris: AlkesItem[];
  pemeliharaan: PemeliharaanItem[];
  perbaikan: PerbaikanItem[];
  beritaAcara: BeritaAcaraPenarikan[];
}

const EXPERT_ROLES: { id: AiExpertRole; label: string; desc: string; icon: any }[] = [
  {
    id: 'teknisi_utama',
    label: 'Asisten Elektromedis Utama',
    desc: 'Bantuan komprehensif seluruh operasional elektromedis & SIM-ALKES',
    icon: Bot,
  },
  {
    id: 'troubleshooter',
    label: 'Senior Troubleshooting',
    desc: 'Analisis gejala kerusakan, kode error, dan skema perbaikan alat',
    icon: Wrench,
  },
  {
    id: 'kalibrasi_sop',
    label: 'Pakar Kalibrasi & Standar',
    desc: 'Regulasi BPFK/Kemenkes, uji keselamatan listrik, dan akurasi parameter',
    icon: FileCheck2,
  },
  {
    id: 'analis_bap',
    label: 'Konsultan BAP & Afkir',
    desc: 'Pembuatan kalimat analisa teknis & rekomendasi Berita Acara Penarikan',
    icon: FileText,
  },
  {
    id: 'manajemen_aset',
    label: 'Manajemen Aset 28 Ruangan',
    desc: 'Optimasi inventaris, prioritas PPM, dan rasio kesiapan alat',
    icon: Layers,
  },
];

const AVAILABLE_MODELS = [
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', tag: 'Rekomendasi (Cerdas & Cepat)' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', tag: 'Super Cepat (Fast Response)' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', tag: 'Penalaran Mendalam (Complex Tasks)' },
];

const QUICK_PROMPTS = [
  {
    category: 'Troubleshooting',
    text: 'Bagaimana langkah sistematis troubleshooting jika Infusion Pump alarm error "Occlusion" terus-menerus?',
  },
  {
    category: 'Berita Acara (BAP)',
    text: 'Bantu buatkan teks analisa teknis dan rekomendasi formal untuk Berita Acara Penarikan (BAP) alat Suction Pump yang motor dinamonya terbakar dan sparepart discontinued.',
  },
  {
    category: 'Kalibrasi & PPM',
    text: 'Jelaskan parameter uji kalibrasi dan batas toleransi kelayakan untuk Defibrillator dan Patient Monitor sesuai standar BPFK.',
  },
  {
    category: 'Analisis SIM-ALKES',
    text: 'Analisis kondisi data inventaris alat kesehatan UPTD RSUD LAMADDUKELLENG dan berikan saran prioritas pemeliharaan (PPM) serta kalibrasi bulan ini.',
  },
  {
    category: 'Safety Listrik (K3RS)',
    text: 'Apa saja prosedur uji keselamatan listrik (Electrical Safety Testing) untuk peralatan medis kelas I dan tipe CF di Ruang Operasi (OK)?',
  },
];

export const AiChatView: React.FC<AiChatViewProps> = ({
  currentTeknisi,
  inventaris,
  pemeliharaan,
  perbaikan,
  beritaAcara,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('sim_alkes_ai_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [
      {
        id: 'msg-welcome',
        role: 'model',
        content: `Halo **${currentTeknisi.namaLengkap}**! 👋\n\nSaya adalah **SIM-ALKES AI Assistant**, asisten cerdas khusus Tim Elektromedis UPTD RSUD LAMADDUKELLENG. Saya siap membantu Anda dalam:\n\n* 🔍 **Troubleshooting Alat Medis**: Panduan perbaikan, penelusuran kode error, dan cek sirkuit.\n* 📋 **Penyusunan BAP**: Merumuskan analisa teknis & rekomendasi penarikan/afkir alat.\n* ⚙️ **SOP Pemeliharaan (PPM) & Kalibrasi**: Standar uji kelayakan BPFK dan Kemenkes RI.\n* 📊 **Evaluasi Data Inventaris**: Analisis 28 ruangan UPTD RSUD LAMADDUKELLENG.\n\nSilakan pilih topik cepat di bawah atau ketik pertanyaan teknis Anda!`,
        timestamp: new Date().toISOString(),
        modelUsed: 'gemini-3.7-flash',
      },
    ];
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AiExpertRole>('teknisi_utama');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.7-flash');
  const [includeHospitalData, setIncludeHospitalData] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    try {
      localStorage.setItem('sim_alkes_ai_chat_history', JSON.stringify(messages));
    } catch (e) {
      // storage quota
    }
  }, [messages]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputPrompt).trim();
    if (!textToSend || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputPrompt('');
    setIsLoading(true);

    try {
      // Build conversation history payload (excluding initial greeting if needed, or sending all turns)
      const payloadMessages = newHistory
        .filter((m) => m.role === 'user' || m.role === 'model')
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          content: m.content,
        }));

      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          model: selectedModel,
          role: selectedRole,
          includeContext: includeHospitalData,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menerima respons dari AI.');
      }

      const botReply: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        content: data.text,
        timestamp: new Date().toISOString(),
        modelUsed: data.modelUsed || selectedModel,
      };

      setMessages((prev) => [...prev, botReply]);
    } catch (err: any) {
      const errorReply: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        content: `⚠️ **Terjadi kendala saat menghubungi AI**: ${err.message || 'Silakan periksa koneksi dan coba beberapa saat lagi.'}`,
        timestamp: new Date().toISOString(),
        modelUsed: selectedModel,
      };
      setMessages((prev) => [...prev, errorReply]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus seluruh riwayat percakapan chat ini?')) {
      const resetMsg: ChatMessage[] = [
        {
          id: `msg-${Date.now()}`,
          role: 'model',
          content: `Riwayat percakapan telah dibersihkan. Silakan ajukan pertanyaan atau pilih prompt topik baru terkait elektromedis UPTD RSUD LAMADDUKELLENG!`,
          timestamp: new Date().toISOString(),
          modelUsed: selectedModel,
        },
      ];
      setMessages(resetMsg);
      localStorage.setItem('sim_alkes_ai_chat_history', JSON.stringify(resetMsg));
    }
  };

  const currentRoleInfo = EXPERT_ROLES.find((r) => r.id === selectedRole) || EXPERT_ROLES[0];
  const RoleIcon = currentRoleInfo.icon;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[580px] rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600/20 border border-red-500/40 text-red-400 shadow-inner">
            <Sparkles className="h-5 w-5 animate-pulse text-red-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5">
                AI Elektromedis & SIM-ALKES
              </h2>
              <span className="rounded bg-red-950 border border-red-800 px-2 py-0.5 text-[10px] font-black text-red-300">
                GEMINI 3.7
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Asisten Cerdas Pemeliharaan, Troubleshooting, & Regulasi Alkes UPTD RSUD LAMADDUKELLENG
            </p>
          </div>
        </div>

        {/* Model & Role Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Persona Role Dropdown */}
          <div className="relative">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as AiExpertRole)}
              className="appearance-none rounded-xl border border-zinc-700 bg-zinc-900 pl-8 pr-7 py-1.5 text-xs font-semibold text-zinc-200 focus:border-red-500 focus:outline-none"
              title="Pilih Peran Spesialis AI"
            >
              {EXPERT_ROLES.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
            <RoleIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-red-400 pointer-events-none" />
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
          </div>

          {/* Model Selector */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 focus:border-red-500 focus:outline-none"
            title="Pilih Versi Model Gemini"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          {/* Data Context Toggle */}
          <button
            onClick={() => setIncludeHospitalData(!includeHospitalData)}
            className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all ${
              includeHospitalData
                ? 'border-emerald-600/80 bg-emerald-950/60 text-emerald-300'
                : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300'
            }`}
            title="Kirim data ringkasan inventaris & status UPTD RSUD LAMADDUKELLENG ke AI untuk jawaban akurat"
          >
            <Database className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Konteks UPTD RSUD LAMADDUKELLENG</span>
          </button>

          {/* Clear History */}
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-xs text-zinc-400 hover:border-red-900 hover:bg-red-950/40 hover:text-red-300 transition-all"
            title="Bersihkan Percakapan"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Hospital Stats Context Bar */}
      {includeHospitalData && (
        <div className="bg-zinc-900/60 border-b border-zinc-800/80 px-4 py-1.5 flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-none py-0.5">
            <span className="font-semibold text-zinc-300 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Database Terhubung:
            </span>
            <span>Inventaris: <strong className="text-zinc-200">{inventaris.length}</strong> unit</span>
            <span>•</span>
            <span>PPM: <strong className="text-zinc-200">{pemeliharaan.length}</strong></span>
            <span>•</span>
            <span>SPK Perbaikan: <strong className="text-zinc-200">{perbaikan.length}</strong></span>
            <span>•</span>
            <span>BAP Penarikan: <strong className="text-zinc-200">{beritaAcara.length}</strong></span>
          </div>
          <span className="hidden md:inline font-mono text-[10px] text-zinc-400">
            Peran Aktif: {currentRoleInfo.label}
          </span>
        </div>
      )}

      {/* Main Chat Scrollable Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-150`}
            >
              {/* Bot Avatar */}
              {!isUser && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-950 border border-red-800/80 text-red-300 shadow-md">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              {/* Message Content Bubble */}
              <div
                className={`max-w-3xl rounded-2xl p-4 shadow-md ${
                  isUser
                    ? 'bg-gradient-to-br from-red-900 to-red-950 border border-red-700/60 text-white rounded-br-none'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-bl-none'
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between gap-3 mb-2 border-b border-zinc-800/60 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold tracking-wider text-zinc-300">
                      {isUser ? currentTeknisi.namaLengkap : 'SIM-ALKES AI Specialist'}
                    </span>
                    {!isUser && msg.modelUsed && (
                      <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[9px] font-mono text-zinc-400">
                        {msg.modelUsed}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!isUser && (
                      <button
                        onClick={() => handleCopyText(msg.id, msg.content)}
                        className="text-zinc-400 hover:text-white transition-colors"
                        title="Salin Teks"
                      >
                        {copiedId === msg.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Message Body (Markdown rendered) */}
                <div className="text-sm leading-relaxed overflow-x-auto space-y-2">
                  <Markdown>{msg.content}</Markdown>
                </div>
              </div>

              {/* User Avatar */}
              {isUser && (
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold text-xs text-white ${currentTeknisi.avatarColor} border border-white/20`}
                >
                  {currentTeknisi.namaLengkap.charAt(0)}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading / Typing Indicator */}
        {isLoading && (
          <div className="flex gap-3 justify-start animate-in fade-in duration-200">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-950 border border-red-800/80 text-red-300">
              <Bot className="h-4 w-4 animate-bounce" />
            </div>
            <div className="rounded-2xl rounded-bl-none border border-zinc-800 bg-zinc-900 p-4 max-w-md">
              <div className="flex items-center gap-2 text-xs text-zinc-400 font-semibold mb-1">
                <Sparkles className="h-3.5 w-3.5 text-red-400 animate-spin" />
                <span>AI sedang menganalisis standar elektromedis...</span>
              </div>
              <div className="flex space-x-1.5 py-1">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
                <div className="h-2 w-2 rounded-full bg-red-400 animate-pulse delay-75"></div>
                <div className="h-2 w-2 rounded-full bg-red-300 animate-pulse delay-150"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="border-t border-zinc-800/80 bg-zinc-950/80 px-4 py-2.5 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1 shrink-0">
            <HelpCircle className="h-3 w-3 text-red-400" />
            Rekomendasi Topik:
          </span>
          {QUICK_PROMPTS.map((qp, idx) => (
            <button
              key={idx}
              disabled={isLoading}
              onClick={() => handleSendMessage(qp.text)}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-red-700 hover:bg-zinc-800 hover:text-white transition-all text-left truncate max-w-[280px]"
              title={qp.text}
            >
              <span className="font-semibold text-red-400">[{qp.category}]</span> {qp.text}
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-zinc-800 bg-zinc-900/90 p-3 sm:p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end gap-2"
        >
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Tanyakan troubleshooting alat medis, SOP PPM, kalibrasi BPFK, atau kalimat BAP... (Enter untuk kirim, Shift+Enter baris baru)`}
              disabled={isLoading}
              className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-xs sm:text-sm text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={!inputPrompt.trim() || isLoading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-red-700 to-red-600 text-white font-bold shadow-lg shadow-red-950/60 hover:from-red-600 hover:to-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title="Kirim Pesan (Enter)"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400 px-1">
          <span>
            Tekan <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 font-mono text-[9px] text-zinc-300">Enter</kbd> untuk mengirim, <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 font-mono text-[9px] text-zinc-300">Shift+Enter</kbd> untuk baris baru
          </span>
          <span className="font-medium text-zinc-400">
            Powered by Google Gemini API
          </span>
        </div>
      </div>
    </div>
  );
};
