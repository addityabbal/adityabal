// Career content for /about and the homepage recognition strip.
// Carried over unchanged from the previous single-page site; edit facts here only.
import type { ImageMetadata } from "astro";
import awardSkoch from "../assets/images/award-skoch.webp";
import awardDevops from "../assets/images/award-india-devops-show.webp";
import globalAiSummit from "../assets/images/global-ai-summit.webp";
import talkAiEra from "../assets/images/talk-ai-era.webp";
import talkPowerOfAi from "../assets/images/talk-power-of-ai.webp";
import certCspo from "../assets/images/cert-cspo.webp";
import certGenAiPm from "../assets/images/cert-genai-product-managers.webp";
import certGenAiEveryone from "../assets/images/cert-genai-everyone.webp";
import certPrompt from "../assets/images/cert-prompt-engineering.webp";
import certNfts from "../assets/images/cert-nfts.webp";
import certNoCode from "../assets/images/cert-no-code.webp";
import certSql from "../assets/images/cert-sql.webp";
import certWebApis from "../assets/images/cert-web-apis.webp";

export const bio: string[] = [
  "I'm a product leader who believes the best products are built at the intersection of deep user empathy, engineering rigour, and business clarity. Over 12+ years at Jio Platforms, I've taken products from whiteboard to 10 million homes.",
  "My work spans video commerce, livestreaming, creator ecosystems, cloud computing, and enterprise SaaS. I've led cross-functional teams of 30+, mentored product managers, and represented Jio on national stages, including a demo visited by the Prime Minister.",
  "I hold an MBA in Marketing & Strategy from Great Lakes and a B.Tech in Electronics from Manipal. I earned the Certified Scrum Product Owner (CSPO) certification in 2024 and hold a Green Belt in Lean Six Sigma.",
  "Outside work, I bring the same curiosity to people, languages, and ideas. I speak English, Hindi, Marathi, and Gujarati.",
];

export interface Role {
  period: string;
  title: string;
  company: string;
  bullets: string[];
}

export const experience: Role[] = [
  {
    period: "April 2019 – Present",
    title: "Senior Product Manager",
    company: "Jio Platforms Ltd. · Mumbai, India",
    bullets: [
      "Built and lead multiple revenue-generating SaaS products across video commerce, livestreaming, and VOD, engaging 10M+ users monthly.",
      "Leading product development for JioPC, bringing advanced computing to 10M+ households, and contributed to Jio Cloud PC.",
      "Managed cross-functional teams of 30+; mentoring 5 PMs and owning roadmaps, documentation, and backlog prioritisation.",
      "Launched Jio Games Watch and scaled it to 3.8M+ users, 53K+ videos, and 14K+ active content creators.",
      "Scaled the Jio Stream video commerce platform: +15% topline revenue, 2.5× CTR, 6.04K+ product clicks.",
      "Built creator payout administration and finance reconciliation; lifted monetised-creator coverage to 3.5K+.",
      "Product manager for enterprise admin platforms: users, licences, roles and permissions, RBAC, SSO/SAML/OIDC, SCIM provisioning.",
      "Led a 12-member AI demo team at Global AI Summit 2023, visited by PM Narendra Modi.",
      "Presented at India Mobile Congress 2023 and 2024, and led 10 JioPC demo booths at IMC 2025.",
    ],
  },
  {
    period: "July 2014 – April 2019",
    title: "Assistant Product Manager",
    company: "Jio Platforms Ltd. · Mumbai, India",
    bullets: [
      "Drove product conceptualisation and requirement gathering for Jio Health Hub, achieving 1M+ downloads.",
      "Led end-to-end development of the Lab Test Booking feature with a 22-member team.",
      "Collaborated with engineering and business teams to define roadmaps, prioritise features, and ensure strategic alignment.",
    ],
  },
];

export const education = [
  { degree: "MBA, Marketing and Strategy", school: "Great Lakes Institute of Management", year: "2019" },
  { degree: "B.Tech, Electronics and Communications", school: "Manipal Institute of Technology", year: "2014" },
];

export interface Recognition {
  year: string;
  title: string;
  summary: string;
  image?: ImageMetadata;
  imageAlt?: string;
  /** Shown in the homepage recognition strip. */
  featured: boolean;
}

export const recognition: Recognition[] = [
  {
    year: "2024",
    title: "SKOCH Award for Digital Transformation",
    summary:
      "Recognised for building Jio Stream, a platform empowering SMBs and enterprises to boost product sales. SKOCH is India's leading socio-economic think tank.",
    image: awardSkoch,
    imageAlt: "Aditya Bal receiving the SKOCH Award for Digital Transformation 2024 for Jio Stream",
    featured: true,
  },
  {
    year: "2023",
    title: "Global AI Summit demo",
    summary:
      "Led a 12-member team representing Jio's AI initiatives. The demo booth was personally visited by the Prime Minister of India.",
    image: globalAiSummit,
    imageAlt: "Aditya Bal presenting the Jio AI demo at Global AI Summit 2023, Delhi",
    featured: true,
  },
  {
    year: "2025",
    title: "India DevOps Show: Best Team Project",
    summary: "Led the award-winning team that implemented automation to enhance service reliability at national scale.",
    image: awardDevops,
    imageAlt: "Aditya Bal receiving the India DevOps Show 2025 Best Team Project award",
    featured: true,
  },
  {
    year: "2021",
    title: "Star Employee of the Quarter",
    summary: "Awarded by Jio Platforms Ltd. for successful product launches and outstanding contribution to business outcomes.",
    featured: false,
  },
];

