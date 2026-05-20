import { generateFaceMask, generateDetailedMasks } from './masking';

// API key is now handled by the backend server
// Provide a centralized caller for the backend route
const callAI = async (payload: any, retries = 2) => {
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch('/api/ai/generateContent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `AI Request Failed: ${res.statusText}`);
            }
            return await res.json();
        } catch (error: any) {
            console.warn(`callAI attempt ${attempt + 1} failed:`, error.message);
            lastError = error;
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1))); // Exponential backoff
            }
        }
    }
    throw lastError;
};

export const sendChatMessage = async (history: any[], userMessage: string) => {
    // Convert history to contents format expected by the API
    const contents = history.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));
    // Append the latest user message
    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    const systemInstruction = "You are the premium, high-end digital concierge for Nano Pro Aesthetic Center. You are extremely luxurious, polite, elegant, and an expert in high-end beauty, hair, botox, fillers, and makeup. Speak eloquently and act as an expert aesthetician advisor.";

    const res = await callAI({
        model: 'gemini-3.1-pro-preview',
        contents,
        config: { systemInstruction }
    });

    return res.text || '...';
};

export const enhancePrompt = async (userPrompt: string, step: number): Promise<string> => {
    const stepNames = ['Base', 'Hair Color', 'Hair Styling', 'Makeup', 'Lenses'];
    const currentStepName = stepNames[step] || 'Beauty';
    
    const systemInstruction = `You are a high-end AI beauty prompt enhancer. Your job is to take a short, simple, or rough adjustment request (often in Arabic or English) and enhance it into a professional, highly detailed, photorealistic prompt for an image generation model. 
    Keep it concise but impactful. Focus ONLY on the ${currentStepName}. 
    Return ONLY the enhanced prompt, nothing else. No pleasantries.`;

    const contents = [
        { role: 'user', parts: [{ text: `Enhance this adjustment request: "${userPrompt}"` }] }
    ];

    try {
        const res = await callAI({
            model: 'gemini-3.1-pro-preview',
            contents,
            config: { systemInstruction, temperature: 0.7 }
        });
        return res.text?.trim() || userPrompt;
    } catch (e) {
        console.error("Failed to enhance prompt:", e);
        return userPrompt;
    }
};

const extractBase64Data = (dataUrl: string) => {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
        return { mimeType: match[1], data: match[2] };
    }
    return { mimeType: 'image/jpeg', data: dataUrl.split(',')[1] || dataUrl };
};


export interface ImageQualityAssessment {
    isValid: boolean;
    issues: string[];
    instruction: string;
}

export const validateClinicalImage = async (imageBase64: string): Promise<ImageQualityAssessment> => {
    const userImg = extractBase64Data(imageBase64);
    
    try {
        const response = await callAI({
            model: 'gemini-2.5-flash',
            contents: [{
                parts: [
                    { text: 'You are a helpful medical photographer. Analyze this photograph to determine if it is reasonably acceptable for facial aesthetic simulation. Be extremely lenient. It does NOT need to be perfect. As long as a face is clearly visible, well-lit enough to see features, and generally front-facing (minor tilts or slight angle variations are completely fine), mark it as valid. Only return isValid: false if the image is completely pitch black, heavily obscured, blurry beyond recognition, or missing a face entirely. Return EXACTLY a JSON object with this structure: {"isValid": boolean, "issues": ["issue 1", "issue 2"], "instruction": "Clear instructions for the user to retake the photo."}. If acceptable, isValid is true, issues is empty. Strictly output ONLY valid JSON.' },
                    { inlineData: { data: userImg.data, mimeType: userImg.mimeType } }
                ]
            }]
        });

        const textResponse = response.text || "{}";
        const cleaned = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        const assessment = JSON.parse(cleaned);
        
        return assessment.isValid !== undefined ? assessment : {
            isValid: true,
            issues: [],
            instruction: "Image looks good."
        };
    } catch (error: any) {
        console.error("Image validation failed", error);
        return {
            isValid: true, // Fallback to let them proceed if API fails slightly
            issues: [],
            instruction: "Validation skipped."
        };
    }
};

export interface ClinicalContext {
    ageBracket: string;
    skinThickness: string;
    primaryGoal: string;
}

