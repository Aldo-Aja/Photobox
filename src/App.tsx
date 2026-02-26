import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, RefreshCw, ChevronRight, Layout, Check, X, Download, Share2, Settings, Plus, Sparkles, Upload } from 'lucide-react';
import { TEMPLATES, Template } from './constants';
import { getSupabase } from './supabase';

type Step = 'layout' | 'capture' | 'preview' | 'final';

export default function App() {
  const [step, setStep] = useState<Step>('layout');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCustomLayoutUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          let minX = canvas.width, maxX = 0, minY = canvas.height, maxY = 0;
          for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
              if (data[(y * canvas.width + x) * 4 + 3] < 250) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }

          let gapPixels = 0;
          let gapCount = 0;
          let inGap = false;
          let holeCount = 0;

          if (minY <= maxY) {
            for (let y = minY; y <= maxY; y++) {
              let isGap = true;
              for (let x = minX; x <= maxX; x++) {
                if (data[(y * canvas.width + x) * 4 + 3] < 250) {
                  isGap = false;
                  break;
                }
              }
              if (isGap) {
                if (!inGap) gapCount++;
                inGap = true;
                gapPixels++;
              } else {
                if (inGap || y === minY) holeCount++;
                inGap = false;
              }
            }
          }

          let dynamicStyle: React.CSSProperties | undefined;
          if (minY <= maxY) {
            dynamicStyle = {
              paddingTop: `${(minY / canvas.height) * 100}%`,
              paddingBottom: `${((canvas.height - maxY) / canvas.height) * 100}%`,
              paddingLeft: `${(minX / canvas.width) * 100}%`,
              paddingRight: `${((canvas.width - maxX) / canvas.width) * 100}%`,
              gap: gapCount > 0 ? `${((gapPixels / gapCount) / canvas.height) * 100}%` : '1%'
            };
          }

          const customTemplate: Template = {
            id: `custom-${Date.now()}`,
            name: 'Custom Frame',
            description: 'Auto-detected slots',
            thumbnailUrl: url,
            layoutType: 'custom',
            slots: holeCount > 0 ? holeCount : 4,
            frameUrl: url,
            dynamicStyle
          };

          setCustomTemplates((prev) => [customTemplate, ...prev]);
          setSelectedTemplate(customTemplate);
        };
        img.src = url;
      };
      reader.readAsDataURL(file);
    }
  };

  // Initialize camera when entering capture step
  useEffect(() => {
    if (step === 'capture') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [step]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please ensure permissions are granted.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      // Mirror the image for a natural feel
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const photoData = canvas.toDataURL('image/jpeg', 0.8);
      setPhotos(prev => [...prev, photoData]);

      if (selectedTemplate && photos.length + 1 >= selectedTemplate.slots) {
        setTimeout(() => setStep('preview'), 500);
      }
    }
  }, [selectedTemplate, photos.length]);

  const handleCaptureClick = () => {
    if (isCapturing || (selectedTemplate && photos.length >= selectedTemplate.slots)) return;

    setIsCapturing(true);
    let count = 3;
    setCountdown(count);

    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(interval);
        setCountdown(null);
        capturePhoto();
        setIsCapturing(false);
      }
    }, 1000);
  };

  const resetSession = () => {
    setStep('layout');
    setPhotos([]);
    setSelectedTemplate(null);
  };

  const saveToSupabase = async () => {
    if (!selectedTemplate) return;

    const supabase = getSupabase();
    if (!supabase) {
      alert("Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('photostrips')
        .insert([
          {
            template_id: selectedTemplate.id,
            photos: photos,
            created_at: new Date().toISOString()
          }
        ]);

      if (error) throw error;
      alert("Saved successfully to Supabase!");
    } catch (err) {
      console.error("Error saving to Supabase:", err);
      alert("Failed to save. Make sure your Supabase URL and Key are configured in .env");
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans selection:bg-pink-100">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-black/5 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-pink-200">
              <Sparkles size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Birthday Booth</h1>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">Sweet 16 Edition</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <Settings size={20} className="text-gray-400" />
            </button>
            <button
              onClick={resetSession}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="pt-28 pb-20 px-6 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {step === 'layout' && (
            <motion.div
              key="layout"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-4xl font-bold tracking-tight mb-2">Select Layout</h2>
                  <p className="text-gray-500">Choose a photostrip style for your session. You can customize colors later.</p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 bg-pink-500 text-white px-6 py-3 rounded-2xl font-semibold shadow-lg shadow-pink-200 hover:bg-pink-600 transition-all active:scale-95"
                >
                  <Upload size={20} />
                  Upload Custom Frame
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleCustomLayoutUpload}
                  accept="image/png"
                  className="hidden"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[...customTemplates, ...TEMPLATES].map((template) => (
                  <motion.div
                    key={template.id}
                    whileHover={{ y: -8 }}
                    onClick={() => setSelectedTemplate(template)}
                    className={`group relative bg-white rounded-[32px] overflow-hidden cursor-pointer border-2 transition-all duration-300 ${selectedTemplate?.id === template.id ? 'border-pink-500 shadow-2xl shadow-pink-100' : 'border-transparent hover:shadow-xl'
                      }`}
                  >
                    <div className="aspect-[3/4] overflow-hidden bg-gray-100">
                      <img
                        src={template.thumbnailUrl}
                        alt={template.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                      />
                      {selectedTemplate?.id === template.id && (
                        <div className="absolute top-4 right-4 w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center text-white shadow-lg">
                          <Check size={18} />
                        </div>
                      )}
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold mb-1">{template.name}</h3>
                      <p className="text-gray-400 text-sm">{template.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="fixed bottom-8 left-0 right-0 px-6 pointer-events-none">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                  <span className="text-gray-400 text-sm font-medium">Step 1 of 4</span>
                  <button
                    disabled={!selectedTemplate}
                    onClick={() => setStep('capture')}
                    className={`pointer-events-auto flex items-center gap-2 bg-pink-500 text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-pink-200 transition-all active:scale-95 ${!selectedTemplate ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-pink-600'
                      }`}
                  >
                    Next
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'capture' && (
            <motion.div
              key="capture"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start"
            >
              {/* Camera View */}
              <div className="lg:col-span-7 space-y-6">
                <div className="relative aspect-video bg-black rounded-[40px] overflow-hidden shadow-2xl ring-1 ring-black/5">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />

                  {/* Overlay UI */}
                  <div className="absolute top-6 right-6">
                    <div className="bg-pink-500/90 backdrop-blur text-white px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 uppercase tracking-widest">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      Live
                    </div>
                  </div>

                  {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                      <motion.span
                        key={countdown}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1.5, opacity: 1 }}
                        className="text-white text-9xl font-black italic drop-shadow-2xl"
                      >
                        {countdown}
                      </motion.span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center gap-6">
                  <button
                    onClick={handleCaptureClick}
                    disabled={isCapturing || (selectedTemplate && photos.length >= selectedTemplate.slots)}
                    className="w-24 h-24 bg-pink-500 rounded-full flex items-center justify-center text-white shadow-2xl shadow-pink-200 hover:bg-pink-600 transition-all active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera size={40} />
                  </button>
                  <p className="text-gray-400 font-medium">
                    Click to capture frame {photos.length + 1} of {selectedTemplate?.slots}
                  </p>
                </div>
              </div>

              {/* Preview Strip */}
              <div className="lg:col-span-5">
                <div className="bg-white p-8 rounded-[40px] shadow-xl border border-black/5">
                  <h3 className="text-2xl font-bold mb-8 text-center">Your Photostrip</h3>

                  <div className="w-full">
                    {selectedTemplate?.frameUrl ? (
                      <div className="relative max-w-[280px] mx-auto overflow-hidden shadow-sm md:max-h-none" style={{ backgroundColor: '#f0f0f0' }}>
                        <img src={selectedTemplate.frameUrl} className="relative w-full h-auto z-10 pointer-events-none drop-shadow-lg" />
                        <div
                          className="absolute inset-0 flex flex-col z-0"
                          style={{
                            paddingLeft: selectedTemplate.dynamicStyle?.paddingLeft || '6%',
                            paddingRight: selectedTemplate.dynamicStyle?.paddingRight || '6%'
                          }}
                        >
                          <div style={{ height: selectedTemplate.dynamicStyle?.paddingTop || '2.5%', flexShrink: 0 }} />
                          {Array.from({ length: selectedTemplate.slots }).map((_, i) => (
                            <React.Fragment key={i}>
                              <div className="flex-1 overflow-hidden relative">
                                {photos[i] ? (
                                  <img src={photos[i]} className="absolute inset-0 w-full h-full object-cover" />
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center text-pink-200 bg-white/50">
                                    <Layout size={24} />
                                  </div>
                                )}
                              </div>
                              {i < selectedTemplate.slots - 1 && (
                                <div style={{ height: selectedTemplate.dynamicStyle?.gap || '5.26%', flexShrink: 0 }} />
                              )}
                            </React.Fragment>
                          ))}
                          <div style={{ height: selectedTemplate.dynamicStyle?.paddingBottom || '24%', flexShrink: 0 }} />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 max-w-[280px] mx-auto">
                        {Array.from({ length: selectedTemplate?.slots || 4 }).map((_, i) => (
                          <div
                            key={i}
                            className={`aspect-square rounded-2xl overflow-hidden border-2 border-dashed transition-all duration-500 ${photos[i] ? 'border-transparent shadow-md' : 'border-pink-100 bg-pink-50/30'
                              }`}
                          >
                            {photos[i] ? (
                              <div className="relative w-full h-full">
                                <img src={photos[i]} className="w-full h-full object-cover" />
                                <div className="absolute top-2 right-2 w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center text-white shadow-lg">
                                  <Check size={12} />
                                </div>
                              </div>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-pink-200">
                                <Layout size={32} />
                              </div>
                            )}
                          </div>
                        ))}

                        <div className="pt-4 text-center">
                          <p className="text-pink-500 font-bold text-sm uppercase tracking-widest mb-1">Sweet 16</p>
                          <p className="text-gray-300 text-[10px] font-medium uppercase tracking-widest">
                            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-10">
                    <button
                      onClick={() => setPhotos(prev => prev.slice(0, -1))}
                      disabled={photos.length === 0}
                      className="w-full py-4 rounded-2xl border-2 border-pink-100 text-pink-500 font-bold hover:bg-pink-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-30"
                    >
                      <RefreshCw size={18} />
                      Retake Last Photo
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'preview' && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto space-y-12"
            >
              <div className="text-center">
                <h2 className="text-4xl font-bold tracking-tight mb-4">Looking Good! ✨</h2>
                <p className="text-gray-500">Your photostrip is ready. You can save it to our gallery or download it.</p>
              </div>

              <div className="bg-white p-12 rounded-[48px] shadow-2xl border border-black/5 flex flex-col items-center">
                {selectedTemplate?.frameUrl ? (
                  <div className="relative w-full max-w-[320px] overflow-hidden shadow-xl" style={{ backgroundColor: '#f0f0f0' }}>
                    <img src={selectedTemplate.frameUrl} className="relative w-full h-auto z-10 pointer-events-none drop-shadow-lg" />
                    <div
                      className="absolute inset-0 flex flex-col z-0"
                      style={{
                        paddingLeft: selectedTemplate.dynamicStyle?.paddingLeft || '6%',
                        paddingRight: selectedTemplate.dynamicStyle?.paddingRight || '6%'
                      }}
                    >
                      <div style={{ height: selectedTemplate.dynamicStyle?.paddingTop || '2.5%', flexShrink: 0 }} />
                      {Array.from({ length: selectedTemplate.slots }).map((_, i) => (
                        <React.Fragment key={i}>
                          {photos[i] ? (
                            <motion.div
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                              className="flex-1 overflow-hidden relative"
                            >
                              <img src={photos[i]} className="absolute inset-0 w-full h-full object-cover" />
                            </motion.div>
                          ) : (
                            <div className="flex-1 bg-white/50" />
                          )}
                          {i < selectedTemplate.slots - 1 && (
                            <div style={{ height: selectedTemplate.dynamicStyle?.gap || '5.26%', flexShrink: 0 }} />
                          )}
                        </React.Fragment>
                      ))}
                      <div style={{ height: selectedTemplate.dynamicStyle?.paddingBottom || '24%', flexShrink: 0 }} />
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-4 shadow-inner rounded-xl space-y-4 w-full max-w-[320px]">
                    {photos.map((photo, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="aspect-square rounded-lg overflow-hidden shadow-sm"
                      >
                        <img src={photo} className="w-full h-full object-cover" />
                      </motion.div>
                    ))}
                    <div className="text-center pt-4 border-t border-gray-50">
                      <p className="text-pink-500 font-bold text-lg tracking-tight">BIRTHDAY BASH</p>
                      <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">Memories for life</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={saveToSupabase}
                  className="flex items-center justify-center gap-3 bg-pink-500 text-white px-10 py-5 rounded-[24px] font-bold shadow-xl shadow-pink-200 hover:bg-pink-600 transition-all active:scale-95"
                >
                  <Share2 size={22} />
                  Save to Gallery
                </button>
                <button className="flex items-center justify-center gap-3 bg-white text-[#1A1A1A] px-10 py-5 rounded-[24px] font-bold shadow-lg border border-black/5 hover:bg-gray-50 transition-all active:scale-95">
                  <Download size={22} />
                  Download PNG
                </button>
              </div>

              <button
                onClick={resetSession}
                className="w-full text-gray-400 font-semibold hover:text-gray-600 transition-colors"
              >
                Start New Session
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Navigation (Visual only) */}
      <footer className="fixed bottom-0 left-0 right-0 py-6 flex justify-center gap-8 text-pink-200 pointer-events-none opacity-50">
        <Layout size={20} />
        <Sparkles size={20} />
        <Camera size={20} />
        <Share2 size={20} />
        <Download size={20} />
      </footer>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