export interface Talk {
  date: string;
  kind: string;
  title: string;
  summary: string;
  host: string;
  image: ImageMetadata;
  imageAlt: string;
}

export const talks: Talk[] = [
  {
    date: "April 18, 2025",
    kind: "Guest lecture",
    title: "Entering Product Management in the AI Era",
    summary:
      "From Expertise to Impact: a session on how aspiring PMs can break into product management in an AI-first world, drawing on real experience from Jio Platforms.",
    host: "MIT School of Distance Education, Pune",
    image: talkAiEra,
    imageAlt: "Aditya Bal speaking at MIT Pune: Entering Product Management in the AI Era, April 2025",
  },
  {
    date: "July 13, 2025",
    kind: "Industry expert session",
    title: "Mastering the Power of AI in Your Hands",
    summary:
      "From Training to Transformation: an expert session for the C10 Batch on practical AI adoption, real-world use cases, and how AI is reshaping product development at scale.",
    host: "MIT School of Distance Education, Pune",
    image: talkPowerOfAi,
    imageAlt: "Aditya Bal speaking at MIT Pune: Mastering the Power of AI, July 2025",
  },
];

export interface Certification {
  title: string;
  issuer: string;
  /** Shown exactly as written. */
  date: string;
  verifyUrl?: string;
  image?: ImageMetadata;
}

export const certifications: Certification[] = [
  {
    title: "Certified Scrum Product Owner® (CSPO)",
    issuer: "Scrum Alliance",
    date: "Earned Feb 25, 2024",
    verifyUrl: "https://www.scrumalliance.org/community/profile/abal67",
    image: certCspo,
  },
  {
    title: "Generative AI for Product Managers",
    issuer: "LinkedIn Learning",
    date: "Aug 03, 2025",
    verifyUrl: "https://www.linkedin.com/learning/certificates/84fc271dfa057a4d4feee914a62b180714e8748cf3f52697904e8ff0a362a8b0",
    image: certGenAiPm,
  },
  {
    title: "Generative AI for Everyone",
    issuer: "DeepLearning.AI · Coursera",
    date: "Oct 1, 2024",
    verifyUrl: "https://coursera.org/verify/HODJKJN2P9GK",
    image: certGenAiEveryone,
  },
  {
    title: "Introduction to Prompt Engineering for Generative AI",
    issuer: "LinkedIn Learning",
    date: "Sep 03, 2023",
    verifyUrl: "https://www.linkedin.com/learning/certificates/33b7c5f6fb56334b84d08169c9f7655f5c7e7dc18623300dc8bd1ce7ea168aff",
    image: certPrompt,
  },
  {
    title: "No-Code Solutions for Websites and Apps",
    issuer: "LinkedIn Learning",
    date: "Sep 10, 2022",
    verifyUrl: "https://www.linkedin.com/learning/certificates/ATMYKhRUYRvDywBrWLUqFeJBFGkB",
    image: certNoCode,
  },
  {
    title: "Introduction to Web APIs",
    issuer: "LinkedIn Learning",
    date: "Jul 24, 2022",
    verifyUrl: "https://www.linkedin.com/learning/certificates/AaUS2u3VO-MIGYq_3JPZffpum_2q",
    image: certWebApis,
  },
  {
    title: "Learning SQL Programming",
    issuer: "LinkedIn Learning",
    date: "Jul 03, 2022",
    verifyUrl: "https://www.linkedin.com/learning/certificates/ASk0BoK8l-wDkGllgeWvq1-Dy6xn",
    image: certSql,
  },
  {
    title: "Introduction to NFTs: Non-fungible Tokens",
    issuer: "LinkedIn Learning",
    date: "May 05, 2022",
    verifyUrl: "https://www.linkedin.com/learning/certificates/AaibGSNfRxsJ41bLWQH7Geuw4wyn",
    image: certNfts,
  },
  {
    title: "Lean Six Sigma Green Belt",
    issuer: "KPMG India",
    date: "2015",
  },
];

export const patent = {
  status: "Filed 2021",
  title: "System and Method of Facilitating Peer-to-Peer Distribution Network Using Set-Top Boxes",
  summary:
    "Filed at the Indian Patent Office, 2021. Covers a novel architecture for P2P content distribution leveraging set-top box infrastructure.",
};

export const skills = [
  {
    group: "Product management",
    items: ["Product strategy", "Roadmapping", "Agile and Scrum", "MVP planning", "Go-to-market", "User research", "Backlog prioritisation", "Lifecycle ownership"],
  },
  {
    group: "Leadership and business",
    items: ["Cross-functional teams", "Stakeholder management", "Data-driven decisions", "Growth optimisation", "Monetisation models", "OKR and KPI setting"],
  },
  {
    group: "Technical and tools",
    items: ["JIRA", "Azure DevOps", "Figma", "Confluence", "SSO, SAML and OIDC", "SCIM and RBAC", "Azure and GCP", "Cursor"],
  },
];
