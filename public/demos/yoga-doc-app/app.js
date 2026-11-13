// Yoga-Doc — live demo build for adityabal.com/demos/yoga-doc
// Source: https://github.com/addityabbal/Yoga-Doc (src/main.js), adapted so AI poses come from
// the server proxy at /api/yoga (Turnstile human check + rate limits) instead of a
// visitor-supplied API key. Model output is HTML-escaped before rendering.

const ASSET_BASE = '/demos/yoga-doc-app'
const API_URL = '/api/yoga'
const SITE_KEY = document.getElementById('app')?.dataset.sitekey || ''

// ── Zone definitions ──────────────────────────────────────────────────────────
const ZONES = {
  head:         'Head / Jaw',
  neck:         'Neck',
  shoulder:     'Shoulders',
  chest:        'Chest',
  'upper-back': 'Upper back',
  core:         'Core / Abdomen',
  'lower-back': 'Lower back',
  hip:          'Hips',
  thigh:        'Thighs',
  knee:         'Knees',
  calf:         'Calves',
  foot:         'Feet / Ankles',
  arm:          'Arms / Elbows',
  wrist:        'Wrists / Hands',
}

const AREA_TO_ZONE = {
  Head: 'head', Forehead: 'head',
  Neck: 'neck',
  Shoulder: 'shoulder',
  Chest: 'chest',
  Back: 'upper-back',
  Belly: 'core',
  'Lower-Abdominal': 'lower-back',
  Hip: 'hip',
  Thigh: 'thigh',
  Knee: 'knee',
  Leg: 'calf',
  Foot: 'foot',
  Arm: 'arm',
  Hand: 'wrist',
}

const SHORTCUT_ZONES = ['neck', 'shoulder', 'upper-back', 'lower-back', 'hip', 'knee']

const MAP_AREAS = [
  { title: 'Head',            shape: 'poly',   coords: '708,44,751,46,789,46,771,21,744,13,717,25' },
  { title: 'Head',            shape: 'circle', coords: '289,55,40' },
  { title: 'Neck',            shape: 'rect',   coords: '719,146,773,183' },
  { title: 'Neck',            shape: 'rect',   coords: '262,109,315,152' },
  { title: 'Shoulder',        shape: 'poly',   coords: '610,216,628,177,660,165,707,146,709,171,687,183,655,203,650,218' },
  { title: 'Shoulder',        shape: 'poly',   coords: '868,183,876,215,843,218,818,188,777,170,783,149,848,166' },
  { title: 'Shoulder',        shape: 'poly',   coords: '177,175,196,162,252,148,259,173' },
  { title: 'Shoulder',        shape: 'poly',   coords: '324,140,318,161,365,173,386,197,411,181' },
  { title: 'Chest',           shape: 'rect',   coords: '662,202,829,279' },
  { title: 'Back',            shape: 'rect',   coords: '218,175,364,406' },
  { title: 'Belly',           shape: 'rect',   coords: '664,296,818,437' },
  { title: 'Lower-Abdominal', shape: 'poly',   coords: '699,441,796,439,786,460,762,497,721,497,710,471' },
  { title: 'Hip',             shape: 'circle', coords: '258,489,45' },
  { title: 'Hip',             shape: 'circle', coords: '336,489,46' },
  { title: 'Thigh',           shape: 'rect',   coords: '648,498,837,662' },
  { title: 'Knee',            shape: 'circle', coords: '700,707,22' },
  { title: 'Knee',            shape: 'circle', coords: '790,707,25' },
  { title: 'Leg',             shape: 'rect',   coords: '743,730,670,913' },
  { title: 'Leg',             shape: 'rect',   coords: '762,732,823,913' },
  { title: 'Leg',             shape: 'rect',   coords: '200,533,294,972' },
  { title: 'Leg',             shape: 'rect',   coords: '300,533,383,973' },
  { title: 'Arm',             shape: 'poly',   coords: '615,218,655,221,657,260,649,315,643,369,626,416,601,460,575,452' },
  { title: 'Arm',             shape: 'poly',   coords: '839,220,879,217,875,240,878,270,891,368,893,449,863,453,832,366,831,270' },
  { title: 'Hand',            shape: 'poly',   coords: '172,179,204,198,202,251,201,306,199,350,174,459,166,551,133,563,108,507,143,453,158,204' },
  { title: 'Hand',            shape: 'poly',   coords: '384,204,411,182,427,254,436,314,450,404,465,464,490,508,483,555,471,566,459,563,446,546,412,418,393,368,380,282' },
  { title: 'Foot',            shape: 'rect',   coords: '692,920,739,957' },
  { title: 'Foot',            shape: 'rect',   coords: '769,922,821,958' },
]

