import { Quote, Star } from "lucide-react";
import Reveal from "@/components/Reveal";
import { REVIEWS, type Review } from "@/data/results";

function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  return (
    <div className={`flex items-center gap-0.5 ${className}`} aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? "fill-amber-400 text-amber-400" : "fill-navy/10 text-navy/10"}`}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

function Initials({ name, tone }: { name: string; tone: string }) {
  const letters = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${tone}`}>
      {letters}
    </span>
  );
}

function ReviewCard({ review, index }: { review: Review; index: number }) {
  return (
    <Reveal variant="up" delayMs={index * 110} className="h-full">
      <figure className="group flex h-full flex-col rounded-3xl border border-navy/10 bg-white p-7 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-navy/10">
        <Stars rating={review.rating} />
        <blockquote className="mt-4 flex-1 leading-relaxed text-navy/75">&ldquo;{review.quote}&rdquo;</blockquote>
        <figcaption className="mt-6 flex items-center gap-3 border-t border-navy/8 pt-5">
          <Initials name={review.name} tone="bg-blue-soft text-blue transition-colors duration-300 group-hover:bg-red group-hover:text-white" />
          <div>
            <p className="font-semibold text-navy">{review.name}</p>
            <p className="text-sm text-navy/55">{review.batch}</p>
          </div>
        </figcaption>
      </figure>
    </Reveal>
  );
}

/** One featured review up top, the rest in a grid underneath. */
export default function ReviewsWall() {
  const [featured, ...rest] = REVIEWS;
  if (!featured) return null;

  return (
    <section className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red">In their words</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-navy sm:text-5xl">
            What students say about the classes.
          </h2>
        </Reveal>

        <Reveal variant="scale" delayMs={100} className="mt-12">
          <figure className="relative overflow-hidden rounded-[2rem] bg-navy p-8 text-white shadow-2xl shadow-navy/20 sm:p-12 lg:p-14">
            <div className="bg-dot-grid-light pointer-events-none absolute inset-0" />
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-red/40 blur-3xl" />
            <Quote className="relative h-12 w-12 fill-white/10 text-white/20" />
            <blockquote className="relative mt-5 max-w-4xl font-display text-2xl font-medium leading-snug sm:text-3xl lg:text-[2.1rem]">
              &ldquo;{featured.quote}&rdquo;
            </blockquote>
            <figcaption className="relative mt-8 flex flex-wrap items-center gap-4">
              <Initials name={featured.name} tone="bg-white text-navy" />
              <div>
                <p className="font-semibold">{featured.name}</p>
                <p className="text-sm text-white/60">{featured.batch}</p>
              </div>
              <Stars rating={featured.rating} className="sm:ml-auto" />
            </figcaption>
          </figure>
        </Reveal>

        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((review, i) => (
            <ReviewCard key={review.id} review={review} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
