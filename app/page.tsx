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
  const personCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const segmenterRef = useRef<any>(null)
  const animationRef = useRef<number | null>(null)
  const processedStreamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [cameraOn, setCameraOn] = useState(false)
  const [segmentationReady, setSegmentationReady] = useState(false)
  const [mirrorVideo, setMirrorVideo] = useState(true)
  const [maskingEnabled, setMaskingEnabled] = useState(true)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [activeBackground, setActiveBackground] = useState('original')
  const [uploadedBackground, setUploadedBackground] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [permissionError, setPermissionError] = useState('')
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('dark')
  const [recordingQuality, setRecordingQuality] = useState<'720p' | '1080p'>('1080p')
  const [segmentationModel, setSegmentationModel] = useState<'fast' | 'quality'>('quality')
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
  const mirrorRef = useRef(mirrorVideo)
  const maskingRef = useRef(maskingEnabled)
  const modelRef = useRef(segmentationModel)

  useEffect(() => {
    backgroundRef.current = activeBackground
    uploadedBackgroundRef.current = uploadedBackground
    mirrorRef.current = mirrorVideo
    maskingRef.current = maskingEnabled
    modelRef.current = segmentationModel
  }, [activeBackground, uploadedBackground, mirrorVideo, maskingEnabled, segmentationModel])

  useEffect(() => {
    if (!recording || isPaused) return
    const interval = window.setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearInterval(interval)
  }, [recording, isPaused])

  useEffect(() => () => {
    if (uploadedBackground) URL.revokeObjectURL(uploadedBackground)
  }, [uploadedBackground])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js'
    script.async = true
    document.head.appendChild(script)
    script.onload = () => {
      const segmenter = new (window as any).SelfieSegmentation({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}` })
      segmenter.setOptions({ modelSelection: modelRef.current === 'quality' ? 1 : 0 })
      segmenter.onResults((results: any) => {
      const canvas = canvasRef.current
      if (!canvas || !videoRef.current) return
      const context = canvas.getContext('2d')
      if (!context) return
      const width = videoRef.current.videoWidth || 1280
      const height = videoRef.current.videoHeight || 720
      // Resizing a canvas clears its bitmap and can interrupt the canvas capture track.
      // Only resize when the source video dimensions actually change.
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      const currentBackground = backgroundRef.current
      const personCanvas = personCanvasRef.current ?? document.createElement('canvas')
      personCanvasRef.current = personCanvas
      personCanvas.width = width
      personCanvas.height = height
      const personContext = personCanvas.getContext('2d')
      if (!personContext) return

      personContext.globalCompositeOperation = 'source-over'
      personContext.clearRect(0, 0, width, height)
      personContext.save()
      if (mirrorRef.current) {
        personContext.translate(width, 0)
        personContext.scale(-1, 1)
      }
      personContext.drawImage(results.image, 0, 0, width, height)
      personContext.globalCompositeOperation = 'destination-in'
      personContext.drawImage(results.segmentationMask, 0, 0, width, height)
      personContext.restore()

      context.globalCompositeOperation = 'source-over'
      context.clearRect(0, 0, width, height)
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
      context.drawImage(personCanvas, 0, 0, width, height)
    })
      segmenterRef.current = segmenter
      setSegmentationReady(true)
    }
    return () => { script.remove(); segmenterRef.current?.close(); segmenterRef.current = null; setSegmentationReady(false) }
  }, [])

  useEffect(() => {
    if (!cameraOn || !videoRef.current || !segmenterRef.current) return
    const processFrame = async () => {
      try {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (video && canvas && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const width = video.videoWidth || 1280
          const height = video.videoHeight || 720
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
          }
          if (!maskingRef.current) {
            const context = canvas.getContext('2d')
            if (context) {
              context.save()
              context.clearRect(0, 0, width, height)
              if (mirrorRef.current) {
                context.translate(width, 0)
                context.scale(-1, 1)
              }
              context.drawImage(video, 0, 0, width, height)
              context.restore()
            }
          } else if (segmenterRef.current) {
            await segmenterRef.current.send({ image: video })
          }
        }
      } catch {
        // Keep scheduling frames if a transient segmentation error occurs.
      } finally {
        animationRef.current = requestAnimationFrame(processFrame)
      }
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
    const mp4Type = 'video/mp4;codecs=h264,aac'
    const webmType = 'video/webm;codecs=vp9,opus'
    const mimeType = MediaRecorder.isTypeSupported(mp4Type) ? mp4Type : MediaRecorder.isTypeSupported(webmType) ? webmType : ''
    const recorder = new MediaRecorder(outputStream, mimeType ? { mimeType, videoBitsPerSecond: recordingQuality === '1080p' ? 6000000 : 3500000 } : undefined)
    recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data)
    recorder.onstop = () => {
      const type = recorderRef.current?.mimeType || 'video/webm'
      const extension = type.includes('mp4') ? 'mp4' : 'webm'
      const blob = new Blob(chunksRef.current, { type })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `talking-head-${new Date().toISOString().slice(0, 10)}.${extension}`
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
          <div className="rounded-2xl border border-[#e3e0da] bg-white p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Camera & mic</h2><p className="mt-1 text-xs text-[#918c83]">Check your setup before recording.</p></div><button onClick={() => setShowSettings((value) => !value)} className="text-xs font-semibold text-[#b06f55]">{showSettings ? 'Done' : 'Adjust'}</button></div><div className="flex items-center justify-between rounded-xl bg-[#f6f4f1] px-3 py-3"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-white text-[#716d66]"><Camera /></span><div><p className="text-sm font-medium">Facecam</p><p className="text-xs text-[#969088]">{cameraOn ? 'Connected' : 'Not connected'}</p></div></div><span className={`size-2.5 rounded-full ${cameraOn ? 'bg-[#81b6a3]' : 'bg-[#d4cfc7]'}`} /></div>{showSettings && <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[#ebe7e1] px-3 py-3 text-sm"><div className="flex items-center justify-between"><div><span className="text-[#716d66]">Mirror video</span><p className="mt-1 text-xs text-[#969088]">Flip the person feed like a mirror.</p></div><button type="button" role="switch" aria-checked={mirrorVideo} onClick={() => setMirrorVideo((value) => !value)} className={`relative h-6 w-11 rounded-full transition ${mirrorVideo ? 'bg-[#242321]' : 'bg-[#d4cfc7]'}`}><span className={`absolute top-1 size-4 rounded-full bg-white transition ${mirrorVideo ? 'left-6' : 'left-1'}`} /></button></div><div className="flex items-center justify-between"><div><span className="text-[#716d66]">Background masking</span><p className="mt-1 text-xs text-[#969088]">Show the unmodified webcam feed.</p></div><button type="button" role="switch" aria-label="Toggle background masking" aria-checked={maskingEnabled} onClick={() => setMaskingEnabled((value) => !value)} className={`relative h-6 w-11 rounded-full transition ${maskingEnabled ? 'bg-[#242321]' : 'bg-[#d4cfc7]'}`}><span className={`absolute top-1 size-4 rounded-full bg-white transition ${maskingEnabled ? 'left-6' : 'left-1'}`} /></button></div><label className="flex items-center justify-between gap-3 text-xs text-[#716d66]">Recording quality<select value={recordingQuality} onChange={(event) => setRecordingQuality(event.target.value as '720p' | '1080p')} className="rounded-lg border border-[#dfddd8] bg-transparent px-2 py-1 text-xs"><option value="720p">720p · smaller</option><option value="1080p">1080p · sharper</option></select></label><label className="flex items-center justify-between gap-3 text-xs text-[#716d66]">Segmentation<select value={segmentationModel} onChange={(event) => setSegmentationModel(event.target.value as 'fast' | 'quality')} className="rounded-lg border border-[#dfddd8] bg-transparent px-2 py-1 text-xs"><option value="quality">Quality edges</option><option value="fast">Fast preview</option></select></label></div>}</div>
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

