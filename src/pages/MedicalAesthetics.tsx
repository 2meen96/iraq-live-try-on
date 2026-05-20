import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, CheckCircle2, ChevronRight, Fingerprint, Sparkles, Wand2, Bookmark, Check } from 'lucide-react';
import { analyzeFacialProportions, simulateAR, FacialAssessment, validateClinicalImage } from '../services/ai';
import { useAuth, saveTryOn } from '../services/firebase';
import ImageComparisonSlider from '../components/ImageComparisonSlider';
import { Link } from 'react-router-dom';

import { VisualFaceMap } from '../components/VisualFaceMap';
import { VolumetricScanner } from '../components/VolumetricScanner';

export default function MedicalAesthetics() {
  const { user } = useAuth();
  // High-level Modes
  const [activeTab, setActiveTab] = useState<'selection' | 'analysis'>('selection');
  
  // Golden Ratio Analysis State
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [angleImage, setAngleImage] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [imagesConfirmed, setImagesConfirmed] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [validatingImage, setValidatingImage] = useState(false);
  const [treatmentPlan, setTreatmentPlan] = useState<FacialAssessment | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  
  // Clinical Context State
  const [ageBracket, setAgeBracket] = useState('30-39');
  const [skinThickness, setSkinThickness] = useState('Average');
  const [primaryGoal, setPrimaryGoal] = useState('Volume Restoration');
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Custom Instruction State
  const [selectedArea, setSelectedArea] = useState('lips');
  const [selectedVolume, setSelectedVolume] = useState('0.5');
  const [selectedMaterial, setSelectedMaterial] = useState('Hyaluronic Acid (e.g. Juvederm/Restylane)');
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');

  const handleUploadRef = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBaseImage(reader.result as string);
        setTreatmentPlan(null);
        setFinalImage(null);
        setSaveSuccess(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAngleUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string | null>>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processFacialAnalysis = async (force: boolean = false) => {
    if (!user) {
        setErrorMsg("Sign in required to perform advanced medical simulations.");
        return;
    }
    if (!baseImage) return;
    
    setValidatingImage(true);
    setLoadingAnalysis(false);
    setErrorMsg(null);
    setSaveSuccess(false);
    
    try {
        let qualityCheck = { isValid: true, issues: [], instruction: '' };
        if (!force) {
            qualityCheck = await validateClinicalImage(baseImage);
        }
        setValidatingImage(false);

        if (!qualityCheck.isValid) {
            setErrorMsg(`Clinical Image Quality Issue: ${qualityCheck.issues.join(', ')}. ${qualityCheck.instruction}`);
            return;
        }

        setLoadingAnalysis(true);

        // Step 1: Analyze Face (Vision + Text)
        const imagesToAnalyze = [baseImage, angleImage, profileImage].filter(Boolean) as string[];
        const plan = await analyzeFacialProportions(imagesToAnalyze, {
            ageBracket,
            skinThickness,
            primaryGoal
        });
        
        // Visual text animation placeholder while second task runs
        setTreatmentPlan(plan);

        // Step 2: Simulate The Result visually
        const prompt = `CLINICAL MANDATE: Generate a high-fidelity, PHOTOREALISTIC clinical "after" image matching this exact treatment plan: ${plan.treatments.join(', ')}.
          RULES FOR STRICT REALISM:
          1. ZERO bone or cranial structure changes. You are ONLY injecting dermal filler (soft tissue volume) and Botox (muscle relaxation).
          2. Maintain exact original lighting, skin texture, pores, blemishes, facial hair, and background. Do NOT airbrush, smoothen over, or apply any "beauty filters".
          3. The result must look like a raw, unedited photograph taken 2 weeks post-procedure in a real medical clinic. 
          4. The volume changes MUST be anatomically possible and realistic. Provide a 100% realistic representation of the patient's achievable non-surgical outcome.`;
          
        const visualResult = await simulateAR(baseImage, undefined, prompt);
        setFinalImage(visualResult);

    } catch (err: any) {
        const errorString = err?.message?.toLowerCase() || '';
        let friendlyMsg = err.message || "Failed to analyze face or generate result.";
        if (errorString.includes('api key') || errorString.includes('unauthorized') || errorString.includes('401') || err?.status === 401) {
            friendlyMsg = "API Key is missing or invalid. Please 'Authenticate API Key' via the settings menu to proceed.";
        } else if (errorString.includes('quota') || errorString.includes('429') || err?.status === 429) {
            friendlyMsg = "AI simulation quota exceeded. Please try again later or check your API key tier.";
        }
        setErrorMsg(friendlyMsg);
    } finally {
        setLoadingAnalysis(false);
    }
  };

  const processCustomUpdate = async () => {
    if (!baseImage) return;
    
    setLoadingCustom(true);
    setErrorMsg(null);
    setSaveSuccess(false);
    try {
        const isBotox = selectedArea.toLowerCase().includes('botox') || selectedArea.toLowerCase().includes('brow lift');
        
        let volumeDescription = '';
        if (!isBotox) {
            const vol = parseFloat(selectedVolume);
            if (vol <= 0.5) volumeDescription = 'a very subtle, natural hydration effect. Slight plumping, smoothing of fine lines, barely noticeable size increase';
            else if (vol <= 1.0) volumeDescription = 'a noticeable volume increase. Enhanced borders, moderate projection, visibly fuller but still natural';
            else if (vol <= 1.5) volumeDescription = 'a significant volume increase. Very full appearance, strong projection, highly noticeable augmentation';
            else volumeDescription = 'a dramatic and extreme volume increase! Maximum fullness, highly visible physical expansion and projection of the soft tissue, visually much larger';
        }

        const injectionText = isBotox 
          ? `Inject precise Botox to the "${selectedArea}" for a subtle medical relaxation/lift. Show a slight, realistic elevation of the outer brow arch for a more lifted appearance while softening dynamic wrinkles.`
          : `Apply "${selectedVolume}cc" of ${selectedMaterial} dermal filler to the "${selectedArea}". Visually, THIS IS CRITICAL: Create ${volumeDescription} in the "${selectedArea}". MAKE SURE THE PHYSICAL SIZE CHANGE IS OBVIOUS in the image based on this description!`;

        const prompt = `CLINICAL MANDATE: ${injectionText}
          RULES FOR STRICT REALISM:
          1. This is a non-surgical clinical procedure. NO bone changes. NO cranial/eye/nose shape changes.
          2. Maintain exact original lighting, skin imperfections, pores, and background. ZERO airbrushing, smoothing, or beauty filters.
          3. ${isBotox ? 'The muscle relaxation must look completely natural and anatomically accurate.' : 'The added volume must be physically apparent in the image. Do not ignore the volume request. The specified area MUST look physically larger/projected according to the requested amount.'}
          4. Preserve the patient's unique identity perfectly. The image MUST look like a raw clinical photograph, retaining all natural skin textures.`;
          
        const imageToProcess = finalImage || baseImage;
        const visualResult = await simulateAR(imageToProcess, undefined, prompt);
        setFinalImage(visualResult);
    } catch (err: any) {
        const errorString = err?.message?.toLowerCase() || '';
        let friendlyMsg = err.message || "Failed to generate custom result.";
        if (errorString.includes('api key') || errorString.includes('unauthorized') || errorString.includes('401') || err?.status === 401) {
            friendlyMsg = "API Key is missing or invalid. Please 'Authenticate API Key' via the settings menu to proceed.";
        } else if (errorString.includes('quota') || errorString.includes('429') || err?.status === 429) {
            friendlyMsg = "AI simulation quota exceeded. Please try again later or check your API key tier.";
        }
        setErrorMsg(friendlyMsg);
    } finally {
        setLoadingCustom(false);
    }
  };

  const handleSaveSimulation = async () => {
     if (!user || !baseImage || !finalImage) return;

     setIsSaving(true);
     setErrorMsg(null);
     try {
         await saveTryOn(user.uid, 'medical-aesthetics', baseImage, '', finalImage);
         setSaveSuccess(true);
     } catch (err: any) {
         setErrorMsg(err.message || 'Failed to save simulation.');
         setSaveSuccess(false);
     } finally {
         setIsSaving(false);
     }
  };

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-12">
      <div className="mb-12 text-center md:text-left flex flex-col md:flex-row justify-between items-end gap-6">
         <div>
            <span className="text-[9px] uppercase tracking-[0.4em] opacity-40 block mb-3 text-[color:var(--color-luxury-accent)]">Clinical Science & Aesthetics</span>
            <h2 className="font-serif text-4xl md:text-5xl font-light tracking-tight text-[color:var(--theme-text)]">
               Fillers & <span className="italic text-[color:var(--color-luxury-rosegold)] font-semibold">Botox</span>
            </h2>
         </div>
         <p className="text-[10px] uppercase tracking-widest opacity-40 max-w-xs md:text-right leading-loose text-[color:var(--theme-text)]">
            Precision enhancements. Choose a specific style or let our AI analyze your facial proportions.
         </p>
      </div>

      <AnimatePresence mode="wait">
        {/* MODE SELECTION SCREEN */}
        {activeTab === 'selection' && (
          <motion.div 
            key="selection" 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12"
          >
             {/* Specific Try-On Path */}
             <div className="group relative flex flex-col items-center text-center p-12 rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] hover:border-[color:var(--color-luxury-accent)]/50 transition-all duration-700 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-[color:var(--color-luxury-accent)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                
                <div className="w-16 h-16 rounded-full border border-[color:var(--color-luxury-accent)]/30 flex items-center justify-center mb-8 bg-[color:var(--theme-bg)] relative z-10">
                   <Sparkles size={24} className="text-[color:var(--color-luxury-accent)]" />
                </div>
                
                <h3 className="font-serif text-2xl mb-4 text-[color:var(--theme-text)] relative z-10">Targeted Enhancement</h3>
                <p className="text-[10px] uppercase tracking-widest opacity-50 leading-loose max-w-sm mb-10 text-[color:var(--theme-text)] relative z-10">
                   Already know what you want? Browse our catalog of lip shapes, jawline definitions, and cheek volumes and try them on your face instantly.
                </p>
                
                <Link to="/services/fillers-botox" className="lux-button-solid relative z-10">Browse Catalog</Link>
             </div>

             {/* Auto Analysis Path */}
             <div className="group relative flex flex-col items-center text-center p-12 rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] hover:border-[color:var(--color-luxury-accent)]/50 transition-all duration-700 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-[color:var(--color-luxury-rosegold)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                
                <div className="w-16 h-16 rounded-full border border-[color:var(--color-luxury-rosegold)]/30 flex items-center justify-center mb-8 bg-[color:var(--theme-bg)] relative z-10">
                   <Fingerprint size={24} className="text-[color:var(--color-luxury-rosegold)]" />
                </div>
                
                <h3 className="font-serif text-2xl mb-4 text-[color:var(--theme-text)] relative z-10">Golden Ratio Analysis</h3>
                <p className="text-[10px] uppercase tracking-widest opacity-50 leading-loose max-w-sm mb-10 text-[color:var(--theme-text)] relative z-10">
                   Let our medical AI scan your facial geometry. Discover a personalized treatment roadmap designed to achieve scientific harmony and symmetry.
                </p>
                
                <button onClick={() => setActiveTab('analysis')} className="px-8 py-3 rounded-full border border-[color:var(--color-luxury-rosegold)] text-[color:var(--color-luxury-rosegold)] text-[10px] uppercase tracking-widest hover:bg-[color:var(--color-luxury-rosegold)] hover:text-white transition-colors relative z-10">
                   Initiate Scan
                </button>
             </div>
          </motion.div>
        )}

        {/* ANALYSIS INTERFACE */}
        {activeTab === 'analysis' && (
          <motion.div key="analysis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 flex flex-col items-center">
             
             <button onClick={() => setActiveTab('selection')} className="text-[9px] uppercase tracking-widest opacity-50 hover:opacity-100 mb-8 flex items-center gap-2 self-start text-[color:var(--theme-text)]">
               &larr; Back to Modes
             </button>

             {!imagesConfirmed ? (
                <div className="flex flex-col items-center animate-[fade-in_1s_ease-out] w-full max-w-4xl px-4">
                  <h2 className="font-serif text-2xl mb-3 text-[color:var(--theme-text)]">Comprehensive Facial Setup</h2>
                  <p className="text-[10px] uppercase tracking-widest opacity-50 mb-8 max-w-md text-center">Upload 3 standardized angles to enable precision 3D volumetric analysis and Ricketts line evaluation.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-10">
                    {/* Frontal */}
                    <div 
                      className={`relative group cursor-pointer w-full max-w-[280px] mx-auto aspect-[3/4] rounded-2xl overflow-hidden border border-dashed transition-all duration-500 flex flex-col items-center justify-center shadow-md ${baseImage ? 'border-[color:var(--theme-accent)] bg-[color:var(--theme-bg-elevated)]' : 'border-[color:var(--theme-border-accent)] bg-[color:var(--theme-surface)] hover:border-[color:var(--color-luxury-accent)]'}`}
                    >
                      {baseImage ? (
                        <>
                          <img src={baseImage} className="w-full h-full object-cover opacity-80" />
                          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBaseImage(null); }} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white z-10 hover:bg-black/80">
                            <span className="text-[10px] uppercase tracking-widest mb-1">Remove</span>
                          </button>
                        </>
                      ) : (
                        <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                          <Fingerprint size={32} className="mb-4 opacity-30 text-[color:var(--theme-text)] group-hover:text-[color:var(--color-luxury-accent)] transition-colors" />
                          <p className="font-serif text-lg mb-1 text-[color:var(--theme-text)]">Frontal Scan</p>
                          <p className="text-[8px] uppercase tracking-widest opacity-40 text-center px-4 text-[color:var(--theme-text)]">0° • Required</p>
                          <input type="file" className="hidden" accept="image/*" onChange={handleUploadRef} />
                        </label>
                      )}
                    </div>
                    {/* 45-Degree */}
                    <div className={`relative group cursor-pointer w-full max-w-[280px] mx-auto aspect-[3/4] rounded-2xl overflow-hidden border border-dashed transition-all duration-500 flex flex-col items-center justify-center shadow-md ${angleImage ? 'border-[color:var(--theme-accent)] bg-[color:var(--theme-bg-elevated)]' : 'border-[color:var(--theme-border-accent)] bg-[color:var(--theme-surface)] hover:border-[color:var(--color-luxury-accent)]'}`}>
                      {angleImage ? (
                        <>
                          <img src={angleImage} className="w-full h-full object-cover opacity-80" />
                          <button onClick={() => setAngleImage(null)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white">
                            <span className="text-[10px] uppercase tracking-widest mb-1">Remove</span>
                          </button>
                        </>
                      ) : (
                        <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                          <UploadCloud size={24} className="mb-4 opacity-30 text-[color:var(--theme-text)] group-hover:text-[color:var(--color-luxury-accent)] transition-colors" />
                          <p className="font-serif text-lg mb-1 text-[color:var(--theme-text)]">Angle Scan</p>
                          <p className="text-[8px] uppercase tracking-widest opacity-40 text-center px-4 text-[color:var(--theme-text)]">45° • Optional</p>
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAngleUpload(e, setAngleImage)} />
                        </label>
                      )}
                    </div>
                    {/* 90-Degree */}
                    <div className={`relative group cursor-pointer w-full max-w-[280px] mx-auto aspect-[3/4] rounded-2xl overflow-hidden border border-dashed transition-all duration-500 flex flex-col items-center justify-center shadow-md ${profileImage ? 'border-[color:var(--theme-accent)] bg-[color:var(--theme-bg-elevated)]' : 'border-[color:var(--theme-border-accent)] bg-[color:var(--theme-surface)] hover:border-[color:var(--color-luxury-accent)]'}`}>
                      {profileImage ? (
                        <>
                          <img src={profileImage} className="w-full h-full object-cover opacity-80" />
                          <button onClick={() => setProfileImage(null)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white">
                            <span className="text-[10px] uppercase tracking-widest mb-1">Remove</span>
                          </button>
                        </>
                      ) : (
                        <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                          <UploadCloud size={24} className="mb-4 opacity-30 text-[color:var(--theme-text)] group-hover:text-[color:var(--color-luxury-accent)] transition-colors" />
                          <p className="font-serif text-lg mb-1 text-[color:var(--theme-text)]">Profile Scan</p>
                          <p className="text-[8px] uppercase tracking-widest opacity-40 text-center px-4 text-[color:var(--theme-text)]">90° • Optional</p>
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAngleUpload(e, setProfileImage)} />
                        </label>
                      )}
                    </div>
                  </div>
                  
                  <button 
                    disabled={!baseImage}
                    onClick={() => setImagesConfirmed(true)} 
                    className={`lux-button-solid shadow-xl flex items-center gap-3 justify-center w-full max-w-sm ${!baseImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                     <CheckCircle2 size={16} /> Proceed to Setup
                  </button>
                </div>
             ) : (
                <div className="w-full flex flex-col lg:flex-row gap-12">
                   {/* Left Side: Image / Output */}
                   <div className="flex-1 flex flex-col items-center">
                     <div className="w-full max-w-sm mb-4 flex justify-between items-center">
                        <span className="text-[10px] uppercase tracking-widest text-[color:var(--theme-text)] opacity-50">Visual Output</span>
                        <div className="flex bg-[color:var(--theme-surface)] rounded-md border border-[color:var(--theme-border)] p-1">
                           <button 
                             onClick={() => setViewMode('2D')}
                             className={`px-3 py-1 rounded-sm text-[10px] uppercase tracking-widest transition-colors ${viewMode === '2D' ? 'bg-[color:var(--theme-accent)] text-black font-semibold' : 'text-[color:var(--theme-text)] opacity-50 hover:opacity-100'}`}
                           >
                             2D Map
                           </button>
                           <button
                             onClick={() => setViewMode('3D')}
                             className={`px-3 py-1 rounded-sm text-[10px] uppercase tracking-widest transition-colors ${viewMode === '3D' ? 'bg-[color:var(--theme-accent)] text-black font-semibold' : 'text-[color:var(--theme-text)] opacity-50 hover:opacity-100'}`}
                           >
                             3D Volume
                           </button>
                        </div>
                     </div>
                     <div className="w-full max-w-sm rounded-xl overflow-hidden border border-[color:var(--theme-border)] shadow-2xl relative aspect-[3/4]">
                        {viewMode === '3D' && (finalImage || baseImage) ? (
                           <VolumetricScanner images={{ frontal: (finalImage || baseImage) as string, angle: angleImage, profile: profileImage }} />
                        ) : finalImage ? (
                           <ImageComparisonSlider beforeImage={baseImage} afterImage={finalImage} isLoading={loadingCustom || loadingAnalysis} />
                        ) : (
                           <div className="relative group w-full h-full">
                              <img src={baseImage} className={`w-full h-full object-cover transition-all duration-1000 ${(loadingAnalysis || validatingImage) ? 'opacity-50' : ''}`} />
                              {(loadingAnalysis || validatingImage) && (
                                 <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                    <div className="absolute inset-0 bg-[color:var(--theme-accent)]/10 animate-pulse pointer-events-none z-10" />
                                    {/* Scanning Grid Background overlay */}
                                    <div className="absolute inset-0 opacity-20 pointer-events-none z-10"
                                       style={{
                                         backgroundImage: `linear-gradient(to right, transparent 49%, var(--theme-accent) 50%, transparent 51%), linear-gradient(to bottom, transparent 49%, var(--theme-accent) 50%, transparent 51%)`,
                                         backgroundSize: '15% 15%'
                                       }}
                                    />
                                    {/* Facial Markers (Fake mapping points) */}
                                    <svg className="absolute inset-0 w-full h-full opacity-60 text-[color:var(--theme-accent)] pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                                        <circle cx="50" cy="40" r="1.5" fill="currentColor" className="animate-ping" />
                                        <circle cx="35" cy="50" r="1.5" fill="currentColor" className="animate-ping" style={{ animationDelay: '0.2s' }} />
                                        <circle cx="65" cy="50" r="1.5" fill="currentColor" className="animate-ping" style={{ animationDelay: '0.4s' }} />
                                        <circle cx="50" cy="65" r="1.5" fill="currentColor" className="animate-ping" style={{ animationDelay: '0.6s' }} />
                                        <circle cx="40" cy="75" r="1" fill="currentColor" className="animate-ping" style={{ animationDelay: '0.8s' }} />
                                        <circle cx="60" cy="75" r="1" fill="currentColor" className="animate-ping" style={{ animationDelay: '1.0s' }} />
                                        <path d="M 35 50 Q 50 65 65 50" fill="none" stroke="currentColor" strokeWidth="0.2" strokeDasharray="1 1" className="animate-pulse" />
                                        <path d="M 50 40 L 50 100" fill="none" stroke="currentColor" strokeWidth="0.2" strokeDasharray="1 1" />
                                        <path d="M 40 75 Q 50 85 60 75" fill="none" stroke="currentColor" strokeWidth="0.2" strokeDasharray="1 1" className="animate-pulse" />
                                    </svg>
                                    {/* The sweeping laser scanner */}
                                    <motion.div
                                       className="absolute left-0 right-0 h-[2px] bg-[color:var(--theme-accent)] z-20 pointer-events-none"
                                       style={{ boxShadow: '0 0 15px var(--theme-accent), 0 0 30px var(--theme-accent)' }}
                                       animate={{ top: ['0%', '100%', '0%'] }}
                                       transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
                                    />
                                    
                                    <div className="absolute inset-0 flex flex-col items-center justify-center translate-y-16 z-30">
                                        <motion.span 
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: 1 }}
                                          className="text-[9px] uppercase tracking-[0.3em] font-mono mt-8 bg-black/80 px-4 py-2 rounded-md text-[color:var(--theme-accent)] backdrop-blur-sm border border-[color:var(--theme-accent)]/30"
                                        >
                                           {validatingImage ? 'Validating Photo Quality...' : 'Scanning Image...'}
                                        </motion.span>
                                    </div>
                                 </div>
                              )}
                           </div>
                        )}
                     </div>

                     {!loadingAnalysis && !validatingImage && !finalImage && (
                        <div className="flex flex-col items-center gap-6 mt-8 w-full max-w-sm">
                            <div className="w-full space-y-4">
                               <h3 className="text-[10px] uppercase tracking-widest text-[color:var(--theme-accent)] mb-3 border-b border-[color:var(--theme-border-accent)] pb-2">Clinical Context</h3>
                               
                               <div className="flex flex-col gap-1.5">
                                  <label className="text-[9px] uppercase tracking-widest text-[color:var(--theme-text)] opacity-70">Age Bracket</label>
                                  <select value={ageBracket} onChange={(e) => setAgeBracket(e.target.value)} className="w-full bg-transparent border border-[color:var(--theme-border-accent)] text-[color:var(--theme-text)] text-xs px-3 py-2.5 rounded-md focus:outline-none focus:border-[color:var(--theme-accent)] transition-colors [&>option]:bg-[color:var(--theme-bg-elevated)]">
                                     <option value="18-29">18 - 29</option>
                                     <option value="30-39">30 - 39</option>
                                     <option value="40-49">40 - 49</option>
                                     <option value="50+">50+</option>
                                  </select>
                               </div>

                               <div className="flex flex-col gap-1.5">
                                  <label className="text-[9px] uppercase tracking-widest text-[color:var(--theme-text)] opacity-70">Skin Type / Thickness</label>
                                  <select value={skinThickness} onChange={(e) => setSkinThickness(e.target.value)} className="w-full bg-transparent border border-[color:var(--theme-border-accent)] text-[color:var(--theme-text)] text-xs px-3 py-2.5 rounded-md focus:outline-none focus:border-[color:var(--theme-accent)] transition-colors [&>option]:bg-[color:var(--theme-bg-elevated)]">
                                     <option value="Thin">Thin / Delicate</option>
                                     <option value="Average">Average</option>
                                     <option value="Thick">Thick / Sebaceous</option>
                                  </select>
                               </div>

                               <div className="flex flex-col gap-1.5">
                                  <label className="text-[9px] uppercase tracking-widest text-[color:var(--theme-text)] opacity-70">Primary Goal</label>
                                  <select value={primaryGoal} onChange={(e) => setPrimaryGoal(e.target.value)} className="w-full bg-transparent border border-[color:var(--theme-border-accent)] text-[color:var(--theme-text)] text-xs px-3 py-2.5 rounded-md focus:outline-none focus:border-[color:var(--theme-accent)] transition-colors [&>option]:bg-[color:var(--theme-bg-elevated)]">
                                     <option value="Volume Restoration">Volume Restoration</option>
                                     <option value="Lifting/Tightening">Lifting & Tightening</option>
                                     <option value="Symmetry Correction">Symmetry Correction</option>
                                     <option value="Preventative Aging">Preventative Aging</option>
                                  </select>
                               </div>
                            </div>

                            <button onClick={() => processFacialAnalysis(false)} className="lux-button-solid shadow-xl flex items-center gap-3 w-full justify-center">
                               <Wand2 size={16} /> Compute Treatment Roadmap
                            </button>
                            {errorMsg && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-xs text-center w-full leading-relaxed">
                                   <p>{errorMsg}</p>
                                   <button onClick={() => processFacialAnalysis(true)} className="mt-3 px-3 py-1 border border-red-500 rounded text-[9px] uppercase hover:bg-red-500/20">Force Proceed</button>
                                </div>
                            )}
                        </div>
                     )}

                     {finalImage && (
                        <div className="mt-8 w-full max-w-sm space-y-4 animate-[fade-in_1s_ease-out]">
                           <div className="flex flex-col gap-2 p-4 rounded-xl border border-[color:var(--theme-border-accent)] bg-[color:var(--theme-surface)] relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                <Sparkles size={80} className="text-[color:var(--theme-accent)]" />
                              </div>
                              <label className="text-[9px] uppercase tracking-[0.2em] opacity-80 text-[color:var(--theme-accent)] font-semibold mb-1">
                                Safe Volumetric Refinement
                              </label>
                              <p className="text-xs text-[color:var(--theme-text)] opacity-60 mb-3 leading-relaxed">
                                Select medically accurate additions to preview realistic enhancements without absurd distortions.
                              </p>
                              
                              <div className="flex flex-col gap-4 relative z-10">
                                <div className="flex flex-col gap-4">
                                    <VisualFaceMap 
                                       selectedArea={selectedArea} 
                                       onSelectArea={setSelectedArea} 
                                       imageUrl={finalImage || baseImage || undefined}
                                    />

                                    {!selectedArea.includes('botox') && (
                                        <div className="flex flex-col gap-4 mt-2">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[9px] uppercase tracking-widest text-[color:var(--theme-text)] opacity-70">Material Type</label>
                                                <select 
                                                  value={selectedMaterial}
                                                  onChange={(e) => setSelectedMaterial(e.target.value)}
                                                  className="w-full bg-transparent border border-[color:var(--theme-border-accent)] text-[color:var(--theme-text)] text-xs px-3 py-2 rounded-sm focus:outline-none focus:border-[color:var(--theme-accent)] transition-colors [&>option]:bg-[color:var(--theme-bg-elevated)]"
                                                >
                                                    <option value="Hyaluronic Acid (e.g. Juvederm/Restylane)">Hyaluronic Acid (Volume & Hydration)</option>
                                                    <option value="Biostimulator (e.g. Sculptra/Radiesse)">Biostimulator (Collagen & Structure)</option>
                                                </select>
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <div className="flex justify-between items-center text-xs text-[color:var(--theme-text)]">
                                                    <span className="opacity-60">Volume (cc)</span>
                                                    <span className="font-mono text-[color:var(--theme-accent)]">{Number(selectedVolume).toFixed(1)} cc</span>
                                                </div>
                                                <input 
                                                    type="range" 
                                                    min="0.1" 
                                                    max="2.0" 
                                                    step="0.1" 
                                                    value={selectedVolume}
                                                    onChange={(e) => setSelectedVolume(e.target.value)}
                                                    className="w-full h-1 bg-[color:var(--theme-border-accent)] rounded-lg appearance-none cursor-pointer accent-[color:var(--theme-accent)]"
                                                />
                                                <div className="flex justify-between text-[8px] uppercase tracking-widest opacity-40 text-[color:var(--theme-text)] mt-1">
                                                    <span>0.1cc</span>
                                                    <span>2.0cc</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button 
                                  onClick={processCustomUpdate}
                                  disabled={loadingCustom}
                                  className="w-full py-2 bg-[color:var(--theme-accent)] text-black rounded-sm text-[10px] uppercase tracking-widest font-bold disabled:opacity-50 hover:bg-[color:var(--theme-accent-dark)] transition-colors flex items-center justify-center gap-2"
                                >
                                  {loadingCustom ? <span className="animate-pulse">...</span> : <Wand2 size={14} />}
                                  Inject Safely
                                </button>
                              </div>
                           </div>

                           <div className="flex gap-4">
                             <button
                               onClick={() => setFinalImage(null)}
                               disabled={isSaving || saveSuccess || loadingCustom}
                               className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 text-xs uppercase tracking-widest transition-all border-[color:var(--theme-border-accent)] hover:bg-[color:var(--theme-surface)] text-[color:var(--theme-text)]`}
                             >
                               تراجع / مسح
                             </button>
                             <button
                               onClick={handleSaveSimulation}
                               disabled={isSaving || saveSuccess}
                               className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 text-xs uppercase tracking-widest transition-all ${
                                 saveSuccess 
                                   ? 'border-green-500/50 bg-green-500/10 text-green-500' 
                                   : 'border-[color:var(--theme-border-accent)] hover:border-[color:var(--theme-accent)] text-[color:var(--theme-text)]'
                               }`}
                             >
                                {isSaving ? <span className="animate-pulse">Saving...</span> : saveSuccess ? <><Check size={14}/> Saved</> : <><Bookmark size={14}/> Save</>}
                             </button>
                             <Link
                               to="/services"
                               className="flex-[2] py-3 rounded-xl border border-transparent bg-[color:var(--theme-accent)] hover:bg-[color:var(--theme-accent-hover)] text-[color:var(--color-bg-primary)] flex items-center justify-center gap-2 text-xs uppercase tracking-widest transition-all font-medium"
                             >
                               Book Consultation
                             </Link>
                           </div>

                           {errorMsg && (
                               <p className="text-red-500 text-xs text-center">{errorMsg}</p>
                           )}
                        </div>
                     )}
                   </div>

                   {/* Right Side: The Medical Breakdown */}
                   <div className="flex-1 flex flex-col justify-center">
                      <div className="bg-[color:var(--theme-surface)] border border-[color:var(--theme-border-accent)] rounded-2xl p-8 relative overflow-hidden min-h-[400px]">
                         <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Fingerprint size={120} className="text-[color:var(--color-luxury-accent)]" />
                         </div>

                         <span className="text-[9px] uppercase tracking-[0.4em] text-[color:var(--color-luxury-rosegold)] block mb-4">Diagnostics</span>
                         <h3 className="font-serif text-3xl mb-8 border-b border-[color:var(--theme-border)] pb-8 text-[color:var(--theme-text)]">
                            Aesthetic Mapping <br/>& Structural Analysis
                         </h3>

                         {loadingAnalysis ? (
                            <div className="space-y-6">
                               {[1,2,3].map(i => (
                                  <div key={i} className="flex gap-4 opacity-30 animate-pulse">
                                     <div className="w-6 h-6 rounded-full bg-[color:var(--theme-border)]" />
                                     <div className="h-6 bg-[color:var(--theme-border)] rounded w-3/4" />
                                  </div>
                               ))}
                            </div>
                         ) : treatmentPlan ? (
                            <div className="space-y-8">
                               {/* Assessment Sections */}
                               <div className="space-y-4 relative z-10">
                                 <h4 className="text-[10px] uppercase tracking-widest text-[color:var(--theme-accent)] mb-2">Clinical Assessment</h4>
                                 
                                 {[
                                   { label: "Upper Face", value: treatmentPlan.assessment.upperFace },
                                   { label: "Mid Face", value: treatmentPlan.assessment.midFace },
                                   { label: "Lower Face", value: treatmentPlan.assessment.lowerFace },
                                   { label: "Symmetry", value: treatmentPlan.assessment.symmetry }
                                 ].map((section, idx) => (
                                   <motion.div 
                                     initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }}
                                     key={section.label} className="border-l-2 border-[color:var(--theme-border-accent)] pl-4"
                                   >
                                     <span className="text-[9px] uppercase tracking-widest block opacity-50 text-[color:var(--theme-text)] mb-1">{section.label}</span>
                                     <p className="text-xs font-light tracking-wide text-[color:var(--theme-text)]">{section.value}</p>
                                   </motion.div>
                                 ))}
                               </div>

                               {/* Recommended Treatments */}
                               <div className="pt-6 border-t border-[color:var(--theme-border)] relative z-10">
                                 <h4 className="text-[10px] uppercase tracking-widest text-[color:var(--theme-accent)] mb-4">Recommended Protocol</h4>
                                 <div className="space-y-3">
                                   {treatmentPlan.treatments.map((step, idx) => (
                                      <motion.div 
                                        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (idx * 0.1) + 0.4 }}
                                        key={idx} className="flex gap-3 items-start"
                                      >
                                         <div className="mt-0.5 min-w-4 text-[color:var(--color-luxury-accent)]">
                                            <CheckCircle2 size={14} />
                                         </div>
                                         <p className="text-xs font-light text-[color:var(--theme-text)] leading-relaxed">{step}</p>
                                      </motion.div>
                                   ))}
                                 </div>
                               </div>

                               {/* Investment & Recovery */}
                               <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="flex gap-4 pt-4 relative z-10">
                                   <div className="bg-[color:var(--theme-bg)] p-4 rounded-xl flex-1 border border-[color:var(--theme-border-accent)] flex flex-col justify-center">
                                       <span className="text-[9px] uppercase tracking-widest block opacity-50 mb-1 text-[color:var(--theme-text)]">Expected Downtime</span>
                                       <p className="text-xs text-[color:var(--theme-text)]">{treatmentPlan.recoveryDowntime}</p>
                                   </div>
                                   <div className="bg-[color:var(--theme-bg)] p-4 rounded-xl flex-1 border border-[color:var(--theme-border-accent)] flex flex-col justify-center">
                                       <span className="text-[9px] uppercase tracking-widest block opacity-50 mb-1 text-[color:var(--theme-text)]">Est. Investment</span>
                                       <p className="text-sm font-mono text-[color:var(--theme-accent)]">{treatmentPlan.estimatedInvestment.currency}{treatmentPlan.estimatedInvestment.min.toLocaleString()} - {treatmentPlan.estimatedInvestment.max.toLocaleString()}</p>
                                   </div>
                               </motion.div>

                               <div className="mt-12 pt-8 border-t border-[color:var(--theme-border)] opacity-60 flex items-center gap-4">
                                  <span className="text-[8px] uppercase tracking-widest text-[color:var(--theme-text)] font-mono block">
                                     Notice: AI simulation model. Results represent aesthetic possibility. Consultation with an aesthetic physician is required.
                                  </span>
                               </div>
                            </div>
                         ) : (
                            <div className="h-full flex items-center justify-center opacity-40">
                               <p className="text-[10px] uppercase tracking-widest text-[color:var(--theme-text)] text-center pb-12">Submit photo to receive an AI facial analysis.</p>
                            </div>
                         )}

                      </div>
                   </div>
                </div>
             )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
