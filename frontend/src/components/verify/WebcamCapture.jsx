import Webcam from 'react-webcam'
import { Camera, RefreshCw, CheckCircle } from 'lucide-react'
import { useWebcam } from '../../hooks/useWebcam'
import clsx from 'clsx'
import { useEffect } from 'react'

export default function WebcamCapture({ onCapture }) {
  const { webcamRef, captured, capturedFile, countdown, flash, capture, retake } = useWebcam()

  useEffect(() => {
    if (capturedFile) onCapture(capturedFile)
  }, [capturedFile, onCapture])

  return (
    <div className="relative rounded-xl overflow-hidden border border-white/10 bg-bg-secondary">
      {/* Flash overlay */}
      {flash && (
        <div className="absolute inset-0 bg-white/70 z-20 pointer-events-none animate-fade-in" />
      )}

      {captured ? (
        <div className="relative">
          <img src={captured} alt="selfie" className="w-full h-48 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-0 right-0 flex justify-center">
            <button
              onClick={retake}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-sm text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retake
            </button>
          </div>
          <div className="absolute top-2 right-2">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-primary/20 text-accent-primary text-xs">
              <CheckCircle className="w-3 h-3" /> Captured
            </div>
          </div>
        </div>
      ) : (
        <div className="relative h-48 flex flex-col items-center justify-center bg-black">
          <Webcam
            ref={webcamRef}
            audio={false}
            mirrored
            screenshotFormat="image/jpeg"
            screenshotQuality={0.9}
            className="absolute inset-0 w-full h-full object-cover"
            videoConstraints={{ facingMode: 'user', width: 640, height: 480 }}
          />

          {/* Face oval overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="w-28 h-36 rounded-full border-2 border-dashed border-accent-primary/70"
              style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }}
            />
          </div>

          {/* Instruction text */}
          <div className="absolute bottom-3 left-0 right-0 text-center">
            <p className="text-xs text-white/70">Align your face within the oval</p>
          </div>

          {/* Countdown overlay */}
          {countdown != null && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/30">
              <span className="text-6xl font-bold text-accent-primary drop-shadow-lg animate-ping">
                {countdown}
              </span>
            </div>
          )}
        </div>
      )}

      {!captured && (
        <button
          onClick={capture}
          disabled={countdown != null}
          className={clsx(
            'w-full py-2.5 flex items-center justify-center gap-2 text-sm font-medium transition-all',
            countdown != null
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-accent-primary/20 hover:bg-accent-primary/30 text-accent-primary border-t border-accent-primary/20'
          )}
        >
          <Camera className="w-4 h-4" />
          {countdown != null ? `Capturing in ${countdown}…` : 'Capture Selfie'}
        </button>
      )}
    </div>
  )
}
