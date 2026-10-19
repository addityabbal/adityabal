// Deep-link map: URL slug -> section id on the page, plus the preview text shown when the link is shared.
export interface SectionPage {
  slug: string;
  id: string;
  title: string;
  description: string;
  canonical?: string; // set on aliases so search engines index one URL
}

export const sectionPages: SectionPage[] = [
  {
    slug: "about",
    id: "about",
    title: "About — Aditya Hemant Bal | Senior Product Manager",
    description: "Product leader with 11+ years at Jio Platforms, taking products from whiteboard to 10 million homes across video commerce, livestreaming, cloud computing and enterprise SaaS.",
  },
  {
    slug: "products",
    id: "products",
    title: "Products — Aditya Hemant Bal | JioPC, Jio Games Watch, Jio Stream",
    description: "Platforms I've built and scaled at Jio: JioPC (10M+ homes), Jio Games Watch (3.8M users), Jio Stream (+15% revenue) and Jio Health Hub.",
  },
  {
    slug: "experience",
    id: "experience",
    title: "Experience — Aditya Hemant Bal | Senior Product Manager, Jio Platforms",
    description: "Career at Jio Platforms: leading revenue-generating SaaS products across video commerce, livestreaming and VOD, cross-functional teams of 30+, and mentoring PMs.",
  },
  {
    slug: "projects",
    id: "projects",
    title: "Projects — Aditya Hemant Bal | Side Projects & Tools",
    description: "Side projects and tools I'm building — Yoga-Doc, a PDF RAG chatbot and more — exploring ideas hands-on.",
  },
  {
    slug: "case-studies",
    id: "casestudies",
    title: "Case Studies — Aditya Hemant Bal | Product Thinking",
    description: "Deep-dives into the thinking, trade-offs and outcomes behind the products I've built — from zero-to-one launches to scaled platforms.",
  },
  {
    slug: "contact",
    id: "contact",
    title: "Contact — Aditya Hemant Bal | Let's Connect",
    description: "Open to product roles, collaborations, or a good conversation about building at scale. Reach me via LinkedIn, email or phone.",
  },
];

// Aliases: alternate spellings that serve the same section but point search engines at the main URL.
export const aliasPages: SectionPage[] = [
  { ...sectionPages.find((p) => p.slug === "case-studies")!, slug: "casestudies", canonical: "/case-studies" },
];

// section id -> slug, used by the in-page nav to show clean URLs.
export const sectionSlugs: Record<string, string> = Object.fromEntries(
  sectionPages.map((p) => [p.id, p.slug])
);
