import { PlayCircle } from "lucide-react";
import { toYouTubeEmbed } from "@/data/phaseDetails";

export default function PhaseVideo({ url, title }: { url: string; title: string }) {
  const embed = url ? toYouTubeEmbed(url) : null;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-navy-dark shadow-2xl shadow-black/30 ring-1 ring-white/10">
      {embed ? (
        <iframe
          src={embed}
          title={title}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
          <div className="bg-dot-grid-light absolute inset-0" />
          <span className="video-pulse relative flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white">
            <PlayCircle className="h-8 w-8" strokeWidth={1.5} />
          </span>
          <p className="relative font-semibold text-white">Phase intro video coming soon</p>
          <p className="relative max-w-xs text-sm text-white/55">
            Until then, the full syllabus and batch timings are below.
          </p>
        </div>
      )}
    </div>
  );
}
