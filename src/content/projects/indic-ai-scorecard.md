---
title: "Indic AI Scorecard"
slug: "indic-ai-scorecard"
shortSlug: "scorecard"
tagline: "Which AI model should you pick for an Indian-language feature, at what cost? Evidence, not vibes."
type: "ai"
status: "live"
year: "2026"
role: "Personal project"
stack: ["Python", "OpenAI-compatible clients", "Cloudflare Workers AI", "AI-as-judge", "Bootstrap statistics", "GitHub Actions", "Cloudflare Workers static assets"]
metrics:
  - value: "6"
    label: "models compared on the same 30 Hinglish tasks"
  - value: "4×"
    label: "cheaper: the model statistically tied for first"
  - value: "33%"
    label: "of one model's Hinglish replies kept the user's script"
demoUrl: "https://scorecard.adityabal.com"
repoUrl: "https://github.com/addityabbal/indic-ai-scorecard"
order: 0.5
featured: true
---

## Overview

An open, reproducible scorecard that answers one product question: which AI model should a builder pick for an Indian-language feature, and at what cost? It tests models on the messy things real Indian users send, such as code-mixed Hinglish, Hindi typed in English letters and WhatsApp-style questions about government schemes, and puts quality, cost per 1,000 answers and response time side by side.

The first published run is a Hinglish pilot: 30 test cases across six real tasks, six models from five makers, and a separate AI judge. The full plan is 300 cases across Hindi, Marathi, Tamil, Bengali and Hinglish, re-run every month.

## Problem

Builders in India pick models from English benchmarks, then find out in production that their users' Hinglish, romanised Tamil or WhatsApp-style messages break things. Academic Indic benchmarks test knowledge and translation; they don't test whether a model answers a Hinglish support message in Hinglish, pulls the right amount out of a shopkeeper's ledger note, or admits it doesn't know a scheme's next payment date. And almost none show what a model costs.

## Approach

- **Real tasks, not exam questions.** Six jobs an Indian product actually gives a model: a support reply, an answer from a scheme passage, pulling data out of a message into JSON, picking an intent label, rewriting a legal notice simply, and saying "I don't know" when the passage doesn't say.
- **Code checks before AI judges.** Half the tasks are scored by code: exact JSON fields, the right label, the key fact present, no invented numbers, a "don't know" phrase. Every free-text reply is also checked for answering in the user's own script.
- **A judge that is kept honest.** Open answers are graded 1–5 by a separate model, blind to which model wrote them and in random order. The judge is shown but never ranked, and its scores will be checked against human ratings.
- **Cost next to quality.** Every call records its tokens or Workers AI neurons, so the leaderboard shows what 1,000 answers would cost on each model's paid plan.
- **Honest uncertainty.** Scores carry 95% bootstrap ranges; overlapping ranges are reported as ties.

## Architecture

- **Test set:** JSONL cases with a schema and a validator that fails on duplicates, missing data, or a hidden-set case leaking into results. Public cases are CC BY 4.0.
- **Harness (Python):** one OpenAI-compatible client covers Groq, Google AI Studio, Sarvam, OpenRouter and Cloudflare Workers AI. Per-model pacing, retry on rate limits and capacity errors, a neuron budget per run, and a resumable answer cache, so a run that hits a free-tier daily limit carries on the next night without paying for any call twice.
- **Scoring:** code checks, the blind judge, a roll-up where every task counts equally, bootstrap ranges and judge-versus-human calibration. The headline sentence is written by code from the data, never by AI.
- **Leaderboard:** a static page (no framework) with a quality-against-cost chart, a sortable table, a failure gallery and an answer explorer, served from Cloudflare. GitHub Actions re-runs it monthly.

## Demo

[Open the leaderboard](https://scorecard.adityabal.com). Start with the quality-against-cost chart, then the failure gallery, then pick any test case in the answer explorer to read every model's answer side by side with its checks and the judge's reason.

## Results

From the Hinglish pilot (November 2026), on Cloudflare Workers AI:

- **Two models tied for first:** Qwen 3.8 27B (99) and Llama 3.3 70B (98). Llama costs about $0.22 per 1,000 answers against $0.93 for Qwen, roughly 4× less, and answered faster.
- **Script drift is the most common product failure.** gpt-oss-20b kept the user's Roman script in only 33% of free-text replies, often switching to Devanagari; Mistral Small 3.1 managed 65%.
- **Even a correct answer can be the wrong product.** Llama 4 Scout and gpt-oss-20b said "I don't know" correctly every time it was needed, but in Devanagari (मुझे नहीं पता) to a user who wrote in Roman script.
- **Wrong numbers still happen with the passage in front of the model.** Mistral Small 3.1 told a user the 3 kW solar subsidy is ₹72,000; the passage says ₹78,000.
- **Reasoning models can run out of room.** Three answers came back empty because the model spent all 1,500 tokens thinking.
- **Model churn is real.** Two of the planned models were deprecated on Workers AI the day the pilot ran.

> **TODO (Aditya):** Review the 30 Hinglish cases, hand-score answers for judge calibration, and add Groq, Google and Sarvam (the India-built model) results.

## Learnings

- **Read the answers before trusting the checks.** Reading every flagged answer found five checker rules failing correct replies: working such as 2 × ₹30,000 = ₹60,000 called "invented", "5 लाख" not matching "5 lakh", "Sunita Bhabhi" called a wrong name, and Devanagari "I don't know" not counted as a refusal. One of my own test cases was wrong too. Fixing them moved one model from 6th to 3rd, which is exactly why the method and its corrections are published.
- **A judge needs the same scrutiny as the models.** The pilot judge sometimes ran out of tokens mid-grade; scores are this high partly because the tasks are a pilot and the judge isn't calibrated yet, which the site says.
- **Free tiers shape the method.** A neuron budget, caching and resume turn a week of nightly runs into ₹0, and stop one project from starving the other live demos on the same account.
- **This feeds the other projects.** The scorecard is how the Hindi summaries in [Solar Rooftop Finder](/projects/solar-rooftop-finder) should pick their model: from a measured result instead of a guess.
