import React, { useState } from 'react';
import { motion } from 'motion/react';

interface VisualFaceMapProps {
  selectedArea: string;
  onSelectArea: (area: string) => void;
  imageUrl?: string;
}

const regions = [
  { id: 'forehead (botox wrinkles)', label: 'Forehead', path: 'M30 20 Q50 10 70 20 Q80 30 85 40 Q50 35 15 40 Q20 30 30 20 Z', textY: 25 },
  { id: 'eyebrows (botox brow lift)', label: 'Brows', path: 'M20 45 Q35 40 45 45 Q50 40 55 45 Q65 40 80 45 Q85 48 80 50 Q65 45 55 50 Q50 45 45 50 Q35 45 20 50 Z', textY: 48 },
  { id: 'under-eye', label: 'Under Eyes', path: 'M25 55 Q35 55 45 60 Q35 65 25 60 Z M55 60 Q65 55 75 55 Q75 60 65 65 Z', textY: 60 },
  { id: 'cheeks', label: 'Cheeks', path: 'M15 60 Q20 55 30 65 Q35 75 25 80 Q10 70 15 60 Z M85 60 Q80 55 70 65 Q65 75 75 80 Q90 70 85 60 Z', textY: 70 },
  { id: 'nasolabial folds', label: 'Nasolabial', path: 'M35 70 Q40 80 40 90 Q30 85 35 70 Z M65 70 Q60 80 60 90 Q70 85 65 70 Z', textY: 82 },
  { id: 'lips', label: 'Lips', path: 'M35 95 Q50 90 65 95 Q70 98 65 102 Q50 108 35 102 Q30 98 35 95 Z', textY: 100 },
  { id: 'jawline', label: 'Jawline', path: 'M15 85 Q30 110 50 115 Q70 110 85 85 Q90 90 85 100 Q70 125 50 130 Q30 125 15 100 Q10 90 15 85 Z', textY: 110 },
  { id: 'chin', label: 'Chin', path: 'M40 115 Q50 125 60 115 Q50 130 40 115 Z', textY: 125 },
];

export const VisualFaceMap: React.FC<VisualFaceMapProps> = ({ selectedArea, onSelectArea, imageUrl }) => {
  const [hoveredArea, setHoveredArea] = useState<string | null>(null);

  // If there's an image, default to a much more subtle look
  return (
    <div className="relative w-full max-w-[280px] mx-auto aspect-[3/4] select-none my-2 rounded-2xl overflow-hidden border border-[color:var(--theme-border-accent)] bg-[color:var(--theme-surface)]">
      {imageUrl && (
        <img src={imageUrl} alt="Patient output" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <svg viewBox="0 0 100 140" className="absolute inset-0 w-full h-full z-10" preserveAspectRatio="xMidYMid meet">
        {/* Abstract Face Base */}
        {!imageUrl && (
            <path d="M10 50 Q10 10 50 10 Q90 10 90 50 Q90 90 85 105 Q70 140 50 140 Q30 140 15 105 Q10 90 10 50 Z" 
                  fill="var(--theme-bg-elevated)" 
                  stroke="var(--theme-border-accent)" 
                  strokeWidth="1" />
        )}
        
        {/* Regions */}
        {regions.map((region) => {
          const isSelected = selectedArea === region.id;
          const isHovered = hoveredArea === region.id;
          return (
            <g 
                key={region.id} 
                onClick={() => onSelectArea(region.id)} 
                onMouseEnter={() => setHoveredArea(region.id)}
                onMouseLeave={() => setHoveredArea(null)}
                className="cursor-pointer"
            >
              <motion.path
                d={region.path}
                fill={imageUrl ? 'var(--theme-accent)' : (isSelected ? 'var(--theme-accent)' : 'var(--theme-text)')}
                stroke={isSelected ? 'var(--theme-accent)' : (imageUrl ? 'var(--theme-accent)' : 'var(--theme-border-accent)')}
                strokeWidth={isSelected ? '1.5' : (imageUrl ? '0.5' : '0.5')}
                initial={false}
                animate={{
                  fillOpacity: isSelected ? 0.4 : (isHovered ? 0.3 : (imageUrl ? 0 : 0.05)),
                  strokeOpacity: isSelected ? 0.8 : (isHovered ? 0.6 : (imageUrl ? 0.1 : 0.3)),
                }}
                className="transition-all duration-300"
              />
              
              {/* Point Indicator & Text to guide user */}
              {(isHovered || isSelected) && (
                 <g className="pointer-events-none drop-shadow-xl" style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.8))' }}>
                    <text
                        x="50"
                        y={region.textY}
                        textAnchor="middle"
                        fill="white"
                        fontSize="4"
                        fontWeight="bold"
                        className="font-mono uppercase tracking-[0.2em]"
                    >
                        {region.label}
                    </text>
                 </g>
              )}
            </g>
          );
        })}
      </svg>
      {/* Label for selected area */}
      <div className="absolute top-4 left-0 right-0 text-center z-20 pointer-events-none drop-shadow-xl">
        <span className="text-[10px] uppercase tracking-widest text-[color:var(--theme-bg)] font-bold bg-[color:var(--theme-accent)] px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(200,169,126,0.3)]">
          {regions.find(r => r.id === selectedArea)?.label || selectedArea}
        </span>
      </div>
    </div>
  );
};
