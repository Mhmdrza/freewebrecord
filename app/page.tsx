'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  ImagePlus,
  Mic,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  Square,
  Upload,
  Video,
  X,
} from 'lucide-react'

const backgrounds = [
  { name: 'Original', value: 'original', className: 'bg-original' },
  { name: 'Soft blur', value: 'blur', className: 'bg-blur' },
  { name: 'Warm studio', value: 'studio', className: 'bg-studio' },
  { name: 'Lavender', value: 'lavender', className: 'bg-lavender' },
]

export default function Page() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const segmenterRef = useRef<any>(null)
  const animationRef = useRef<number | null>(null)
  const processedStreamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [cameraOn, setCameraOn] = useState(false)
  const [segmentationReady, setSegmentationReady] = useState(false)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [activeBackground, setActiveBackground] = useState('original')
  const [uploadedBackground, setUploadedBackground] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [permissionError, setPermissionError] = useState('')
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')
  const [systemDark, setSystemDark] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const backgroundRef = useRef(activeBackground)
  const uploadedBackgroundRef = useRef(uploadedBackground)
  const backgroundImageRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    backgroundRef.current = activeBackground
    uploadedBackgroundRef.current = uploadedBackground
  }, [activeBackground, uploadedBackground])

  useEffect(() => {
    if (!recording || isPaused) return
    const interval = window.setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearInterval(interval)
  }, [recording, isPaused])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    if (uploadedBackground) URL.revokeObjectURL(uploadedBackground)
  }, [uploadedBackground])

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js'
    script.async = true
    document.head.appendChild(script)
    script.onload = () => {
      const segmenter = new (window as any).SelfieSegmentation({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}` })
      segmenter.setOptions({ modelSelection: 1 })
      segmenter.onResults((results: any) => {
      const canvas = canvasRef.current
      if (!canvas || !videoRef.current) return
      const context = canvas.getContext('2d')
      if (!context) return
      canvas.width = videoRef.current.videoWidth || 1280
      canvas.height = videoRef.current.videoHeight || 720
      const width = canvas.width
      const height = canvas.height
      const currentBackground = backgroundRef.current
      context.save()
      if (currentBackground === 'upload' && uploadedBackgroundRef.current && backgroundImageRef.current?.complete) {
        context.drawImage(backgroundImageRef.current, 0, 0, width, height)
      } else {
        const gradient = context.createLinearGradient(0, 0, width, height)
        if (currentBackground === 'studio') { gradient.addColorStop(0, '#b87551'); gradient.addColorStop(1, '#633f35') }
        else if (currentBackground === 'lavender') { gradient.addColorStop(0, '#bca9d4'); gradient.addColorStop(1, '#705b9b') }
        else if (currentBackground === 'blur') { gradient.addColorStop(0, '#d8cbb8'); gradient.addColorStop(1, '#a9957b') }
        else { gradient.addColorStop(0, '#ddd8ce'); gradient.addColorStop(1, '#aaa397') }
        context.fillStyle = gradient
        context.fillRect(0, 0, width, height)
      }
      context.globalCompositeOperation = 'destination-in'
      context.drawImage(results.segmentationMask, 0, 0, width, height)
      context.globalCompositeOperation = 'destination-over'
      context.drawImage(results.image, 0, 0, width, height)
      context.restore()
    })
      segmenterRef.current = segmenter
      setSegmentationReady(true)
    }
    return () => { script.remove(); segmenterRef.current?.close(); segmenterRef.current = null; setSegmentationReady(false) }
  }, [])

  useEffect(() => {
    if (!cameraOn || !videoRef.current || !segmenterRef.current) return
    const processFrame = async () => {
      if (videoRef.current && segmenterRef.current) await segmenterRef.current.send({ image: videoRef.current })
      animationRef.current = requestAnimationFrame(processFrame)
    }
    animationRef.current = requestAnimationFrame(processFrame)
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [cameraOn, segmentationReady])

  const startCamera = async () => {
    try {
      setPermissionError('')
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      if (canvasRef.current) processedStreamRef.current = canvasRef.current.captureStream(30)
      processedStreamRef.current?.addTrack(stream.getAudioTracks()[0])
      setCameraOn(true)
    } catch {
      setPermissionError('Camera access is needed to preview your recording.')
    }
  }

  const toggleRecording = () => {
    if (recording && recorderRef.current) {
      recorderRef.current.stop()
      setRecording(false)
      setIsPaused(false)
      return
    }
    if (!streamRef.current) return
    chunksRef.current = []
    const outputStream = processedStreamRef.current ?? streamRef.current
    const recorder = new MediaRecorder(outputStream)
    recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data)
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `talking-head-${new Date().toISOString().slice(0, 10)}.webm`
      link.click()
      URL.revokeObjectURL(url)
    }
    recorder.start()
    recorderRef.current = recorder
    setElapsed(0)
    setRecording(true)
  }

  const togglePause = () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    if (isPaused) recorder.resume()
    else recorder.pause()
    setIsPaused((value) => !value)
  }

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (uploadedBackground) URL.revokeObjectURL(uploadedBackground)
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { backgroundImageRef.current = image }
    image.src = objectUrl
    setUploadedBackground(objectUrl)
    setActiveBackground('upload')
  }

  const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  const backgroundClass = activeBackground === 'upload' ? '' : backgrounds.find((item) => item.value === activeBackground)?.className ?? ''
  const isDark = theme === 'dark' || (theme === 'system' && systemDark)

  return (
    <main className={`studio-shell min-h-screen bg-[#f4f3f0] text-[#242321] ${isDark ? 'theme-dark' : 'theme-light'}`}>
      <div className="theme-switcher" aria-label="Color theme">
        <button onClick={() => setTheme('system')} className={theme === 'system' ? 'active' : ''} aria-label="Use system theme"><Monitor /></button>
        <button onClick={() => setTheme('light')} className={theme === 'light' ? 'active' : ''} aria-label="Use light theme"><Sun /></button>
        <button onClick={() => setTheme('dark')} className={theme === 'dark' ? 'active' : ''} aria-label="Use dark theme"><Moon /></button>
      </div>
      <header className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[#242321] text-[#f7c7a7]"><Video data-icon="inline-start" /></div>
          <div><p className="text-[15px] font-semibold tracking-tight">Framewise</p><p className="text-[11px] text-[#8d8a83]">Creator studio</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button className="hidden items-center gap-2 rounded-full border border-[#dfddd8] bg-white px-3 py-2 text-xs font-medium sm:flex"><CircleHelp data-icon="inline-start" /> Help</button>
          <button className="flex items-center gap-2 rounded-full border border-[#dfddd8] bg-white px-3 py-2 text-xs font-medium"><Settings2 data-icon="inline-start" /> Settings <ChevronDown data-icon="inline-end" /></button>
          <button aria-label="More options" className="flex size-9 items-center justify-center rounded-full border border-[#dfddd8] bg-white"><MoreHorizontal /></button>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1440px] gap-6 px-5 pb-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-12">
        <div className="min-w-0">
          <div className="mb-5 flex items-end justify-between"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#a19c94]">New recording</p><h1 className="font-serif text-4xl tracking-[-0.04em] sm:text-5xl">Make your point.</h1></div><div className="hidden items-center gap-2 rounded-full bg-white px-3 py-2 text-xs text-[#77736d] shadow-sm sm:flex"><span className="size-2 rounded-full bg-[#81b6a3]" /> Camera ready</div></div>
          <div className={`relative aspect-video overflow-hidden rounded-[26px] border border-white/70 bg-[#d8d5ce] shadow-[0_20px_60px_rgba(61,55,46,0.10)] ${backgroundClass}`}>
            <video ref={videoRef} autoPlay muted playsInline className="absolute size-px opacity-0" />
            <canvas ref={canvasRef} className={`absolute inset-0 size-full object-cover ${cameraOn ? '' : 'opacity-0'}`} aria-label="AI segmented camera preview" />
            {!cameraOn && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center"><div className="flex size-16 items-center justify-center rounded-2xl bg-white/80 text-[#8f8a80] shadow-sm"><Camera /></div><div><p className="font-medium">Your camera preview will appear here</p><p className="mt-1 text-sm text-[#8f8a80]">Turn on your camera to frame your shot.</p></div><button onClick={startCamera} className="rounded-full bg-[#242321] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#383632]"><Camera data-icon="inline-start" /> Enable camera</button></div>}
            <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-white/85 px-3 py-2 text-xs font-medium backdrop-blur"><Sparkles className="text-[#c48667]" /> {activeBackground === 'upload' ? 'Custom background' : backgrounds.find((item) => item.value === activeBackground)?.name}</div>
            {recording && <div className="absolute right-5 top-5 flex items-center gap-2 rounded-full bg-[#242321]/85 px-3 py-2 text-xs font-semibold text-white"><span className="size-2 rounded-full bg-[#e47f70]" /> {isPaused ? 'Paused' : 'Recording'} · {formatTime(elapsed)}</div>}
            <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/70 bg-white/90 p-2 shadow-lg backdrop-blur"><button onClick={togglePause} disabled={!recording} aria-label={isPaused ? 'Resume recording' : 'Pause recording'} className="flex size-10 items-center justify-center rounded-full text-[#6e6a63] hover:bg-[#f0eeea] disabled:opacity-30">{isPaused ? <Play /> : <Pause />}</button><button onClick={toggleRecording} disabled={!cameraOn} aria-label={recording ? 'Stop recording' : 'Start recording'} className={`flex size-14 items-center justify-center rounded-full border-[5px] border-white shadow-md ${recording ? 'bg-[#e47f70]' : 'bg-[#c48667]'} disabled:opacity-30`}>{recording ? <Square className="fill-white text-white" /> : <span className="size-4 rounded-full bg-white" />}</button><button onClick={() => setElapsed(0)} aria-label="Reset timer" className="flex size-10 items-center justify-center rounded-full text-[#6e6a63] hover:bg-[#f0eeea]"><RotateCcw /></button></div>
          </div>
          {permissionError && <p role="alert" className="mt-3 text-sm text-[#b45f57]">{permissionError}</p>}
          <div className="mt-4 flex items-center justify-between text-xs text-[#89857d]"><span className="flex items-center gap-2"><Mic /> Built-in microphone <span className="text-[#c7c2b9]">·</span> 1080p</span><span>{recording ? 'Recording locally' : 'Ready to record'}</span></div>
        </div>

        <aside className="flex flex-col gap-4 lg:pt-[74px]">
          <div className="rounded-2xl border border-[#e3e0da] bg-white p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Background</h2><p className="mt-1 text-xs text-[#918c83]">Set the scene for your video.</p></div><button onClick={() => fileRef.current?.click()} className="flex size-9 items-center justify-center rounded-xl bg-[#f4f1ed] text-[#716d66] hover:bg-[#ebe7e1]" aria-label="Upload background"><ImagePlus /></button><input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" /></div><div className="grid grid-cols-2 gap-2">{backgrounds.map((item) => <button key={item.value} onClick={() => setActiveBackground(item.value)} className={`group relative aspect-[1.45] overflow-hidden rounded-xl border-2 text-left transition ${activeBackground === item.value ? 'border-[#c48667]' : 'border-transparent'}`}><div className={`absolute inset-0 ${item.className}`} /><span className="absolute bottom-2 left-2 rounded-md bg-white/80 px-2 py-1 text-[11px] font-medium backdrop-blur">{item.name}</span>{activeBackground === item.value && <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-[#c48667] text-white"><Check /></span>}</button>)}{uploadedBackground && <button onClick={() => setActiveBackground('upload')} className={`group relative aspect-[1.45] overflow-hidden rounded-xl border-2 text-left transition ${activeBackground === 'upload' ? 'border-[#c48667]' : 'border-transparent'}`}><div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${uploadedBackground})` }} /><span className="absolute bottom-2 left-2 rounded-md bg-white/80 px-2 py-1 text-[11px] font-medium backdrop-blur">Your upload</span></button>}<button onClick={() => fileRef.current?.click()} className="flex aspect-[1.45] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#d8d3cb] text-xs text-[#918c83] hover:bg-[#faf9f7]"><Upload /><span>Upload image</span></button></div></div>
          <div className="rounded-2xl border border-[#e3e0da] bg-white p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Camera & mic</h2><p className="mt-1 text-xs text-[#918c83]">Check your setup before recording.</p></div><button onClick={() => setShowSettings((value) => !value)} className="text-xs font-semibold text-[#b06f55]">{showSettings ? 'Done' : 'Adjust'}</button></div><div className="flex items-center justify-between rounded-xl bg-[#f6f4f1] px-3 py-3"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-white text-[#716d66]"><Camera /></span><div><p className="text-sm font-medium">Facecam</p><p className="text-xs text-[#969088]">{cameraOn ? 'Connected' : 'Not connected'}</p></div></div><span className={`size-2.5 rounded-full ${cameraOn ? 'bg-[#81b6a3]' : 'bg-[#d4cfc7]'}`} /></div>{showSettings && <div className="mt-3 flex items-center justify-between rounded-xl border border-[#ebe7e1] px-3 py-3 text-sm"><span className="text-[#716d66]">Mirror video</span><span className="rounded-full bg-[#242321] px-2 py-1 text-[10px] font-semibold text-white">ON</span></div>}</div>
          <div className="rounded-2xl bg-[#242321] p-5 text-white"><div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-[0.16em] text-[#aaa69e]">Your recording</p><p className="mt-3 font-serif text-3xl">{formatTime(elapsed)}</p></div><Download className="text-[#f0b18e]" /></div><div className="mt-5 flex items-center gap-2 text-xs text-[#aaa69e]"><span className="size-2 rounded-full bg-[#81b6a3]" /> Downloads automatically when you stop.</div></div>
        </aside>
      </section>
      <footer className="mx-auto flex max-w-[1440px] items-center justify-between px-5 pb-8 text-xs text-[#a19c94] sm:px-8 lg:px-12"><span>Framewise · A calm space to create</span><span className="hidden sm:block">No account required</span></footer>
    </main>
  )
}

export { backgrounds }

// CSS-friendly background presets are defined in globals.css.

// Keep imported icons used by the UI in one place for tree-shaking.
void X
void MoreHorizontal
void Play
void Download
void Settings2
void Check
void ChevronDown
void CircleHelp
void Sparkles
void Upload
void ImagePlus
void Pause
void Square
void RotateCcw
void Mic
void Camera
void Video

