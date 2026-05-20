import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud } from 'lucide-react';
import { useCatalogs } from '../services/firebase';

const PRESETS: Record<string, {id: string, title: string, src: string}[]> = {
  'hair-color': [
    { id: 'hc-1', title: 'Auburn Sunset', src: 'https://images.unsplash.com/photo-1595476108010-b4d1f10d5e43?auto=format&fit=crop&w=400&q=80' },
    { id: 'hc-2', title: 'Platinum Ice', src: 'https://images.unsplash.com/photo-1605980776566-0486c3ac7617?auto=format&fit=crop&w=400&q=80' },
    { id: 'hc-3', title: 'Midnight Blue', src: 'https://images.unsplash.com/photo-1616683693504-3ea7e9ad6ece?auto=format&fit=crop&w=400&q=80' }
  ],
  'makeup-transfer': [
    { id: 'mu-1', title: 'Classic Red', src: 'https://images.unsplash.com/photo-1512496115851-a1c8f137768a?auto=format&fit=crop&w=400&q=80' },
    { id: 'mu-2', title: 'Smokey Eye', src: 'https://images.unsplash.com/photo-1503236823255-94609f598e71?auto=format&fit=crop&w=400&q=80' },
  ]
};

export default function ServiceCatalog() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const customItems = useCatalogs(id);
  const fallbacks = PRESETS[id as keyof typeof PRESETS] || [];
  
  // Merge custom db items with the hardcoded presets (custom items go first)
  const combinedPresets = [
      ...customItems.map(c => ({ id: c.id, title: c.title, src: c.imageUrl })), 
      ...fallbacks
  ];

  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  const handleProceed = () => {
    if (selectedStyle || id === 'hair-color') {
      if (id === 'bride-journey') {
        navigate('/bride');
      } else {
        navigate('/try-on', { state: { serviceId: id, styleImage: selectedStyle || undefined } });
      }
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (id === 'bride-journey') {
           navigate('/bride');
        } else {
           navigate('/try-on', { state: { serviceId: id, styleImage: reader.result as string } });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-12">
      <div className="mb-12">
         <span className="text-[9px] uppercase tracking-[0.3em] opacity-40 block mb-4">Preset Palette</span>
         <h2 className="font-serif text-3xl font-bold italic tracking-tight text-[color:var(--color-luxury-rosegold)]">The Selection</h2>
         <p className="text-[color:var(--color-luxury-muted)] text-[10px] uppercase tracking-widest mt-2 opacity-60">Choose from our curated collection or upload your own reference.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-6">
           {combinedPresets.map((preset) => (
             <motion.div 
               layoutId={preset.id}
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               key={preset.id} 
               className={`cursor-pointer group relative overflow-hidden rounded-sm border transition-all duration-300 ${selectedStyle === preset.src ? 'border-[color:var(--color-luxury-accent)] opacity-100 shadow-[0_0_20px_rgba(200,160,110,0.3)]' : 'border-transparent opacity-60 hover:opacity-100'}`}
               onClick={() => setSelectedStyle(preset.src)}
             >
               <img src={preset.src} alt={preset.title} className="w-full aspect-[3/4] object-cover transition-all" referrerPolicy='no-referrer' />
               <div className="absolute bottom-0 w-full p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="font-serif text-sm">{preset.title}</p>
               </div>
             </motion.div>
           ))}
        </div>

        <div className="lg:col-span-1 flex flex-col gap-6">
           <div 
             className="border border-dashed border-[color:var(--color-luxury-accent)]/30 hover:border-[color:var(--color-luxury-accent)] rounded-sm flex flex-col items-center justify-center p-8 aspect-[3/4] cursor-pointer transition-colors bg-[color:var(--color-luxury-charcoal)]"
             onClick={() => fileInputRef.current?.click()}
           >
             <UploadCloud size={32} className="mb-4 text-[color:var(--color-luxury-accent)] opacity-50" />
             <p className="font-bold text-[10px] tracking-wider uppercase text-center mb-2">Custom Upload</p>
             <p className="text-[9px] uppercase tracking-[0.3em] opacity-40 text-center">Your own reference</p>
             <input type="file" hidden accept="image/*" ref={fileInputRef} onChange={handleUpload} />
           </div>

           <button 
             disabled={!selectedStyle && id !== 'hair-color'}
             onClick={handleProceed}
             className={`lux-button-solid w-full py-4 ${!selectedStyle && id !== 'hair-color' ? 'opacity-50 cursor-not-allowed' : ''}`}
           >
             {selectedStyle ? 'Proceed' : id === 'hair-color' ? 'Skip & Configure in App' : 'Proceed'}
           </button>
        </div>
      </div>
    </div>
  );
}
