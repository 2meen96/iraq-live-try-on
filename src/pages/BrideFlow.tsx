import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, Check, ChevronRight, Palette, Scissors, Sparkles, Wand2, Eye } from 'lucide-react';
import { simulateAR, suggestStyles, AIStyleSuggestion, extractColorPalette, ColorPaletteItem, extractStyleDetails, enhancePrompt } from '../services/ai';
import { useAuth } from '../services/firebase';
import ImageComparisonSlider from '../components/ImageComparisonSlider';
import GuidelinesModal from '../components/GuidelinesModal';
import CropModal from '../components/CropModal';

// Define steps configuration
const FLOW_STEPS = [
  { id: 0, title: 'Reference Photo', icon: UploadCloud, subtitle: 'Base' },
  { id: 1, title: 'Hair Color', icon: Palette, subtitle: 'Step 1' },
  { id: 2, title: 'Hair Styling', icon: Scissors, subtitle: 'Step 2' },
  { id: 3, title: 'Makeup', icon: Sparkles, subtitle: 'Step 3' },
  { id: 4, title: 'Lenses', icon: Eye, subtitle: 'Step 4' },
  { id: 5, title: 'Final Look', icon: Check, subtitle: 'Final' }
];

const CATALOG_MAKEUP = [
  { id: 'cat-1', title: 'Classic Matte', src: 'https://images.unsplash.com/photo-1596704017254-9b121068fb31?q=80&w=600&auto=format&fit=crop' },
  { id: 'cat-2', title: 'Soft Glam', src: 'https://images.unsplash.com/photo-1512413915509-3286b24d17c7?q=80&w=600&auto=format&fit=crop' },
  { id: 'cat-3', title: 'Dewy Rose', src: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=600&auto=format&fit=crop' },
  { id: 'cat-4', title: 'Smokey Bold', src: 'https://images.unsplash.com/photo-1542452255-1f95a4f6ab73?q=80&w=600&auto=format&fit=crop' }
];

const CATALOG_HAIR = [
  { id: 'hair-cat-1', title: 'Elegant Updo', src: 'https://images.unsplash.com/photo-1595475884562-073c30d45670?q=80&w=600&auto=format&fit=crop' },
  { id: 'hair-cat-2', title: 'Soft Waves', src: 'https://images.unsplash.com/photo-1562322140-8baeececf3ce?q=80&w=600&auto=format&fit=crop' },
  { id: 'hair-cat-3', title: 'Classic Chignon', src: 'https://images.unsplash.com/photo-1580614838380-4927f8059080?q=80&w=600&auto=format&fit=crop' },
  { id: 'hair-cat-4', title: 'Flowing Curls', src: 'https://images.unsplash.com/photo-1620353163777-1f4a9b2bdf36?q=80&w=600&auto=format&fit=crop' }
];

const CATALOG_LENSES = [
  { id: 'lens-1', title: 'Hazel Nuance', src: 'https://images.unsplash.com/photo-1542037104857-ffbb0b9155fb?q=80&w=600&auto=format&fit=crop' },
  { id: 'lens-2', title: 'Sapphire Blue', src: 'https://images.unsplash.com/photo-1588691512409-ecfcba2e86bb?q=80&w=600&auto=format&fit=crop' },
  { id: 'lens-3', title: 'Emerald Green', src: 'https://images.unsplash.com/photo-1510520434124-5bc7e642b61f?q=80&w=600&auto=format&fit=crop' },
  { id: 'lens-4', title: 'Silver Grey', src: 'https://images.unsplash.com/photo-1533036814238-d621fc422bc7?q=80&w=600&auto=format&fit=crop' }
];

export default function BrideFlow() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [step, setStep] = useState(0);
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  
  // Active step state
  const [referenceImg, setReferenceImg] = useState<string | null>(null);
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [withVeil, setWithVeil] = useState(false);
  const [adjustment, setAdjustment] = useState('');
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // Hair Analysis State
  const [activeTab, setActiveTab] = useState<'upload' | 'manual' | 'ai' | 'catalog'>('upload');
  const [manualColor, setManualColor] = useState('');
  const [analyzingHair, setAnalyzingHair] = useState(false);
  const [hairSuggestions, setHairSuggestions] = useState<AIStyleSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AIStyleSuggestion | null>(null);

  const [makeupToggles, setMakeupToggles] = useState({ eyes: true, lips: true, foundation: true });
  const [makeupIntensity, setMakeupIntensity] = useState(50);
  
  const [detectedPalette, setDetectedPalette] = useState<ColorPaletteItem[]>([]);
  const [detectingPalette, setDetectingPalette] = useState(false);
  const [extractedStyleInfo, setExtractedStyleInfo] = useState<any>(null);

  // Errors & Config
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsApiKey, setNeedsApiKey] = useState(false);

  // Guidelines & Crop
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  useEffect(() => {
     let isMounted = true;
     if ([1, 2, 3].includes(step) && referenceImg) {
         setDetectingPalette(true);
         extractColorPalette(referenceImg, step === 3 ? 'makeup' : 'hair').then(palette => {
             if (isMounted) setDetectedPalette(palette);
         }).finally(() => {
             if (isMounted) setDetectingPalette(false);
         });
     } else {
         setDetectedPalette([]);
     }
     return () => { isMounted = false; };
  }, [referenceImg, step]);

  const getTargetImage = () => {
    if (step === 1) return baseImage;
    if (step === 2) return history[0] || baseImage;
    if (step === 3) return history[1] || history[0] || baseImage;
    if (step === 4) return history[2] || history[1] || history[0] || baseImage;
    return baseImage;
  };

  const handleEnhancePrompt = async () => {
    if (!adjustment.trim()) return;
    setEnhancingPrompt(true);
    try {
        const enhanced = await enhancePrompt(adjustment, step);
        setAdjustment(enhanced);
    } catch (e) {
        console.warn("Enhancement failed", e);
    } finally {
        setEnhancingPrompt(false);
    }
  };

  const handleAuthKey = async () => {
    setNeedsApiKey(false);
    setErrorMsg('To use your custom API key: 1. Click on Settings (gear icon in AI Studio). 2. Go to Secrets. 3. Add USER_GEMINI_API_KEY with your API key.');
  };

  const handleGuidelinesAck = () => {
    setShowGuidelines(false);
    fileInputRef.current?.click();
  };

  const triggerUpload = () => {
    if (step === 0 && !baseImage) {
        setShowGuidelines(true);
    } else {
        fileInputRef.current?.click();
    }
  };

  const handleUploadRef = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    // Reset input value so same file can be selected again
    e.target.value = '';
  };

  const handleCropComplete = (croppedBase64: string) => {
    setImageToCrop(null);
    if (step === 0) {
        setBaseImage(croppedBase64);
    } else {
        setReferenceImg(croppedBase64);
        setManualColor('');
        setSelectedSuggestion(null);
        setGeneratedImg(null);
        setAdjustment('');
    }
  };

  const handleAnalysis = async () => {
    const targetImage = getTargetImage();
    if (!targetImage) return;
    setAnalyzingHair(true);
    setErrorMsg(null);
    try {
      const type = step === 3 ? 'makeup-transfer' : 'hair-color';
      const suggestions = await suggestStyles(targetImage, type);
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
    if (!user) {
      setErrorMsg("Sign in required to generate AI simulations.");
      return;
    }
    setLoading(true);
    setProgress(0);
    setLoadingMessage('نُحلل ملامح الوجه..');

    progressInterval.current = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 5 + 1, 95));
    }, 600);

    try {
      const targetImage = getTargetImage();
      if (!targetImage) throw new Error("Missing target image.");

      let p_userPayload = targetImage;
      let p_stylePayload: string | null | undefined = referenceImg;
      let basePrompt = "";

      if (step === 1) {
          if (activeTab === 'manual' && manualColor) {
              basePrompt = `CRITICAL INSTRUCTION: You MUST change the hair color in the TARGET USER IMAGE to this specific hex color/description: ${manualColor}. DO NOT RETURN THE ORIGINAL IMAGE UNCHANGED. Apply the new color realistically. EXTREME ISOLATION REQUIRED: STRICTLY PROTECT the face, skin, eyes, lips, makeup, hands, and background from ANY color spill or tint. DO NOT change the angle of the head, pose, or camera perspective.`;
              p_stylePayload = undefined;
          } else if (activeTab === 'ai' && selectedSuggestion) {
              basePrompt = `CRITICAL INSTRUCTION: You MUST change the hair color in the TARGET USER IMAGE to this specific color: ${selectedSuggestion.colorName} (${selectedSuggestion.hexCode}). DO NOT RETURN THE ORIGINAL IMAGE UNCHANGED. Apply the new color realistically. EXTREME ISOLATION REQUIRED: STRICTLY PROTECT the face, skin, eyes, lips, makeup, hands, and background from ANY color spill or tint. DO NOT change the angle of the head, pose, or camera perspective.`;
              p_stylePayload = undefined;
          } else {
              basePrompt = "CRITICAL INSTRUCTION: You MUST extract the exact hair color from the STYLE REFERENCE IMAGE and apply it ONLY to the hair in the TARGET USER IMAGE. DO NOT RETURN THE ORIGINAL IMAGE UNCHANGED. The hair color MUST visibly change to match the reference. EXTREME ISOLATION REQUIRED: STRICTLY PROTECT the face, skin, eyes, lips, makeup, hands, and background from ANY color spill or tint. DO NOT change the angle of the head, pose, or camera perspective.";
          }
      } else if (step === 2) {
          basePrompt = `CRITICAL INSTRUCTION: You are an expert bridal hair stylist AI. Apply the hair structural styling, cut, curls, or updo from the STYLE REFERENCE IMAGE onto the TARGET USER IMAGE. ${withVeil ? '\n\nMANDATE: REVEAL a visible, elegant bridal veil (طرحة عروس) smoothly placed on her head/hair.' : '\n\nMANDATE: Strictly DO NOT include a veil.'}\n\nAlter ONLY the hair geometry/style (and veil if requested). KEEP the facial identity, skin, makeup, hands, and hair color exactly as they are in the target image. Ensure that the hair color DOES NOT CHANGE AT ALL. Match the original hair color perfectly. DO NOT change the angle of the head, pose, or camera perspective.`;
      } else if (step === 3) {
          if (activeTab === 'ai' && selectedSuggestion) {
              basePrompt = `CRITICAL INSTRUCTION: You are an expert bridal makeup artist AI. Apply a bridal makeup look to the TARGET USER IMAGE specifically matching this description: ${selectedSuggestion.colorName} (${selectedSuggestion.explanation}, dominant hex: ${selectedSuggestion.hexCode}). ${withVeil ? '\n\nMANDATE: Ensure a bridal veil (طرحة) is vividly and gracefully present on her head.' : ''}\n\nApply full makeup vividly based on the description. DO NOT change the facial bone structure, identity, or hair style/color. Preserve the background and pose exactly. DO NOT change the angle of the head.`;
              p_stylePayload = undefined;
          } else {
              basePrompt = `CRITICAL INSTRUCTION: You are an expert bridal makeup artist AI. Extract the exact bridal makeup look (lipstick shade, foundation, blush, eyes) from the STYLE REFERENCE IMAGE and apply it to the TARGET USER IMAGE. ${withVeil ? '\n\nMANDATE: Ensure a bridal veil (طرحة) is vividly and gracefully present on her head.' : ''}\n\nApply full makeup vividly. DO NOT change the facial bone structure, identity, or hair style/color. DO NOT change the angle of the head, pose, or camera perspective.`;
          }
      } else if (step === 4) {
          if (activeTab === 'manual' && manualColor) {
              basePrompt = `CRITICAL INSTRUCTION: You are an expert AI photo editor. Change the subject's eye color in the TARGET USER IMAGE to match this description/hex: ${manualColor}. ONLY change the iris color of the eyes. DO NOT change the facial identity, skin, makeup, hair, or background. DO NOT change the angle of the head, pose, or camera perspective.`;
              p_stylePayload = undefined;
          } else {
              basePrompt = `CRITICAL INSTRUCTION: You are an expert AI photo editor. Extract the exact eye (iris) color from the STYLE REFERENCE IMAGE and apply it to the TARGET USER IMAGE. ONLY change the iris color. DO NOT change the facial identity, skin, makeup, hair, or background. Perfect extreme isolation. DO NOT change the angle of the head, pose, or camera perspective.`;
          }
      }

      if (isRefinement && adjustment.trim() !== '' && generatedImg) {
          p_userPayload = generatedImg;
          p_stylePayload = undefined; 
          basePrompt = `[CLIENT REVISION REQUEST]: ${adjustment.trim()}\n\nCRITICAL MANDATE: Apply this exact adjustment to the specific elements mentioned. Do NOT change anything else about the face, identity, hair, veil, or background. Perfect extreme isolation. DO NOT change the angle of the head, pose, or camera perspective.`;
      }

      if (!isRefinement) {
          if ((step === 1 || step === 4) && activeTab === 'manual') {
              if (!manualColor.trim()) throw new Error("Please type a color to generate.");
          } else if ((step === 1 || step === 3) && activeTab === 'ai') {
              if (!selectedSuggestion) throw new Error("Please select an AI suggestion.");
          } else if (!p_stylePayload) {
              throw new Error("Please upload or select a reference image first.");
          }
      }

      if (p_stylePayload && p_stylePayload.startsWith('http')) {
          try {
              const res = await fetch(p_stylePayload);
              if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
              const blob = await res.blob();
              p_stylePayload = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.readAsDataURL(blob);
                  reader.onloadend = () => resolve(reader.result as string);
              });
          } catch (e) {
              console.warn("Failed to convert image url to base64", e);
              throw new Error("فشل تحميل الصورة المرجعية. يرجى اختيار صورة أخرى.");
          }
      }

      const operationType = step === 3 ? 'makeup' : (step === 4 ? 'general' : 'hair');
      
      let styleDetailsObj = null;
      if (p_stylePayload && !isRefinement && (operationType === 'makeup' || step === 1)) {
          setLoadingMessage('نستخلص الألوان المرجعية السداسية بدقة..');
          try {
              styleDetailsObj = await extractStyleDetails(p_stylePayload, operationType as 'makeup' | 'hair');
              setExtractedStyleInfo(styleDetailsObj);
          } catch (e) {
              console.warn("Failed to extract specific style details", e);
          }
      }

      setLoadingMessage('نطبق اللمسات السحرية..');
      const result = await simulateAR(p_userPayload, p_stylePayload, basePrompt, operationType, step === 3 ? makeupToggles : undefined, step === 3 ? makeupIntensity : undefined, styleDetailsObj);
      
      setProgress(100);
      setLoadingMessage('اكتملت المعالجة');
      
      setGeneratedImg(result);
      if (!isRefinement) {
          setAdjustment('');
      }

    } catch (err: any) {
      console.warn(err);
      const isPermissionDenied = err?.message?.includes('403') || err?.status === 'PERMISSION_DENIED';
      const isQuotaExceeded = err?.message?.includes('429') || err?.status === 'RESOURCE_EXHAUSTED';
      
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
      setLoading(false);
      setProgress(0);
    }
  };

  const proceedToNextStep = (skip = false) => {
    const target = getTargetImage();
    const finalImageForThisStep = (!skip && generatedImg) ? generatedImg : target;

    setHistory(prev => {
        const newHist = [...prev];
        newHist[step - 1] = finalImageForThisStep!;
        return newHist;
    });

    setGeneratedImg(null);
    setReferenceImg(null);
    setAdjustment('');
    setActiveTab('upload');
    setManualColor('');
    setSelectedSuggestion(null);
    setHairSuggestions([]);
    setWithVeil(false);
    setStep(s => s + 1);
  };

  return (
    <div className="flex-1 w-full relative min-h-screen pb-24 overflow-hidden">
       {/* Background ambient glow */}
       <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[color:var(--color-luxury-accent)] opacity-[0.03] blur-[150px] pointer-events-none rounded-full" />
       <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[color:var(--color-luxury-rosegold)] opacity-[0.02] blur-[120px] pointer-events-none rounded-full" />

       <div className="max-w-7xl mx-auto px-6 py-16 relative z-10">
          
          {/* Header */}
          <div className="mb-16 text-center md:text-left flex flex-col md:flex-row justify-between items-end gap-6">
             <div>
                <span className="text-[9px] uppercase tracking-[0.4em] opacity-80 block mb-3 text-[color:var(--color-luxury-accent)]">Advanced AI Pipeline</span>
                <h2 className="font-serif text-4xl md:text-6xl font-light tracking-tight text-[color:var(--theme-text)]">
                   Bridal <span className="italic text-[color:var(--color-luxury-rosegold)] font-semibold">Synthesis</span>
                </h2>
             </div>
             <p className="text-[10px] uppercase tracking-widest text-[color:var(--theme-text-muted)] max-w-xs text-right hidden md:block leading-loose">
                A multi-stage generative process combining precision styling and hyper-realistic rendering.
             </p>
          </div>

          {/* Minimalist Linear Stepper */}
          <div className="flex w-full mb-16 gap-2">
             {FLOW_STEPS.map((s, i) => (
                <div key={s.id} className="flex-1 flex flex-col gap-3 relative group">
                   <div className="h-[2px] w-full bg-[color:var(--theme-border)] relative overflow-hidden rounded-full">
                      <motion.div 
                         className="absolute top-0 left-0 bottom-0 bg-[color:var(--color-luxury-accent)]"
                         initial={{ width: '0%' }}
                         animate={{ width: step >= s.id ? '100%' : '0%' }}
                         transition={{ duration: 0.8, ease: "easeInOut" }}
                      />
                   </div>
                   <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-mono tracking-widest transition-colors duration-500 hidden sm:block ${step >= s.id ? 'text-[color:var(--color-luxury-accent)]' : 'text-[color:var(--theme-text-muted)]'}`}>0{s.id + 1}</span>
                      <span className={`text-[9px] uppercase tracking-[0.2em] transition-colors duration-500 ${step === s.id ? 'text-[color:var(--theme-text)]' : step > s.id ? 'text-[color:var(--theme-text)] opacity-70' : 'text-[color:var(--theme-text-muted)]'}`}>{s.title}</span>
                   </div>
                </div>
             ))}
          </div>

          {/* Error Message */}
          <AnimatePresence>
             {errorMsg && (
                <motion.div initial={{opacity: 0, y:-10}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y:-10}} className="w-full mb-8 p-4 border border-red-500/20 bg-red-500/5 backdrop-blur-md rounded-md flex items-center justify-between">
                   <p className="text-[10px] text-red-200/80 uppercase tracking-widest">{errorMsg}</p>
                   {needsApiKey && (
                      <button onClick={handleAuthKey} className="text-[9px] uppercase tracking-widest border border-red-500/30 px-4 py-2 rounded-sm text-[color:var(--theme-text)] hover:bg-red-500/20 transition-colors">Authenticate</button>
                   )}
                </motion.div>
             )}
          </AnimatePresence>

          {/* Main Content Area */}
          <div className="w-full bg-[color:var(--theme-bg)] border border-[color:var(--theme-border)] backdrop-blur-3xl rounded-2xl p-6 md:p-12 shadow-2xl relative overflow-hidden min-h-[70vh]">
             
             {/* Diagonal subtle lines bg inside container */}
             <div className="absolute inset-0 opacity-[0.02] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,var(--theme-text)_10px,var(--theme-text)_11px)] pointer-events-none" />

             <AnimatePresence mode="wait">
                
                {/* STEP 0: BASE UPLOAD */}
                {step === 0 && (
                   <motion.div key="step0" initial={{opacity:0, filter:'blur(10px)'}} animate={{opacity:1, filter:'blur(0px)'}} exit={{opacity:0, scale:0.95}} transition={{duration: 0.5}} className="flex flex-col items-center justify-center min-h-[400px]">
                      <div className="text-center mb-10 relative z-10">
                         <div className="w-12 h-12 bg-[color:var(--theme-text)]/5 border border-[color:var(--theme-text)]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <UploadCloud size={20} className="text-[color:var(--color-luxury-accent)] opacity-80" />
                         </div>
                         <h3 className="font-serif italic text-3xl mb-3 text-[color:var(--theme-text)]">Upload Reference Photo</h3>
                         <p className="text-[10px] uppercase tracking-widest text-[color:var(--theme-text-muted)] max-w-sm mx-auto leading-loose">Upload a high-resolution, front-facing portrait to begin the analysis process.</p>
                      </div>

                      {!baseImage ? (
                         <div 
                            className="relative group cursor-pointer w-full max-w-md mx-auto aspect-[3/4] rounded-xl overflow-hidden border border-[color:var(--theme-border)] bg-[color:var(--theme-bg-elevated)] hover:border-[color:var(--color-luxury-accent)]/40 transition-all duration-700 flex flex-col items-center justify-center z-10 shadow-xl"
                            onClick={triggerUpload}
                         >
                            <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--color-luxury-accent)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                            <div className="w-20 h-20 rounded-full border border-dashed border-[color:var(--theme-border-accent)] flex items-center justify-center group-hover:rotate-90 transition-transform duration-700">
                               <span className="text-3xl font-light text-[color:var(--theme-text-muted)] group-hover:text-[color:var(--color-luxury-accent)]">+</span>
                            </div>
                         </div>
                      ) : (
                         <div className="flex flex-col items-center gap-8 relative z-10">
                            <div className="w-full max-w-md rounded-xl overflow-hidden border border-[color:var(--theme-border)] relative group shadow-2xl bg-[color:var(--theme-bg)]">
                               <img src={baseImage} alt="Base" className="w-full h-auto object-contain block max-h-[60vh] mx-auto" />
                               <div className="absolute inset-0 bg-[color:var(--theme-bg)]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                  <button onClick={() => setBaseImage(null)} className="text-[10px] uppercase tracking-[0.2em] border border-[color:var(--theme-border)] text-[color:var(--theme-text)] px-8 py-3 rounded-full hover:bg-[color:var(--theme-text)] hover:text-[color:var(--theme-bg)] transition-colors">Replace Canvas</button>
                               </div>
                            </div>
                            <button onClick={() => setStep(1)} className="group flex items-center justify-center gap-4 bg-[color:var(--theme-bg-elevated)] border border-[color:var(--theme-border)] hover:border-[color:var(--color-luxury-accent)]/50 px-12 py-5 rounded-full transition-all duration-500 overflow-hidden relative shadow-lg">
                               <div className="absolute inset-0 bg-[color:var(--color-luxury-accent)]/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                               <span className="text-[11px] uppercase tracking-[0.2em] relative z-10 text-[color:var(--theme-text)] font-semibold opacity-80 group-hover:opacity-100 transition-colors">Commence Phase I</span>
                               <ChevronRight size={16} className="relative z-10 text-[color:var(--color-luxury-accent)]" />
                            </button>
                         </div>
                      )}
                   </motion.div>
                )}

                {/* STEPS 1-4: GENERATIVE PHASES */}
                {[1, 2, 3, 4].includes(step) && (
                   <motion.div key={`step${step}`} initial={{opacity:0, filter:'blur(10px)'}} animate={{opacity:1, filter:'blur(0px)'}} exit={{opacity:0, scale:0.95}} transition={{duration: 0.5}} className="flex flex-col lg:flex-row gap-12 relative z-10">
                      
                      {/* Left Column: Inputs */}
                      <div className="w-full lg:w-[40%] flex flex-col justify-center">
                         <h3 className="font-serif italic text-3xl mb-2 text-[color:var(--theme-text)]">{FLOW_STEPS[step].title}</h3>
                         <p className="text-[10px] uppercase tracking-widest text-[color:var(--theme-text-muted)] mb-10 leading-loose">Define the reference parameters for this phase.</p>

                         {[1, 4].includes(step) && (
                            <div className="flex bg-[color:var(--theme-bg)] border border-[color:var(--theme-border)] p-1 rounded-lg gap-1 mb-6">
                                <button onClick={() => setActiveTab('upload')} className={`flex-1 py-3.5 text-[9px] uppercase tracking-widest transition-colors rounded-md ${activeTab === 'upload' ? 'bg-[color:var(--theme-bg-elevated)] text-[color:var(--theme-text)] font-semibold shadow-sm border border-[color:var(--theme-border)]' : 'text-[color:var(--theme-text-muted)] hover:text-[color:var(--theme-text)]'}`}>Reference Img</button>
                                <button onClick={() => setActiveTab('manual')} className={`flex-1 py-3.5 text-[9px] uppercase tracking-widest transition-colors rounded-md ${activeTab === 'manual' ? 'bg-[color:var(--theme-bg-elevated)] text-[color:var(--theme-text)] font-semibold shadow-sm border border-[color:var(--theme-border)]' : 'text-[color:var(--theme-text-muted)] hover:text-[color:var(--theme-text)]'}`}>Type Color</button>
                                {step === 1 && <button onClick={() => setActiveTab('ai')} className={`flex-1 py-3.5 text-[9px] uppercase tracking-widest transition-colors rounded-md ${activeTab === 'ai' ? 'bg-[color:var(--theme-bg-elevated)] text-[color:var(--theme-text)] font-semibold shadow-sm border border-[color:var(--theme-border)]' : 'text-[color:var(--theme-text-muted)] hover:text-[color:var(--theme-text)]'}`}>AI Suggest</button>}
                            </div>
                         )}

                         {[2, 3, 4].includes(step) && (![1, 4].includes(step) || activeTab === 'catalog' || activeTab === 'upload') && step !== 4 && (
                             <div className="flex bg-[color:var(--theme-bg)] border border-[color:var(--theme-border)] p-1 rounded-lg gap-1 mb-6 overflow-x-auto hide-scrollbar">
                                 <button onClick={() => setActiveTab('upload')} className={`min-w-[100px] flex-1 py-3.5 px-2 text-[9px] uppercase tracking-widest transition-colors rounded-md ${activeTab === 'upload' ? 'bg-[color:var(--theme-bg-elevated)] text-[color:var(--theme-text)] font-semibold shadow-sm border border-[color:var(--theme-border)]' : 'text-[color:var(--theme-text-muted)] hover:text-[color:var(--theme-text)]'}`}>Upload</button>
                                 {step === 3 && <button onClick={() => setActiveTab('ai')} className={`min-w-[100px] flex-1 py-3.5 px-2 text-[9px] uppercase tracking-widest transition-colors rounded-md ${activeTab === 'ai' ? 'bg-[color:var(--theme-bg-elevated)] text-[color:var(--theme-text)] font-semibold shadow-sm border border-[color:var(--theme-border)]' : 'text-[color:var(--theme-text-muted)] hover:text-[color:var(--theme-text)]'}`}>AI Analysis</button>}
                                 <button onClick={() => setActiveTab('catalog')} className={`min-w-[100px] flex-1 py-3.5 px-2 text-[9px] uppercase tracking-widest transition-colors rounded-md ${activeTab === 'catalog' ? 'bg-[color:var(--theme-bg-elevated)] text-[color:var(--theme-text)] font-semibold shadow-sm border border-[color:var(--theme-border)]' : 'text-[color:var(--theme-text-muted)] hover:text-[color:var(--theme-text)]'}`}>Catalog</button>
                             </div>
                         )}
                         {step === 4 && (
                             <div className="flex bg-[color:var(--theme-bg)] border border-[color:var(--theme-border)] p-1 rounded-lg gap-1 mb-6 mt-[-10px] overflow-x-auto hide-scrollbar">
                                 <button onClick={() => setActiveTab('catalog')} className={`min-w-[100px] flex-1 py-3.5 px-2 text-[9px] uppercase tracking-widest transition-colors rounded-md ${activeTab === 'catalog' ? 'bg-[color:var(--theme-bg-elevated)] text-[color:var(--theme-text)] font-semibold shadow-sm border border-[color:var(--theme-border)]' : 'text-[color:var(--theme-text-muted)] hover:text-[color:var(--theme-text)]'}`}>Catalog</button>
                             </div>
                         )}

                         {(![1, 2, 3, 4].includes(step) || activeTab === 'upload') && (
                            <div 
                               className={`relative group cursor-pointer w-full max-w-sm mx-auto rounded-xl overflow-hidden border transition-all duration-700 flex flex-col items-center justify-center bg-[color:var(--theme-bg-elevated)] shadow-xl
                                  ${referenceImg ? 'border-[color:var(--color-luxury-accent)]/50' : 'border-[color:var(--theme-border)] hover:border-[color:var(--color-luxury-accent)]/30 aspect-square'}
                               `}
                               onClick={triggerUpload}
                            >
                               {referenceImg ? (
                                  <>
                                     <img src={referenceImg} alt="Reference" className="w-full h-auto object-contain block opacity-80 group-hover:opacity-100 transition-opacity bg-[color:var(--theme-bg)]" />
                                     <div className="absolute inset-0 bg-[color:var(--theme-bg)]/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                                        <span className="text-[9px] uppercase tracking-widest border border-[color:var(--theme-border)] text-[color:var(--theme-text)] px-4 py-2 rounded-full backdrop-blur-md">Change Reference</span>
                                     </div>
                                  </>
                               ) : (
                                  <div className="flex flex-col items-center gap-4">
                                     <Wand2 size={24} className="text-[color:var(--theme-text-muted)] group-hover:text-[color:var(--color-luxury-accent)] transition-colors duration-500" />
                                     <span className="text-[9px] uppercase tracking-[0.2em] text-[color:var(--theme-text-muted)]">Upload Target Reference</span>
                                  </div>
                               )}
                            </div>
                         )}
                         
                         {/* Detected Palette */}
                         {([1, 2, 3].includes(step)) && activeTab === 'upload' && detectingPalette && (
                            <div className="mt-4 flex flex-col gap-2 p-4 border border-[color:var(--theme-border)] rounded-xl bg-[color:var(--theme-bg-elevated)]">
                                <div className="text-[9px] uppercase tracking-[0.2em] text-[color:var(--theme-text-muted)] flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full border border-[color:var(--theme-border-accent)] border-t-[color:var(--color-luxury-accent)] animate-spin"></span>
                                    Analyzing colors...
                                </div>
                            </div>
                         )}

                         {([1, 2, 3].includes(step)) && (activeTab === 'upload' || activeTab === 'catalog') && !detectingPalette && detectedPalette.length > 0 && (
                            <div className="mt-4 flex flex-col gap-3 p-4 border border-[color:var(--theme-border)] rounded-xl bg-[color:var(--theme-bg-elevated)]">
                                <span className="text-[9px] uppercase tracking-[0.2em] text-[color:var(--theme-text-muted)] flex items-center gap-2">
                                    <Palette size={12} className="text-[color:var(--color-luxury-accent)]" />
                                    Detected {step === 3 ? 'Makeup' : 'Hair'} Palette
                                </span>
                                <div className="flex gap-2">
                                    {detectedPalette.map((color, idx) => (
                                        <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                                            <div 
                                                className="w-8 h-8 rounded-full border shadow-sm"
                                                style={{ backgroundColor: color.hex, borderColor: 'rgba(255,255,255,0.1)' }}
                                                title={color.label}
                                            />
                                            <span className="text-[8px] uppercase text-[color:var(--theme-text-muted)] text-center line-clamp-1 h-3">{color.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                         )}

                         {[1, 4].includes(step) && activeTab === 'manual' && (
                            <div className="flex flex-col gap-4 bg-[color:var(--theme-bg-elevated)] p-6 rounded-xl border border-[color:var(--theme-border)]">
                                <div className="relative">
                                   <Palette size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--theme-text-muted)]" />
                                   <input 
                                       type="text" 
                                       placeholder="#HEX or description (e.g. 'Auburn')"
                                       value={manualColor}
                                       onChange={(e) => setManualColor(e.target.value)}
                                       className="w-full bg-[color:var(--theme-bg)] border border-[color:var(--theme-border)] p-4 pl-12 text-[11px] text-[color:var(--theme-text)] rounded-lg focus:outline-none focus:border-[color:var(--color-luxury-accent)] transition-colors placeholder-[color:var(--theme-text-muted)]"
                                   />
                                </div>
                            </div>
                         )}

                         {[1, 3].includes(step) && activeTab === 'ai' && (
                            <div className="flex flex-col gap-4">
                                {hairSuggestions.length === 0 ? (
                                    <button 
                                       onClick={handleAnalysis}
                                       disabled={analyzingHair}
                                       className="w-full py-4 bg-[color:var(--theme-bg-elevated)] border border-[color:var(--color-luxury-accent)] text-[color:var(--color-luxury-accent)] text-[10px] uppercase tracking-widest rounded-xl flex items-center justify-center gap-3 hover:bg-[color:var(--color-luxury-accent)]/10 transition-colors shadow-sm"
                                    >
                                       {analyzingHair ? <span className="animate-pulse flex items-center gap-2"><Wand2 size={14} className="animate-spin" /> Analyzing Features...</span> : <><Sparkles size={14} /> Provide Aesthetic Suggestions</>}
                                    </button>
                                ) : (
                                    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto hide-scrollbar pr-2">
                                       {hairSuggestions.map((sug, idx) => (
                                          <div 
                                             key={idx}
                                             onClick={() => setSelectedSuggestion(sug)}
                                             className={`p-4 border rounded-xl text-left cursor-pointer transition-colors ${selectedSuggestion?.colorName === sug.colorName ? 'border-[color:var(--color-luxury-accent)] bg-[color:var(--color-luxury-accent)]/10 shadow-[0_0_15px_rgba(230,175,116,0.15)]' : 'border-[color:var(--theme-border)] bg-[color:var(--theme-bg-elevated)] hover:border-[color:var(--color-luxury-accent)]/50'}`}
                                          >
                                             <div className="flex items-center gap-3 mb-2">
                                                <div className="w-6 h-6 rounded-full border border-[color:var(--theme-text)]/10 shadow-sm" style={{ backgroundColor: sug.hexCode }}></div>
                                                <span className="text-[12px] font-bold text-[color:var(--theme-text)]">{sug.colorName}</span>
                                             </div>
                                             <p className="text-[10px] text-[color:var(--theme-text-muted)] leading-relaxed">{sug.explanation}</p>
                                          </div>
                                       ))}
                                    </div>
                                )}
                            </div>
                         )}

                         {[2, 3, 4].includes(step) && activeTab === 'catalog' && (
                             <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto hide-scrollbar pr-2">
                                 {(step === 3 ? CATALOG_MAKEUP : step === 4 ? CATALOG_LENSES : CATALOG_HAIR).map((item) => (
                                     <div 
                                         key={item.id} 
                                         onClick={() => setReferenceImg(item.src)}
                                         className={`relative cursor-pointer aspect-[3/4] rounded-lg overflow-hidden border transition-all ${referenceImg === item.src ? 'border-[color:var(--color-luxury-accent)] shadow-[0_0_15px_rgba(230,175,116,0.2)] scale-100' : 'border-[color:var(--theme-border)] opacity-80 hover:opacity-100 scale-[0.98] hover:scale-100 filter hover:grayscale-0 grayscale-[20%]'}`}
                                     >
                                         <img src={item.src} className="w-full h-full object-cover" alt={item.title} />
                                         <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8">
                                             <span className="text-[9px] uppercase tracking-widest text-white font-medium">{item.title}</span>
                                         </div>
                                         {referenceImg === item.src && (
                                             <div className="absolute top-2 right-2 w-5 h-5 bg-[color:var(--color-luxury-accent)] rounded-full flex items-center justify-center">
                                                 <Check size={12} className="text-black" />
                                             </div>
                                         )}
                                     </div>
                                 ))}
                             </div>
                         )}

                         {/* Custom Sci-Fi/Luxury Toggle for Veil */}
                         {[2, 3].includes(step) && (
                            <div 
                               onClick={() => setWithVeil(!withVeil)}
                               className={`mt-6 p-5 rounded-xl border backdrop-blur-md cursor-pointer transition-all duration-500 flex items-center justify-between group
                                  ${withVeil ? 'border-[color:var(--color-luxury-accent)]/50 bg-[color:var(--color-luxury-accent)]/5' : 'border-[color:var(--theme-border)] bg-[color:var(--theme-bg-elevated)]'}
                               `}
                            >
                               <div className="flex items-center gap-4">
                                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${withVeil ? 'border-[color:var(--color-luxury-accent)]/50 bg-[color:var(--color-luxury-accent)]/10 text-[color:var(--color-luxury-accent)]' : 'border-[color:var(--theme-border)] text-[color:var(--theme-text-muted)]'}`}>
                                     <Sparkles size={12} />
                                  </div>
                                  <div className="flex flex-col">
                                     <span className={`text-[10px] uppercase tracking-widest ${withVeil ? 'text-[color:var(--theme-text)]' : 'text-[color:var(--theme-text)] opacity-60'}`}>Add Bridal Veil</span>
                                     <span className="text-[8px] font-mono text-[color:var(--theme-text-muted)] opacity-60">OPTIONAL - إضافة طرحة</span>
                                  </div>
                               </div>
                               {/* Custom switch track */}
                               <div className={`w-10 h-5 rounded-full relative transition-colors duration-500 ${withVeil ? 'bg-[color:var(--color-luxury-accent)]/80' : 'bg-[color:var(--theme-text)]/10'}`}>
                                  {/* Custom switch thumb */}
                                  <div className={`absolute top-1 bottom-1 w-3 rounded-full bg-[color:var(--theme-text)] transition-all duration-500 shadow-sm ${withVeil ? 'left-6' : 'left-1'}`} />
                               </div>
                            </div>
                         )}

                         {/* Makeup Transfer Toggles */}
                         {step === 3 && (
                             <div className="mt-6 flex flex-col gap-3">
                                <p className="text-[10px] uppercase tracking-widest text-[color:var(--theme-text-muted)] mb-2">Transfer Specifics (تحديد مناطق النقل)</p>
                                {[
                                   { id: 'eyes', label: 'Eye Makeup', sub: 'Eyeshadow, Eyeliner, Lashes', value: makeupToggles.eyes },
                                   { id: 'lips', label: 'Lip Color', sub: 'Lipstick, Gloss, Liner', value: makeupToggles.lips },
                                   { id: 'foundation', label: 'Base Makeup', sub: 'Foundation, Contour, Blush', value: makeupToggles.foundation }
                                ].map((toggle) => (
                                   <div 
                                      key={toggle.id}
                                      onClick={() => setMakeupToggles(prev => ({ ...prev, [toggle.id]: !prev[toggle.id as keyof typeof prev] }))}
                                      className={`p-4 rounded-xl border backdrop-blur-md cursor-pointer transition-all duration-300 flex items-center justify-between group
                                         ${toggle.value ? 'border-[color:var(--color-luxury-accent)]/30 bg-[color:var(--color-luxury-accent)]/5' : 'border-[color:var(--theme-border)] bg-[color:var(--theme-bg-elevated)] opacity-60 hover:opacity-100'}
                                      `}
                                   >
                                      <div className="flex flex-col">
                                         <span className={`text-[11px] font-bold ${toggle.value ? 'text-[color:var(--theme-text)]' : 'text-[color:var(--theme-text-muted)]'}`}>{toggle.label}</span>
                                         <span className="text-[9px] text-[color:var(--theme-text-muted)] opacity-80 mt-1">{toggle.sub}</span>
                                      </div>
                                      <div className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${toggle.value ? 'bg-[color:var(--color-luxury-accent)] border-[color:var(--color-luxury-accent)]' : 'border-[color:var(--theme-border)] bg-transparent'}`}>
                                          {toggle.value && <Check size={10} className="text-[#111]" strokeWidth={3} />}
                                      </div>
                                   </div>
                                ))}
                             </div>
                         )}

                         {/* Makeup Intensity Slider */}
                         {step === 3 && (
                             <div className="mt-6 flex flex-col gap-3">
                                 <div className="flex justify-between items-center mb-1">
                                     <p className="text-[10px] uppercase tracking-widest text-[color:var(--theme-text-muted)]">Intensity (كثافة المكياج)</p>
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
                                 <div className="flex justify-between w-full text-[8px] uppercase tracking-widest text-[color:var(--theme-text-muted)] mt-1 opacity-70">
                                     <span>Subtle (خفيف)</span>
                                     <span>Glamorous (بارز)</span>
                                 </div>
                             </div>
                         )}

                         <div className="flex items-center gap-4 mt-10">
                            <button 
                               disabled={loading || ((step === 1 || step === 4) ? (activeTab === 'upload' ? !referenceImg : activeTab === 'manual' ? !manualColor : !selectedSuggestion) : step === 3 && activeTab === 'ai' ? !selectedSuggestion : !referenceImg)}
                               onClick={() => processGeneration(false)}
                               className={`flex-1 lux-button-solid py-4 flex justify-center items-center gap-2 ${(loading || ((step === 1 || step === 4) ? (activeTab === 'upload' ? !referenceImg : activeTab === 'manual' ? !manualColor : !selectedSuggestion) : step === 3 && activeTab === 'ai' ? !selectedSuggestion : !referenceImg)) ? 'opacity-50' : ''}`}
                            >
                               {loading ? 'Processing...' : 'Execute Merge'}
                            </button>
                            <button 
                               onClick={() => proceedToNextStep(true)}
                               className="px-6 py-4 border border-[color:var(--theme-border)] hover:border-[color:var(--theme-border-accent)] rounded-full text-[9px] uppercase tracking-widest text-[color:var(--theme-text-muted)] hover:text-[color:var(--theme-text)] transition-all duration-300"
                            >
                               Skip
                            </button>
                         </div>
                      </div>

                      {/* Right Column: Output & Tools */}
                      <div className="w-full lg:w-[60%] flex flex-col">
                         {!generatedImg ? (
                            <div className="w-full max-w-[450px] mx-auto aspect-[3/4] border border-dashed border-[color:var(--theme-border)] bg-[color:var(--theme-bg-elevated)] flex flex-col items-center justify-center rounded-xl relative overflow-hidden">
                               <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[color:var(--color-luxury-accent)]/20 to-transparent absolute top-1/2 -translate-y-1/2" />
                               <div className="w-[1px] h-full bg-gradient-to-b from-transparent via-[color:var(--color-luxury-accent)]/20 to-transparent absolute left-1/2 -translate-x-1/2" />
                               <span className="text-[9px] uppercase tracking-widest text-[color:var(--theme-text-muted)] bg-[color:var(--theme-bg)] px-4 py-2 rounded-full backdrop-blur-md relative z-10 border border-[color:var(--theme-border)]">Awaiting Generation</span>
                            </div>
                         ) : (
                            <motion.div initial={{opacity:0, scale:0.98}} animate={{opacity:1, scale:1}} className="flex flex-col gap-8 items-center w-full">
                               {extractedStyleInfo && !loading && (
                                  <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} className="w-full max-w-[450px] mx-auto p-4 bg-[color:var(--theme-bg-elevated)] border border-[color:var(--color-luxury-accent)]/30 rounded-xl mb-4">
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
                               <div className="w-full max-w-[450px] mx-auto rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.1)] dark:shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-[color:var(--theme-border)]">
                                  <ImageComparisonSlider 
                                     beforeImage={getTargetImage()!} 
                                     afterImage={generatedImg} 
                                     isLoading={loading}
                                     loadingProgress={progress}
                                     loadingMessage={loadingMessage}
                                  />
                               </div>
                               
                               <div className="w-full max-w-[450px] mx-auto flex flex-col gap-4 bg-[color:var(--theme-bg-elevated)] p-6 border border-[color:var(--theme-border)] rounded-xl backdrop-blur-sm shadow-sm transition-all duration-300 hover:shadow-md">
                                  <div className="flex items-center justify-between">
                                      <span className="text-[9px] uppercase tracking-[0.3em] font-semibold text-[color:var(--color-luxury-accent)] flex items-center gap-2">
                                         <Wand2 size={12}/> Micro-Adjustments 
                                      </span>
                                      <span className="text-[9px] text-[color:var(--theme-text-muted)] opacity-70">
                                         Common tweaks
                                      </span>
                                  </div>
                                  
                                  <div className="flex flex-wrap gap-2 mt-1">
                                      {(step === 1 ? ["Lighter Tone", "Darker Tone", "Warmer Accent", "Cooler Accent", "Less Saturation"] :
                                        step === 2 ? ["More Volume", "Sleeker Finish", "Messier Look", "Tighter Curls", "Looser Waves"] :
                                        step === 3 ? ["Softer Makeup", "More Glamorous", "Darker Eyes", "Lighter Lips", "More Blush"] :
                                        step === 4 ? ["More Intense Color", "More Natural", "Brighter Eyes", "Darker Eyes", "Softer Edge"] :
                                        ["Lighter", "Darker", "More Intense", "Softer"]).map((adjLabel, idx) => (
                                          <button
                                            key={idx}
                                            onClick={() => {
                                                setAdjustment(adjLabel);
                                            }}
                                            disabled={loading}
                                            className="px-3 py-1.5 rounded-full border border-[color:var(--theme-border)] text-[9px] text-[color:var(--theme-text-muted)] hover:text-[color:var(--theme-text)] hover:border-[color:var(--color-luxury-accent)]/80 bg-[color:var(--theme-bg)] transition-all disabled:opacity-50"
                                          >
                                            {adjLabel}
                                          </button>
                                      ))}
                                  </div>

                                  <div className="flex flex-col gap-3 relative mt-2">
                                     <div className="relative flex items-center">
                                         <input
                                           type="text"
                                           value={adjustment}
                                           onChange={(e) => setAdjustment(e.target.value)}
                                           onKeyDown={(e) => {
                                               if(e.key === 'Enter' && !loading && adjustment.trim()) {
                                                   processGeneration(true);
                                               }
                                           }}
                                           placeholder="Or type your own tweak... (e.g. 'Make the tone cooler')"
                                           className="w-full bg-[color:var(--theme-bg)] border border-[color:var(--theme-border)] p-3 pr-10 text-[11px] text-[color:var(--theme-text)] focus:outline-none focus:border-[color:var(--color-luxury-accent)]/50 focus:ring-1 focus:ring-[color:var(--color-luxury-accent)]/30 rounded-lg transition-all placeholder-[color:var(--theme-text-muted)]/70 shadow-inner"
                                           disabled={loading}
                                         />
                                         <button 
                                            onClick={handleEnhancePrompt} 
                                            disabled={!adjustment.trim() || enhancingPrompt || loading} 
                                            title="Enhance Prompt with AI"
                                            className="absolute right-2 p-1.5 text-[color:var(--theme-text-muted)] hover:text-[color:var(--color-luxury-accent)] disabled:opacity-30 transition-colors bg-[color:var(--theme-bg)] rounded-md border border-transparent hover:border-[color:var(--color-luxury-accent)]/30 flex items-center justify-center"
                                         >
                                            {enhancingPrompt ? (
                                                <div className="w-3.5 h-3.5 border-2 border-[color:var(--color-luxury-accent)] border-t-white/0 rounded-full animate-spin"/>
                                            ) : (
                                                <Sparkles size={14} />
                                            )}
                                         </button>
                                     </div>
                                     <button onClick={() => processGeneration(true)} disabled={loading || !adjustment.trim()} className="lux-button-outline py-3 px-6 text-[10px] uppercase font-semibold tracking-wider whitespace-nowrap rounded-lg active:scale-95 transition-transform disabled:opacity-50 shadow-sm">Apply Adjustment</button>
                                  </div>
                                  <button onClick={() => proceedToNextStep(false)} className="w-full mt-2 lux-button-solid py-3.5 text-[10px] gap-2 flex items-center justify-center rounded-lg uppercase tracking-widest font-semibold shadow-lg hover:shadow-xl transition-all">
                                     Approve & Continue <ChevronRight size={14} className="opacity-70"/>
                                  </button>
                               </div>
                            </motion.div>
                         )}
                      </div>

                   </motion.div>
                )}

                {/* STEP 5: FINAL REVEAL */}
                {step === 5 && (
                   <motion.div key="step5" initial={{opacity:0, filter:'blur(20px)', y: 20}} animate={{opacity:1, filter:'blur(0px)', y: 0}} exit={{opacity:0}} transition={{duration: 1}} className="flex flex-col items-center justify-center text-center relative z-10 w-full">
                      
                      <div className="mb-12">
                         <span className="inline-block px-4 py-1.5 rounded-full border border-[color:var(--color-luxury-accent)]/30 text-[8px] uppercase tracking-[0.4em] text-[color:var(--color-luxury-accent)] bg-[color:var(--color-luxury-accent)]/5 backdrop-blur-md mb-6">Process Complete</span>
                         <h3 className="font-serif italic text-5xl md:text-6xl text-[color:var(--theme-text)]">Your Final Look</h3>
                      </div>

                      <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16 justify-center w-full max-w-5xl">
                         
                         {/* Original */}
                         <div className="flex flex-col items-center gap-4">
                            <span className="text-[9px] uppercase tracking-[0.3em] text-[color:var(--theme-text-muted)] font-mono">Reference Photo</span>
                            <div className="w-56 md:w-64 aspect-[3/4] overflow-hidden rounded-xl border border-[color:var(--theme-border)] opacity-70 transition-all duration-700">
                               <img src={baseImage!} className="w-full h-full object-cover" />
                            </div>
                         </div>

                         <div className="w-[1px] h-24 md:w-24 md:h-[1px] bg-gradient-to-b md:bg-gradient-to-r from-transparent via-[color:var(--theme-border)] to-transparent" />

                         {/* Final */}
                         <div className="flex flex-col items-center gap-4 relative">
                            <div className="absolute -inset-10 bg-[color:var(--color-luxury-accent)]/10 blur-[60px] rounded-full pointer-events-none" />
                            <span className="text-[9px] uppercase tracking-[0.3em] text-[color:var(--color-luxury-accent)] relative z-10 font-mono">Final Simulation</span>
                            <div className="w-80 md:w-96 md:max-w-[400px] aspect-[3/4] overflow-hidden rounded-2xl border border-[color:var(--color-luxury-accent)]/50 shadow-[0_0_60px_rgba(230,175,116,0.15)] relative z-10 group">
                               <img src={history[3] || history[2] || history[1] || history[0] || baseImage!} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
                            </div>
                         </div>

                      </div>

                      <button onClick={() => {
                           setStep(0);
                           setBaseImage(null);
                           setHistory([]);
                      }} className="group mt-16 flex items-center gap-3 px-8 py-4 rounded-full border border-[color:var(--theme-border)] hover:border-[color:var(--color-luxury-accent)]/50 bg-[color:var(--theme-bg-elevated)] transition-all duration-500">
                         <span className="text-[9px] uppercase tracking-[0.2em] text-[color:var(--theme-text-muted)] group-hover:text-[color:var(--theme-text)]">Initialize New Subject</span>
                         <Wand2 size={14} className="text-[color:var(--theme-text-muted)] group-hover:text-[color:var(--theme-text)]" />
                      </button>

                   </motion.div>
                )}

             </AnimatePresence>
          </div>

       </div>
       <input type="file" hidden accept="image/*" ref={fileInputRef} onChange={handleUploadRef} />
       
       <AnimatePresence>
          {showGuidelines && (
             <GuidelinesModal 
                onAcknowledge={handleGuidelinesAck} 
                onCancel={() => setShowGuidelines(false)} 
             />
          )}
       </AnimatePresence>

       {imageToCrop && (
          <CropModal 
             imageSrc={imageToCrop}
             onCropComplete={handleCropComplete}
             onCropCancel={() => setImageToCrop(null)}
          />
       )}
    </div>
  );
}
