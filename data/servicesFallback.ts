export type ServiceCard = {
  slug: string;
  title: string;
  subtitle: string;
  desc: string;
  bg: string;
  text: string;
};

export const servicesFallback: ServiceCard[] = [
  {
    slug: "1-1-coaching",
    title: "1:1 Coaching",
    subtitle: "Decode your psychological code.",
    desc: "Not generic advice. aCRL-powered deep-dive to map your patterns and rewire your defaults.",
    bg: "#ffffff",
    text: "#0F3B46",
  },
  {
    slug: "therapy-sessions",
    title: "Therapy Sessions",
    subtitle: "Root-cause psychology. Not just symptom management.",
    desc: "Fix the source, not the surface. Evidence-based support blended with aCRL profiling.",
    bg: "#0F3B46",
    text: "#FFFFFF",
  },
  {
    slug: "workshops",
    title: "Workshops",
    subtitle: "1 to 3 days. Lasting change.",
    desc: "Immersive group experiences using live aCRL profiling and zero filler content.",
    bg: "#0F172A",
    text: "#FFFFFF",
  },
  {
    slug: "corporate-training",
    title: "Corporate Training",
    subtitle: "Build teams that understand themselves.",
    desc: "Custom aCRL programs for organizations, from profiling to leadership development.",
    bg: "#02040A",
    text: "#F2F2F2",
  },
];
