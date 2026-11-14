import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Sparkles, X } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export function StylistDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'chat' | 'voice'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: 'Marhba! I am your Gentleman Atelier Kairouan stylist. Ask me about pairing blazers and linen overshirts, Tunisian delivery, or how your 10 loyalty points unlock 10% off.',
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  // Live Voice API state
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>('Ready to speak in EN, FR, or Darija.');
  const wsRef = useRef<WebSocket | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextPlayTimeRef = useRef(0);

  function stopVoiceSession() {
    setVoiceActive(false);
    setVoiceStatus('Voice session ended.');
    try {
      wsRef.current?.close();
    } catch {
      // ignore
    }
    wsRef.current = null;
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore
    }
    streamRef.current = null;
    try {
      captureCtxRef.current?.close();
    } catch {
      // ignore
    }
    captureCtxRef.current = null;
  }

  useEffect(() => {
    if (!open && voiceActive) {
      stopVoiceSession();
    }
  }, [open, voiceActive]);

  if (!open) return null;

  async function handleSendChat(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const historyToSend = [...messages];
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: historyToSend,
          message: trimmed,
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: data.reply || data.error || 'I could not reach the concierge right now.',
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: 'Connection interrupted. Please try again.' },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function startVoiceSession() {
    setVoiceStatus('Connecting to live voice concierge...');
    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/live-stylist`);
      wsRef.current = ws;

      const playCtx = new AudioContext({ sampleRate: 24000 });
      playCtxRef.current = playCtx;
      nextPlayTimeRef.current = playCtx.currentTime;

      ws.onmessage = async (event) => {
        const payload = JSON.parse(event.data as string) as {
          ready?: boolean;
          audio?: string;
          error?: string;
          interrupted?: boolean;
        };
        if (payload.error) {
          setVoiceStatus(payload.error);
          stopVoiceSession();
          return;
        }
        if (payload.ready) {
          setVoiceStatus('Connected. Speak naturally with our stylist.');
        }
        if (payload.interrupted && playCtxRef.current) {
          nextPlayTimeRef.current = playCtxRef.current.currentTime;
        }
        if (payload.audio && playCtxRef.current) {
          const bin = atob(payload.audio);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const int16 = new Int16Array(bytes.buffer);
          const float32 = new Float32Array(int16.length);
          for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

          const audioBuf = playCtxRef.current.createBuffer(1, float32.length, 24000);
          audioBuf.copyToChannel(float32, 0);
          const src = playCtxRef.current.createBufferSource();
          src.buffer = audioBuf;
          src.connect(playCtxRef.current.destination);
          const startAt = Math.max(playCtxRef.current.currentTime, nextPlayTimeRef.current);
          src.start(startAt);
          nextPlayTimeRef.current = startAt + audioBuf.duration;
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const capCtx = new AudioContext({ sampleRate: 16000 });
      captureCtxRef.current = capCtx;
      const source = capCtx.createMediaStreamSource(stream);
      const processor = capCtx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (ev) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const f32 = ev.inputBuffer.getChannelData(0);
        const i16 = new Int16Array(f32.length);
        for (let i = 0; i < f32.length; i++) {
          const clamped = Math.max(-1, Math.min(1, f32[i]));
          i16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
        }
        const u8 = new Uint8Array(i16.buffer);
        let bin = '';
        for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
        ws.send(JSON.stringify({ audio: btoa(bin) }));
      };

      source.connect(processor);
      processor.connect(capCtx.destination);
      setVoiceActive(true);
    } catch {
      setVoiceStatus('Microphone access or live session unavailable in this browser.');
      stopVoiceSession();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#0E1014]/65"
      role="dialog"
      aria-modal="true"
      aria-label="Gentleman Atelier Stylist"
    >
      <div className="w-full max-w-md bg-[#F9F7F2] h-full flex flex-col border-l border-[#D8D1C4] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-[#E6E1D6]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#8B6B2E]" />
            <h3 className="font-editorial text-xl text-[#111111]">Atelier Personal Stylist</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              stopVoiceSession();
              onClose();
            }}
            className="p-1.5 border border-[#E6E1D6] hover:border-[#111111]"
            aria-label="Close stylist"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 border-b border-[#E6E1D6] bg-white text-xs font-semibold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setTab('chat')}
            className={`py-2.5 ${
              tab === 'chat' ? 'bg-[#111111] text-white' : 'text-[#5C5953] hover:text-[#111111]'
            }`}
          >
            Text Stylist
          </button>
          <button
            type="button"
            onClick={() => setTab('voice')}
            className={`py-2.5 ${
              tab === 'voice' ? 'bg-[#111111] text-white' : 'text-[#5C5953] hover:text-[#111111]'
            }`}
          >
            Live Voice
          </button>
        </div>

        {tab === 'chat' ? (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 text-xs leading-relaxed border ${
                    m.role === 'user'
                      ? 'ml-8 bg-[#111111] text-[#F9F7F2] border-[#111111]'
                      : 'mr-8 bg-white text-[#111111] border-[#E6E1D6]'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
              ))}
              {sending && (
                <p className="text-[11px] text-[#5C5953] italic">Stylist is composing advice...</p>
              )}
            </div>

            <form
              onSubmit={handleSendChat}
              className="p-4 bg-white border-t border-[#E6E1D6] flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about outfits, sizing, or 10% loyalty..."
                className="flex-1 px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E6E1D6] focus:outline-none focus:border-[#111111]"
              />
              <button
                type="submit"
                disabled={sending}
                className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-5">
            <div className="w-20 h-20 border border-[#C5A059] bg-white flex items-center justify-center">
              {voiceActive ? (
                <Mic className="w-8 h-8 text-[#1F7A52]" />
              ) : (
                <MicOff className="w-8 h-8 text-[#8B6B2E]" />
              )}
            </div>
            <div className="space-y-1.5">
              <h4 className="font-editorial text-2xl text-[#111111]">Live Voice Concierge</h4>
              <p className="text-xs text-[#5C5953] max-w-xs">{voiceStatus}</p>
            </div>
            {voiceActive ? (
              <button
                type="button"
                onClick={stopVoiceSession}
                className="px-6 py-3 bg-[#9E2A2B] text-white text-xs font-semibold uppercase tracking-wider"
              >
                End Voice Consultation
              </button>
            ) : (
              <button
                type="button"
                onClick={startVoiceSession}
                className="px-6 py-3 bg-[#111111] text-[#F9F7F2] text-xs font-semibold uppercase tracking-wider"
              >
                Start Voice Consultation
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