// ── Sample poses (fallback when the live AI is unavailable) ──────────────────
const DEMO_POSES = {
  'lower-back': [
    { name: 'Cat-Cow', how: 'Start on hands and knees. Inhale and drop your belly toward the floor, lifting your head and tailbone (Cow). Exhale and round your spine toward the ceiling, tucking your chin and pelvis (Cat). Repeat 8–10 times.', breath: 'Let your breath lead — inhale for Cow, exhale for Cat.' },
    { name: 'Child\'s Pose', how: 'Kneel on the floor, touch your big toes together, and sit back on your heels. Extend your arms forward and lower your forehead to the mat. Hold for 30–60 seconds, breathing deeply into your back.', breath: 'Breathe into the lower back — feel it expand on each inhale.' },
    { name: 'Supine Twist', how: 'Lie on your back. Draw your right knee to your chest, then guide it across your body to the left. Extend your right arm out to the side. Hold 30–45 seconds, then switch sides.', breath: 'Exhale deeper into the twist with each breath out.' },
  ],
  neck: [
    { name: 'Neck Rolls', how: 'Sit tall. Drop your right ear to your right shoulder and hold 5 breaths. Slowly roll your chin to your chest, then bring your left ear to your left shoulder. Avoid rolling back — keep it a half circle.', breath: 'Slow, steady breaths. Don\'t hold your breath through the stretch.' },
    { name: 'Thread the Needle', how: 'Start on hands and knees. Slide your right arm under your left arm, palm up, until your right shoulder and ear rest on the mat. Hold 30–45 seconds, then switch.', breath: 'Inhale to create length, exhale to melt deeper into the stretch.' },
    { name: 'Seated Forward Fold', how: 'Sit with legs extended. Inhale to lengthen your spine, then hinge forward from the hips. Let your head hang heavy, releasing neck tension. Hold 45–60 seconds.', breath: 'With each exhale, release a little more tension from the neck and shoulders.' },
  ],
  shoulder: [
    { name: 'Eagle Arms', how: 'Extend arms forward at shoulder height. Cross right arm under left, bend both elbows, and try to press palms together. Lift elbows to shoulder height and hold 30 seconds, then switch sides.', breath: 'Breathe into the back of the shoulders — 4 counts in, 4 counts out.' },
    { name: 'Thread the Needle', how: 'On hands and knees, slide your right arm under your body, palm up, until your shoulder touches the mat. Stack your left hand under your shoulder or extend it forward. Hold 30–45 seconds each side.', breath: 'Let gravity do the work on the exhale.' },
    { name: 'Cow Face Arms', how: 'Raise your right arm overhead and bend the elbow, reaching your hand down your back. Bring your left arm behind your back and reach up. Try to clasp fingers or hold a strap. Hold 30 seconds each side.', breath: 'Keep breathing steadily — don\'t hold your breath through the tension.' },
  ],
  hip: [
    { name: 'Pigeon Pose', how: 'From downward dog, bring your right knee toward your right wrist and lower your shin to the mat. Extend your left leg back. Square your hips and fold forward over your front shin. Hold 60–90 seconds each side.', breath: 'Breathe into any resistance — long exhales help the hip release.' },
    { name: 'Butterfly / Bound Angle', how: 'Sit with the soles of your feet together. Hold your feet or ankles and gently press your knees toward the floor. Sit tall or fold forward from the hips. Hold 45–60 seconds.', breath: 'Inhale to lengthen, exhale to fold a little deeper.' },
    { name: 'Low Lunge (Anjaneyasana)', how: 'Step your right foot forward between your hands. Lower your left knee to the mat. Sink your hips forward and down, keeping your front knee over your ankle. Hold 30–45 seconds each side.', breath: 'Breathe into the front of the left hip — let it soften on each exhale.' },
  ],
  knee: [
    { name: 'Supported Hero Pose', how: 'Kneel with feet hip-width apart. Place a folded blanket or block between your feet if needed. Slowly sit back onto your heels or support. Hold 30–60 seconds — skip if there\'s sharp pain.', breath: 'Slow even breaths. Come out immediately if you feel any sharp sensation.' },
    { name: 'Reclined Hand-to-Big-Toe Pose', how: 'Lie on your back. Loop a strap around your right foot and extend your leg toward the ceiling. Keep the standing leg active. Hold 30–45 seconds each side.', breath: 'Inhale to lengthen the leg, exhale to gently draw it closer.' },
    { name: 'Chair Pose (Utkatasana)', how: 'Stand with feet hip-width apart. Inhale, raise your arms overhead. Exhale and sit back as if sitting on a chair, keeping weight in your heels. Hold 5 breaths. Strengthens the muscles that protect the knee.', breath: 'Steady, even breath throughout. Don\'t hold.' },
  ],
}

