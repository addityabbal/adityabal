---
title: "Solar Rooftop Lead Finder"
slug: "solar-rooftop-finder"
shortSlug: "solar"
tagline: "One pincode in. The rooftops worth a solar site visit out."
type: "ai"
status: "live"
year: "2026"
role: "Personal project"
stack: ["Next.js", "TypeScript", "Tailwind CSS", "Python", "DuckDB spatial", "GeoParquet", "Google Solar API", "Cloudflare Workers", "pdf-lib"]
metrics:
  - value: "2,07,817"
    label: "buildings read for one pincode"
  - value: "58 s"
    label: "to find, measure and rank them"
  - value: "Top 50"
    label: "roofs shortlisted per pincode"
demoUrl: "https://solar.adityabal.com/p/380015"
order: 3
featured: false
---

## Overview

Type one Indian pincode and get a ranked list of the rooftops worth pitching solar to: roof and usable area in square feet, system size, yearly units and rupees saved, PM Surya Ghar subsidy and payback. A campaign layer then turns the list into outreach: a page per roof with a before-and-after panel diagram, a print-ready postcard with a QR code, and a dashboard that tracks every roof from scanned to booked.

It became buildable as a solo project once Google's Solar API started covering Indian rooftops in September 2026. That removed the hardest part, which was training a roof-detection model on satellite images.

## Problem

A solar installer's scarcest resource is the site visit. Most leads come from cold lists with no idea whether the roof can carry a worthwhile system, so days go on roofs that are too small or too shaded.

The obvious shortcut, scraping phone numbers for every home, is both unlawful under India's Digital Personal Data Protection Act and unwelcome. The product had to find good roofs and reach their owners without collecting anyone's personal data.

## Approach

- **Start from the roof, not the person.** Every building outline in the pincode comes from open data, and roofs are ranked by what solar would save, so the first visit goes to the best roof.
- **Lawful contact or none.** Homes get an address only. Business contact comes from public listings, fetched when someone opens the row and never stored. The only personal detail the system ever holds is what an owner types into the booking form, with an explicit consent tick.
- **Reach the address, not the phone.** Outreach is a postcard addressed to "The Owner", whose QR code opens a page made for that roof. The owner books a visit only if they choose to.
- **Estimates that say so.** Every figure carries a plus or minus 15% range and "estimate, not a quotation". Roofs without detailed roof data are marked "estimated" instead of passed off as measured.
- **One file for every assumption.** Tariffs, cost per kW, subsidy slabs and panel sizing live in one JSON file read by both the Python pipeline and the web app, so a wrong number is fixed without touching code.

## Architecture

- **Footprints:** a Python worker turns the pincode into a boundary and reads every building outline inside it from the Google-Microsoft-OSM Open Buildings dataset, a single 64 GB GeoParquet file for India. DuckDB spatial uses the file's bounding-box column to download only the slices that overlap.
- **Shortlist:** area is measured in the local UTM projection, roofs under 40 m² are dropped and the 50 largest are kept, which caps the cost of every paid call after it.
- **Enrichment:** one client module calls Google's Solar API for usable roof area, sunshine hours and panel positions, reverse geocoding for the address, and Places for a business within 30 metres. It has retries, timeouts and a per-scan budget that stops a scan at 50 Solar API calls.
- **Savings model:** usable area becomes kW, units, rupees, subsidy and payback. The same pure functions exist in Python and TypeScript and are tested against one worked example.
- **Web app:** Next.js on Cloudflare Workers, with a map, sortable table, filters, CSV export, per-roof pages, postcard PDFs generated on the server, and the campaign dashboard.

## Demo

[Open the live demo](https://solar.adityabal.com/p/380015) for pincode 380015 in Ahmedabad.

The demo runs on open building data alone. Google's Solar, Geocoding and Places APIs are wired into the pipeline but switched off here, so usable area is estimated as half of each footprint, the pincode boundary is an approximate rectangle, and the booking form is disabled so no personal details are collected. The [campaign dashboard](https://solar.adityabal.com/campaigns/380015) and postcard downloads work.

## Results

- One scan of pincode 380015 read 2,07,817 building outlines and ranked the top 50 in 58 seconds, without downloading the 64 GB source file.
- A repeat search of a scanned pincode makes zero paid API calls; the stored result is served instead.
- The pipeline and app are covered by 40 automated tests, including the savings model's worked example: a 300 sq ft home roof gives a 3 kW system, about 4,200 units and ₹29,400 a year, ₹78,000 subsidy and a payback of about 3 years.

> **TODO (Aditya):** Add the measured cost per scan and the accuracy check against Google Maps once the Google APIs are switched on.

## Learnings

- **Check the legal route before the technical one.** The contact-data question decided the whole outreach design, and settling it first saved building a feature that could never ship.
- **Read only what you need.** A bounding-box filter on a remote GeoParquet file turned a 64 GB download into a minute of reading.
- **Postal mail has no API here.** No India Post or Indian print-and-post API turned up, so posting stays a manual hand-off that the dashboard records, behind a switch that stays off until a real installer backs the campaign.
- **A demo should be honest about its gaps.** Labelling estimated roofs and approximate boundaries on screen costs nothing and keeps trust when someone checks a number.
