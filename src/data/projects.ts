export interface Project {
  name: string
  description: string
  url: string
  linkText: string
  stack: string
}

export const FEATURED_PROJECTS: Project[] = [
  {
    name: "thera copilot",
    description:
      "full-stack AI copilot for a global payroll platform. streaming SSE chat UI with backend orchestration for tool calling.",
    url: "https://www.getthera.com/",
    linkText: "getthera.com",
    stack: "kotlin, next.js, aws bedrock",
  },
  {
    name: "musicMixer",
    description:
      "upload two songs, splits stems with bsroformer, and mixes vocals from one with instrumentals from the other.",
    url: "https://mixer.awill.co",
    linkText: "mixer.awill.co",
    stack: "react, python, bsroformer",
  },
  {
    name: "particleArt",
    description:
      "type text, generates particle art via a fine-tuned stable diffusion model.",
    url: "https://prtkl.net",
    linkText: "prtkl.net",
    stack: "react, stable diffusion, python",
  },
  {
    name: "multiDraw",
    description:
      "multi-project excalidraw fork with local-first storage via indexeddb.",
    url: "https://multidraw.net",
    linkText: "multidraw.net",
    stack: "react, excalidraw, indexeddb",
  },
  {
    name: "diaHistory",
    description:
      "swift CLI that watches and archives dia browser conversations as local markdown.",
    url: "https://github.com/aaronw122/diaHistory",
    linkText: "github",
    stack: "swift, macos cli",
  },
  {
    name: "CTA Widget Tracker",
    description:
      "ios widgetkit widget for real-time chicago bus arrival times.",
    url: "https://testflight.apple.com/join/yW1pzgWA",
    linkText: "testflight",
    stack: "react native, swift, widgetkit, cta api",
  },
]
