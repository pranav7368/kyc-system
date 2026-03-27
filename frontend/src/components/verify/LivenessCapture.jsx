/**
 * LivenessCapture v3 — Apple Face ID style active liveness.
 *
 * UI:  Bright white outside oval (not dark), camera only inside oval.
 * Detection:
 *   FORWARD  — YCbCr skin-tone 7×7 grid inside oval
 *   LEFT     — right-quadrant skin dominance (raw frame)
 *   RIGHT    — left-quadrant skin dominance
 *   BLINK    — dual eye-zone brightness drop ≥ 18 %, immediate advance
 *
 * Fixes vs v2:
 *   • CORS: uses relative URL through Vite proxy (no hardcoded localhost)
 *   • Blink: immediate advance when detected, 18 % threshold, dual eye zones
 *   • Outside oval: bright white (Apple FaceID style)
 *   • Eye sampling: two separate eye patches, not one thin band
 */
import { useRef, useState, useEffect, useCallback } from 'react'
import Webcam from 'react-webcam'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, RefreshCw } from 'lucide-react'

// ---------------------------------------------------------------------------
// Challenge config
// ---------------------------------------------------------------------------
const CFG = {
  FORWARD: { label: 'Look straight at camera', sub: 'Center your face in the oval', emoji: '🎯', color: '#059669', holdMs: 2000 },
  LEFT:    { label: 'Turn your head LEFT',      sub: 'Slowly turn to your left',     emoji: '👈', color: '#2563EB', holdMs: 1800 },
  RIGHT:   { label: 'Turn your head RIGHT',     sub: 'Slowly turn to your right',    emoji: '👉', color: '#7C3AED', holdMs: 1800 },
  BLINK:   { label: 'Blink your eyes',          sub: 'Blink naturally once or twice',emoji: '😉', color: '#DB2777', holdMs: 0   },
}

// SVG viewBox — fixed units, no % transform bugs
const VB_W = 200, VB_H = 270
const OX = 100, OY = 130       // oval centre
const ORX = 58,  ORY = 80      // oval radii
const RING_R = 92              // progress ring radius
const CIRC = 2 * Math.PI * RING_R  // ≈ 578

