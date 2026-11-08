'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, Send, X, Radio } from 'lucide-react';
import { HostConfig, HOST_VOICES, PERSONALITY_PRESETS } from '@/lib/monopoly-data';

interface LiveVoicePanelProps {
  hostConfig: HostConfig;
  boardContext: string;
  onClose: () => void;
}

function float32ToBase64Pcm16(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default function LiveVoicePanel({
  hostConfig,
  boardContext,
  onClose,
}: LiveVoicePanelProps) {
  const [status, setStatus] = useState<'IDLE' | 'CONNECTING' | 'LIVE' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [inputTranscript, setInputTranscript] = useState('');
  const [outputTranscript, setOutputTranscript] = useState('');
  const [textQuestion, setTextQuestion] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const micMutedRef = useRef<boolean>(false);

  useEffect(() => {
    micMutedRef.current = micMuted;
  }, [micMuted]);

  const stopSession = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {}
    }
    activeSourcesRef.current = [];
    if (outputCtxRef.current) {
      outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('IDLE');
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  const playPcm24kChunk = (base64Data: string) => {
    const outCtx = outputCtxRef.current;
    if (!outCtx) return;

    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const audioBuffer = outCtx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);

    const source = outCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(outCtx.destination);

    const now = outCtx.currentTime;
    if (nextStartTimeRef.current < now) {
      nextStartTimeRef.current = now + 0.02;
    }
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += audioBuffer.duration;
    activeSourcesRef.current.push(source);
  };

  const startLiveSession = async () => {
    setErrorMessage(null);
    setStatus('CONNECTING');
    setInputTranscript('');
    setOutputTranscript('');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/live`);
      wsRef.current = ws;

      const outCtx = new AudioContext({ sampleRate: 24000 });
      outputCtxRef.current = outCtx;
      nextStartTimeRef.current = outCtx.currentTime;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'live:init',
            hostConfig,
            boardContext,
          })
        );
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'live:ready') {
          setStatus('LIVE');
          // Start 16kHz microphone capture if available
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true,
              },
            });
            streamRef.current = stream;
            const inCtx = new AudioContext({ sampleRate: 16000 });
            inputCtxRef.current = inCtx;
            const source = inCtx.createMediaStreamSource(stream);
            const processor = inCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              if (micMutedRef.current) return;
              if (ws.readyState === WebSocket.OPEN) {
                const channelData = e.inputBuffer.getChannelData(0);
                const b64 = float32ToBase64Pcm16(channelData);
                ws.send(JSON.stringify({ type: 'live:audio', audio: b64 }));
              }
            };

            source.connect(processor);
            processor.connect(inCtx.destination);
          } catch {
            // Mic permission declined or unavailable -> user can still send live text prompts and hear 24kHz voice responses
            setMicMuted(true);
          }
        } else if (msg.type === 'live:audio' && msg.audio) {
          playPcm24kChunk(msg.audio);
        } else if (msg.type === 'live:input_transcript') {
          setInputTranscript((prev) => `${prev} ${msg.text}`.trim());
        } else if (msg.type === 'live:output_transcript') {
          setOutputTranscript((prev) => `${prev} ${msg.text}`.trim());
        } else if (msg.type === 'live:interrupted') {
          for (const src of activeSourcesRef.current) {
            try {
              src.stop();
            } catch {}
          }
          activeSourcesRef.current = [];
          if (outputCtxRef.current) {
            nextStartTimeRef.current = outputCtxRef.current.currentTime;
          }
        } else if (msg.type === 'live:error') {
          setErrorMessage(msg.message || 'Live voice session encountered an error.');
          setStatus('ERROR');
        }
      };

      ws.onerror = () => {
        setErrorMessage('Could not connect to Live Voice WebSocket.');
        setStatus('ERROR');
      };

      ws.onclose = () => {
        setStatus((prev) => (prev === 'ERROR' ? 'ERROR' : 'IDLE'));
      };
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to start Live API session'
      );
      setStatus('ERROR');
    }
  };

  const handleSendTextToLive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textQuestion.trim() || !wsRef.current || status !== 'LIVE') return;
    setOutputTranscript('');
    setInputTranscript(textQuestion.trim());
    wsRef.current.send(
      JSON.stringify({
        type: 'live:text',
        text: textQuestion.trim(),
      })
    );
    setTextQuestion('');
  };

  const voiceMeta =
    HOST_VOICES.find((v) => v.voiceName === hostConfig.voiceName) ||
    HOST_VOICES[0];
  const presetMeta =
    PERSONALITY_PRESETS.find((p) => p.id === hostConfig.personalityPreset) ||
    PERSONALITY_PRESETS[0];

  return (
    <div className="fixed bottom-24 right-6 z-40 w-[380px] max-w-[92vw] rounded-xl bg-[#14100E] border border-[#D4AF37]/35 shadow-2xl p-4 text-[#FAF6F0]">
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div>
          <div className="text-xs text-[#D4AF37] font-medium">
            Gemini 3.8 Live Voice Studio · {hostConfig.gender}
          </div>
          <h3
            className="text-base font-bold text-[#FAF6F0]"
            style={{ fontFamily: 'var(--font-fraunces), serif' }}
          >
            {voiceMeta.label} · {presetMeta.name}
          </h3>
        </div>
        <button
          onClick={() => {
            stopSession();
            onClose();
          }}
          className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close Live Voice Studio"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <div className="p-3 rounded-lg bg-[#0F0C0A] border border-white/10 text-xs space-y-2 min-h-[88px]">
          {status === 'IDLE' && (
            <p className="text-stone-400 leading-relaxed">
              Start a real-time two-way voice conversation with your AI Host.
              Ask for trade evaluations, auction strategy, or live commentary on
              the board.
            </p>
          )}
          {status === 'CONNECTING' && (
            <p className="text-[#D4AF37] font-medium">
              Connecting to Gemini 3.8 Live Audio Stream (16kHz in / 24kHz out)...
            </p>
          )}
          {status === 'LIVE' && (
            <>
              <div className="flex items-center justify-between text-[11px] text-emerald-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  LIVE VOICE ACTIVE ({voiceMeta.voiceName})
                </span>
                <span>{micMuted ? 'Mic Muted' : 'Listening...'}</span>
              </div>
              {inputTranscript && (
                <p className="text-stone-400">
                  <strong className="text-stone-200">You:</strong>{' '}
                  {inputTranscript}
                </p>
              )}
              {outputTranscript ? (
                <p className="text-[#FAF6F0] leading-relaxed">
                  <strong className="text-[#D4AF37]">Host:</strong>{' '}
                  {outputTranscript}
                </p>
              ) : (
                <p className="text-stone-400 italic">
                  Speak into your microphone or type a prompt below...
                </p>
              )}
            </>
          )}
          {status === 'ERROR' && (
            <p className="text-red-400 leading-relaxed">
              {errorMessage || 'Connection failed. Check Settings > Secrets.'}
            </p>
          )}
        </div>

        {status === 'LIVE' && (
          <form onSubmit={handleSendTextToLive} className="flex gap-2">
            <input
              type="text"
              value={textQuestion}
              onChange={(e) => setTextQuestion(e.target.value)}
              placeholder="Or type to speak with the Host..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-[#0F0C0A] border border-white/15 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-[#D4AF37]"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#0F0C0A] text-xs font-semibold hover:bg-[#e3be42] transition-colors flex items-center gap-1 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              Ask
            </button>
          </form>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          {status !== 'LIVE' ? (
            <button
              onClick={startLiveSession}
              disabled={status === 'CONNECTING'}
              className="w-full py-2 px-4 rounded-lg bg-[#D4AF37] text-[#0F0C0A] font-semibold text-xs hover:bg-[#e3be42] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Volume2 className="w-4 h-4" />
              {status === 'CONNECTING'
                ? 'Connecting Live Voice...'
                : 'Start Live Voice Conversation'}
            </button>
          ) : (
            <>
              <button
                onClick={() => setMicMuted((m) => !m)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 ${
                  micMuted
                    ? 'bg-stone-800 border-white/15 text-stone-300'
                    : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                }`}
              >
                {micMuted ? (
                  <>
                    <MicOff className="w-3.5 h-3.5" /> Unmute Mic
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5" /> Mute Mic
                  </>
                )}
              </button>
              <button
                onClick={stopSession}
                className="py-2 px-4 rounded-lg bg-red-950/90 border border-red-500/40 text-red-200 text-xs font-semibold hover:bg-red-900 transition-colors"
              >
                End Call
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
