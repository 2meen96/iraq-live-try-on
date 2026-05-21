import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, Monitor, Smartphone, Square, Maximize } from 'lucide-react';

interface CropModalProps {
  imageSrc: string;
  onCropCancel: () => void;
  onCropComplete: (croppedImageBase64: string) => void;
}

export default function CropModal({ imageSrc, onCropCancel, onCropComplete }: CropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  
  // Custom Aspect Ratios: Free/Original (0), 1:1, 3:4, 16:9, etc.
  const [aspect, setAspect] = useState<number | undefined>(3 / 4);
  const [originalAspect, setOriginalAspect] = useState<number>(1);

  const onCropCompleteEvent = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const onMediaLoaded = useCallback((mediaSize: { width: number; height: number }) => {
    setOriginalAspect(mediaSize.width / mediaSize.height);
  }, []);

  const currentAspect = aspect || originalAspect;

  const createImage = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return '';
    }

    // Limit maximum dimension to 2048px for better AI face detection
    const MAX_DIMENSION = 2048;
    let targetWidth = pixelCrop.width;
    let targetHeight = pixelCrop.height;
    
    if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
        if (targetWidth > targetHeight) {
            targetHeight = Math.round((targetHeight * MAX_DIMENSION) / targetWidth);
            targetWidth = MAX_DIMENSION;
        } else {
            targetWidth = Math.round((targetWidth * MAX_DIMENSION) / targetHeight);
            targetHeight = MAX_DIMENSION;
        }
    }

    // Set canvas dimensions to the cropped size.
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Draw the cropped image onto the canvas.
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      targetWidth,
      targetHeight
    );

    // Convert the canvas to a base64 string.
    return canvas.toDataURL('image/jpeg', 0.95);
  };

  const handleDone = async () => {
    if (croppedAreaPixels) {
      try {
        const croppedBase64 = await getCroppedImg(imageSrc, croppedAreaPixels);
        onCropComplete(croppedBase64);
      } catch (e) {
        console.error(e);
        onCropCancel();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[color:var(--theme-bg)] border border-[color:var(--theme-border)] rounded-2xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="p-4 border-b border-[color:var(--theme-border)] flex justify-between items-center bg-[color:var(--theme-bg-elevated)]">
          <h3 className="font-serif italic text-xl text-[color:var(--theme-text)]">Crop Image</h3>
          <button onClick={onCropCancel} className="text-[color:var(--theme-text-muted)] hover:text-[color:var(--theme-text)] transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Cropper Container */}
        <div className="flex-1 relative bg-black/10">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={currentAspect}
            onCropChange={setCrop}
            onCropComplete={onCropCompleteEvent}
            onMediaLoaded={onMediaLoaded}
            onZoomChange={setZoom}
          />
          {/* Advanced HUD Face Scale Guide */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 overflow-hidden">
              <div 
                  className="relative flex items-center justify-center pointer-events-none" 
                  style={{ width: '180px', height: '240px' }}
              >
                  {/* HUD Info Panel */}
                  <div className="absolute -top-20 w-[280px] flex flex-col items-center">
                       <span className="bg-black/95 backdrop-blur-md text-[#d4af37] text-[10px] sm:text-[11px] font-bold tracking-widest px-4 py-1.5 rounded-t-xl uppercase border-b border-[#d4af37]/30 border-x border-t border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.8)]">
                           نطاق الوجه الآمن (60%)
                       </span>
                       <span className="bg-black/80 backdrop-blur-sm text-white/90 text-[10px] sm:text-[11px] font-medium px-4 py-2.5 rounded-b-xl rounded-tl-xl shadow-xl border border-white/10 text-center leading-relaxed">
                           قم بتصغير الصورة حتى يقع الوجه بالكامل داخل الإطار ليتم معالجته بدقة.
                           <br />
                           <span className="opacity-60 text-[9px]">يجب ترك مساحة فارغة للرأس من الأعلى والأسفل</span>
                       </span>
                  </div>

                  {/* Corner Target Marks */}
                  <div className="absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] border-[#d4af37] opacity-80 rounded-tl-2xl shadow-[0_0_10px_rgba(212,175,55,0.4)]"></div>
                  <div className="absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] border-[#d4af37] opacity-80 rounded-tr-2xl shadow-[0_0_10px_rgba(212,175,55,0.4)]"></div>
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] border-[#d4af37] opacity-80 rounded-bl-2xl shadow-[0_0_10px_rgba(212,175,55,0.4)]"></div>
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] border-[#d4af37] opacity-80 rounded-br-2xl shadow-[0_0_10px_rgba(212,175,55,0.4)]"></div>

                  {/* Aesthetic Head Silhouette */}
                  <svg viewBox="0 0 100 130" className="absolute w-[60%] h-[60%] opacity-[0.25] drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" fill="none" stroke="white" strokeWidth="1.5">
                      <path d="M 20 45 C 20 15, 80 15, 80 45 C 80 85, 65 115, 50 120 C 35 115, 20 85, 20 45 Z" strokeDasharray="3 3"/>
                  </svg>

                  {/* Alignment Crosshairs & Lines */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#d4af37] shadow-[0_0_8px_rgba(212,175,55,0.8)]"></div>
                  <div className="absolute top-[35%] w-[80%] border-t border-white/20 border-dashed">
                       <span className="absolute -top-3 left-0 text-[7px] text-white/40 tracking-widest uppercase">Eye Level</span>
                  </div>
                  <div className="absolute top-[70%] w-[50%] border-t border-white/10 border-dashed">
                       <span className="absolute -top-3 left-0 text-[7px] text-white/30 tracking-widest uppercase">Mouth</span>
                  </div>
              </div>
          </div>
        </div>

        {/* Controls: Aspect Ratio */}
        <div className="p-3 border-t border-[color:var(--theme-border)] bg-[color:var(--theme-bg)] flex justify-center gap-2 overflow-x-auto hide-scrollbar">
           <button onClick={() => setAspect(undefined)} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] uppercase tracking-widest transition-colors ${!aspect ? 'bg-[color:var(--color-luxury-accent)] text-white' : 'bg-[color:var(--theme-bg-elevated)] text-[color:var(--theme-text-muted)] hover:text-[color:var(--theme-text)]'}`}>
              <Maximize size={14} /> Orginal
           </button>
           <button onClick={() => setAspect(3 / 4)} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] uppercase tracking-widest transition-colors ${aspect === 3 / 4 ? 'bg-[color:var(--color-luxury-accent)] text-white' : 'bg-[color:var(--theme-bg-elevated)] text-[color:var(--theme-text-muted)] hover:text-[color:var(--theme-text)]'}`}>
              <Smartphone size={14} /> 3:4
           </button>
           <button onClick={() => setAspect(1)} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] uppercase tracking-widest transition-colors ${aspect === 1 ? 'bg-[color:var(--color-luxury-accent)] text-white' : 'bg-[color:var(--theme-bg-elevated)] text-[color:var(--theme-text-muted)] hover:text-[color:var(--theme-text)]'}`}>
              <Square size={14} /> 1:1
           </button>
           <button onClick={() => setAspect(16 / 9)} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] uppercase tracking-widest transition-colors ${aspect === 16 / 9 ? 'bg-[color:var(--color-luxury-accent)] text-white' : 'bg-[color:var(--theme-bg-elevated)] text-[color:var(--theme-text-muted)] hover:text-[color:var(--theme-text)]'}`}>
              <Monitor size={14} /> 16:9
           </button>
        </div>

        {/* Footer Controls */}
        <div className="p-4 border-t border-[color:var(--theme-border)] bg-[color:var(--theme-bg-elevated)] flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 w-full relative flex items-center gap-4">
             <span className="text-[10px] text-[color:var(--theme-text-muted)] uppercase tracking-widest">Zoom</span>
             <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-[color:var(--color-luxury-accent)]"
              />
          </div>
          <button 
            onClick={handleDone}
            className="lux-button-solid py-3 px-6 text-[10px] uppercase tracking-widest flex items-center gap-2 rounded-lg w-full sm:w-auto justify-center"
          >
            <Check size={14} /> Confirm Crop
          </button>
        </div>
      </div>
    </div>
  );
}
