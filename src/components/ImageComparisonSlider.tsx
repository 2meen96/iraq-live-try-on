import { Check } from 'lucide-react';

interface Props {
  beforeImage?: string; // Kept for backwards compatibility
  afterImage: string;
  isLoading?: boolean;
  loadingProgress?: number;
  loadingMessage?: string;
}

export default function ImageComparisonSlider({ afterImage, isLoading, loadingProgress = 0, loadingMessage = 'Re-engineering image...' }: Props) {
  return (
    <div className="relative w-full max-w-xl mx-auto overflow-hidden rounded-sm select-none border border-[color:var(--color-luxury-accent)]/50 shadow-2xl flex bg-[color:var(--theme-bg)] transition-all duration-300">
      
      {/* Result Image */}
      <img src={afterImage} alt="Final AR Result" className="block w-full h-auto object-contain pointer-events-none" />

      {/* Loading Overlay */}
      {isLoading && (
         <div className="absolute inset-0 bg-black/70 flex p-6 items-center flex-col justify-center gap-6 z-20 backdrop-blur-sm pointer-events-none">
             <div className="w-full max-w-[200px] flex flex-col items-center gap-4">
                <div className="w-full bg-[color:var(--theme-bg)]/30 rounded-full h-1 overflow-hidden backdrop-blur-md">
                   <div 
                      className="bg-[color:var(--color-luxury-accent)] h-full transition-all duration-300 ease-out"
                      style={{ width: `${loadingProgress}%` }}
                   />
                </div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-luxury-pearl)] font-medium text-center">{loadingMessage}</span>
             </div>
         </div>
      )}
    </div>
  );
}
