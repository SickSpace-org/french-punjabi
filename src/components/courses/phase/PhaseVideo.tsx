import { toYouTubeEmbed } from "@/data/phaseDetails";

export default function PhaseVideo({ url, title }: { url: string; title: string }) {
  const embed = toYouTubeEmbed(url);
  if (!embed) return null;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-navy-dark shadow-2xl shadow-black/30 ring-1 ring-white/10">
      <iframe
        src={embed}
        title={title}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
