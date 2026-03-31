/**
 * DocumentCapture — advanced camera capture for ID documents.
 *
 * Features:
 *  - Requests highest available camera resolution (4K → 1080p → 720p fallback)
 *  - Real-time blur detection via Laplacian variance on the guide region
 *  - Real-time brightness check (too dark / too bright warning)
 *  - Auto-capture ONLY when image is sharp + document detected + held steady 2s
 *  - Captures at native resolution (not display resolution) for maximum OCR quality
 *  - Perspective guide with corner markers, live sharpness bar
 */
import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, RefreshCw, CheckCircle, Sun, Zap, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

const CARD_ASPECT = 1.586   // ISO/IEC 7810 ID-1: 85.6 × 53.98 mm
const HOLD_MS     = 2000    // ms to hold steady before auto-capture
const BLUR_SHARP  = 55      // Laplacian variance above this = sharp enough
const BLUR_WARN   = 25      // below this = show red warning
const EDGE_THRESH = 0.012   // min edge density to consider document present

// ---------------------------------------------------------------------------
// Analysis helpers — run on offscreen canvas every animation frame
// ---------------------------------------------------------------------------

/**
 * Compute Laplacian variance of the guide region.
 * Higher value = sharper image. < 25 is blurry, > 55 is sharp.
 */
function computeSharpness(ctx, px, py, pw, ph) {
  try {
    const { data, width } = ctx.getImageData(px, py, pw, ph)
    let sum = 0, sumSq = 0, count = 0
    // Stride 2 for speed (every other pixel)
    for (let j = 1; j < ph - 1; j += 2) {
      for (let i = 1; i < pw - 1; i += 2) {
        const c = ((j * width) + i) * 4
        const gray    = (data[c]   + data[c+1]   + data[c+2])   / 3
        const top     = (data[c - width*4] + data[c - width*4+1] + data[c - width*4+2]) / 3
        const bot     = (data[c + width*4] + data[c + width*4+1] + data[c + width*4+2]) / 3
        const lft     = (data[c-4] + data[c-3] + data[c-2]) / 3
        const rgt     = (data[c+4] + data[c+5] + data[c+6]) / 3
        const lap     = Math.abs(4 * gray - top - bot - lft - rgt)
        sum += lap; sumSq += lap * lap; count++
      }
    }
    if (!count) return 0
    const mean = sum / count
    return Math.max(0, sumSq / count - mean * mean)
  } catch { return 0 }
}

/**
 * Compute average brightness (0–255) of the guide region.
 */
function computeBrightness(ctx, px, py, pw, ph) {
  try {
    const { data } = ctx.getImageData(px, py, pw, ph)
    let sum = 0
    for (let i = 0; i < data.length; i += 16) {
      sum += (data[i] + data[i+1] + data[i+2]) / 3
    }
    return sum / (data.length / 16)
  } catch { return 128 }
}

/**
 * Detect if a document is present (high contrast edges inside guide).
 */