function shuffled(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function makeSequence() {
  return ['FORWARD', ...shuffled(['LEFT', 'RIGHT', 'BLINK'])]
}

// ---------------------------------------------------------------------------
// Frame analysis — skin grid + dual eye-zone brightness
// ---------------------------------------------------------------------------
function analyzeFrame(videoEl) {
  const empty = { skinRatio: 0, leftRatio: 0, rightRatio: 0, eyeBrightness: 128 }
  if (!videoEl || videoEl.readyState < 2) return empty
  try {
    const vw = videoEl.videoWidth  || 640
    const vh = videoEl.videoHeight || 480
    const cx = vw / 2, cy = vh / 2
    const rx = vw * 0.22, ry = vh * 0.30

    const cvs = document.createElement('canvas')
    cvs.width = vw; cvs.height = vh
    const ctx = cvs.getContext('2d')
    ctx.drawImage(videoEl, 0, 0, vw, vh)
    const { data } = ctx.getImageData(0, 0, vw, vh)
    const stride = vw * 4

    // 7×7 skin grid
    let total = 0, skin = 0, leftSkin = 0, rightSkin = 0, leftN = 0, rightN = 0
    for (let gi = -3; gi <= 3; gi++) {
      for (let gj = -3; gj <= 3; gj++) {
        const nx = gi / 3, ny = gj / 3
        if (nx * nx + ny * ny > 0.88) continue
        const px = Math.round(cx + nx * rx * 0.80)
        const py = Math.round(cy + ny * ry * 0.80)
        const idx = py * stride + px * 4
        if (idx < 0 || idx + 3 >= data.length) continue
        const r = data[idx], g = data[idx+1], b = data[idx+2]
        const Y  = 0.299*r + 0.587*g + 0.114*b
        const Cb = 128 - 0.168736*r - 0.331264*g + 0.5*b
        const Cr = 128 + 0.5*r - 0.418688*g - 0.081312*b
        const isSkin = Y > 40 && Cb > 75 && Cb < 130 && Cr > 130 && Cr < 176
        total++; if (isSkin) skin++
        if (nx <= 0) { leftN++;  if (isSkin) leftSkin++  }
        else         { rightN++; if (isSkin) rightSkin++ }
      }
    }
    const skinRatio  = total  > 0 ? skin      / total  : 0
    const leftRatio  = leftN  > 0 ? leftSkin  / leftN  : 0
    const rightRatio = rightN > 0 ? rightSkin / rightN : 0

    // Dual eye-zone brightness — left eye + right eye separately
    // Eyes sit ~28 % above oval centre; each eye is ~35 % of oval width
    const eyeY  = Math.round(cy - ry * 0.28)
    const eyeHH = Math.max(3, Math.round(ry * 0.10))   // zone half-height
    const eyeHW = Math.max(4, Math.round(rx * 0.28))   // zone half-width
    const lEyeX = Math.round(cx - rx * 0.38)           // left eye centre
    const rEyeX = Math.round(cx + rx * 0.38)           // right eye centre

    let eyeSum = 0, eyeN = 0
    for (const ex of [lEyeX, rEyeX]) {
      for (let dx = -eyeHW; dx <= eyeHW; dx++) {
        for (let dy = -eyeHH; dy <= eyeHH; dy++) {
          const px = ex + dx, py = eyeY + dy
          if (px < 0 || px >= vw || py < 0 || py >= vh) continue
          const idx = py * stride + px * 4
          eyeSum += (data[idx] + data[idx+1] + data[idx+2]) / 3
          eyeN++
        }
      }
    }
    const eyeBrightness = eyeN > 0 ? eyeSum / eyeN : 128
    return { skinRatio, leftRatio, rightRatio, eyeBrightness }
  } catch { return empty }
}

// ---------------------------------------------------------------------------
// Blink detector — 18 % drop from baseline in last portion of window
// ---------------------------------------------------------------------------
function detectBlink(history) {
  if (history.length < 8) return false
  const win = history.slice(-Math.min(35, history.length))
  const baseLen = Math.max(4, Math.floor(win.length * 0.65))
  const baseline = win.slice(0, baseLen)
  const avg = baseline.reduce((a, b) => a + b, 0) / baseline.length
  const minRecent = Math.min(...win.slice(baseLen))
  return minRecent < avg * 0.82   // 18 % drop = blink
}

// ---------------------------------------------------------------------------
// Challenge pass condition (non-blink; blink handled separately in rAF)
// ---------------------------------------------------------------------------
function challengePasses(key, { skinRatio, leftRatio, rightRatio }) {
  switch (key) {
    case 'FORWARD': return skinRatio > 0.22
    case 'LEFT':    return skinRatio > 0.12 && rightRatio > leftRatio  + 0.06
    case 'RIGHT':   return skinRatio > 0.12 && leftRatio  > rightRatio + 0.06
    default:        return skinRatio > 0.20
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function LivenessCapture({ onComplete }) {
  const webcamRef    = useRef(null)
  const rafRef       = useRef(null)
  const holdRef      = useRef(null)
  const blinkHist    = useRef([])
  const frames       = useRef([])

  const [sequence]      = useState(makeSequence)
  const [step, setStep] = useState(0)
  const [holdPct, setHoldPct]     = useState(0)
  const [faceIn, setFaceIn]       = useState(false)
  const [metrics, setMetrics]     = useState({ skinRatio: 0 })
  const [done, setDone]           = useState(false)
  const [flash, setFlash]         = useState(false)
  const [blinkReady, setBlinkReady] = useState(false)  // enough frames collected

  const key = done ? null : sequence[step]
  const cfg = key ? CFG[key] : null

  // snapshot helper
  const snapshot = useCallback(() => {
    const src = webcamRef.current?.getScreenshot()
    if (!src) return null
    setFlash(true); setTimeout(() => setFlash(false), 200)
    return src
  }, [])

  const toFile = (src, name) =>
    fetch(src).then(r => r.blob()).then(b => new File([b], name, { type: 'image/jpeg' }))

  // advance step
  const advance = useCallback(async () => {
    const frame = snapshot()
    if (frame) frames.current.push(frame)
    if (step + 1 >= sequence.length) {
      setDone(true)
      const fi  = sequence.indexOf('FORWARD')
      const src = frames.current[fi] ?? frames.current[0]
      const f   = await toFile(src, 'selfie.jpg')
      onComplete(f, { challenge_completed: true, frames_count: frames.current.length })
    } else {
      holdRef.current  = null
      blinkHist.current = []
      setHoldPct(0); setFaceIn(false); setBlinkReady(false)
      setStep(s => s + 1)
    }
  }, [step, sequence, snapshot, onComplete])

  // rAF detection loop
  useEffect(() => {
    if (done) return
    let alive = true
    const currentKey = sequence[step]
    const isBlink    = currentKey === 'BLINK'
    const holdMs     = CFG[currentKey]?.holdMs ?? 1800

    const tick = () => {
      if (!alive) return
      const video = webcamRef.current?.video
      if (!video) { rafRef.current = requestAnimationFrame(tick); return }

      const m = analyzeFrame(video)
      setMetrics(m)

      // Always track eye brightness (needed for blink even before BLINK step)
      blinkHist.current.push(m.eyeBrightness)
      if (blinkHist.current.length > 60) blinkHist.current.shift()

      // ── BLINK challenge: detect once, advance immediately ──────────
      if (isBlink) {
        const ready = blinkHist.current.length >= 12
        setBlinkReady(ready)
        if (ready && detectBlink(blinkHist.current)) {
          alive = false
          setHoldPct(100)
          advance()
          return
        }
        setFaceIn(m.skinRatio > 0.15)
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      // ── Other challenges: hold timer ───────────────────────────────
      const passes = challengePasses(currentKey, m)
      setFaceIn(passes)

      if (passes) {
        if (!holdRef.current) holdRef.current = Date.now()
        const pct = Math.min(100, ((Date.now() - holdRef.current) / holdMs) * 100)
        setHoldPct(pct)
        if (pct >= 100) { alive = false; advance(); return }
      } else {
        holdRef.current = null
        setHoldPct(0)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { alive = false; cancelAnimationFrame(rafRef.current) }
  }, [step, sequence, done, advance])

  const reset = () => {
    frames.current = []; holdRef.current = null; blinkHist.current = []
    setStep(0); setHoldPct(0); setFaceIn(false)
    setDone(false); setFlash(false); setBlinkReady(false)
    setMetrics({ skinRatio: 0 })
  }

  // colours
  const ovalStroke = done ? '#059669' : faceIn ? (cfg?.color ?? '#059669') : '#9CA3AF'
  const ringOffset = CIRC * (1 - holdPct / 100)
  const isBlink    = key === 'BLINK'
  const confPct    = Math.min(100, Math.round(metrics.skinRatio / 0.22 * 100))

  return (
    <div className="flex flex-col gap-0 select-none">

      {/* ── Camera area ───────────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden border border-gray-200"
        style={{ height: 360, background: '#F8FAFC' }}   /* light background outside oval */
      >
        {flash && <div className="absolute inset-0 bg-white/70 z-30 pointer-events-none" />}

        {/* Webcam — fills container, clipped to oval by the SVG above */}
        <Webcam
          ref={webcamRef}
          audio={false}
          mirrored
          screenshotFormat="image/jpeg"
          screenshotQuality={0.93}
          className="absolute inset-0 w-full h-full object-cover"
          videoConstraints={{ facingMode: 'user', width: 640, height: 480 }}
        />

        {/* SVG overlay — WHITE outside oval, transparent inside */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <mask id="lc3Mask">
              <rect width={VB_W} height={VB_H} fill="white" />
              <ellipse cx={OX} cy={OY} rx={ORX} ry={ORY} fill="black" />
            </mask>
          </defs>

          {/* Bright white surround — hides camera outside oval */}
          <rect width={VB_W} height={VB_H} fill="#F8FAFC" mask="url(#lc3Mask)" />

          {/* Subtle shadow ring outside oval for depth */}
          <ellipse cx={OX} cy={OY} rx={ORX+3} ry={ORY+3}
            fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="6" />

          {/* Glow behind oval when face detected */}
          {faceIn && !done && (
            <ellipse cx={OX} cy={OY} rx={ORX+2} ry={ORY+2}
              fill="none" stroke={cfg?.color} strokeWidth="8" opacity="0.12" />
          )}

          {/* Progress ring */}
          {holdPct > 0 && !done && !isBlink && (
            <circle cx={OX} cy={OY} r={RING_R}
              fill="none" stroke={cfg?.color} strokeWidth="3.5"
              strokeDasharray={CIRC} strokeDashoffset={ringOffset}
              strokeLinecap="round"
              style={{ transformOrigin: `${OX}px ${OY}px`, transform: 'rotate(-90deg)', transition: 'stroke-dashoffset 0.08s linear' }}
            />
          )}

          {/* Oval border */}
          <ellipse cx={OX} cy={OY} rx={ORX} ry={ORY}
            fill="none"
            stroke={ovalStroke}
            strokeWidth={faceIn || done ? 2.5 : 1.8}
            strokeDasharray={done ? 'none' : faceIn ? 'none' : '7 4'}
            style={{ transition: 'stroke 0.3s, stroke-width 0.2s' }}
          />

          {/* Corner tick marks */}
          {[
            [OX-ORX, OY-ORY,  1,0, 0,1],
            [OX+ORX, OY-ORY, -1,0, 0,1],
            [OX-ORX, OY+ORY,  1,0, 0,-1],
            [OX+ORX, OY+ORY, -1,0, 0,-1],
          ].map(([cx,cy,dxa,dya,dxb,dyb],i) => (
            <g key={i}>
              <line x1={cx} y1={cy} x2={cx+dxa*10} y2={cy+dya*10} stroke={ovalStroke} strokeWidth="2.2" strokeLinecap="round" style={{transition:'stroke 0.3s'}} />
              <line x1={cx} y1={cy} x2={cx+dxb*10} y2={cy+dyb*10} stroke={ovalStroke} strokeWidth="2.2" strokeLinecap="round" style={{transition:'stroke 0.3s'}} />
            </g>
          ))}

          {/* Direction arrows (LEFT / RIGHT) */}
          {!done && key === 'LEFT' && (
            <g opacity="0.8">
              <line x1={OX-18} y1={OY+28} x2={OX-42} y2={OY+28} stroke={cfg.color} strokeWidth="2.5" strokeLinecap="round"/>
              <line x1={OX-42} y1={OY+28} x2={OX-31} y2={OY+18} stroke={cfg.color} strokeWidth="2.5" strokeLinecap="round"/>
              <line x1={OX-42} y1={OY+28} x2={OX-31} y2={OY+38} stroke={cfg.color} strokeWidth="2.5" strokeLinecap="round"/>
            </g>
          )}
          {!done && key === 'RIGHT' && (
            <g opacity="0.8">
              <line x1={OX+18} y1={OY+28} x2={OX+42} y2={OY+28} stroke={cfg.color} strokeWidth="2.5" strokeLinecap="round"/>
              <line x1={OX+42} y1={OY+28} x2={OX+31} y2={OY+18} stroke={cfg.color} strokeWidth="2.5" strokeLinecap="round"/>
              <line x1={OX+42} y1={OY+28} x2={OX+31} y2={OY+38} stroke={cfg.color} strokeWidth="2.5" strokeLinecap="round"/>
            </g>
          )}

          {/* Blink icon */}
          {!done && isBlink && (
            <text x={OX} y={OY+40} textAnchor="middle" fontSize="24" opacity={blinkReady ? 0.9 : 0.4}>👁️</text>
          )}

          {/* Done check */}
          {done && (
            <g>
              <circle cx={OX} cy={OY} r={32} fill="rgba(5,150,105,0.15)" />
              <text x={OX} y={OY+9} textAnchor="middle" fontSize="28" fill="#059669">✓</text>
            </g>
          )}
        </svg>

        {/* ── Challenge badge — top of camera ────────────────────── */}
        {!done && (
          <AnimatePresence mode="wait">
            <motion.div key={step}
              initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
              exit={{ opacity:0, y:-8 }} transition={{ duration: 0.2 }}
              className="absolute top-3 left-0 right-0 flex justify-center z-10 pointer-events-none"
            >
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold shadow-md"
                style={{ background: `${cfg?.color}18`, color: cfg?.color, border: `1.5px solid ${cfg?.color}40` }}>
                <span>{cfg?.emoji}</span>
                {cfg?.label}
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Done overlay ───────────────────────────────────────── */}
        {done && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-20"
            style={{ background: 'rgba(248,250,252,0.6)' }}
          >
            <CheckCircle className="w-12 h-12 drop-shadow-sm" style={{ color: '#059669' }} />
            <p className="text-sm font-semibold mt-2 text-gray-800">Liveness Verified!</p>
            <p className="text-xs text-gray-500 mt-0.5">All {sequence.length} challenges passed</p>
          </motion.div>
        )}

        {/* ── Bottom status hint ─────────────────────────────────── */}
        {!done && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center z-10 pointer-events-none">
            <span className="px-3 py-1 rounded-full text-xs font-medium shadow-sm"
              style={{
                background: faceIn ? `${cfg?.color}15` : 'rgba(255,255,255,0.85)',
                color: faceIn ? cfg?.color : '#6B7280',
                border: `1px solid ${faceIn ? cfg?.color+'40' : '#E5E7EB'}`,
                transition: 'all 0.3s',
              }}
            >
              {isBlink
                ? (blinkReady ? 'Blink your eyes now!' : 'Hold still for a moment…')
                : faceIn
                  ? holdPct > 5 ? `Hold steady… ${Math.round(holdPct)}%` : cfg?.sub
                  : 'Position your face inside the oval'}
            </span>
          </div>
        )}

        {done && (
          <button onClick={reset}
            className="absolute bottom-3 right-3 z-30 flex items-center gap-1 px-3 py-1 rounded-full text-xs text-gray-600 hover:text-gray-900 transition"
            style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #E5E7EB' }}
          >
            <RefreshCw className="w-3 h-3" /> Retake
          </button>
        )}
      </div>

      {/* ── Progress row ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1 mt-3">
        <div className="flex items-center gap-2">
          {sequence.map((ch, i) => {
            const c = CFG[ch]
            const isActive   = i === step && !done
            const isComplete = i < step || done
            return (
              <div key={ch} className="flex items-center gap-2">
                <div className="rounded-full flex items-center justify-center transition-all duration-300"
                  style={{
                    width: isActive ? 30 : isComplete ? 24 : 20,
                    height: isActive ? 30 : isComplete ? 24 : 20,
                    background: isComplete ? 'rgba(5,150,105,0.12)' : isActive ? `${c.color}15` : '#F3F4F6',
                    border: `1.5px solid ${isComplete ? '#059669' : isActive ? c.color : '#D1D5DB'}`,
                  }}
                >
                  <span style={{ fontSize: isActive ? 14 : 11 }}>
                    {isComplete ? '✓' : c.emoji}
                  </span>
                </div>
                {i < sequence.length - 1 && (
                  <div className="w-4 h-px" style={{ background: i < step ? '#059669' : '#D1D5DB' }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Face confidence meter */}
        {!done && (
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-150"
                style={{ width: `${confPct}%`, background: faceIn ? cfg?.color : '#D1D5DB' }} />
            </div>
            <span className="text-[10px] font-mono" style={{ color: faceIn ? cfg?.color : '#9CA3AF' }}>
              {confPct}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
