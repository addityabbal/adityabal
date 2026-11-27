// PDF RAG Chatbot — live demo build for adityabal.com/demos/pdf-rag
// Source: https://github.com/addityabbal/rag-pdf-chatbot (Streamlit + local PDF uploads).
// This demo answers questions grounded in one fixed, precomputed knowledge base
// (a study guide Aditya wrote himself — data/rag/vedas-geeta-study-guide.md) instead
// of accepting uploads, so there's no upload surface to secure. Retrieval (Vectorize)
// and generation (Llama 3.3 70B) both run on Cloudflare Workers AI via /api/rag.

const API_URL = '/api/rag'
const SITE_KEY = document.getElementById('app')?.dataset.sitekey || ''

const SUGGESTIONS = [
  'What does Osho say about suppressing the senses?',
  'How do the four Vedas divide up?',
  'What is the Geeta’s teaching on action without attachment to fruit?',
  'What does the guide say about Om and the sacred word?',
]

let messages = [] // {role, text, sources?, confident?}
let sending = false

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

// ── Human check (Cloudflare Turnstile) ───────────────────────────────────────
let widgetId = null

function waitForTurnstile(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      if (window.turnstile) return resolve(window.turnstile)
      if (Date.now() - start > timeoutMs) return reject(new Error('captcha_load_failed'))
      setTimeout(tick, 100)
    }
    tick()
  })
}

async function getTurnstileToken() {
  const turnstile = await waitForTurnstile()
  const box = document.getElementById('captcha-box')
  const slot = document.getElementById('captcha-slot')
  return new Promise((resolve, reject) => {
    const close = (fn, arg) => {
      box.hidden = true
      if (widgetId !== null) { turnstile.remove(widgetId); widgetId = null }
      fn(arg)
    }
    document.getElementById('captcha-cancel').onclick = () => close(reject, new Error('captcha_cancelled'))
    if (widgetId !== null) { turnstile.remove(widgetId); widgetId = null }
    box.hidden = false
    widgetId = turnstile.render(slot, {
      sitekey: SITE_KEY,
      action: 'pdf-rag',
      callback: token => close(resolve, token),
      'error-callback': () => close(reject, new Error('captcha_error')),
      'expired-callback': () => close(reject, new Error('captcha_expired')),
    })
  })
}

function callApi(question, token) {
  return fetch(API_URL, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(token ? { question, token } : { question }),
  })
}

const NOTICES = {
  rate_limited: 'Too many requests — try again in a minute.',
  cap_reached: "Today's free quota for this demo is used up. Come back tomorrow.",
  disabled: 'This demo is paused right now.',
  retrieval_unavailable: 'The knowledge base is unavailable right now. Try again shortly.',
  captcha: "Human check didn't complete — try again.",
  generic: 'Something went wrong. Try again shortly.',
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function render() {
  const log = document.getElementById('chat-log')
  log.innerHTML = messages.map((m, i) => {
    if (m.role === 'user') {
      return `<div class="msg user"><div class="bubble">${esc(m.text)}</div></div>`
    }
    const sourcesId = `src-${i}`
    const confidenceNote = m.confident === false
      ? `<div class="confidence-note">Low-confidence match in the source material — treat this answer with some skepticism.</div>`
      : ''
    const sourcesHtml = (m.sources && m.sources.length)
      ? `<button class="sources-toggle" data-toggle="${sourcesId}">Sources (${m.sources.length})</button>
         <div class="sources-list" id="${sourcesId}">
           ${m.sources.map(s => `<div>${esc(s.heading)} — relevance ${s.score.toFixed(2)}</div>`).join('')}
         </div>`
      : ''
    const bubble = m.pending
      ? `<div class="typing-dots"><span></span><span></span><span></span></div>`
      : `<div class="bubble">${esc(m.text).replace('[[unavailable]]', '') || '…'}</div>`
    return `<div class="msg assistant">${confidenceNote}${bubble}${sourcesHtml}</div>`
  }).join('')
  log.scrollTop = log.scrollHeight

  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.toggle)?.classList.toggle('open')
    })
  })

  const input = document.getElementById('question-input')
  const sendBtn = document.getElementById('send-btn')
  if (input) input.disabled = sending
  if (sendBtn) sendBtn.disabled = sending
}

function renderShell() {
  document.getElementById('app').innerHTML = `
    <header>
      <div>
        <a class="back-link" href="/projects/pdf-rag-chatbot">← Aditya H Bal · Projects</a>
        <div class="brand"><h1>📄 PDF RAG Chatbot</h1><p>Ask questions, grounded in one source — with citations</p></div>
      </div>
    </header>

    <div class="source-card">
      Knowledge base: <strong>"The Vedas and the Geeta: A Synthesis and Study Guide"</strong> (a study guide Aditya wrote himself). This demo answers only from that document — no uploads, so answers are reproducible and the citations are checkable.
    </div>

    <div class="suggestions" id="suggestions">
      ${SUGGESTIONS.map(s => `<button class="suggestion-chip" data-cta="rag.chip" data-q="${esc(s)}">${esc(s)}</button>`).join('')}
    </div>

    <div class="chat-log" id="chat-log"></div>

    <form class="composer" id="composer">
      <input id="question-input" type="text" placeholder="Ask a question about the study guide…" maxlength="400" autocomplete="off" />
      <button id="send-btn" type="submit">Ask</button>
    </form>
    <p class="disclaimer">Answers come from an AI model and may be imperfect — check the cited sections yourself.</p>
  `

  document.getElementById('composer').addEventListener('submit', e => {
    e.preventDefault()
    const input = document.getElementById('question-input')
    const q = input.value.trim()
    if (!q) return
    input.value = ''
    // Analytics (public/a.js): input type only, never the question text.
    window.abTrack?.('demo_query', { target: 'pdf-rag', detail: 'typed' })
    ask(q)
  })
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      window.abTrack?.('demo_query', { target: 'pdf-rag', detail: 'chip' })
      ask(chip.dataset.q)
    })
  })
}

// ── Ask flow ──────────────────────────────────────────────────────────────────
async function ask(question) {
  if (sending || !question) return
  sending = true
  messages.push({ role: 'user', text: question })
  const assistantMsg = { role: 'assistant', text: '', pending: true }
  messages.push(assistantMsg)
  render()

  try {
    let res = await callApi(question)
    if (res.status === 403 && (await res.clone().json().catch(() => ({}))).error === 'captcha_required') {
      let token
      try { token = await getTurnstileToken() }
      catch {
        assistantMsg.pending = false
        assistantMsg.text = NOTICES.captcha
        sending = false
        return render()
      }
      res = await callApi(question, token)
    }

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))).error
      assistantMsg.pending = false
      assistantMsg.text = NOTICES[err] || NOTICES.generic
      sending = false
      return render()
    }

    assistantMsg.pending = false
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        let evt
        try { evt = JSON.parse(line) } catch { continue }
        if (evt.type === 'sources') {
          assistantMsg.sources = evt.chunks
          assistantMsg.confident = evt.confident
        } else if (evt.type === 'text') {
          assistantMsg.text += evt.text
        }
        render()
      }
    }
    if (!assistantMsg.text) assistantMsg.text = "I couldn't generate an answer. Try rephrasing the question."
  } catch {
    assistantMsg.pending = false
    assistantMsg.text = NOTICES.generic
  }
  sending = false
  render()
}

renderShell()
render()
