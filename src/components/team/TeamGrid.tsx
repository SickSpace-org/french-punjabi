import PlaceholderImage from "@/components/PlaceholderImage";
import Reveal from "@/components/Reveal";
import { TEAM_MEMBERS } from "@/data/team";

export default function TeamGrid() {
  return (
    <section className="bg-white py-20 lg:py-24">
      <div className="mx-auto max-w-6xl space-y-20 px-6 lg:space-y-28 lg:px-10">
        {TEAM_MEMBERS.map((member, index) => {
          const imageFirst = index % 2 === 0;

          return (
            <div
              key={member.id}
              className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <Reveal
                variant={imageFirst ? "left" : "right"}
                className={imageFirst ? "lg:order-1" : "lg:order-2"}
              >
                <div className="relative mx-auto aspect-[4/5] w-full max-w-sm">
                  <div className="absolute -inset-3 rounded-[2rem] bg-red-soft" />
                  <div className="relative h-full w-full overflow-hidden rounded-[1.75rem] shadow-xl shadow-navy/10">
                    <PlaceholderImage
                      src={member.photo}
                      alt={member.name}
                      label="[ TEAM PHOTO ]"
                      helperText="Replace by adding /public/images/team/*.jpg and passing src to <TeamGrid />"
                      variant="portrait"
                    />
                  </div>
                </div>
              </Reveal>

              <div className={imageFirst ? "lg:order-2" : "lg:order-1"}>
                <Reveal delayMs={80} variant={imageFirst ? "right" : "left"}>
                  <span className="inline-flex items-center rounded-full bg-red-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-dark">
                    {member.role}
                  </span>
                </Reveal>

                <Reveal delayMs={140} variant={imageFirst ? "right" : "left"}>
                  <h3 className="mt-5 font-display text-3xl font-semibold tracking-tight text-navy">
                    {member.name}
                  </h3>
                </Reveal>

                <Reveal delayMs={200} variant={imageFirst ? "right" : "left"}>
                  <div className="mt-3 h-1 w-14 rounded-full bg-red" />
                  <p className="mt-5 text-base leading-relaxed text-navy/70">{member.bio}</p>
                </Reveal>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
