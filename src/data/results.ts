/**
 * Placeholder content for the Results page — student reviews and result
 * photos. Replace `photo` with a path under /public/images/ and swap the
 * copy for real quotes/results as they come in.
 */

export type Review = {
  id: string;
  name: string;
  batch: string;
  quote: string;
  rating: number;
  photo?: string;
};

export const REVIEWS: Review[] = [
  {
    id: "review-1",
    name: "Priya Malhotra",
    batch: "Phase 1 · Level 2",
    rating: 5,
    quote:
      "The teachers here explain every topic patiently and never make you feel embarrassed for asking questions. My doubts get solved instantly, and my grammar has genuinely improved a lot.",
  },
  {
    id: "review-2",
    name: "Rohan Verma",
    batch: "TCF Batch",
    rating: 5,
    quote:
      "Such a friendly and encouraging environment to learn in. The TCF preparation was structured and practical, and I finally feel ready to speak French confidently in real conversations.",
  },
  {
    id: "review-3",
    name: "Anjali Sharma",
    batch: "Phase 2 Batch",
    rating: 5,
    quote:
      "यहाँ के टीचर्स बहुत धैर्य से पढ़ाते हैं और हर doubt तुरंत क्लियर कर देते हैं। माहौल इतना friendly है कि French बोलते हुए झिझक बिल्कुल नहीं होती।",
  },
  {
    id: "review-4",
    name: "Deepak Kumar",
    batch: "TEF Batch",
    rating: 5,
    quote:
      "रोज़ speaking practice करवाई जाती है जिससे बोलने की हिचक खत्म हो गई। TEF की तैयारी बहुत systematic तरीके से करवाई, अब मुझे अपनी French पर पूरा भरोसा है।",
  },
  {
    id: "review-5",
    name: "Gurpreet Singh",
    batch: "Phase 1 · Level 3",
    rating: 5,
    quote:
      "Teachers bahut vadhiya tarike naal samjhaunde ne, har concept clear ho jaanda hai. Main pehla French bolan to darda si, hun bina kise hichkichahat de gal karda haan.",
  },
  {
    id: "review-6",
    name: "Simranjit Kaur",
    batch: "Native Batch",
    rating: 5,
    quote:
      "Ithe da mahaul bahut friendly hai, koi v doubt pucho, teacher patiently samjhaunde ne. TCF di preparation bahut vadhiya karvai, hun exam layi confident mehsoos kardi haan.",
  },
];

export type StudentResult = {
  id: string;
  name: string;
  batch: string;
  photo?: string;
};

export const STUDENT_RESULTS: StudentResult[] = [
  {
    id: "result-1",
    name: "Ritik",
    batch: "TCF Canada Graduate",
    photo: "/images/results/ritik-tcf.jpg",
  },
  {
    id: "result-2",
    name: "Kamalpreet Kaur",
    batch: "TCF Canada Graduate",
    photo: "/images/results/kamalpreet-kaur-tcf.jpg",
  },
  {
    id: "result-3",
    name: "Kamini Sharma",
    batch: "TEF Canada Graduate",
    photo: "/images/results/kamini-sharma-tef.jpg",
  },
  {
    id: "result-4",
    name: "Arshdeep Singh",
    batch: "TEF Canada Graduate",
    photo: "/images/results/arshdeep-singh-tef.jpg",
  },
  {
    id: "result-5",
    name: "TEF Canada Graduate",
    batch: "C2 Level Achiever",
    photo: "/images/results/tef-c2-result.jpg",
  },
  {
    id: "result-6",
    name: "Siddharth",
    batch: "TCF Canada Graduate",
    photo: "/images/results/siddharth-tcf.jpg",
  },
];
