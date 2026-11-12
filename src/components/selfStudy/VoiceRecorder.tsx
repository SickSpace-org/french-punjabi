"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, RotateCcw, Square } from "lucide-react";
import { MAX_RECORDING_SECONDS, formatDuration } from "@/lib/selfStudy/constants";

export type Recording = { blob: Blob; mimeType: string; durationSeconds: number };

/** Opus/WebM where supported (Chrome, Firefox, Edge), MP4/AAC on Safari. */
function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export default function VoiceRecorder({
  disabled,
  onChange,
}: {
  disabled?: boolean;
  onChange: (recording: Recording | null) => void;
}) {
  const [status, setStatus] = useState<"idle" | "recording" | "recorded">("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  function stopTimer() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function releaseMic() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  // Never leave the mic on if the student navigates away mid-recording.
  useEffect(() => {
    return () => {
      stopTimer();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      releaseMic();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser can't record audio. Please try Chrome, Safari or Edge.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferred = pickMimeType();
      const recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopTimer();
        releaseMic();
        const mimeType = recorder.mimeType || preferred || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const durationSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
        setSeconds(durationSeconds);
        setAudioUrl(URL.createObjectURL(blob));
        setStatus("recorded");
        onChange({ blob, mimeType, durationSeconds });
      };

      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setSeconds(0);
      recorder.start(1000);
      setStatus("recording");

      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setSeconds(elapsed);
        if (elapsed >= MAX_RECORDING_SECONDS && recorder.state !== "inactive") recorder.stop();
      }, 250);
    } catch {
      releaseMic();
      setError("Couldn't access your microphone. Please allow mic access and try again.");
    }
  }

  function stop() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }

  function reset() {
    setAudioUrl(null);
    setSeconds(0);
    setStatus("idle");
    onChange(null);
  }

  return (
    <div className="rounded-xl border border-navy/10 bg-cream-dim/50 p-4">
      {status === "idle" ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={start}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-full bg-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-dark disabled:opacity-60"
          >
            <Mic className="h-4 w-4" strokeWidth={2} />
            Start recording
          </button>
          <p className="text-xs text-navy/50">Up to {MAX_RECORDING_SECONDS / 60} minutes.</p>
        </div>
      ) : null}

      {status === "recording" ? (
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-red-dark" aria-live="polite">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red" />
            </span>
            Recording {formatDuration(seconds)}
          </span>
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-2 rounded-full border border-navy/15 bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-cream-dim"
          >
            <Square className="h-3.5 w-3.5 fill-current" strokeWidth={2} />
            Stop
          </button>
        </div>
      ) : null}

      {status === "recorded" && audioUrl ? (
        <div className="space-y-3">
          <audio controls src={audioUrl} className="w-full" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-navy/50">Length {formatDuration(seconds)} — listen back before you send.</p>
            <button
              type="button"
              onClick={reset}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-cream-dim disabled:opacity-60"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
              Record again
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm font-medium text-red-dark">{error}</p> : null}
    </div>
  );
}