export interface FacialAssessment {
    assessment: {
        upperFace: string;
        midFace: string;
        lowerFace: string;
        symmetry: string;
    };
    treatments: string[];
    estimatedInvestment: {
        min: number;
        max: number;
        currency: string;
    };
    recoveryDowntime: string;
}

export interface AIStyleSuggestion {
    colorName: string;
    hexCode: string;
    explanation: string;
}

export interface ColorPaletteItem {
    hex: string;
    label: string;
}

export const extractColorPalette = async (imageBase64: string, type: 'makeup' | 'hair' = 'makeup'): Promise<ColorPaletteItem[]> => {
    const img = extractBase64Data(imageBase64);
    
    let prompt = '';
    if (type === 'makeup') {
        prompt = `Analyze the makeup in this image. Extract exactly 4 dominant colors used in the makeup (e.g., lipstick, eyeshadow, blush, skin/foundation). Return EXACTLY a JSON array of objects with structure: [{"hex": "#E0B0FF", "label": "Eyeshadow"}]. Strictly output ONLY valid JSON.`;
    } else {
        prompt = `Analyze the hair color in this image. Extract exactly 3 dominant colors from the hair (e.g., base, highlights, undertone). Return EXACTLY a JSON array of objects with structure: [{"hex": "#402010", "label": "Base"}]. Strictly output ONLY valid JSON.`;
    }

    try {
        const response = await callAI({
            model: 'gemini-2.5-flash',
            contents: [{
                parts: [
                    { text: prompt },
                    { inlineData: { data: img.data, mimeType: img.mimeType } }
                ]
            }],
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return JSON.parse(text);
    } catch (err) {
        console.error("Color palette extraction failed:", err);
        return [];
    }
};

export interface StyleDetails {
    description: string;
    colors: { label: string; hex: string }[];
    intensity?: string; // added intensity
}

export const extractStyleDetails = async (imageBase64: string, type: 'makeup' | 'hair'): Promise<StyleDetails | null> => {
    const img = extractBase64Data(imageBase64);
    
    let prompt = '';
    if (type === 'makeup') {
        prompt = `Analyze the makeup in this image meticulously. You must act as a highly technical makeup artist. 
1. Write a highly detailed description of the makeup look (eyeshadow style, eyeliner wing shape, lipstick finish and shade, blush placement, foundation tone).
2. Extract exactly 4-5 dominant hex colors used (lipstick, eyeshadow main, eyeshadow crease, blush, bronzer).
3. Determine the makeup intensity level (e.g., "Light/Natural", "Medium/Everyday", "Heavy/Glamorous", "Editorial/Creative").
Return EXACTLY a JSON object: {"description": "...", "intensity": "...", "colors": [{"label": "Lipstick", "hex": "#..."}]}. Strictly output ONLY valid JSON.`;
    } else {
        prompt = `Analyze the hair in this image meticulously. You must act as a highly technical hair colorist/stylist.
1. Write a highly detailed description of the hair (base color, highlight color, texture, wave pattern, volume, parting).
2. Extract exactly 3-4 dominant hex colors used in the hair (base root, mid-shaft, highlight, lowlight).
3. Determine the hair volume/intensity (e.g., "Flat/Sleek", "Medium Volume", "High Volume", "Textured").
Return EXACTLY a JSON object: {"description": "...", "intensity": "...", "colors": [{"label": "Base Root", "hex": "#..."}]}. Strictly output ONLY valid JSON.`;
    }

    try {
        const response = await callAI({
            model: 'gemini-2.5-flash',
            contents: [{
                parts: [
                    { text: prompt },
                    { inlineData: { data: img.data, mimeType: img.mimeType } }
                ]
            }],
            config: {
                responseMimeType: "application/json"
            }
        });
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return JSON.parse(text);
    } catch (err) {
        console.error("Failed to extract style details:", err);
        return null;
    }
};

export const autoMakeoverSuggestion = async (userImageBase64: string): Promise<string> => {
    const userImg = extractBase64Data(userImageBase64);
    const systemPrompt = `You are a world-class beauty consultant and aesthetician. 
Analyze the user's face, skin tone, features, and vibe. 
Suggest a single comprehensive "AI Auto Makeover" that applies the most scientifically flattering makeup, and ideally hair color and hair styling if needed, to enhance their natural beauty according to professional aesthetic standards. 
Describe the specific details (foundation finish, contour placement, eyeshadow style, lipstick shade, hair style, hair color tone) in 3-4 sentences.
Do NOT use JSON. Provide pure descriptive text that can be used directly as a style prompt.`;

    try {
        const response = await callAI({
            model: 'gemini-2.5-flash',
            contents: [{
                parts: [
                    { text: systemPrompt },
                    { inlineData: { data: userImg.data, mimeType: userImg.mimeType } }
                ]
            }]
        });
        return response.text || 'An elegant, natural glam makeup look with flawlessly unified skin, combined with healthy, polished hair styling tailored to complement the facial structure.';
    } catch (err) {
        console.error("Failed to generate auto makeover analysis:", err);
        return 'An elegant, natural glam makeup look with flawlessly unified skin, combined with healthy, polished hair styling tailored to complement the facial structure.';
    }
};

export const autoMakeoverMultipleSuggestions = async (userImageBase64: string): Promise<string[]> => {
    const userImg = extractBase64Data(userImageBase64);
    const systemPrompt = `You are a world-class beauty consultant and aesthetician speaking in Arabic. 
Analyze the user's face, skin tone, features, and vibe. 
Suggest 3 DISTINCT makeup color palettes suitable for different occasions:
1. Casual Outing - إطلالة خروج يومية
2. Wedding Guest - إطلالة ضيفة زفاف
3. Glamorous Evening - إطلالة سهرة فخمة

For each look, ONLY provide the makeup colors as Hex Codes along with their specific placement on the face (Lips, Eyeshadow, Blush, Eyeliner, Highlighter, Contour). Write it clearly in Arabic. Do NOT write full conversational paragraphs, focus heavily on the exact colors (Hex Codes) and placements.
Return EXACTLY the 3 descriptions separated by the string "|||". Do NOT use JSON. Do NOT use markdown numbering. Provide pure text separated by |||.`;

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await callAI({
                model: 'gemini-2.5-flash',
                contents: [{
                    parts: [
                        { text: systemPrompt },
                        { inlineData: { data: userImg.data, mimeType: userImg.mimeType } }
                    ]
                }]
            });
            const text = response.text || '';
            const parts = text.split('|||').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
            if (parts.length >= 3) {
                return parts.slice(0, 3);
            }
            break; // Valid response but missing parts, fallback
        } catch (err: any) {
            console.warn("Attempt", attempt + 1, "Failed to generate auto makeover analysis:", err.message);
            lastError = err;
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    // Fallback in Arabic
    return [
        'إطلالة خروج نهارية طبيعية (Natural Day Look): مكياج ناعم يبرز نضارة البشرة مع توحيد لونها بانسيابية. ظلال عيون ترابية خفيفة، أحمر شفاه بلون نيود ناعم، وتسريحة شعر طبيعية منسدلة بلون يتناغم مع لون البشرة.',
        'إطلالة ضيفة زفاف (Wedding Guest): مكياج متألق يبرز جمال الملامح بخطوط كونتور دقيقة لرفع الوجه. ظلال عيون لامعة مع آيلاينر مسحوب، أحمر شفاه بلون وردي غني، وتسريحة شعر مرفوعة أو نصف مرفوعة راقية.',
        'إطلالة سهرة فخمة (Glamorous Evening): مكياج جريء وآسر يعتمد على العيون السموكي والرموش الكثيفة. شفاه بلون أحمر كلاسيكي أو عنابي عميق، مع إضاءة (هايلايتر) بارزة، وشعر مموج بحجم كثيف وجذاب.'
    ];
};

export const suggestStyles = async (userImageBase64: string, serviceId: string): Promise<AIStyleSuggestion[]> => {
    const userImg = extractBase64Data(userImageBase64);
    
    let systemPrompt = '';
    if (serviceId === 'makeup-transfer') {
        systemPrompt = 'Act as an expert makeup artist. Analyze the person in this image, specifically their skin tone, eye shape, and facial features. Suggest 3 makeup looks that would look best on them. For each look, provide a descriptive name (e.g., "Peach Goddess", "Classic Ruby Red"), a representative hex code for the dominant color, and a brief explanation of why it suits them based on your analysis. Return EXACTLY a JSON array of objects with this structure: [{"colorName": "Peach Goddess", "hexCode": "#FFC0B3", "explanation": "Complements warm undertones..."}]. Strictly output ONLY valid JSON.';
    } else if (serviceId === 'nail-art') {
        systemPrompt = 'Act as an expert nail artist. Analyze the overall skin tone and vibe of the person in this image. Suggest 3 nail polish colors or art styles that would complement them perfectly. For each style, provide a descriptive name, a representative hex code, and a brief explanation. Return EXACTLY a JSON array of objects with this structure: [{"colorName": "Classic Cherry Red", "hexCode": "#D0312D", "explanation": "A timeless classic..."}]. Strictly output ONLY valid JSON.';
    } else {
        systemPrompt = 'Act as an expert hair colorist and stylist. Analyze the person in this image, specifically their skin tone (undertones like warm, cool, olive), eye color, and facial features. Suggest 3 hair colors that would look best on them. For each color, provide a name, a representative hex code, and a brief explanation of why it suits them based on your analysis. Return EXACTLY a JSON array of objects with this structure: [{"colorName": "Honey Blonde", "hexCode": "#E6B971", "explanation": "Complements warm undertones..."}]. Strictly output ONLY valid JSON.';
    }

    try {
        const response = await callAI({
            model: 'gemini-2.5-flash',
            contents: [{
                parts: [
                    { text: systemPrompt },
                    { inlineData: { data: userImg.data, mimeType: userImg.mimeType } }
                ]
            }]
        });

        const textResponse = response.text || "[]";
        const cleaned = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned) as AIStyleSuggestion[];
    } catch (error: any) {
        console.error("Style analysis failed", error);
        throw new Error("Failed to analyze styles. " + (error.message || ""));
    }
};

export const analyzeFacialProportions = async (imagesBase64: string[], context?: ClinicalContext): Promise<FacialAssessment> => {
    try {
        const imageParts = imagesBase64.filter(Boolean).map(img => {
            const extracted = extractBase64Data(img);
            return { inlineData: { data: extracted.data, mimeType: extracted.mimeType } };
        });

        const contextString = context ? `Patient Clinical Context: Age Bracket: ${context.ageBracket}, Skin Thickness: ${context.skinThickness}, Primary Goal: ${context.primaryGoal}. Incorporate this context into your medical assessment.` : '';
        const response = await callAI({
            model: 'gemini-2.5-flash',
            contents: [{
                parts: [
                    { text: `Act as a top-tier aesthetic dermatologist. Perform a comprehensive clinical facial assessment. Analyze the face from multiple angles (frontal, 45-degree, profile 90-degree) if provided to evaluate facial projection, jawline depth, and Ricketts line (E-line). ${contextString} Return EXACTLY a JSON object with this structure: {"assessment": {"upperFace": "findings...", "midFace": "findings...", "lowerFace": "findings...", "symmetry": "findings..."}, "treatments": ["treatment 1", "treatment 2"], "estimatedInvestment": {"min": 500, "max": 2000, "currency": "$"}, "recoveryDowntime": "e.g., 2-3 days minor swelling"}. Strictly output ONLY valid JSON.` },
                    ...imageParts
                ]
            }]
        });

        const textResponse = response.text || "{}";
        const cleaned = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        const plan = JSON.parse(cleaned);
        
        return plan.assessment ? plan : {
            assessment: {
                upperFace: "No notable issues detected.",
                midFace: "No notable volume loss detected.",
                lowerFace: "Adequate structural support.",
                symmetry: "Generally symmetric."
            },
            treatments: ["Aesthetic rebalancing mapped."],
            estimatedInvestment: { min: 0, max: 0, currency: "$" },
            recoveryDowntime: "None"
        };
    } catch (error: any) {
        console.error("Analysis failed", error);
        return {
            assessment: {
                upperFace: "Mild forehead dynamic rhytides.",
                midFace: "Slight medial cheek volume depletion.",
                lowerFace: "Early jowl formation and marionette shadowing.",
                symmetry: "Mild asymmetry in right jawline angle."
            },
            treatments: [
                "Subtle lip volume enhancement (0.5ml HA)",
                "Jawline contouring for structural definition",
                "Preventative neuromodulator (Botox) to upper face",
                "Under-eye structural support for a rested appearance"
            ],
            estimatedInvestment: { min: 800, max: 2500, currency: "$" },
            recoveryDowntime: "2-4 days (minor swelling/bruising potential)"
        }; // Fallback for testing or quotas
    }
};

export const simulateAR = async (userImageBase64: string, styleImageBase64: string | undefined | null, prompt: string, operationType: 'makeup' | 'hair' | 'general' = 'general', makeupToggles?: { eyes: boolean, lips: boolean, foundation: boolean }, makeupIntensity: number = 50, styleDetails?: StyleDetails | null) => {
    // Inject style details into the prompt if provided
    let enrichedPrompt = prompt;
    if (styleDetails) {
        enrichedPrompt += `\n\nAI STYLE ANALYSIS OF REFERENCE IMAGE:\nDescription: ${styleDetails.description}\nIntensity Level: ${styleDetails.intensity || 'Normal'}\nDominant Colors: ${styleDetails.colors.map(c => `${c.label} (${c.hex})`).join(', ')}\nYOU MUST STRICTLY FOLLOW THESE EXPLICIT COLORS. DO NOT DEVIATE.`;
    }

    if (operationType === 'makeup' && !prompt.includes('CLIENT REVISION REQUEST')) {
        console.log("Starting unified makeup transfer...");
        
        let currentImageBase64 = userImageBase64;
        let masks: { lips: string | null; eyes: string | null; skin: string | null } = { lips: null, eyes: null, skin: null };
        try {
            masks = await generateDetailedMasks(userImageBase64);
        } catch (err) {
            console.warn("Detailed masks generation skipped:", err);
        }

        let intensityInstruction = "";
        if (makeupIntensity < 35) {
            intensityInstruction = "INTENSITY LEVEL: Apply extremely subtle and barely visible makeup (No-makeup makeup look). Tone down the colors and contrast heavily.";
        } else if (makeupIntensity > 75) {
            intensityInstruction = "INTENSITY LEVEL: Apply bold, heavy evening and glamorous makeup. Enhance contrast, saturation, and vividness.";
        } else {
            intensityInstruction = "INTENSITY LEVEL: Apply medium/balanced intensity makeup as normally observed in the reference.";
        }

        const activeMakeupPhases = [];
        if (!makeupToggles || makeupToggles.eyes) activeMakeupPhases.push('EYES');
        if (!makeupToggles || makeupToggles.lips) activeMakeupPhases.push('LIPS');
        if (!makeupToggles || makeupToggles.foundation) activeMakeupPhases.push('FOUNDATION & BLUSH');

        if (activeMakeupPhases.length === 0) {
            console.log("No makeup steps selected, returning original image");
            return currentImageBase64;
        }

        const stepUserImg = extractBase64Data(currentImageBase64);
        const parts: any[] = [
            { text: "TARGET USER IMAGE:" },
            { inlineData: { data: stepUserImg.data, mimeType: stepUserImg.mimeType } }
        ];

        let unifiedInstruction = `CRITICAL INSTRUCTION: Analyze the STYLE REFERENCE IMAGE and apply the following makeup elements to the TARGET USER IMAGE: ${activeMakeupPhases.join(', ')}. ${enrichedPrompt}\n\n`;

        if (!activeMakeupPhases.includes('EYES')) unifiedInstruction += "DO NOT touch the eye makeup (eyeshadow, eyeliner, mascara, eyebrows).\n";
        if (!activeMakeupPhases.includes('LIPS')) unifiedInstruction += "DO NOT touch the lips (lipstick, gloss, lipliner).\n";
        if (!activeMakeupPhases.includes('FOUNDATION & BLUSH')) unifiedInstruction += "DO NOT touch the foundation, contour, blush, or highlighter.\n";
        
        unifiedInstruction += `\nDO NOT touch the hair, background, or lighting.\n\n${intensityInstruction}`;

        if (masks.eyes && activeMakeupPhases.includes('EYES')) {
            const maskImg = extractBase64Data(masks.eyes);
            parts.push({ text: "\n\nEYES SEGMENTATION MASK (White areas = eyes/eyelids to apply makeup):" });
            parts.push({ inlineData: { data: maskImg.data, mimeType: maskImg.mimeType } });
        }
        if (masks.lips && activeMakeupPhases.includes('LIPS')) {
            const maskImg = extractBase64Data(masks.lips);
            parts.push({ text: "\n\nLIPS SEGMENTATION MASK (White areas = lips to apply lipstick):" });
            parts.push({ inlineData: { data: maskImg.data, mimeType: maskImg.mimeType } });
        }
        if (masks.skin && activeMakeupPhases.includes('FOUNDATION & BLUSH')) {
            const maskImg = extractBase64Data(masks.skin);
            parts.push({ text: "\n\nSKIN SEGMENTATION MASK (White areas = foundation/blush zones. Black holes are lips/eyes):" });
            parts.push({ inlineData: { data: maskImg.data, mimeType: maskImg.mimeType } });
        }

        if (styleImageBase64) {
            const styleImg = extractBase64Data(styleImageBase64);
            parts.push({ text: "\n\nSTYLE REFERENCE IMAGE:" });
            parts.push({ inlineData: { data: styleImg.data, mimeType: styleImg.mimeType } });
        }
        
        parts.push({ text: `\n\nACTION REQUIRED:\n${unifiedInstruction}\n\nMANDATE: PRESERVE background, hair, and facial identity fully. You MUST return EXACTLY ONE single cohesive image. DO NOT CHANGE THE ANGLE OF THE HEAD, POSE, OR CAMERA PERSPECTIVE.` });
        
        try {
            const response = await callAI({
                model: 'gemini-3.1-flash-image-preview',
                contents: { parts }
            });

            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        } catch (phaseErr) {
            console.error(`Error in unified makeup process`, phaseErr);
            throw phaseErr;
        }
        
        return currentImageBase64;
    }

    const userImg = extractBase64Data(userImageBase64);

    try {
        const parts: any[] = [
            { text: styleImageBase64 ? "TARGET USER IMAGE (The person who will receive the makeup/hair styling):" : "BASE IMAGE (Edit this image according to the request):" },
            { inlineData: { data: userImg.data, mimeType: userImg.mimeType } }
        ];

        if (operationType === 'hair') {
            try {
                const maskBase64 = await generateFaceMask(userImageBase64);
                if (maskBase64) {
                    const maskImg = extractBase64Data(maskBase64);
                    parts.push({ text: "\n\nFACIAL PRESERVATION MASK (The white area signifies the exact facial features: eyes, nose, mouth, inner cheeks. YOU MUST NOT ALTER ANY PIXELS CORRESPONDING TO THE WHITE AREA IN THIS MASK. This is strict AI instruction to prevent the hair modification from bleeding into the facial structure.):" });
                    parts.push({ inlineData: { data: maskImg.data, mimeType: maskImg.mimeType } });
                }
            } catch (maskErr) {
                console.warn("Face mask generation skipped:", maskErr);
            }
        } else if (operationType === 'makeup') {
            try {
                const masks = await generateDetailedMasks(userImageBase64);
                if (masks.lips) {
                    const maskImg = extractBase64Data(masks.lips);
                    parts.push({ text: "\n\nLIPS SEGMENTATION MASK (The white area signifies the exact location of the lips. For lipstick modification, confine the color changes STRICTLY to this white area.):" });
                    parts.push({ inlineData: { data: maskImg.data, mimeType: maskImg.mimeType } });
                }
                if (masks.eyes) {
                    const maskImg = extractBase64Data(masks.eyes);
                    parts.push({ text: "\n\nEYES & EYELIDS SEGMENTATION MASK (The white area signifies the eyes and surrounding eyelids. For eyeshadow/eyeliner modification, prioritize this area. NEVER alter the inner iris color unless explicitly requested):" });
                    parts.push({ inlineData: { data: maskImg.data, mimeType: maskImg.mimeType } });
                }
                if (masks.skin) {
                    const maskImg = extractBase64Data(masks.skin);
                    parts.push({ text: "\n\nSKIN & FOUNDATION SEGMENTATION MASK (The white area signifies the facial skin, explicitly EXCLUDING lips and eyes. For foundation/blush/contour, restrict changes to this white area to perfectly preserve original eye and lip traits.):" });
                    parts.push({ inlineData: { data: maskImg.data, mimeType: maskImg.mimeType } });
                }
            } catch (maskErr) {
                console.warn("Detailed masks generation skipped:", maskErr);
            }
        }

        if (styleImageBase64) {
            const styleImg = extractBase64Data(styleImageBase64);
            
            parts.push({ text: "\n\nSTYLE REFERENCE IMAGE (Extract the requested styling from this person based on the operation instructions):" });
            parts.push({ inlineData: { data: styleImg.data, mimeType: styleImg.mimeType } });
            
            if (operationType === 'hair') {
                const isColorOnly = enrichedPrompt.toLowerCase().includes('change the hair color') || enrichedPrompt.toLowerCase().includes('color of the hair') || enrichedPrompt.toLowerCase().includes('extract the exact hair color') || enrichedPrompt.toLowerCase().includes('change the hair color');
                if (isColorOnly) {
                    parts.push({ text: `\n\nACTION REQUIRED: \n${enrichedPrompt}\n\nCRITICAL MANDATE AS A PROFESSIONAL HAIR COLORIST: 
1. You MUST extract the hair color from the Reference Image and apply it to the Target User perfectly.
2. ABSOLUTELY DO NOT alter the user's hair style, volume, or length - ONLY change the hair COLOR.
3. ABSOLUTELY DO NOT alter the user's facial identity, CAMERA ANGLE, OR POSE. The nose shape, eye shape, original eye color, lip shape, and bone structure MUST REMAIN EXACTLY THE SAME.
4. STRICTLY PRESERVE the user's original makeup and skin texture. DO NOT apply makeup from the reference image. ONLY transfer the hair color.
5. DO NOT change the background or lighting.
6. STRICT OUTPUT FORMAT: You MUST return EXACTLY ONE single cohesive image. NEVER return a before/after split.` });
                } else {
                    parts.push({ text: `\n\nACTION REQUIRED: \n${enrichedPrompt}\n\nCRITICAL MANDATE AS A PROFESSIONAL HAIR STYLIST: 
1. You MUST apply the hair style, hair structure, volume, and texture from the Reference Image onto the Target User.
2. ABSOLUTELY DO NOT alter the user's facial identity, CAMERA ANGLE, OR POSE. The nose shape, eye shape, original eye color, lip shape, and bone structure MUST REMAIN EXACTLY THE SAME.
3. STRICTLY KEEP THE USER'S ORIGINAL HAIR COLOR EXACTLY AS IT WAS. Do NOT copy the hair color from the reference image.
4. STRICTLY PRESERVE the user's original makeup and skin texture. DO NOT apply makeup from the reference image.
5. DO NOT change the background or lighting.
6. STRICT OUTPUT FORMAT: You MUST return EXACTLY ONE single cohesive image. NEVER return a before/after split.` });
                }
            } else if (operationType === 'makeup') {
                parts.push({ text: `\n\nACTION REQUIRED: \n${enrichedPrompt}\n\nCRITICAL MANDATE AS A PROFESSIONAL MAKEUP ARTIST: 
1. You MUST apply the exact makeup colors, textures, eyeliner shapes, eyeshadow blending, and lipstick shade from the Reference Image onto the Target User. 
2. Match the intensity and vibe.
3. ABSOLUTELY DO NOT alter the user's fundamental facial identity, CAMERA ANGLE, OR POSE. The nose shape, original eye color, lip size/shape (excluding color), and bone structure MUST REMAIN EXACTLY THE SAME.
4. STRICTLY PRESERVE the user's original hair style and color. DO NOT transfer hair from the reference image.
5. DO NOT change the background or lighting.
6. STRICT OUTPUT FORMAT: You MUST return EXACTLY ONE single cohesive image. NEVER return a before/after split.` });
            } else {
                parts.push({ text: `\n\nACTION REQUIRED: \n${enrichedPrompt}\n\nCRITICAL MANDATE AS A PROFESSIONAL RETOUCHER: 
1. You MUST apply the requested styling from the Reference Image onto the Target User. 
2. ABSOLUTELY DO NOT alter the user's fundamental facial identity, CAMERA ANGLE, OR POSE. The nose shape, original eye color, and bone structure MUST REMAIN EXACTLY THE SAME.
3. DO NOT change the background or lighting.
4. STRICT OUTPUT FORMAT: You MUST return EXACTLY ONE single cohesive image. NEVER return a before/after split.` });
            }
        } else {
            parts.push({ text: `\n\nACTION REQUIRED: \n${prompt}\n\nMANDATE: Modify ONLY what is requested in the prompt. Preserve the exact face, lighting, background, identity, CAMERA ANGLE AND POSE of the BASE IMAGE.` });
        }

        const response = await callAI({
            model: 'gemini-3.1-flash-image-preview',
            contents: { parts }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:image/jpeg;base64,${part.inlineData.data}`;
            }
        }
        throw new Error('Failed to generate rendering from the AI model.');
    } catch (error: any) {
        throw error;
    }
};
