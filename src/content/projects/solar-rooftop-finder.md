---
title: "Solar Rooftop Finder"
slug: "solar-rooftop-finder"
shortSlug: "solar"
tagline: "One pincode in. The rooftops worth a solar site visit out. Built to run at ₹0 a month."
type: "ai"
status: "live"
year: "2026"
role: "Personal project"
stack: ["Python", "DuckDB spatial", "Overture Maps", "NASA POWER", "Cloudflare Pages Functions", "Workers KV", "D1", "Workers AI · Llama 3.3 70B", "GitHub Actions", "MapLibre"]
metrics:
  - value: "₹0"
    label: "monthly infrastructure, all on free tiers"
  - value: "8,827"
    label: "buildings scored in one pincode (400709)"
  - value: "100%"
    label: "number faithfulness on 30 AI summary eval cases"
demoUrl: "https://solar.adityabal.com"
repoUrl: "https://github.com/addityabbal/solar-rooftop-finder"
order: 0
featured: true
---

## Overview

Type a 6-digit Indian pincode and get the roofs in that area ranked for solar: usable roof area in square feet, system size, yearly units, rupees saved after the PM Surya Ghar subsidy, payback, an address an installer can navigate to, and a public business phone or website where one exists. Each pincode also gets a plain-language summary in English and Hindi and a WhatsApp-length pitch.

Everything runs on free tiers. The heavy work happens once per pincode in GitHub Actions; every visit after that is a single read from Cloudflare KV.

## Problem

Small solar installers in tier-2 and tier-3 India find customers by door-knocking. PM Surya Ghar cut payback for homes sharply, but finding roofs worth a site visit is still manual, and a wasted visit costs a day.

Two shortcuts are off the table. Collecting residents' phone numbers without consent breaches India's Digital Personal Data Protection Act, 2023. Paying for satellite imagery and training a roof-detection model costs more than a small installer will ever pay for a tool.

## Approach

- **Use roofs someone already found.** Overture Maps merges Google's and Microsoft's AI-detected building footprints with OpenStreetMap, each with an area. No imagery, no model of our own.
- **Precompute per pincode, never per visitor.** A GitHub Actions run builds a pincode once and writes the result to KV. Visits are cheap reads, so traffic can't create a bill.
- **Opt-in contacts only.** Homes show an address and a Plus Code, never a person. Businesses show only their public listing. Homeowners who want a quote share their own details through a form that stores the exact consent text they agreed to.
- **Road + Plus Code instead of reverse geocoding.** Free geocoders allow about one request a second; a pincode can hold 20,000 buildings. The nearest named road plus a Plus Code gets an installer to the door without touching a rate limit.
- **Every number is named.** Usable share, roof space per kW, sunlight, performance ratio, tariff, cost and subsidy slabs live in one config file and in the app's "How we calculate" drawer.

## Architecture

- **Pipeline (Python, GitHub Actions):** pincode → centre and a 3 km square → DuckDB reads only the matching slices of Overture's buildings, places and roads on public S3 → NASA POWER sunlight → solar maths → a 0–100 lead score (area 40, sunlight 20, public contact 20, commercial 10, payback 10) → top 500 roofs → KV.
- **AI layer:** one Workers AI call per pincode turns the computed numbers into an English and Hindi summary and a pitch. The model never computes. Guardrails in code: the output must parse as JSON; every number must appear in the input (±1%); phone numbers are stripped; the pitch may not name a business. Any failure retries once, then falls back to a template.
- **Site (Cloudflare Pages):** plain HTML and JavaScript, no framework. MapLibre on OpenFreeMap tiles, a ranked table with filters and CSV export, roof cards with a Google Maps link. Three small Functions: read a pincode or queue a build (capped at 25 a day), report build status, save an opt-in lead behind a Turnstile check.

## Demo

[Open the live demo](https://solar.adityabal.com) and pick a ready pincode: [400703](https://solar.adityabal.com/?pin=400703) or [400709](https://solar.adityabal.com/?pin=400709) in Navi Mumbai, [380015](https://solar.adityabal.com/?pin=380015) in Ahmedabad, or [600132](https://solar.adityabal.com/?pin=600132) near Chennai. Click a roof for its numbers, switch the summary to Hindi, or download the list as CSV.

> **TODO (Aditya):** Add the 60-second screen recording (search → map → roof card → CSV).

## Results

- A new pincode builds in about 3 to 3.5 minutes on a laptop: 7,611 buildings, 6,316 places and 721 named roads for 400703; 8,827 buildings for 400709. Each result is about 270 KB.
- Every real summary so far passed the number check, and the eval suite shows the check catches all 18 planted mistakes (invented rupees, changed payback, unit conversions, invented Hindi counts). The AI did invent a non-numeric claim, that a named business "already" used solar, which no number check can catch; a rule now stops the pitch from naming any business.
- The pincode directory has bad rows: 600132 sits 618 km away in Telangana, and two others are 28 to 29 km off. One OpenStreetMap lookup per build catches them.
- Finding: with the planned weights, businesses get 30 points no home can earn, so the top 500 in Navi Mumbai are all businesses and institutions. Good for an installer who can call today; homes come in through the opt-in form.

> **TODO (Aditya):** Add roof-area accuracy (50 roofs measured by hand), Hindi ratings, and what two installers said about the top 20 leads.

## Learnings

- **Precompute is the cost model.** Moving all heavy work to one build per pincode is what makes ₹0 possible, and a daily cap is what keeps it there.
- **Guardrails need more than number checks.** A model can stay numerically faithful and still invent a fact. Narrow what each output is allowed to mention.
- **Open data needs checking too.** An official directory was hundreds of kilometres wrong for some pincodes; a second, independent source is cheap insurance.
- **Write the failures down.** Merged footprints in dense areas, malls with dozens of listings in one footprint, and score saturation are all in the evals write-up, because showing them is part of the work.
