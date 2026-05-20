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
  const [aspect, setAspect] = useState<number | undefined>(undefined);
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

    // Limit maximum dimension to 1024px for balanced quality/speed
    const MAX_DIMENSION = 1024;
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
    return canvas.toDataURL('image/jpeg', 0.80);
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
