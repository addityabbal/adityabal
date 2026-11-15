// Site-wide facts used by layout, SEO and structured data. Content only; no presentation.
export const site = {
  url: "https://adityabal.com",
  name: "Aditya Hemant Bal",
  shortName: "Aditya Bal",
  jobTitle: "Senior Product Manager",
  employer: "Jio Platforms Ltd.",
  employerUrl: "https://www.jio.com",
  location: { city: "Mumbai", region: "Maharashtra", regionCode: "IN-MH", country: "IN", lat: "19.0760", lon: "72.8777" },
  email: "addityabbal@gmail.com",
  phoneDisplay: "+91 77100 52746",
  phoneHref: "+917710052746",
  linkedin: "https://linkedin.com/in/addityabbal",
  github: "https://github.com/addityabbal",
  defaultTitle: "Aditya Hemant Bal — Senior Product Manager building AI products",
  defaultDescription:
    "Senior Product Manager at Jio Platforms with 11+ years building digital products at scale. Live AI demos, plus JioPC, Jio Games Watch, Jio Stream and Jio Health Hub.",
} as const;

export const navLinks = [
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export function absoluteUrl(path: string): string {
  return new URL(path, site.url).href;
}

/** Person JSON-LD, used on / and /about. Facts carried over unchanged from the previous site. */
export function personJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${site.url}/#person`,
    name: site.name,
    givenName: "Aditya",
    familyName: "Bal",
    jobTitle: site.jobTitle,
    description:
      "Product Management Professional with 11+ years of experience leading end-to-end delivery of digital products across web and mobile platforms. Specialising in video commerce, livestreaming, creator ecosystems, and cloud computing.",
    url: site.url,
    image: absoluteUrl("/portrait.webp"),
    email: site.email,
    telephone: "+91-77100-52746",
    sameAs: [site.linkedin, site.github],
    address: {
      "@type": "PostalAddress",
      addressLocality: site.location.city,
      addressRegion: site.location.region,
      addressCountry: site.location.country,
    },
    worksFor: {
      "@type": "Organization",
      name: site.employer,
      url: site.employerUrl,
      sameAs: "https://en.wikipedia.org/wiki/Jio_Platforms",
    },
    alumniOf: [
      {
        "@type": "EducationalOrganization",
        name: "Great Lakes Institute of Management",
        description: "MBA in Marketing and Strategy, 2019",
      },
      {
        "@type": "EducationalOrganization",
        name: "Manipal Institute of Technology",
        description: "B.Tech in Electronics and Communications, 2014",
      },
    ],
    award: [
      "SKOCH Group Award for Digital Transformation 2024",
      "India DevOps Show Best Team Project 2025",
      "Star Employee of the Quarter — Jio Platforms 2021",
    ],
    knowsAbout: [
      "Product Management",
      "AI Products",
      "Retrieval-Augmented Generation",
      "Digital Platform Strategy",
      "Cloud Computing",
      "Video Commerce",
      "Livestreaming Platforms",
      "Creator Economy",
      "SaaS Products",
      "Identity and Access Management",
    ],
  };
}
