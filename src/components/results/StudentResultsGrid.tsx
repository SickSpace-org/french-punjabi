import PlaceholderImage from "@/components/PlaceholderImage";
import Reveal from "@/components/Reveal";
import { STUDENT_RESULTS } from "@/data/results";

export default function StudentResultsGrid() {
  return (
    <section className="bg-red-soft/25 py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-dark shadow-sm">
            Results
          </span>
          <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
            Students Who Made It Happen
          </h2>
          <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-red" />
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {STUDENT_RESULTS.map((result, index) => (
            <Reveal key={result.id} variant="scale" delayMs={index * 80}>
              <div className="laminate group overflow-hidden rounded-2xl border border-navy/10 transition-all duration-300 hover:-translate-y-1.5 hover:border-red/20">
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <PlaceholderImage
                    src={result.photo}
                    alt={result.name}
                    label="[ Student Result ]"
                    helperText="Replace by adding /public/images/results/*.jpg and passing src to <StudentResultsGrid />"
                    variant="document"
                    className="transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-5">
                  <p className="font-display text-base font-bold text-navy">{result.name}</p>
                  <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-red">
                    {result.batch}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
