import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UploadCloud, ArrowRight, Camera, Palette, Sparkles, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { simulateAR, suggestStyles, AIStyleSuggestion, extractColorPalette, ColorPaletteItem, extractStyleDetails } from '../services/ai';
import { useAuth, saveTryOn } from '../services/firebase';
import ImageComparisonSlider from '../components/ImageComparisonSlider';
import CropModal from '../components/CropModal';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function TryOn() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { serviceId, styleImage } = location.state || {};
  
  const [targetImage, setTargetImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsApiKey, setNeedsApiKey] = useState(false);
  
  const [analyzingHair, setAnalyzingHair] = useState(false);
  const [hairSuggestions, setHairSuggestions] = useState<AIStyleSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AIStyleSuggestion | null>(null);
  const [manualColor, setManualColor] = useState('');
  const [localStyleImage, setLocalStyleImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'manual' | 'ai'>('manual');
  const [makeupToggles, setMakeupToggles] = useState({ eyes: true, lips: true, foundation: true });
  const [makeupIntensity, setMakeupIntensity] = useState(50);
  
  const [detectedPalette, setDetectedPalette] = useState<ColorPaletteItem[]>([]);
  const [detectingPalette, setDetectingPalette] = useState(false);
  const [extractedStyleInfo, setExtractedStyleInfo] = useState<any>(null);

  const [isDraggingRef, setIsDraggingRef] = useState(false);
  const [isDraggingTarget, setIsDraggingTarget] = useState(false);

  const [pendingCropTargetImage, setPendingCropTargetImage] = useState<string | null>(null);
  const [pendingCropRefImage, setPendingCropRefImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const localStyleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
     let isMounted = true;
     const styleImg = localStyleImage || styleImage;
     if (styleImg && serviceId !== 'hair-styling') {
         setDetectingPalette(true);
         extractColorPalette(styleImg, serviceId === 'makeup-transfer' ? 'makeup' : 'hair').then(palette => {
             if (isMounted) setDetectedPalette(palette);
         }).finally(() => {
             if (isMounted) setDetectingPalette(false);
         });
     } else {
         setDetectedPalette([]);
     }
     return () => { isMounted = false; };
  }, [localStyleImage, styleImage, serviceId]);

  if (!serviceId) {
    return <div className="p-12 text-center micro-label">Missing session context. Please go back and select a style.</div>;
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPendingCropTargetImage(reader.result as string);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLocalStyleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPendingCropRefImage(reader.result as string);
        if (localStyleInputRef.current) localStyleInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOverRef = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingRef(true);
  };

  const handleDragLeaveRef = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingRef(false);
  };

  const handleDropRef = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingRef(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPendingCropRefImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOverTarget = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingTarget(true);
  };

  const handleDragLeaveTarget = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingTarget(false);
  };

  const handleDropTarget = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingTarget(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPendingCropTargetImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropTargetComplete = (croppedBase64: string) => {
    setTargetImage(croppedBase64);
    setHairSuggestions([]);
    setSelectedSuggestion(null);
    setManualColor('');
    setLocalStyleImage(null);
    setPendingCropTargetImage(null);
  };

  const handleCropRefComplete = (croppedBase64: string) => {
    setLocalStyleImage(croppedBase64);
    setManualColor('');
    setSelectedSuggestion(null);
    setPendingCropRefImage(null);
  };

  const handleHairAnalysis = async () => {
    if (!targetImage) return;
    setAnalyzingHair(true);
    setErrorMsg(null);
    try {
      const suggestions = await suggestStyles(targetImage, serviceId);
      setHairSuggestions(suggestions);
    } catch (err: any) {
      console.warn(err);
      const isQuotaExceeded = err?.message?.includes('429') || err?.status === 'RESOURCE_EXHAUSTED' || err?.message?.includes('quota');
      if (isQuotaExceeded) {
        setErrorMsg('Free tier quota exceeded or rate limit reached. Please provide a custom API Key to continue.');
        setNeedsApiKey(true);
      } else {
        setErrorMsg(err.message || 'Analysis failed. Please try again.');
      }
    } finally {
      setAnalyzingHair(false);
    }
  };

  const processGeneration = async (isRefinement = false) => {
    setErrorMsg(null);
    if (!isRefinement) setExtractedStyleInfo(null);
    if (!targetImage || !user) {
      if (!user) setErrorMsg("Sign in required to generate AI simulations.");
      return;
    }

    if (['hair-color', 'makeup-transfer', 'nail-art', 'lenses'].includes(serviceId) && !styleImage && !localStyleImage && !isRefinement && !selectedSuggestion && manualColor.trim() === '') {
        setErrorMsg('Please provide a reference image, select an AI suggested color/style, or type a manual style.');
        return;
    }

    setLoading(true);
    setProgress(0);
    setLoadingMessage('نُحلل ملامح الوجه..');

    progressInterval.current = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 5 + 1, 95));
    }, 600);

    try {
      const promptMap: Record<string, string> = {
        'hair-color': "CRITICAL INSTRUCTION: You are an expert hair colorist AI. Your ONLY job is to change the color of the hair in the TARGET USER IMAGE to exactly match the hair color in the STYLE REFERENCE IMAGE.\n\nMANDATE:\n1. The original hair color in the TARGET USER IMAGE must be 100% REPLACED and OVERWRITTEN.\n2. Do NOT try to blend the new color with the old color. If the target is dark black and the reference is bright blonde, the result MUST BE bright blonde.\n3. Make sure to color EVERY SINGLE strand of hair, including the roots and the ends.\n4. You are strictly forbidden from altering the target user's face, skin tone, makeup, eyes, lips, under-eye area, hands, or background. ANY color spill onto the skin or makeup is a complete failure. Only the hair strands should change color. Keep the original lipstick and eyeshadow EXACTLY the same.",
        'makeup-transfer': "CRITICAL INSTRUCTION: You are performing a MAKEUP TRANSFER operation. Extract the FULL MAKEUP LOOK from the Style Reference (lipstick, foundation, eyeshadow, eyeliner, blush).\n\nMANDATE:\n1. Apply this exact makeup onto the Target User vividly.\n2. DO NOT change the user's hair color, facial structure, identity, or background.\n3. The final output must be exactly the TARGET USER wearing the reference's complete makeup.",
        'nail-art': "CRITICAL INSTRUCTION: You are performing a NAIL ART transfer. Apply the exact nail polish color and art from the Style Reference onto the user's nails.\n\nMANDATE:\n1. ONLY alter the nails.\n2. DO NOT alter the hands, skin tone, rings, or background.",
        'fillers-botox': "CRITICAL INSTRUCTION: You are performing a SUBTLE AESTHETIC enhancement. Apply a highly subtle, natural-looking aesthetic touch (e.g., smoothed fine lines, subtle lip hydration) inspired by the Style Reference.\n\nMANDATE: MUST preserve 100% of the user's core facial identity, makeup, eye shape, hair, and bone structure.",
        'lenses': "CRITICAL INSTRUCTION: You are performing an EYE COLOR change. Extract the exact eye (iris) color from the Style Reference and apply it to the Target User Image.\n\nMANDATE:\n1. ONLY alter the irises.\n2. DO NOT change the facial identity, skin, makeup, hair, or background."
      };
      
      let basePrompt = promptMap[serviceId] || 'Perform highly precise AR try-on matching the reference image. Preserve core identity completely.';
      let userImagePayload = targetImage;
      let styleImagePayload: string | undefined = localStyleImage || styleImage;

      if (serviceId === 'hair-color' && manualColor.trim() !== '' && !isRefinement) {
          styleImagePayload = undefined;
          basePrompt = `CRITICAL INSTRUCTION: You are an expert hair colorist AI. Change the color of the hair in the TARGET USER IMAGE to exactly this color: ${manualColor.trim()}.
MANDATE:
1. The original hair color MUST be 100% REPLACED.
2. Color EVERY SINGLE strand of hair. 
3. Protect the user's face, skin tone, makeup, lips, and under-eye area completely. ONLY change the hair color.`;
      } else if (serviceId === 'hair-color' && selectedSuggestion && !isRefinement) {
          styleImagePayload = undefined;
          basePrompt = `CRITICAL INSTRUCTION: You are an expert hair colorist AI. Change the color of the hair in the TARGET USER IMAGE to exactly: ${selectedSuggestion.colorName} (Hex: ${selectedSuggestion.hexCode}).
MANDATE:
1. The original hair color MUST be 100% REPLACED.
2. Color EVERY SINGLE strand of hair. 
3. Protect the user's face, skin tone, makeup, lips, and under-eye area completely. ONLY change the hair color.`;
      } else if (serviceId === 'makeup-transfer' && manualColor.trim() !== '' && !isRefinement) {
          styleImagePayload = undefined;
          basePrompt = `CRITICAL INSTRUCTION: You are an expert makeup artist AI. Apply exactly this makeup style to the TARGET USER IMAGE: ${manualColor.trim()}.
MANDATE:
1. Apply the makeup vividly and realistically.
2. Protect the user's hair color, facial identity, eye color, and background perfectly. ONLY apply makeup.`;
      } else if (serviceId === 'makeup-transfer' && selectedSuggestion && !isRefinement) {
          styleImagePayload = undefined;
          basePrompt = `CRITICAL INSTRUCTION: You are an expert makeup artist AI. Apply exactly this makeup style to the TARGET USER IMAGE: ${selectedSuggestion.colorName}.
MANDATE:
1. Apply the makeup vividly and realistically.
2. Protect the user's hair color, facial identity, eye color, and background perfectly. ONLY apply makeup.`;
      } else if (serviceId === 'nail-art' && manualColor.trim() !== '' && !isRefinement) {
          styleImagePayload = undefined;
          basePrompt = `CRITICAL INSTRUCTION: You are an expert nail artist AI. Change the nail polish/art in the TARGET USER IMAGE to exactly this style: ${manualColor.trim()}.
MANDATE:
1. Change ONLY the nails.
2. Protect the hands, skin tone, rings, background, and everything else entirely.`;
      } else if (serviceId === 'nail-art' && selectedSuggestion && !isRefinement) {
          styleImagePayload = undefined;
          basePrompt = `CRITICAL INSTRUCTION: You are an expert nail artist AI. Change the nail polish/art in the TARGET USER IMAGE to exactly this style: ${selectedSuggestion.colorName} (Hex: ${selectedSuggestion.hexCode}).
MANDATE:
1. Change ONLY the nails.
2. Protect the hands, skin tone, rings, background, and everything else entirely.`;
      } else if (serviceId === 'lenses' && manualColor.trim() !== '' && !isRefinement) {
          styleImagePayload = undefined;
          basePrompt = `CRITICAL INSTRUCTION: You are an expert AI photo editor. Change the eye color of the TARGET USER IMAGE to exactly this description/hex: ${manualColor.trim()}.
MANDATE:
1. ONLY alter the irises.
2. Protect the face, skin tone, makeup, hair, and background completely.`;
      } else if (serviceId === 'lenses' && selectedSuggestion && !isRefinement) {
          styleImagePayload = undefined;
          basePrompt = `CRITICAL INSTRUCTION: You are an expert AI photo editor. Change the eye color of the TARGET USER IMAGE to exactly: ${selectedSuggestion.colorName} (Hex: ${selectedSuggestion.hexCode}).
MANDATE:
1. ONLY alter the irises.
2. Protect the face, skin tone, makeup, hair, and background completely.`;
      }

      if (isRefinement && adjustment.trim() !== '' && resultImage) {
          // If it's a refinement, use the previously generated AI result as the user's base face.
          userImagePayload = resultImage;
          styleImagePayload = undefined; // Drop the style image so AI focuses entirely on text adjustment
          basePrompt = `[CLIENT REVISION REQUEST]: ${adjustment.trim()}

CRITICAL MANDATE:
1. EXTREME ISOLATION: ONLY change the specific element mentioned in the revision request. Do absolutely nothing else.
2. For example, if asked to change the eyeshadow color, you MUST keep the lipstick, eyeliner, blush, and foundation EXACTLY the same color and style they currently are. Do NOT touch any other facial feature.
3. If asked to change lipstick, keep eyes EXACTLY as they are.
4. Protect the identity, lighting, background, and skin texture completely.`;
      }

      if (styleImagePayload && styleImagePayload.startsWith('http')) {
          try {
              const res = await fetch(styleImagePayload);
              if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
              const blob = await res.blob();
              styleImagePayload = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.readAsDataURL(blob);
                  reader.onloadend = () => resolve(reader.result as string);
              });
          } catch (e) {
              console.warn("Failed to convert image url to base64", e);
              throw new Error("فشل تحميل الصورة المرجعية. يرجى اختيار صورة أخرى.");
          }
      }

      const operationType = serviceId === 'hair-color' ? 'hair' : (serviceId === 'makeup-transfer' ? 'makeup' : 'general');
      
      let styleDetailsObj = null;
      if (styleImagePayload && !isRefinement && (operationType === 'makeup' || operationType === 'hair')) {
          setLoadingMessage('نستخلص الألوان المرجعية بدقة..');
          try {
              styleDetailsObj = await extractStyleDetails(styleImagePayload, operationType);
              setExtractedStyleInfo(styleDetailsObj);
          } catch (e) {
              console.warn("Failed to extract specific style details", e);
          }
      }

      setLoadingMessage('نطبق اللمسات السحرية..');
      const result = await simulateAR(userImagePayload, styleImagePayload, basePrompt, operationType, serviceId === 'makeup-transfer' ? makeupToggles : undefined, serviceId === 'makeup-transfer' ? makeupIntensity : undefined, styleDetailsObj);
      
      setResultImage(result);
      if (!isRefinement) {
          setAdjustment('');
      }
      
      // Save session in background
      saveTryOn(user.uid, serviceId, styleImage, targetImage, result).catch(console.warn);
    } catch (err: any) {
      console.warn(err);
      const isPermissionDenied = err?.message?.includes('403') || err?.status === 'PERMISSION_DENIED' || err?.message?.includes('caller does not have permission');
      const isQuotaExceeded = err?.message?.includes('429') || err?.status === 'RESOURCE_EXHAUSTED' || err?.message?.includes('quota');
      
      if (isPermissionDenied || isQuotaExceeded) {
        setErrorMsg(isQuotaExceeded 
          ? 'Free tier quota exceeded or rate limit reached. Please provide a custom API Key to continue.'
          : 'Advanced generation requires a custom Google Cloud API key.');
        setNeedsApiKey(true);
      } else {
        setErrorMsg(err?.message || 'Generation failed. Please try again.');
      }
    } finally {
      if (progressInterval.current) clearInterval(progressInterval.current);
      setProgress(100);
      setLoading(false);
    }
  };

  const handleProvideKey = async () => {
    setNeedsApiKey(false);
    setErrorMsg('To use your custom API key: 1. Click on Settings (gear icon in AI Studio). 2. Go to Secrets. 3. Add USER_GEMINI_API_KEY with your API key.');
  };

  return (
    <>
    <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-12">
      <div className="mb-12 text-center">
         <span className="text-[9px] uppercase tracking-[0.3em] opacity-40 block mb-4">Processing Layer v2.1</span>
         <h2 className="font-serif text-3xl font-bold italic text-[color:var(--color-luxury-rosegold)] tracking-tight">The Simulation</h2>
      </div>

      {!resultImage ? (
        <>
          {['hair-color', 'makeup-transfer', 'nail-art', 'lenses'].includes(serviceId) ? (
            <div className={`grid grid-cols-1 ${targetImage ? 'md:grid-cols-2' : ''} gap-12 items-start justify-items-center max-w-4xl mx-auto`}>
              
              {/* Target Upload First */}
              <div className="space-y-6 flex flex-col items-center">
                 <p className="font-bold text-[10px] uppercase tracking-wider text-[color:var(--color-luxury-accent)]">Step 1: Upload Your Portrait</p>
                 
                 {!targetImage ? (
                    <div 
                      className={`w-64 aspect-[3/4] border border-dashed rounded-sm flex flex-col items-center justify-center cursor-pointer transition-colors bg-[color:var(--theme-bg-elevated)] ${isDraggingTarget ? 'border-[color:var(--color-luxury-accent)] bg-[color:var(--color-luxury-accent)]/10' : 'border-[color:var(--theme-border)] hover:bg-[color:var(--theme-border)]'}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={handleDragOverTarget}
                      onDragLeave={handleDragLeaveTarget}
                      onDrop={handleDropTarget}
                    >
                      <Camera size={40} className="mb-4 text-[color:var(--color-luxury-accent)] opacity-50" />
                      <p className="font-bold text-[10px] uppercase tracking-wider">{isDraggingTarget ? 'Drop Image Here' : 'Capture or Upload'}</p>
                      <span className="text-[8px] text-[color:var(--theme-text-muted)] mt-2">or drag and drop</span>
                    </div>
                 ) : (
                    <div className="w-64 aspect-[3/4] rounded-sm overflow-hidden border border-[color:var(--theme-border)] relative">
                       <img src={targetImage} alt="Target" className="w-full h-full object-cover" />
                       <button 
                         onClick={() => {
                             setTargetImage(null);
                             setSelectedSuggestion(null);
                             setManualColor('');
                             setLocalStyleImage(null);
                         }}
                         className="absolute top-2 right-2 bg-[color:var(--theme-bg)]/50 border border-[color:var(--color-luxury-accent)]/30 p-2 rounded-sm text-[9px] uppercase tracking-widest text-[color:var(--theme-text)]"
                       >
                         Clear
                       </button>
                    </div>
                 )}
                 <input type="file" hidden accept="image/*" ref={fileInputRef} onChange={handleUpload} />
              </div>

              {/* Color Strategy - Only visible if target image uploaded */}
              {targetImage && (
                <div className="w-full max-w-md space-y-6 flex flex-col pt-2">
                   <p className="font-bold text-[10px] uppercase tracking-wider text-[color:var(--color-luxury-accent)] text-center">Step 2: Choose Color Strategy</p>
                   
                   <div className="flex bg-[color:var(--color-luxury-charcoal)] border border-[color:var(--color-luxury-accent)]/30 p-1 rounded-sm gap-1">
                     <button onClick={() => setActiveTab('upload')} className={`flex-1 py-2 text-[9px] uppercase tracking-widest transition-colors rounded-sm ${activeTab === 'upload' ? 'bg-[color:var(--color-luxury-accent)] text-[color:var(--theme-bg)] font-semibold' : 'text-[color:var(--theme-text-muted)] hover:text-[color:var(--theme-text)]'}`}>Upload Ref</button>
                     <button onClick={() => setActiveTab('manual')} className={`flex-1 py-2 text-[9px] uppercase tracking-widest transition-colors rounded-sm ${activeTab === 'manual' ? 'bg-[color:var(--color-luxury-accent)] text-[color:var(--theme-bg)] font-semibold' : 'text-[color:var(--theme-text-muted)] hover:text-[color:var(--theme-text)]'}`}>Type Color</button>
                     <button onClick={() => setActiveTab('ai')} className={`flex-1 py-2 text-[9px] uppercase tracking-widest transition-colors rounded-sm ${activeTab === 'ai' ? 'bg-[color:var(--color-luxury-accent)] text-[color:var(--theme-bg)] font-semibold' : 'text-[color:var(--theme-text-muted)] hover:text-[color:var(--theme-text)]'}`}>AI Analysis</button>
                   </div>

                   <div className="min-h-[200px] flex flex-col justify-center">
                     {activeTab === 'upload' && (
                       <div className="space-y-4 flex flex-col items-center">
                           <p className="text-[10px] text-[#A0A0A0] text-center mb-2">Have a reference photo? We'll match its exact style.</p>
                           {!(localStyleImage || styleImage) ? (
                              <div 
                                onClick={() => localStyleInputRef.current?.click()}
                                onDragOver={handleDragOverRef}
                                onDragLeave={handleDragLeaveRef}
                                onDrop={handleDropRef}
                                className={`w-48 aspect-[3/4] border border-dashed rounded-sm cursor-pointer flex flex-col items-center justify-center p-4 text-center transition-colors ${isDraggingRef ? 'border-[color:var(--color-luxury-accent)] bg-[color:var(--color-luxury-accent)]/10' : 'border-[color:var(--color-luxury-accent)]/30 hover:bg-[color:var(--color-luxury-accent)]/5'}`}
                              >
                                 <UploadCloud size={24} className="mb-2 text-[color:var(--color-luxury-accent)]/50" />
                                 <span className="text-[9px] uppercase tracking-widest">{isDraggingRef ? 'Drop Here' : 'Upload Reference'}</span>
                                 <span className="text-[8px] text-[color:var(--theme-text-muted)] mt-2">or drag and drop</span>
                              </div>
                           ) : (
                              <div className="relative w-48 aspect-[3/4] rounded-sm overflow-hidden border border-[color:var(--color-luxury-accent)]/50">
                                 <img src={localStyleImage || styleImage || ''} alt="Ref" className="w-full h-full object-cover" />
                                 <button 
                                   onClick={() => setLocalStyleImage(null)}
                                   className="absolute top-2 right-2 bg-[color:var(--theme-bg)]/50 border border-[color:var(--color-luxury-accent)]/30 p-2 rounded-sm text-[9px] uppercase tracking-widest text-[color:var(--theme-text)]"
                                 >Clear</button>
                              </div>
                           )}
                           <input type="file" hidden accept="image/*" ref={localStyleInputRef} onChange={handleLocalStyleUpload} />
                           
                           {/* Detected Palette */}
                           {detectingPalette && (
                              <div className="mt-4 flex flex-col gap-2 p-4 border border-[color:var(--theme-border)] rounded-sm bg-[color:var(--theme-bg-elevated)] w-full">
                                  <div className="text-[9px] uppercase tracking-[0.2em] text-[#A0A0A0] flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full border border-[color:var(--theme-border-accent)] border-t-[color:var(--color-luxury-accent)] animate-spin"></span>
                                      Analyzing colors...
                                  </div>
                              </div>
                           )}

                           {!detectingPalette && detectedPalette.length > 0 && (
                              <div className="mt-4 flex flex-col gap-3 p-4 border border-[color:var(--theme-border)] rounded-sm bg-[color:var(--theme-bg-elevated)] w-full">
                                  <span className="text-[9px] uppercase tracking-[0.2em] text-[#A0A0A0] flex items-center gap-2">
                                      <Palette size={12} className="text-[color:var(--color-luxury-accent)]" />
                                      Detected {serviceId === 'makeup-transfer' ? 'Makeup' : 'Hair'} Palette
                                  </span>
                                  <div className="flex gap-2">
                                      {detectedPalette.map((color, idx) => (
                                          <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                                              <div 
                                                  className="w-8 h-8 rounded-full border shadow-sm"
                                                  style={{ backgroundColor: color.hex, borderColor: 'rgba(255,255,255,0.1)' }}
                                                  title={color.label}
                                              />
                                              <span className="text-[8px] uppercase text-[#A0A0A0] text-center line-clamp-1 h-3">{color.label}</span>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                           )}
                       </div>
                     )}

                     {activeTab === 'manual' && (
                       <div className="space-y-4">
                           <p className="text-[10px] text-[#A0A0A0] text-center mb-4">Know exactly what you want? Type the shade, style, or select a hex color.</p>
                           <div className="relative flex items-center">
                               <input 
                                   type="color"
                                   className="absolute left-3 w-8 h-8 opacity-0 cursor-pointer z-10"
                                   onChange={(e) => {
                                       const val = e.target.value;
                                       setManualColor(val);
                                       setSelectedSuggestion(null);
                                       setLocalStyleImage(null);
                                   }}
                                   title="Pick a color"
                               />
                               <div className="absolute left-3 w-8 h-8 rounded-sm pointer-events-none border border-[color:var(--color-luxury-accent)]/50 flex items-center justify-center bg-[color:var(--theme-bg)] transition-colors" 
                                    style={{ backgroundColor: manualColor.match(/^#[0-9a-fA-F]{6}$/) ? manualColor : 'transparent' }}>
                                   {!manualColor.match(/^#[0-9a-fA-F]{6}$/) && <Palette size={14} className="text-[color:var(--color-luxury-accent)]" />}
                               </div>
                               <input 
                                  type="text" 
                                  placeholder="e.g. Ash Blonde, #FF0000..." 
                                  value={manualColor}
                                  onChange={(e) => {
                                      setManualColor(e.target.value);
                                      setSelectedSuggestion(null);
                                      setLocalStyleImage(null);
                                  }}
                                  className="w-full bg-[color:var(--theme-bg-elevated)] border border-[color:var(--color-luxury-accent)]/50 p-4 pl-14 text-[13px] text-[color:var(--theme-text)] rounded-sm placeholder:opacity-30 focus:border-[color:var(--color-luxury-accent)] focus:outline-none transition-colors"
                               />
                           </div>
                       </div>
                     )}

                     {activeTab === 'ai' && (
                       <div className="space-y-4">
                           <p className="text-[10px] text-[#A0A0A0] text-center mb-4">Let our AI analyze your skin tone and features to suggest the perfect styles.</p>
                           <button 
                             onClick={handleHairAnalysis}
                             disabled={analyzingHair}
                             className="w-full py-3 bg-[color:var(--theme-bg)] border border-[color:var(--color-luxury-accent)] text-[color:var(--color-luxury-accent)] text-[10px] uppercase tracking-widest rounded-sm flex items-center justify-center gap-2 hover:bg-[color:var(--color-luxury-accent)]/10 transition-colors"
                           >
                             {analyzingHair ? <span className="animate-pulse">Analyzing Features...</span> : <><Sparkles size={14} /> Analyze & Suggest Options</>}
                           </button>

                           {hairSuggestions.length > 0 && (
                             <div className="flex flex-col gap-2 mt-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {hairSuggestions.map((sug, i) => (
                                   <div 
                                     key={i}
                                     onClick={() => {
                                         setSelectedSuggestion(sug === selectedSuggestion ? null : sug);
                                         if (sug !== selectedSuggestion) {
                                             setManualColor('');
                                             setLocalStyleImage(null);
                                         }
                                     }}
                                     className={`p-3 border rounded-sm text-left cursor-pointer transition-colors ${selectedSuggestion?.colorName === sug.colorName ? 'border-[color:var(--color-luxury-accent)] bg-[color:var(--color-luxury-accent)]/10' : 'border-[color:var(--theme-border)] bg-[color:var(--theme-bg-elevated)] hover:border-[color:var(--color-luxury-accent)]/60'}`}
                                   >
                                      <div className="flex items-center gap-2 mb-2">
                                         <div className="w-5 h-5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: sug.hexCode }}></div>
                                         <span className="text-[12px] font-bold text-[color:var(--theme-text)]">{sug.colorName}</span>
                                      </div>
                                      <p className="text-[10px] text-[#A0A0A0] leading-relaxed">{sug.explanation}</p>
                                   </div>
                                ))}
                             </div>
                           )}
                       </div>
                     )}
                   </div>

                   {/* Makeup Transfer Toggles */}
                   {serviceId === 'makeup-transfer' && (
                       <div className="mt-8 flex flex-col gap-3 w-full">
                          <p className="text-[10px] uppercase tracking-widest text-[#A0A0A0] mb-2 text-center">Transfer Specifics (تحديد مناطق النقل)</p>
                          {[
                             { id: 'eyes', label: 'Eye Makeup', sub: 'Eyeshadow, Eyeliner, Lashes', value: makeupToggles.eyes },
                             { id: 'lips', label: 'Lip Color', sub: 'Lipstick, Gloss, Liner', value: makeupToggles.lips },
                             { id: 'foundation', label: 'Base Makeup', sub: 'Foundation, Contour, Blush', value: makeupToggles.foundation }
                          ].map((toggle) => (
                             <div 
                                key={toggle.id}
                                onClick={() => setMakeupToggles(prev => ({ ...prev, [toggle.id]: !prev[toggle.id as keyof typeof prev] }))}
                                className={`p-4 rounded-sm border cursor-pointer transition-all duration-300 flex items-center justify-between group
                                   ${toggle.value ? 'border-[color:var(--color-luxury-accent)]/50 bg-[color:var(--color-luxury-accent)]/5' : 'border-[color:var(--theme-border)] bg-[color:var(--theme-bg-elevated)] opacity-60 hover:opacity-100'}
                                `}
                             >
                                <div className="flex flex-col text-left">
                                   <span className={`text-[11px] font-bold ${toggle.value ? 'text-[color:var(--theme-text)]' : 'text-[#A0A0A0]'}`}>{toggle.label}</span>
                                   <span className="text-[9px] text-[#A0A0A0] opacity-80 mt-1">{toggle.sub}</span>
                                </div>
                                <div className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${toggle.value ? 'bg-[color:var(--color-luxury-accent)] border-[color:var(--color-luxury-accent)]' : 'border-[color:var(--theme-border)] bg-transparent'}`}>
                                    {toggle.value && <div className="w-1.5 h-1.5 rounded-full bg-[#111]" />}
                                </div>
                             </div>
                          ))}
                       </div>
                   )}

                   {/* Makeup Intensity Slider */}
                   {serviceId === 'makeup-transfer' && (
                       <div className="mt-6 flex flex-col gap-3 w-full">
                           <div className="flex justify-between items-center mb-1">
                               <p className="text-[10px] uppercase tracking-widest text-[#A0A0A0]">Intensity (كثافة المكياج)</p>
                               <span className="text-[10px] font-mono text-[color:var(--color-luxury-accent)]">{makeupIntensity}%</span>
                           </div>
                           <input 
                               type="range" 
                               min="1" 
                               max="100" 
                               value={makeupIntensity} 
                               onChange={(e) => setMakeupIntensity(parseInt(e.target.value))} 
                               className="w-full h-1 bg-[color:var(--theme-border)] rounded-lg appearance-none cursor-pointer outline-none"
                               style={{
                                   background: `linear-gradient(to right, var(--color-luxury-accent) ${makeupIntensity}%, var(--theme-border) ${makeupIntensity}%)`
                               }}
                           />
                           <div className="flex justify-between w-full text-[8px] uppercase tracking-widest text-[#A0A0A0] mt-1 opacity-70">
                               <span>Subtle (خفيف)</span>
                               <span>Glamorous (بارز)</span>
                           </div>
                       </div>
                   )}

                   {/* Error & Generate Button for Hair Color */}
                   <div className="pt-6 mt-6 border-t border-[color:var(--color-luxury-accent)]/20 flex flex-col items-center">
                     {errorMsg && (
                       <div className="w-full p-4 mb-4 border border-red-500/30 bg-red-500/10 rounded-sm text-center flex flex-col items-center gap-3">
                         <p className="text-[10px] text-red-200 uppercase tracking-widest leading-relaxed">{errorMsg}</p>
                         {needsApiKey && (
                            <button 
                              onClick={handleProvideKey}
                             className="text-[9px] uppercase tracking-widest border border-red-500/50 bg-red-500/10 px-3 py-2 rounded-sm text-red-500 hover:bg-red-500/20 transition-colors w-full"
                            >
                              Authenticate API Key
                            </button>
                         )}
                       </div>
                     )}

                     <button 
                       onClick={() => processGeneration(false)}
                       disabled={!targetImage || loading}
                       className={`lux-button-solid w-full flex items-center justify-center gap-2 py-4 ${(!targetImage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                     >
                        {loading ? (
                          <div className="flex flex-col items-center justify-center w-full">
                              <span className="text-[9px] uppercase tracking-widest">{loadingMessage} ({Math.floor(progress)}%)</span>
                              <div className="w-3/4 h-[2px] bg-black/20 mt-2">
                                  <div className="h-full bg-[color:var(--theme-bg)] transition-all duration-300" style={{ width: `${progress}%` }} />
                              </div>
                          </div>
                        ) : <>Generate <ArrowRight size={16} /></>}
                     </button>
                   </div>
                </div>
              )}
            </div>
          ) : (
            /* --- OTHER SERVICES (Original Layout) --- */
            <div className={`grid grid-cols-1 ${styleImage ? 'md:grid-cols-2' : ''} gap-12 items-center justify-items-center max-w-4xl mx-auto`}>
              {/* Reference Image Info */}
              {styleImage && (
                 <div className="space-y-6 flex flex-col items-center opacity-70 w-full max-w-sm">
                     <p className="font-bold text-[10px] uppercase tracking-wider">Your Chosen Reference</p>
                     <div className="w-48 aspect-[3/4] rounded-sm overflow-hidden border border-[color:var(--theme-border)] bg-[color:var(--theme-bg-elevated)] flex flex-col items-center justify-center">
                        <img src={styleImage} alt="Style" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                     </div>
                     
                     {/* Detected Palette */}
                     {detectingPalette && (
                         <div className="mt-4 flex flex-col gap-2 p-4 border border-[color:var(--theme-border)] rounded-sm bg-[color:var(--theme-bg-elevated)] w-full">
                             <div className="text-[9px] uppercase tracking-[0.2em] text-[#A0A0A0] flex items-center gap-2 justify-center">
                                 <span className="w-2 h-2 rounded-full border border-[color:var(--theme-border-accent)] border-t-[color:var(--color-luxury-accent)] animate-spin"></span>
                                 Analyzing colors...
                             </div>
                         </div>
                     )}

                     {!detectingPalette && detectedPalette.length > 0 && (
                         <div className="mt-4 flex flex-col gap-3 p-4 border border-[color:var(--theme-border)] rounded-sm bg-[color:var(--theme-bg-elevated)] w-full">
                             <span className="text-[9px] uppercase tracking-[0.2em] text-[#A0A0A0] flex items-center justify-center gap-2">
                                 <Palette size={12} className="text-[color:var(--color-luxury-accent)]" />
                                 Detected {serviceId === 'makeup-transfer' ? 'Makeup' : 'Style'} Palette
                             </span>
                             <div className="flex gap-2">
                                 {detectedPalette.map((color, idx) => (
                                     <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                                         <div 
                                             className="w-8 h-8 rounded-full border shadow-sm"
                                             style={{ backgroundColor: color.hex, borderColor: 'rgba(255,255,255,0.1)' }}
                                             title={color.label}
                                         />
                                         <span className="text-[8px] uppercase text-[#A0A0A0] text-center line-clamp-1 h-3">{color.label}</span>
                                     </div>
                                 ))}
                             </div>
                         </div>
                     )}
                  </div>
              )}

              {/* Target Upload */}
              <div className="space-y-6 flex flex-col items-center">
                 <p className="font-bold text-[10px] uppercase tracking-wider text-[color:var(--color-luxury-accent)]">Upload Your Portrait</p>
                 
                 {!targetImage ? (
                    <div 
                      className={`w-64 aspect-[3/4] border border-dashed rounded-sm flex flex-col items-center justify-center cursor-pointer transition-colors bg-[color:var(--theme-bg-elevated)] ${isDraggingTarget ? 'border-[color:var(--color-luxury-accent)] bg-[color:var(--color-luxury-accent)]/10' : 'border-[color:var(--theme-border)] hover:bg-[color:var(--theme-border)]'}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={handleDragOverTarget}
                      onDragLeave={handleDragLeaveTarget}
                      onDrop={handleDropTarget}
                    >
                      <Camera size={40} className="mb-4 text-[color:var(--color-luxury-accent)] opacity-50" />
                      <p className="font-bold text-[10px] uppercase tracking-wider">{isDraggingTarget ? 'Drop Image Here' : 'Capture or Upload'}</p>
                      <span className="text-[8px] text-[color:var(--theme-text-muted)] mt-2">or drag and drop</span>
                    </div>
                 ) : (
                    <div className="w-64 aspect-[3/4] rounded-sm overflow-hidden border border-[color:var(--theme-border)] relative">
                       <img src={targetImage} alt="Target" className="w-full h-full object-cover" />
                       <button 
                         onClick={() => setTargetImage(null)}
                         className="absolute top-2 right-2 bg-[color:var(--theme-bg)]/50 border border-[color:var(--color-luxury-accent)]/30 p-2 rounded-sm text-[9px] uppercase tracking-widest text-[color:var(--theme-text)]"
                       >
                         Clear
                       </button>
                    </div>
                 )}
                 <input type="file" hidden accept="image/*" ref={fileInputRef} onChange={handleUpload} />

                 {errorMsg && (
                   <div className="w-64 p-4 border border-red-500/30 bg-red-500/10 rounded-sm text-center flex flex-col items-center gap-3">
                     <p className="text-[10px] text-red-200 uppercase tracking-widest leading-relaxed">{errorMsg}</p>
                     {needsApiKey && (
                        <button 
                          onClick={handleProvideKey}
                          className="text-[9px] uppercase tracking-widest border border-red-500/50 bg-red-500/10 px-3 py-2 rounded-sm text-red-500 hover:bg-red-500/20 transition-colors w-full"
                        >
                          Authenticate API Key
                        </button>
                     )}
                   </div>
                 )}

                 <button 
                   onClick={() => processGeneration(false)}
                   disabled={!targetImage || loading}
                   className={`lux-button-solid w-64 flex flex-col items-center justify-center gap-2 py-3 ${(!targetImage || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                 >
                    {loading ? (
                      <div className="flex flex-col items-center justify-center w-full">
                          <span className="text-[9px] uppercase tracking-widest">{loadingMessage} ({Math.floor(progress)}%)</span>
                          <div className="w-3/4 h-[2px] bg-black/20 mt-2">
                              <div className="h-full bg-[color:var(--theme-bg)] transition-all duration-300" style={{ width: `${progress}%` }} />
                          </div>
                      </div>
                    ) : <div className="flex items-center gap-2 py-1">Generate <ArrowRight size={16} /></div>}
                 </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Result View */
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-12"
        >
          <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto">
             {extractedStyleInfo && !loading && (
                <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} className="w-full max-w-[450px] mx-auto p-4 bg-[color:var(--theme-bg-elevated)] border border-[color:var(--color-luxury-accent)]/30 rounded-xl mb-6">
                   <h4 className="text-[10px] uppercase tracking-widest text-[color:var(--color-luxury-accent)] flex items-center gap-2 mb-3">
                       <Sparkles size={12} /> AI Analysis
                   </h4>
                   <p className="text-[10px] text-[color:var(--theme-text-muted)] leading-relaxed mb-3">
                       {extractedStyleInfo.description}
                   </p>
                   <div className="flex gap-2 flex-wrap items-center">
                       <span className="text-[10px] opacity-70">Intensity:</span>
                       <span className="text-[10px] text-white bg-[color:var(--color-luxury-accent)]/20 px-2 py-0.5 rounded mr-2">{extractedStyleInfo.intensity || 'Normal'}</span>
                       {extractedStyleInfo.colors?.map((c: any, i: number) => (
                           <div key={i} className="flex items-center gap-1 bg-[color:var(--theme-bg)] px-2 py-1 rounded border border-[color:var(--theme-border)]">
                               <div className="w-3 h-3 rounded-full border border-[color:var(--theme-border)]" style={{backgroundColor: c.hex}}></div>
                               <span className="text-[9px] text-[color:var(--theme-text)]">{c.label}</span>
                           </div>
                       ))}
                   </div>
                </motion.div>
             )}
             <ImageComparisonSlider 
                beforeImage={targetImage!} 
                afterImage={resultImage} 
                isLoading={loading} 
             />
          </div>

          {/* Client Refinement Protocol */}
          <div className="w-full max-w-lg mt-8 bg-[color:var(--theme-bg-elevated)] border border-[color:var(--theme-border)] p-6 rounded-sm">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-80 block text-[color:var(--color-luxury-pearl)]">Customize Reference Pattern</span>
              
              <div className="relative group cursor-pointer flex items-center gap-2 text-[color:var(--color-luxury-accent)] bg-[color:var(--theme-bg)] px-3 py-1.5 border border-[color:var(--color-luxury-accent)]/30 rounded-sm hover:bg-[color:var(--color-luxury-accent)]/10 transition-colors">
                <Palette size={12} />
                <span className="text-[9px] uppercase tracking-wider">Pick Exact Color</span>
                <input 
                  type="color" 
                  onChange={(e) => {
                    const val = e.target.value;
                    const injection = `(Use exact hex color: ${val})`;
                    setAdjustment(prev => {
                      const regex = /\(Use exact hex color: #[0-9a-fA-F]{6}\)/g;
                      if (regex.test(prev)) {
                        return prev.replace(regex, injection);
                      }
                      return prev + (prev.trim() === '' ? '' : ' ') + injection;
                    });
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Pick a specific color to append to your instructions"
                />
              </div>
            </div>

            <textarea
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              placeholder="e.g., 'Make the lipstick bright fire-engine red', 'Soften the cheek contour'..."
              className="w-full bg-[color:var(--theme-bg-elevated)] border border-[color:var(--color-luxury-accent)]/30 p-4 text-[13px] text-[color:var(--theme-text)] focus:outline-none focus:border-[color:var(--color-luxury-accent)] rounded-sm mb-4 resize-none placeholder-[color:var(--theme-text-muted)]"
              rows={3}
              disabled={loading}
            />
            <button
               onClick={() => processGeneration(true)}
               disabled={loading || !adjustment.trim()}
               className={`w-full py-3 border border-[color:var(--color-luxury-accent)] text-[color:var(--color-luxury-accent)] text-[10px] uppercase tracking-widest transition-colors ${(!loading && adjustment.trim()) ? 'hover:bg-[color:var(--color-luxury-accent)] hover:text-black cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
            >
               Apply Custom Adjustments
            </button>
          </div>

          <div className="flex gap-6 mt-4">
             <button onClick={() => setResultImage(null)} disabled={loading} className="lux-button disabled:opacity-50">New Simulation</button>
             <button className="lux-button-solid disabled:opacity-50" disabled={loading} onClick={() => setErrorMsg('Appointment flow to be connected.')}>Book Appointment</button>
          </div>
          {errorMsg && (
             <p className="text-[10px] text-red-200 uppercase tracking-widest mt-4 text-center">{errorMsg}</p>
          )}
        </motion.div>
      )}
    </div>

    {pendingCropTargetImage && (
       <CropModal 
          imageSrc={pendingCropTargetImage}
          onCropComplete={handleCropTargetComplete}
          onCropCancel={() => setPendingCropTargetImage(null)}
       />
    )}
    {pendingCropRefImage && (
       <CropModal 
          imageSrc={pendingCropRefImage}
          onCropComplete={handleCropRefComplete}
          onCropCancel={() => setPendingCropRefImage(null)}
       />
    )}
    </>
  );
}