const GENERIC_POSES = [
  { name: 'Mountain Pose (Tadasana)', how: 'Stand with feet hip-width apart, arms at your sides. Press all four corners of each foot into the floor. Lift your chest, roll shoulders back and down. Hold for 10 slow breaths, feeling full-body alignment.', breath: 'Breathe naturally and evenly — feel each inhale lengthen your spine.' },
  { name: 'Seated Forward Fold', how: 'Sit with legs extended. Inhale to sit tall, then exhale and hinge forward from the hips, reaching for your feet or shins. Hold 45–60 seconds, letting gravity deepen the stretch gradually.', breath: 'With each exhale, soften a little more. No forcing.' },
  { name: 'Legs Up the Wall', how: 'Sit sideways next to a wall, then swing your legs up as you lie back. Your hips can be close to or touching the wall. Arms rest at your sides or on your belly. Hold 3–5 minutes.', breath: 'Completely relax your breath. Let the body restore.' },
]

// ── State ─────────────────────────────────────────────────────────────────────
let appView = 'home'   // 'home' | 'poses'
let selectedZone = null
let poses = []
let loadingPoses = false
let poseNotice = null  // shown when we fall back to sample poses
let streamText = ''
let streaming = false
let requestSeq = 0     // ignores responses from superseded requests

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

const HISTORY_KEY = 'yogadoc_history'

function loadHistory() {
  try {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY))
    return Array.isArray(h) ? h.filter(s => s && ZONES[s.zone]) : []
  } catch { return [] }
}
function saveSession(zoneId) {
  try {
    const h = loadHistory()
    h.unshift({ zone: zoneId, date: Date.now() })
    if (h.length > 30) h.splice(30)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h))
  } catch { /* storage blocked — history is optional */ }
}

function relativeDate(ts) {
  const d = Date.now() - Number(ts), m = Math.floor(d / 60000)
  if (!Number.isFinite(m)) return ''
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

// ── Image map rescaling ───────────────────────────────────────────────────────
function rescaleMap() {
  const img = document.getElementById('body-img')
  if (!img || !img.naturalWidth) return
  const ratio = img.clientWidth / img.naturalWidth
  document.querySelectorAll('#body-map area').forEach(area => {
    const orig = area.dataset.origCoords
    if (orig) area.coords = orig.split(',').map(v => Math.round(parseFloat(v) * ratio)).join(',')
  })
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
      action: 'yoga-doc',
      callback: token => close(resolve, token),
      'error-callback': () => close(reject, new Error('captcha_error')),
      'expired-callback': () => close(reject, new Error('captcha_expired')),
    })
  })
}

// ── Workers AI via server proxy ───────────────────────────────────────────────────
function parsePoses(text) {
  return text.split(/\n\s*\n/).map(block => {
    const lines = block.trim().split('\n')
    const name   = (lines.find(l => l.startsWith('POSE:'))   || '').replace('POSE:', '').trim()
    const how    = (lines.find(l => l.startsWith('HOW:'))    || '').replace('HOW:', '').trim()
    const breath = (lines.find(l => l.startsWith('BREATH:')) || '').replace('BREATH:', '').trim()
    return { name, how, breath }
  }).filter(p => p.name)
}

