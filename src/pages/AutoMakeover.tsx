import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { UploadCloud, Wand2, Check, Sparkles, ArrowLeft } from 'lucide-react';
import { useAuth } from '../services/firebase';
import ImageComparisonSlider from '../components/ImageComparisonSlider';
import { autoMakeoverMultipleSuggestions, simulateAR } from '../services/ai';
import CropModal from '../components/CropModal';

export default function AutoMakeover() {
  const { user } = useAuth();
  
  const [targetImage, setTargetImage] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  
  const [resultImages, setResultImages] = useState<{style: string, image: string}[] | null>(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUploadRef = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processAutoMakeover = async () => {
    setErrorMsg(null);
    if (!targetImage || !user) {
      if (!user) setErrorMsg("Sign in required to generate AI simulations.");
      return;
    }

    setLoading(true);
    setProgress(0);
    setLoadingMessage('جاري تحليل ملامح الوجه علمياً...');
    
    progressInterval.current = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 5 + 1, 95));
    }, 600);

    try {
      // Step 1: AI analysis
      const analysisPrompts = await autoMakeoverMultipleSuggestions(targetImage);
      
      setLoadingMessage('تم الانتهاء من التحليل. جاري توليد الإطلالات...');
      setProgress(50);
      
      // Initialize results with pending status
      const initialResults = analysisPrompts.map(style => ({ style, image: '' }));
      setResultImages(initialResults);
      setLoading(false); // Stop main loading, show grid
      
      // Step 2: Apply
      // Call simulateAR for each, and update the specific item when done
      const generateForPrompt = async (prompt: string, index: number) => {
        try {
            const res = await simulateAR(
                targetImage, 
                null, 
                `CRITICAL INSTRUCTION: Analyze the Target User Image and automatically apply a full makeover according to scientific beauty standards. This includes full makeup, hair styling, and hair color adjustment. Use the following AI analysis for reference: ${prompt}`, 
                'general'
            );
            setResultImages(prev => {
                if (!prev) return prev;
                const updated = [...prev];
                updated[index] = { ...updated[index], image: res };
                return updated;
            });
        } catch (err) {
            console.error('Failed to generate option', index, err);
            // Optionally handle individual error visually
        }
      };

      // To avoid 503 errors from concurrency limit, we make them strictly sequential with a delay
      for (let i = 0; i < analysisPrompts.length; i++) {
          await generateForPrompt(analysisPrompts[i], i);
          if (i < analysisPrompts.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 8000));
          }
      }
      
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || 'Generation failed. Please try again.');
    } finally {
      if (progressInterval.current) clearInterval(progressInterval.current);
      setLoading(false);
      setProgress(0);
    }
  };

  const handleReset = () => {
      setResultImages(null);
      setSelectedResultIndex(null);
  };

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-12 md:py-24">
      <div className="mb-16 text-center">
        <span className="text-[9px] text-[color:var(--theme-text-muted)] uppercase tracking-[0.3em] block mb-4">One Click Magic</span>
        <h2 className="font-serif text-4xl md:text-5xl italic font-bold">
          AI Auto <span className="text-[color:var(--color-luxury-accent)]">Makeover</span>
        </h2>
        <p className="text-[11px] uppercase tracking-widest text-[color:var(--theme-text-muted)] mt-4 max-w-xl mx-auto leading-relaxed">
           Upload your photo and let our advanced AI analyze your facial features and skin tone to automatically apply 3 distinct, scientifically flattering makeovers.
        </p>
      </div>

      {errorMsg && (
        <div className="w-full max-w-lg mx-auto bg-red-950/20 border border-red-900/50 text-red-500 text-[10px] p-4 text-center rounded-sm mb-8">
          {errorMsg}
        </div>
      )}

      {imageToCrop && (
         <CropModal
            imageSrc={imageToCrop}
            onCropComplete={(croppedImage) => {
               setTargetImage(croppedImage);
               setImageToCrop(null);
            }}
            onCropCancel={() => setImageToCrop(null)}
         />
      )}

      <div className="w-full">
        {loading ? (
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="flex flex-col items-center justify-center py-20"
             >
                <div className="w-12 h-12 border-t-2 border-[color:var(--color-luxury-accent)] rounded-full animate-spin mb-6" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--theme-text-muted)] mb-4">{loadingMessage}</p>
                <div className="w-64 h-1 bg-[color:var(--theme-border)] rounded-full overflow-hidden">
                   <div className="h-full bg-[color:var(--color-luxury-accent)] transition-all duration-300" style={{width: `${progress}%`}} />
                </div>
             </motion.div>
        ) : !resultImages ? (
          <motion.div initial={{opacity:0, scale:0.98}} animate={{opacity:1, scale:1}} className="flex flex-col items-center gap-8">
            <div className={`relative w-64 h-64 border-2 border-dashed ${targetImage ? 'border-[color:var(--color-luxury-accent)]' : 'border-[color:var(--theme-border)]'} rounded-full flex flex-col items-center justify-center bg-[color:var(--theme-bg-elevated)] overflow-hidden group cursor-pointer transition-colors`}>
              <input type="file" accept="image/*" onChange={handleUploadRef} className="absolute inset-0 opacity-0 cursor-pointer z-20" />
              {targetImage ? (
                <>
                  <div className="absolute inset-0 bg-black/40 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[10px] uppercase tracking-widest text-white">Change Photo</span>
                  </div>
                  <img src={targetImage} alt="Target" className="w-full h-full object-cover" />
                </>
              ) : (
                <div className="flex flex-col items-center text-[color:var(--theme-text-muted)] group-hover:text-[color:var(--color-luxury-accent)] transition-colors">
                  <UploadCloud size={32} className="mb-4 stroke-[1.5]" />
                  <span className="text-[9px] uppercase tracking-widest text-center px-4">Upload Your Photo</span>
                </div>
              )}
            </div>

            <button 
              onClick={processAutoMakeover}
              disabled={!targetImage}
              className={`mt-4 lux-button-solid py-4 px-12 flex justify-center items-center gap-2 ${!targetImage ? 'opacity-50' : ''}`}
            >
              Start AI Makeover <Sparkles size={14} />
            </button>
          </motion.div>
        ) : selectedResultIndex !== null ? (
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="flex flex-col items-center gap-12"
             >
               <div className="w-full max-w-4xl flex justify-between items-center mb-4">
                   <button onClick={() => setSelectedResultIndex(null)} className="text-[10px] uppercase tracking-widest text-[color:var(--theme-text-muted)] hover:text-white transition-colors flex items-center gap-2">
                       <ArrowLeft size={14} /> Back to Options
                   </button>
                   <span className="text-[10px] uppercase tracking-widest text-[color:var(--color-luxury-accent)]">Option {selectedResultIndex + 1}</span>
               </div>
               
               <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto">
                  <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} className="w-full max-w-[450px] mx-auto p-4 bg-[color:var(--theme-bg-elevated)] border border-[color:var(--color-luxury-accent)]/30 rounded-xl mb-6">
                     <h4 className="text-[10px] uppercase tracking-widest text-[color:var(--color-luxury-accent)] flex items-center gap-2 mb-3">
                         <Sparkles size={12} /> AI Aesthetic Analysis
                     </h4>
                     <p className="text-[10px] text-[color:var(--theme-text-muted)] leading-relaxed mb-3">
                         {resultImages[selectedResultIndex].style}
                     </p>
                  </motion.div>
                  <ImageComparisonSlider 
                     beforeImage={targetImage!} 
                     afterImage={resultImages[selectedResultIndex].image} 
                     isLoading={false} 
                     loadingProgress={100}
                     loadingMessage=""
                  />
               </div>
             </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-12"
          >
             <h3 className="text-xl font-serif italic mb-8">Select Your Preferred Look</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl mx-auto">
                 {resultImages.map((result, idx) => (
                    <motion.div 
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={`flex flex-col items-center gap-4 ${result.image ? 'cursor-pointer group' : ''}`}
                        onClick={() => result.image && setSelectedResultIndex(idx)}
                    >
                        <div className="w-full aspect-[3/4] rounded-lg overflow-hidden border border-[color:var(--theme-border)] group-hover:border-[color:var(--color-luxury-accent)] transition-colors relative bg-[color:var(--theme-bg-elevated)] flex flex-col items-center justify-center">
                            {result.image ? (
                                <>
                                    <img src={result.image} alt={`Option ${idx+1}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="lux-button-outline px-6 py-2 text-[9px] bg-black/60 backdrop-blur-sm">View Details</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center px-4 opacity-70">
                                    <div className="w-8 h-8 border-t-2 border-[color:var(--color-luxury-accent)] rounded-full animate-spin mb-4" />
                                    <span className="text-[10px] uppercase tracking-widest text-[color:var(--color-luxury-accent)] mb-2 animate-pulse">جاري التوليد...</span>
                                </div>
                            )}
                        </div>
                        <div className="p-3 text-center">
                            <span className="text-[10px] uppercase tracking-widest text-[color:var(--color-luxury-accent)] mb-2 block">إطلالة {idx + 1}</span>
                            <p className="text-[9px] text-[color:var(--theme-text-muted)] line-clamp-3 leading-relaxed" dir="rtl">
                                {result.style}
                            </p>
                        </div>
                    </motion.div>
                 ))}
             </div>
            
            <button onClick={handleReset} className="lux-button-outline py-3 px-8 text-[10px] gap-2 flex items-center justify-center mt-12">
               Try Another Photo
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
