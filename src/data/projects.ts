export interface Project {
  name: string
  description: string
  url: string
  linkText: string
}

export const FEATURED_PROJECTS: Project[] = [
  {
    name: "musicMixer",
    description:
      "upload two songs. takes vocals from one, instrumentals from the other, and mixes them together. anyone can be a DJ.",
    url: "https://mixer.awill.co",
    linkText: "mixer.awill.co",
  },
  {
    name: "particleArt",
    description:
      "type in text and it generates particle art using a fine-tuned stable diffusion model.",
    url: "https://prtkl.net",
    linkText: "prtkl.net",
  },
  {
    name: "multiDraw",
    description:
      "multi-project excalidraw clone. save, organize, and switch between drawings — all local-first in your browser.",
    url: "https://multidraw.net",
    linkText: "multidraw.net",
  },
  {
    name: "diaHistory",
    description:
      "macOS CLI tool that automatically archives Dia browser conversations as local markdown files.",
    url: "https://github.com/aaronw122/diaHistory",
    linkText: "github",
  },
  {
    name: "CTA Widget Tracker",
    description:
      "iOS home screen widget for Chicago transit times. dreamed of knowing when my bus comes without digging through an app.",
    url: "https://testflight.apple.com/join/yW1pzgWA",
    linkText: "testflight",
  },
]
