import { createFileRoute } from "@tanstack/react-router";
import { HERO_SIZES } from "@/components/Hero";
import { Site } from "@/components/Site";
import { SITE } from "@/site.config";

const TITLE = `${SITE.name} — Custom Sports Posters From Your Photo`;
const DESCRIPTION = `${SITE.name}: turn your photo into a cinematic sports poster. Send a photo — we turn it into a Kuvaello. Digital from ${SITE.from}, A3 poster + digital version €30, DUO €40 and team packages. ${SITE.tagline}.`;
const OG_IMAGE = `${SITE.url}/og-image.jpg`;

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: `${SITE.name} — ${SITE.tagline.toLowerCase()}` },
      { property: "og:description", content: `Turn your photo into a sports poster. Digital from ${SITE.from} · A3 poster + digital version €30.` },
      { property: "og:url", content: `${SITE.url}/` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "canonical", href: `${SITE.url}/` },
      // The hero photograph is the largest paint — start it with the CSS.
      {
        rel: "preload",
        as: "image",
        href: "/images/silventoinen-720.webp",
        imageSrcSet: "/images/silventoinen-480.webp 480w, /images/silventoinen-720.webp 720w, /images/silventoinen-1092.webp 1092w",
        imageSizes: HERO_SIZES,
        fetchPriority: "high",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        // Only what is public on their own site and Instagram.
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Store",
          name: SITE.fullName,
          slogan: SITE.tagline,
          description: SITE.bio,
          url: `${SITE.url}/`,
          image: OG_IMAGE,
          email: SITE.email,
          priceRange: "€5–€150",
          sameAs: [SITE.instagramUrl, "https://kuvaelloposters.fi/"],
        }),
      },
    ],
  }),
});

function Index() {
  return <Site />;
}
