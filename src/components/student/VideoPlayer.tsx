import { ExternalLink, Video } from "lucide-react";

function getYouTubeEmbedUrl(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/
  );
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function getVimeoEmbedUrl(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? `https://player.vimeo.com/video/${match[1]}` : null;
}

function isDirectFileUrl(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
}

/**
 * Renders whatever's actually at the URL — YouTube/Vimeo embed, a direct
 * video file, or a plain link — without the app ever committing to a
 * hosting provider. Swappable later without touching the schema (see
 * course_lessons.video_url / video_provider).
 */
export default function VideoPlayer({ videoUrl }: { videoUrl: string | null }) {
  if (!videoUrl) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-navy/15 bg-cream-dim/60 text-navy/40">
        <Video className="h-8 w-8" strokeWidth={1.5} />
        <p className="text-sm font-medium">Video coming soon</p>
      </div>
    );
  }

  const youtubeUrl = getYouTubeEmbedUrl(videoUrl);
  const vimeoUrl = getVimeoEmbedUrl(videoUrl);
  const embedUrl = youtubeUrl ?? vimeoUrl;

  if (embedUrl) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-navy/10 bg-navy-dark">
        <iframe
          src={embedUrl}
          title="Lesson video"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (isDirectFileUrl(videoUrl)) {
    return (
      <video controls className="aspect-video w-full rounded-2xl border border-navy/10 bg-navy-dark">
        <source src={videoUrl} />
      </video>
    );
  }

  return (
    <a
      href={videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-navy/15 bg-cream-dim/60 text-navy/60 transition-colors hover:border-red/30 hover:text-red-dark"
    >
      <ExternalLink className="h-8 w-8" strokeWidth={1.5} />
      <p className="text-sm font-semibold">Open Video</p>
    </a>
  );
}
