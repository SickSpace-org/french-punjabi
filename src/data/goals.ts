/**
 * "What's your French for?" goals shown at the top of the Program page.
 *
 * Describes how French *helps* each goal, never the score or level a
 * student needs: those rules change and depend on the person, so we link
 * the official source instead. Keep claims conservative.
 */

export type Goal = {
  id: string;
  label: string;
  short: string;
  /** One-line summary of what French does for this goal. */
  headline: string;
  why: string[];
  sourceLabel: string;
  sourceHref: string;
};

export const GOALS: Goal[] = [
  {
    id: "pr",
    label: "Canada PR",
    short: "Express Entry",
    headline: "One of the strongest boosts you can add to your profile.",
    why: [
      "Extra CRS points for French, on top of whatever your English already earns you.",
      "Access to French-language category draws, which have often had lower cut-offs than general draws.",
      "Points for a second official language, so it helps even if your English is already strong.",
    ],
    sourceLabel: "IRCC: Express Entry points",
    sourceHref:
      "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html",
  },
  {
    id: "citizenship",
    label: "Citizenship",
    short: "Canadian citizenship",
    headline: "French counts as your language proof, just like English.",
    why: [
      "Canada accepts either official language for the citizenship language requirement.",
      "A second route if English testing hasn't gone your way.",
    ],
    sourceLabel: "IRCC: Citizenship language proof",
    sourceHref:
      "https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship/become-canadian-citizen/eligibility/language-skills.html",
  },
  {
    id: "mobility",
    label: "Work permit",
    short: "Francophone Mobility",
    headline: "Get hired outside Québec without the usual LMIA.",
    why: [
      "Francophone Mobility makes French speakers a simpler, faster hire for Canadian employers.",
      "The Canadian work experience you gain counts toward PR later.",
    ],
    sourceLabel: "IRCC: Francophone Mobility",
    sourceHref:
      "https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/hire-temporary-foreign/international-mobility-program/work-permit/mobilite-francophone.html",
  },
  {
    id: "quebec",
    label: "Québec",
    short: "Québec immigration",
    headline: "In Québec, French is at the centre of selection.",
    why: [
      "Québec picks its own immigrants and weighs French far more than the rest of Canada.",
      "Work, study and daily life there happen in French, so you arrive ready.",
    ],
    sourceLabel: "Québec: French requirements",
    sourceHref: "https://www.quebec.ca/en/immigration/french-language",
  },
  {
    id: "study",
    label: "Study or life",
    short: "Study, work or everyday French",
    headline: "Real French for college, work and life around town.",
    why: [
      "Hold real conversations with classmates, colleagues and neighbours.",
      "Bilingual candidates stand out for jobs across Canada.",
      "The grammar base is already there if you decide on PR later.",
    ],
    sourceLabel: "",
    sourceHref: "",
  },
];
