---
title: "Yoga-Doc"
slug: "yoga-doc"
shortSlug: "yoga"
tagline: "Tap where it hurts. Get three yoga poses to ease the pain."
type: "ai"
status: "live"
year: "2026"
role: "Personal project"
stack: ["Cloudflare Workers AI", "Llama 3.3 70B", "Astro", "Cloudflare D1", "Turnstile", "JavaScript", "Vite"]
metrics:
  - value: "14"
    label: "body zones to choose from"
  - value: "3"
    label: "poses per suggestion"
demoUrl: "/demos/yoga-doc"
repoUrl: "https://github.com/addityabbal/Yoga-Doc"
order: 1
featured: true
---

## Overview

Describe your pain area and Yoga-Doc suggests yoga poses to ease muscles and reduce pain. Tap a zone on the body map and get three AI-suggested, beginner-friendly poses, each with instructions and a breathing note.

The project is open-sourced on GitHub, and a live version runs on this site.

## Problem

> **TODO (Aditya):** Write the problem statement. Who is this for, what do they do today when something hurts, and why is that not good enough?

## Approach

- **Fixed choices, not free text.** The visitor picks one of 14 body zones. The browser sends only a zone id; the prompt is built on the server, so visitors cannot inject instructions.
- **Safety-minded by default.** The model is instructed to suggest only beginner-friendly poses and to remind the user to stop if they feel sharp pain. Every result carries a "not medical advice" note.
- **Structured output.** Each suggestion follows one format: pose name, how to do it, and a breathing note.
- **Graceful fallback.** If the live AI is unavailable, rate limited, or the daily quota is used up, the app shows sample poses and says so.

> **TODO (Aditya):** Add the product decisions behind these choices: why a body map, why three poses, what you tried and dropped.

## Architecture

The open-source version is a JavaScript app built with Vite. The live demo on this site runs the same interface against Cloudflare Workers AI.

- **Interface:** a static app served from this site.
- **API:** a server-side route that maps the zone id to a prompt and streams the answer back as plain text.
- **Model:** Llama 3.3 70B on Cloudflare Workers AI. No third-party API key is involved.
- **Protection:** origin check, per-IP rate limit (10 requests a minute), Cloudflare Turnstile human check with a short-lived signed session, and a per-day request cap with a kill switch stored in Cloudflare D1.
- **Privacy:** the request log stores no prompts and no raw IP addresses, only a salted hash.

## Demo

[Try the live demo](/demos/yoga-doc). It asks for a quick human check before the AI runs.

## Results

> **TODO (Aditya):** Add results. For example usage numbers, feedback from people who tried it, or what you measured.

## Learnings

> **TODO (Aditya):** Add what you learned building and shipping this, and what you would do differently.
