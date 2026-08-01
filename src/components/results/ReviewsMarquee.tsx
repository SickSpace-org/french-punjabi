import Image from "next/image";
import { Quote, Star, UserRound } from "lucide-react";
import Reveal from "@/components/Reveal";
import { REVIEWS } from "@/data/results";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "fill-navy/10 text-navy/10"}`}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

function Avatar({ name, photo }: { name: string; photo?: string }) {
  if (photo) {
    return (
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full">
        <Image src={photo} alt={name} fill className="object-cover" />
      </div>
    );
  }
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-soft via-cream to-red-soft text-navy/40">
      <UserRound className="h-5 w-5" strokeWidth={1.5} />
    </div>
  );
}

function ReviewCard({ review }: { review: (typeof REVIEWS)[number] }) {
  return (
    <div className="laminate flex w-[22rem] shrink-0 flex-col gap-4 rounded-2xl border border-navy/10 p-6">
      <div className="flex items-center justify-between">
        <Quote className="h-6 w-6 text-red/30" strokeWidth={2} fill="currentColor" />
        <StarRating rating={review.rating} />
      </div>
      <p className="line-clamp-4 text-sm leading-relaxed text-navy/70">{review.quote}</p>
      <div className="mt-auto flex items-center gap-3 border-t border-navy/8 pt-4">
        <Avatar name={review.name} photo={review.photo} />
        <div>
          <p className="text-sm font-bold text-navy">{review.name}</p>
          <p className="text-xs text-navy/50">{review.batch}</p>
        </div>
      </div>
    </div>
  );
}

export default function ReviewsMarquee() {
  const track = [...REVIEWS, ...REVIEWS];

  return (
    <section className="bg-white py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-red-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-dark">
            Reviews
          </span>
          <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
            What Students Are Saying
          </h2>
          <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-red" />
        </Reveal>
      </div>

      <Reveal delayMs={100} className="relative mt-12 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-transparent sm:w-32" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-transparent sm:w-32" />

        <div className="marquee-track flex w-max animate-marquee-right gap-6 px-6">
          {track.map((review, index) => (
            <ReviewCard key={`${review.id}-${index}`} review={review} />
          ))}
        </div>
      </Reveal>
    </section>
  );
}
