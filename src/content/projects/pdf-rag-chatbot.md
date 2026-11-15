---
title: "PDF RAG Chatbot"
slug: "pdf-rag-chatbot"
shortSlug: "rag"
tagline: "Answers grounded in the source, with citations and an honest \"I don't know\"."
type: "ai"
status: "live"
year: "2026"
role: "Personal project"
stack: ["Cloudflare Workers AI", "Vectorize", "Llama 3.3 70B", "bge-base-en-v1.5", "Cloudflare D1", "Python", "Streamlit", "Claude API", "ChromaDB", "sentence-transformers"]
metrics:
  - value: "Top 5"
    label: "chunks retrieved per question"
  - value: "0.45"
    label: "minimum relevance score before an answer is flagged"
demoUrl: "/demos/pdf-rag"
repoUrl: "https://github.com/addityabbal/rag-pdf-chatbot"
order: 2
featured: true
---

## Overview

A retrieval-augmented chatbot that answers questions grounded in a source document, with citations and a built-in confidence guardrail against hallucination. Built to demonstrate applied AI product thinking, not just API integration.

There are two versions. The open-source project on GitHub lets you upload your own PDFs. The live demo on this site answers questions about one fixed document.

## Problem

"Chat with your PDF" demos are everywhere, and most of them share the same failure mode: they answer confidently even when the source document does not contain the answer, and they do not tell you where an answer came from. A chatbot nobody can verify is not a product, it is a toy. This project treats those two failure modes as the actual problem to solve, not an afterthought.

## Approach

- **Citations are mandatory, not optional.** The system prompt requires every claim to cite its source. Answers that cannot be verified against the document are not trustworthy enough to ship, even for a demo.
- **A guardrail against hallucination.** The retriever flags when the top retrieved chunk's relevance score falls below a threshold, and the interface tells the user instead of hiding it. An honest "I don't know" beats a fluent wrong answer.
- **Hand-rolled pipeline instead of a framework.** Every stage (chunking, embedding, retrieval, prompting) is plain code that can be explained line by line.
- **Retrieval evaluation is separate from answer evaluation.** The open-source version includes a hit-rate@k harness: did the right page show up in the top-k retrieved chunks? A low hit rate means fix chunking or embeddings; a high hit rate with bad answers means fix the prompt.

## Architecture

### Live demo on this site

- **Knowledge base:** one fixed study guide, chunked (1,000 characters with 150 overlap) and embedded ahead of time. Visitors ask questions; they never upload files, so there is no upload surface to secure.
- **Retrieval:** the question is embedded with `bge-base-en-v1.5` on Cloudflare Workers AI, the top 5 chunks are fetched from a Cloudflare Vectorize index, and their text is read from Cloudflare D1.
- **Generation:** Llama 3.3 70B on Workers AI, with a strict grounded-answer prompt that cites the section each claim came from. The answer streams back with its sources and a confidence flag.
- **Protection:** origin check, per-IP rate limit, Cloudflare Turnstile human check, and a per-day request cap with a kill switch.

### Open-source version on GitHub

- **Ingest:** text extracted per page with pypdf, split into overlapping chunks (800 characters with 150 overlap).
- **Embeddings:** MiniLM sentence embeddings, run locally. Zero cost, no rate limits, works offline.
- **Vector store:** Chroma, local and persistent.
- **Generation:** Claude API with a grounded-answer prompt and page-level citations, in a Streamlit interface.

## Demo

[Try the live demo](/demos/pdf-rag). It asks for a quick human check before the AI runs.

## Results

> **TODO (Aditya):** Add measured results, for example hit-rate@k from the evaluation harness, and what the confidence guardrail caught.

## Learnings

What I would change for a production version:

- Swap local embeddings for a stronger hosted model once query volume justifies the cost, and re-run the evaluation before and after to quantify the lift.
- Add an LLM-as-judge pass over generated answers (faithfulness and relevance), not just retrieval hit rate.
- Move to a hosted vector database with multi-tenant document namespaces.
- Add OCR fallback for scanned PDFs with no extractable text layer.

> **TODO (Aditya):** Add what you learned porting this to Cloudflare Workers AI and Vectorize for the live demo.
