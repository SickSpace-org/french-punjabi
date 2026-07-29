import Image from "next/image";
import { ImageIcon, UserRound } from "lucide-react";

type PlaceholderImageProps = {
  /**
   * Once you have the real photo, drop the file into /public/images/
   * and pass its path here, e.g. src="/images/founder-hero.jpg".
   * Leaving this undefined keeps the placeholder visible.
   */
  src?: string;
  alt: string;
  label: string;
  helperText?: string;
  className?: string;
  variant?: "portrait" | "document";
  priority?: boolean;
};

export default function PlaceholderImage({
  src,
  alt,
  label,
  helperText,
  className = "",
  variant = "portrait",
  priority = false,
}: PlaceholderImageProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        className={`object-cover ${className}`}
      />
    );
  }

  const Icon = variant === "portrait" ? UserRound : ImageIcon;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-navy/15 bg-gradient-to-br from-blue-soft via-cream to-red-soft text-center ${className}`}
    >
      <Icon className="h-10 w-10 text-navy/30" strokeWidth={1.5} />
      <p className="px-4 text-xs font-semibold uppercase tracking-wider text-navy/50">
        {label}
      </p>
      {helperText ? (
        <p className="max-w-[80%] text-[11px] text-navy/35">{helperText}</p>
      ) : null}
    </div>
  );
}
