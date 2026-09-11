"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Square, Loader2, RefreshCw } from "lucide-react";
import { requestQuizPrompt, submitSpeakingAttempt } from "@/app/student/(portal)/quiz/actions";
import { blobToWav, blobToBase64 } from "@/lib/audio/encodeWav";
import type { QuizGrade } from "@/lib/quiz/schema";
import type { QuizAttemptRow } from "@/types/database";

type Status = "idle" | "recording" | "recorded" | "grading";

export default function SpeakingQuiz({ history }: { history: QuizAttemptRow[] }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [grade, setGrade] = useState<QuizGrade | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);

  async function loadPrompt() {
    setPromptLoading(true);
    setError(null);
    const result = await requestQuizPrompt();
    setPromptLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPrompt(result.prompt);
    setStatus("idle");
    setAudioUrl(null);
    setGrade(null);
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        recordedBlobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        setStatus("recorded");
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
    } catch {
      setError("Couldn't access your microphone. Please allow mic access and try again.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  async function submitRecording() {
    if (!recordedBlobRef.current || !prompt) return;
    setStatus("grading");
    setError(null);

    try {
      const wavBlob = await blobToWav(recordedBlobRef.current);
      const wavBase64 = await blobToBase64(wavBlob);
      const result = await submitSpeakingAttempt(prompt, wavBase64);

      if (!result.ok) {
        setError(result.error);
        setStatus("recorded");
        return;
      }

      setGrade(result.grade);
      setStatus("idle");
      router.refresh();
    } catch {
      setError("Something went wrong processing your recording. Please try again.");
      setStatus("recorded");
    }
  }

  function reRecord() {
    setAudioUrl(null);
    setGrade(null);
    setStatus("idle");
  }

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
      <h2 className="font-display text-lg font-bold text-navy">Speaking Quiz</h2>
      <p className="mt-1 text-sm text-navy/60">
        Get an AI-generated topic, record yourself speaking French, and get instant feedback.
      </p>

      <div className="mt-4 rounded-xl bg-cream-dim p-4">
        {prompt ? (
          <p className="text-sm font-medium text-navy">{prompt}</p>
        ) : (
          <p className="text-sm text-navy/50">Click below to get a speaking prompt.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={loadPrompt}
          disabled={promptLoading || status === "recording" || status === "grading"}
          className="inline-flex items-center gap-2 rounded-xl border border-navy/15 bg-white px-4 py-2 text-sm font-semibold text-navy transition hover:bg-cream-dim disabled:opacity-40"
        >
          {promptLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          New Prompt
        </button>

        {prompt && status === "idle" && (
          <button
            type="button"
            onClick={startRecording}
            className="inline-flex items-center gap-2 rounded-xl bg-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-dark"
          >
            <Mic className="h-4 w-4" />
            Record
          </button>
        )}

        {status === "recording" && (
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white"
          >
            <Square className="h-4 w-4" />
            Stop
          </button>
        )}
      </div>

      {audioUrl && (status === "recorded" || status === "grading") && (
        <div className="mt-4 space-y-3">
          <audio src={audioUrl} controls className="w-full" />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={submitRecording}
              disabled={status === "grading"}
              className="inline-flex items-center gap-2 rounded-xl bg-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-dark disabled:opacity-40"
            >
              {status === "grading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {status === "grading" ? "Grading…" : "Submit for Grading"}
            </button>
            <button
              type="button"
              onClick={reRecord}
              disabled={status === "grading"}
              className="rounded-xl border border-navy/15 bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-cream-dim disabled:opacity-40"
            >
              Re-record
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red">{error}</p>}

      {grade && (
        <div className="mt-6 rounded-xl border border-navy/10 bg-cream-dim p-5">
          <div className="flex items-baseline justify-between">
            <p className="font-display text-2xl font-bold text-navy">{Math.round(grade.overallScore)}/100</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">Overall</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="font-semibold text-navy">{Math.round(grade.pronunciationScore)}</p>
              <p className="text-xs text-navy/50">Pronunciation</p>
            </div>
            <div>
              <p className="font-semibold text-navy">{Math.round(grade.fluencyScore)}</p>
              <p className="text-xs text-navy/50">Fluency</p>
            </div>
            <div>
              <p className="font-semibold text-navy">{Math.round(grade.grammarScore)}</p>
              <p className="text-xs text-navy/50">Grammar</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-navy/70">
            <span className="font-semibold text-navy">You said:</span> {grade.transcript}
          </p>
          <p className="mt-3 text-sm text-navy/80">{grade.feedback}</p>
          {grade.strengths.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">Strengths</p>
              <ul className="mt-1 list-inside list-disc text-sm text-navy/70">
                {grade.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {grade.improvements.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">To Improve</p>
              <ul className="mt-1 list-inside list-disc text-sm text-navy/70">
                {grade.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">Recent Attempts</p>
          <ul className="mt-2 divide-y divide-navy/10">
            {history.map((attempt) => (
              <li key={attempt.id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate pr-3 text-navy/70">{attempt.prompt}</span>
                <span className="shrink-0 font-semibold text-navy">{attempt.overall_score}/100</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