function detectEdgeDensity(ctx, px, py, pw, ph) {
  try {
    const { data, width } = ctx.getImageData(px, py, pw, ph)
    let edges = 0, total = 0
    for (let i = 4; i < data.length - 4 * width; i += 8) {
      const lum  = (data[i]   + data[i+1]   + data[i+2])   / 3
      const next = (data[i+4] + data[i+5]   + data[i+6])   / 3
      if (Math.abs(lum - next) > 28) edges++
      total++
    }
    return total > 0 ? edges / total : 0
  } catch { return 0 }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DocumentCapture({ onCapture, label = 'ID Document' }) {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)   // offscreen analysis canvas
  const animRef    = useRef(null)
  const holdRef    = useRef(null)
  const streamRef  = useRef(null)

  const [ready,       setReady]       = useState(false)
  const [captured,    setCaptured]    = useState(null)   // data-URL of captured image
  const [flash,       setFlash]       = useState(false)
  const [holdPct,     setHoldPct]     = useState(0)
  const [sharpness,   setSharpness]   = useState(0)
  const [brightness,  setBrightness]  = useState(128)
  const [docDetected, setDocDetected] = useState(false)
  const [camError,    setCamError]    = useState(null)

  // Guide rectangle in normalised coords
  const GUIDE = { x: 0.05, y: 0.12, w: 0.90, h: 0.90 / CARD_ASPECT }

  // -------------------------------------------------------------------------
  // Camera startup — request highest possible resolution
  // -------------------------------------------------------------------------
  useEffect(() => {
    let alive = true
    const constraints = [
      { facingMode: 'environment', width: { ideal: 3840 }, height: { ideal: 2160 } },
      { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720  } },
      { facingMode: 'user',        width: { ideal: 1280 }, height: { ideal: 720  } },
    ]

    async function startCamera() {
      for (const c of constraints) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: c, audio: false })
          if (!alive) { stream.getTracks().forEach(t => t.stop()); return }
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            await videoRef.current.play()
          }
          const track = stream.getVideoTracks()[0]
          const { width, height } = track.getSettings()
          console.log(`Camera: ${width}×${height} | facing: ${c.facingMode}`)
          setReady(true)
          return
        } catch { continue }
      }
      if (alive) setCamError('Camera not available. Please allow camera access or use file upload.')
    }

    startCamera()
    return () => {
      alive = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      cancelAnimationFrame(animRef.current)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Analysis loop — runs every rAF
  // -------------------------------------------------------------------------
  const snapshot = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    const vw = video.videoWidth
    const vh = video.videoHeight

    // Map guide rectangle to native pixel coords
    const px = Math.round(GUIDE.x * vw)
    const py = Math.round(GUIDE.y * vh)
    const pw = Math.round(GUIDE.w * vw)
    const ph = Math.round(GUIDE.h * vh)

    // Crop to guide region at native resolution
    const c = document.createElement('canvas')
    c.width  = pw
    c.height = ph
    c.getContext('2d').drawImage(video, px, py, pw, ph, 0, 0, pw, ph)

    c.toBlob(
      (blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        setCaptured(url)
        onCapture(new File([blob], 'document.jpg', { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.97   // very high quality
    )
    setFlash(true)
    setTimeout(() => setFlash(false), 300)
  }, [onCapture])

  useEffect(() => {
    if (!ready || captured) return
    let alive = true

    const tick = () => {
      if (!alive) return
      const video = videoRef.current
      if (!video || video.readyState < 2) {
        animRef.current = requestAnimationFrame(tick)
        return
      }

      // Reuse or create offscreen canvas
      if (!canvasRef.current) canvasRef.current = document.createElement('canvas')
      const cv = canvasRef.current
      const vw = video.videoWidth  || 640
      const vh = video.videoHeight || 480
      cv.width = vw; cv.height = vh
      const ctx = cv.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(video, 0, 0, vw, vh)

      const px = Math.round(GUIDE.x * vw), py = Math.round(GUIDE.y * vh)
      const pw = Math.round(GUIDE.w * vw), ph = Math.round(GUIDE.h * vh)

      const sharp  = computeSharpness(ctx, px, py, pw, ph)
      const bright = computeBrightness(ctx, px, py, pw, ph)
      const edges  = detectEdgeDensity(ctx, px, py, pw, ph)

      setSharpness(sharp)
      setBrightness(bright)
      const doc = edges > EDGE_THRESH
      setDocDetected(doc)

      const isSharp    = sharp   >= BLUR_SHARP
      const isLit      = bright  >= 40 && bright <= 230
      const canCapture = doc && isSharp && isLit

      if (canCapture) {
        if (!holdRef.current) holdRef.current = Date.now()
        const pct = Math.min(100, ((Date.now() - holdRef.current) / HOLD_MS) * 100)
        setHoldPct(pct)
        if (pct >= 100) { alive = false; snapshot(); return }
      } else {
        holdRef.current = null
        setHoldPct(0)
      }

      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => { alive = false; cancelAnimationFrame(animRef.current) }
  }, [ready, captured, snapshot])

  // -------------------------------------------------------------------------
  // Derived state for UI
  // -------------------------------------------------------------------------
  const isSharp    = sharpness  >= BLUR_SHARP
  const isBlurry   = sharpness  <  BLUR_WARN && ready && !captured
  const tooDark    = brightness <  40  && ready && !captured
  const tooBright  = brightness >  230 && ready && !captured
  const lightOk    = !tooDark && !tooBright

  const borderColor = captured
    ? '#06D6A0'
    : holdPct > 0
      ? `hsl(${80 + holdPct * 0.8},80%,55%)`
      : docDetected && isSharp && lightOk
        ? '#22d3ee'
        : docDetected
          ? '#f59e0b'
          : 'rgba(255,255,255,0.2)'

  const statusMsg = () => {
    if (!ready)            return 'Starting camera…'
    if (tooDark)           return '⚠ Too dark — move to better lighting'
    if (tooBright)         return '⚠ Too bright — avoid direct light'
    if (isBlurry)          return '⚠ Image blurry — hold phone still'
    if (!docDetected)      return 'Align document within the frame'
    if (!isSharp)          return 'Hold steady — focusing…'
    if (holdPct > 0)       return `Hold steady… ${Math.round(holdPct)}%`
    return 'Document detected — keep still'
  }

  const retake = () => {
    setCaptured(null)
    setHoldPct(0)
    setSharpness(0)
    holdRef.current = null
  }

  const sharpPct = Math.min(100, (sharpness / BLUR_SHARP) * 100)

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (camError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-300">{camError}</p>
        <p className="text-xs text-gray-400 mt-1">Switch to "Upload" mode above to use a file instead.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-black relative select-none">
      {flash && <div className="absolute inset-0 bg-white/70 z-30 pointer-events-none" />}

      {captured ? (
        <div className="relative">
          <img src={captured} alt="document" className="w-full object-contain max-h-64 bg-black" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-primary/20 text-accent-primary text-xs backdrop-blur">
            <CheckCircle className="w-3 h-3" /> Captured
          </div>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center">
            <button
              onClick={retake}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-sm text-white transition backdrop-blur"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retake
            </button>
          </div>
        </div>
      ) : (
        <div className="relative" style={{ aspectRatio: '16/10' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* SVG overlay: guide rectangle + corner marks + progress bar */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <mask id="dcMask">
                <rect width="100" height="100" fill="white" />
                <rect
                  x={GUIDE.x * 100} y={GUIDE.y * 100}
                  width={GUIDE.w * 100} height={GUIDE.h * 100}
                  rx="0.8" fill="black"
                />
              </mask>
            </defs>

            {/* Dimmed surround */}
            <rect width="100" height="100" fill="rgba(0,0,0,0.52)" mask="url(#dcMask)" />

            {/* Guide border */}
            <rect
              x={GUIDE.x * 100} y={GUIDE.y * 100}
              width={GUIDE.w * 100} height={GUIDE.h * 100}
              rx="0.8" fill="none"
              stroke={borderColor} strokeWidth="0.45"
              style={{ transition: 'stroke 0.25s' }}
            />

            {/* Corner L-marks */}
            {[
              [GUIDE.x,            GUIDE.y,             1,  0,  0,  1],
              [GUIDE.x + GUIDE.w,  GUIDE.y,            -1,  0,  0,  1],
              [GUIDE.x,            GUIDE.y + GUIDE.h,   1,  0,  0, -1],
              [GUIDE.x + GUIDE.w,  GUIDE.y + GUIDE.h,  -1,  0,  0, -1],
            ].map(([cx, cy, dx, dy, bx, by], i) => (
              <g key={i} transform={`translate(${cx * 100},${cy * 100})`}>
                <line x1="0" y1="0" x2={dx*6} y2="0"      stroke={borderColor} strokeWidth="0.9" style={{ transition: 'stroke 0.25s' }} />
                <line x1="0" y1="0" x2="0"    y2={by*6}   stroke={borderColor} strokeWidth="0.9" style={{ transition: 'stroke 0.25s' }} />
              </g>
            ))}

            {/* Hold progress bar along top of guide */}
            {holdPct > 0 && (
              <rect
                x={GUIDE.x * 100} y={GUIDE.y * 100}
                width={GUIDE.w * 100 * holdPct / 100} height="0.5"
                fill="#06D6A0"
                style={{ transition: 'width 0.08s linear' }}
              />
            )}
          </svg>

          {/* Sharpness indicator — top left */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm">
            <Zap className={clsx('w-3 h-3', isSharp ? 'text-green-400' : isBlurry ? 'text-red-400' : 'text-yellow-400')} />
            <div className="w-16 h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full transition-all', isSharp ? 'bg-green-400' : isBlurry ? 'bg-red-400' : 'bg-yellow-400')}
                style={{ width: `${sharpPct}%` }}
              />
            </div>
            <span className="text-xs text-white/60 font-mono w-8">{Math.round(sharpPct)}%</span>
          </div>

          {/* Light indicator — top right */}
          {(tooDark || tooBright) && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm">
              <Sun className="w-3 h-3 text-yellow-400" />
              <span className="text-xs text-yellow-300">{tooDark ? 'Too dark' : 'Too bright'}</span>
            </div>
          )}

          {/* Status tip — bottom */}
          <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none px-4">
            <span className={clsx(
              'inline-block px-3 py-1 rounded-full text-xs backdrop-blur-sm',
              isBlurry || tooDark || tooBright
                ? 'bg-red-500/25 text-red-300'
                : docDetected && isSharp
                  ? holdPct > 0 ? 'bg-green-500/25 text-green-300' : 'bg-cyan-500/25 text-cyan-300'
                  : 'bg-black/50 text-white/70'
            )}>
              {statusMsg()}
            </span>
          </div>
        </div>
      )}

      {/* Manual capture button */}
      {!captured && (
        <button
          onClick={snapshot}
          className="w-full py-2.5 flex items-center justify-center gap-2 text-sm font-medium bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary border-t border-accent-primary/10 transition"
        >
          <Camera className="w-4 h-4" />
          Capture Manually
        </button>
      )}
    </div>
  )
}
