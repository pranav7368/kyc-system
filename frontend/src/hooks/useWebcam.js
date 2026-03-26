import { useRef, useState, useCallback } from 'react'

export function useWebcam() {
  const webcamRef   = useRef(null)
  const [captured, setCaptured]     = useState(null)  // base64 data URL
  const [capturedFile, setCapturedFile] = useState(null)  // File object
  const [countdown, setCountdown]   = useState(null)
  const [flash, setFlash]           = useState(false)

  const startCountdown = useCallback((cb) => {
    let count = 3
    setCountdown(count)
    const id = setInterval(() => {
      count -= 1
      if (count <= 0) {
        clearInterval(id)
        setCountdown(null)
        cb()
      } else {
        setCountdown(count)
      }
    }, 1000)
  }, [])

  const capture = useCallback(() => {
    startCountdown(() => {
      const imageSrc = webcamRef.current?.getScreenshot()
      if (!imageSrc) return

      setCaptured(imageSrc)
      setFlash(true)
      setTimeout(() => setFlash(false), 300)

      // Convert base64 to File
      fetch(imageSrc)
        .then((r) => r.blob())
        .then((blob) => {
          const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' })
          setCapturedFile(file)
        })
    })
  }, [startCountdown])

  const retake = useCallback(() => {
    setCaptured(null)
    setCapturedFile(null)
  }, [])

  return { webcamRef, captured, capturedFile, countdown, flash, capture, retake }
}