function callApi(zoneId, token) {
  return fetch(API_URL, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(token ? { zone: zoneId, token } : { zone: zoneId }),
  })
}

const NOTICES = {
  rate_limited: 'Easy there — too many requests. Showing sample poses; try again in a minute.',
  cap_reached:  'Today\'s free AI quota is used up. Showing sample poses — come back tomorrow.',
  disabled:     'Live AI is paused right now. Showing sample poses.',
  captcha:      'Human check didn\'t complete. Showing sample poses — tap "Try again" to retry.',
  generic:      'Live AI is unavailable right now. Showing sample poses.',
}

function useFallback(zoneId, noticeKey) {
  poses = DEMO_POSES[zoneId] || GENERIC_POSES
  poseNotice = NOTICES[noticeKey] || NOTICES.generic
}

async function fetchPoses(zoneId) {
  const seq = ++requestSeq
  loadingPoses = true
  streaming = false
  streamText = ''
  poses = []
  poseNotice = null
  renderPosesPage()

  try {
    let res = await callApi(zoneId)
    if (res.status === 403 && (await res.clone().json().catch(() => ({}))).error === 'captcha_required') {
      let token
      try { token = await getTurnstileToken() }
      catch { if (seq === requestSeq) { useFallback(zoneId, 'captcha'); finish() } return }
      if (seq !== requestSeq) return
      res = await callApi(zoneId, token)
    }
    if (seq !== requestSeq) return

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))).error
      useFallback(zoneId, err === 'captcha_required' ? 'captcha' : err)
      return finish()
    }

    streaming = true
    renderPosesPage()
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (seq !== requestSeq) { reader.cancel(); return }
      streamText += decoder.decode(value, { stream: true })
      updateStreamingCard()
    }

    const unavailable = streamText.includes('[[unavailable]]')
    poses = unavailable ? [] : parsePoses(streamText)
    if (!poses.length) useFallback(zoneId, 'generic')
  } catch {
    if (seq !== requestSeq) return
    useFallback(zoneId, 'generic')
  }
  finish()

  function finish() {
    if (seq !== requestSeq) return
    streaming = false
    loadingPoses = false
    renderPosesPage()
  }
}

function updateStreamingCard() {
  const el = document.getElementById('stream-card')
  if (el) el.querySelector('pre').textContent = streamText.replace('[[unavailable]]', '') + '▌'
}

// ── Views ─────────────────────────────────────────────────────────────────────
function renderApp() {
  if (appView === 'poses') renderPosesPage()
  else renderHomePage()
}

const DISCLAIMER = `<p class="disclaimer">Not medical advice. Go gently and stop if you feel sharp pain — see a doctor for persistent or severe pain.</p>`

function renderHomePage() {
  const mapAreas = MAP_AREAS.map(a => {
    const zoneId = AREA_TO_ZONE[a.title]
    if (!zoneId) return ''
    return `<area data-zone="${zoneId}" data-orig-coords="${a.coords}" shape="${a.shape}" coords="${a.coords}" alt="${a.title}" title="${a.title}" href="#">`
  }).join('\n')

  const tags = SHORTCUT_ZONES.map(id => `
    <button class="zone-tag" data-zone="${id}">${ZONES[id]}</button>`).join('')

  const history = loadHistory()
  const historyHTML = history.length
    ? history.slice(0, 5).map(s => `
        <div class="history-item" data-zone="${esc(s.zone)}">
          <div class="history-dot"></div>
          <span class="zone-name">${esc(ZONES[s.zone])}</span>
          <span class="date">${esc(relativeDate(s.date))}</span>
        </div>`).join('')
    : `<div class="history-empty">No sessions yet</div>`

  document.getElementById('app').innerHTML = `
    <header>
      <div class="brand">
        <a class="portfolio-back" href="/projects/yoga-doc">← Aditya H Bal · Projects</a>
        <h1>🧘 Yoga-Doc</h1><p>Tap where it hurts</p>
      </div>
      <button class="share-btn" id="share-btn">⤴ Share</button>
    </header>

    <div class="body-map-card">
      <p class="hint">Tap a body zone to get yoga poses</p>
      <div class="body-img-wrap">
        <img id="body-img" src="${ASSET_BASE}/humanbody.jpg" alt="Human body map" usemap="#body-map">
        <map name="body-map" id="body-map">${mapAreas}</map>
      </div>
      <div class="zone-tags">${tags}</div>
    </div>

    <div class="history-card">
      <h2>Pain history <span>stored in your browser</span></h2>
      ${historyHTML}
    </div>
    ${DISCLAIMER}
  `

  bindHomeEvents()
  const img = document.getElementById('body-img')
  if (img.complete) rescaleMap()
  else img.addEventListener('load', rescaleMap)
}

