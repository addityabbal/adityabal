// Astro integration: generates 1200x630 link-preview images at build (and dev) start.
//   public/og/<slug>.png   one per project in src/content/projects
//   public/og-image.jpg    homepage and default
// Runs in Node (satori + sharp), because the Cloudflare adapter prerenders pages in workerd.
// Output is git-ignored; it is rebuilt on every build.
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import satori from "satori";
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
const colors = { bg: "#000000", text: "#f5f5f7", muted: "#a1a1a6", accent: "#2997ff" };
const typeLabels = { ai: "AI project", platform: "Platform" };

const el = (type, style, children) => ({ type, props: { style, children } });

function card({ label, title, tagline, footer }) {
  const titleSize = title.length > 28 ? 76 : title.length > 16 ? 92 : 112;
  return el(
    "div",
    {
      width: "100%",
      height: "100%",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "64px 72px",
      backgroundColor: colors.bg,
      color: colors.text,
      fontFamily: "Inter",
    },
    [
      el("div", { display: "flex", justifyContent: "space-between", fontSize: 28 }, [
        el("div", { fontWeight: 600 }, "Aditya Bal"),
        el("div", { color: colors.muted }, label),
      ]),
      el("div", { display: "flex", flexDirection: "column" }, [
        el("div", { fontSize: titleSize, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.05 }, title),
        el("div", { marginTop: 24, fontSize: 40, lineHeight: 1.25, color: colors.muted, maxWidth: 940 }, tagline),
      ]),
      el("div", { fontSize: 28, color: colors.accent }, footer),
    ],
  );
}

async function readProjects(dir) {
  const files = (await readdir(dir)).filter((file) => file.endsWith(".md"));
  const projects = [];
  for (const file of files) {
    const source = await readFile(path.join(dir, file), "utf8");
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) throw new Error(`og-images: ${file} has no frontmatter`);
    projects.push(yaml.load(match[1]));
  }
  return projects;
}

async function generate(root, logger) {
  const fontDir = path.join(root, "node_modules/@fontsource/inter/files");
  const fonts = await Promise.all(
    [400, 600, 700].map(async (weight) => ({
      name: "Inter",
      weight,
      style: "normal",
      data: await readFile(path.join(fontDir, `inter-latin-${weight}-normal.woff`)),
    })),
  );
  const render = async (tree) => Buffer.from(await satori(tree, { width: WIDTH, height: HEIGHT, fonts }));

  const outDir = path.join(root, "public/og");
  await mkdir(outDir, { recursive: true });

  const projects = await readProjects(path.join(root, "src/content/projects"));
  for (const project of projects) {
    const svg = await render(
      card({
        label: typeLabels[project.type] ?? "Project",
        title: project.title,
        tagline: project.tagline,
        footer: `adityabal.com/p/${project.shortSlug}`,
      }),
    );
    await writeFile(path.join(outDir, `${project.slug}.png`), await sharp(svg).png().toBuffer());
  }

  const home = await render(
    card({
      label: "Senior Product Manager, Jio Platforms",
      title: "Product leadership for the AI era.",
      tagline: "Live AI demos, and platforms built at scale.",
      footer: "adityabal.com",
    }),
  );
  await writeFile(path.join(root, "public/og-image.jpg"), await sharp(home).jpeg({ quality: 90 }).toBuffer());

  logger.info(`generated ${projects.length} project images and og-image.jpg`);
}

export default function ogImages() {
  let root;
  return {
    name: "og-images",
    hooks: {
      "astro:config:done": ({ config }) => {
        root = fileURLToPath(config.root);
      },
      "astro:build:start": ({ logger }) => generate(root, logger),
      // Dev: only fill in missing images, so writing into public/ never triggers a reload loop.
      "astro:server:setup": ({ logger }) => {
        if (!existsSync(path.join(root, "public/og-image.jpg"))) return generate(root, logger);
      },
    },
  };
}