function bindHomeEvents() {
  document.querySelectorAll('#body-map area').forEach(area =>
    area.addEventListener('click', e => { e.preventDefault(); goToPoses(area.dataset.zone) }))
  document.querySelectorAll('.zone-tag').forEach(t =>
    t.addEventListener('click', () => goToPoses(t.dataset.zone)))
  document.querySelectorAll('.history-item[data-zone]').forEach(item =>
    item.addEventListener('click', () => goToPoses(item.dataset.zone)))
  document.getElementById('share-btn')?.addEventListener('click', copyLink)
}

function renderPosesPage() {
  let posesHTML
  if (streaming) {
    posesHTML = `
      <div class="pose-card streaming" id="stream-card">
        <pre>${esc(streamText.replace('[[unavailable]]', ''))}▌</pre>
      </div>`
  } else if (loadingPoses) {
    posesHTML = `
      <div class="poses-loading">
        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
      </div>`
  } else {
    posesHTML = poses.map((p, i) => `
      <div class="pose-card" style="animation-delay:${i * 0.08}s">
        <div class="pose-number">${i + 1}</div>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.how)}</p>
        <div class="pose-breath">🌬 ${esc(p.breath)}</div>
      </div>`).join('')
  }

  const notice = poseNotice ? `<div class="demo-notice">${esc(poseNotice)}</div>` : ''
  const label = esc(ZONES[selectedZone] || '')

  document.getElementById('app').innerHTML = `
    <header class="poses-header-bar">
      <button class="back-btn" id="back-btn">← Back</button>
      <div class="header-zone-label">${label}</div>
      <button class="share-btn small" id="share-btn">⤴</button>
    </header>

    <div class="poses-page">
      <div class="poses-hero">
        <div class="zone-badge">${label}</div>
        <h2>Yoga for ${label}</h2>
        <p class="poses-subhead">3 poses to relieve this pain</p>
      </div>

      ${notice}

      <div class="poses-list" id="poses-list">
        ${posesHTML}
      </div>

      ${!streaming && !loadingPoses ? `<button class="retry-btn" id="retry-btn">↻ Try again</button>` : ''}
      ${DISCLAIMER}
    </div>
  `

  bindPosesEvents()
}

function bindPosesEvents() {
  document.getElementById('back-btn')?.addEventListener('click', () => {
    requestSeq++
    appView = 'home'
    history.replaceState(null, '', location.pathname)
    renderApp()
  })
  document.getElementById('retry-btn')?.addEventListener('click', () => fetchPoses(selectedZone))
  document.getElementById('share-btn')?.addEventListener('click', copyLink)
}

// ── Navigation ────────────────────────────────────────────────────────────────
function goToPoses(zoneId) {
  if (!ZONES[zoneId]) return
  selectedZone = zoneId
  appView = 'poses'
  saveSession(zoneId)
  fetchPoses(zoneId)
}

function copyLink() {
  const url = selectedZone && appView === 'poses'
    ? `${location.origin}${location.pathname}?zone=${encodeURIComponent(selectedZone)}`
    : `${location.origin}${location.pathname}`
  navigator.clipboard?.writeText(url).then(() => {
    const btn = document.getElementById('share-btn')
    if (btn) { const old = btn.textContent; btn.textContent = '✓'; setTimeout(() => { btn.textContent = old }, 2000) }
  })
}

window.addEventListener('resize', rescaleMap)

// ── Deep link (?zone=neck) ────────────────────────────────────────────────────
const urlZone = new URLSearchParams(location.search).get('zone')
if (urlZone && ZONES[urlZone]) {
  selectedZone = urlZone
  appView = 'poses'
  fetchPoses(urlZone)
} else {
  renderApp()
}
