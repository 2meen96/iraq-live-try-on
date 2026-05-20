import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let faceLandmarker: FaceLandmarker | null = null;

export const initFaceLandmarker = async () => {
    if (faceLandmarker) return faceLandmarker;
    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: "GPU"
            },
            outputFaceBlendshapes: false,
            runningMode: "IMAGE",
            numFaces: 1
        });
        return faceLandmarker;
    } catch (e) {
        console.error("Masking model init error:", e);
        return null;
    }
};

export const generateFaceMask = async (imageBase64: string): Promise<string | null> => {
    console.log("Initializing mask generator...");
    const model = await initFaceLandmarker();
    if (!model) {
        console.warn("Masking model failed to initialize.");
        return null;
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            setTimeout(() => {
                console.log("Detecting face landmarks for masking...");
                try {
                    const result = model.detect(img);
                    if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
                        resolve(null);
                        return;
                    }

                    const canvas = document.createElement("canvas");
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return resolve(null);

                    // Fill black (representing area to change)
                    ctx.fillStyle = "black";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    const landmarks = result.faceLandmarks[0];
                    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
                    
                    for (const lm of landmarks) {
                        const x = lm.x * canvas.width;
                        const y = lm.y * canvas.height;
                        if (x < minX) minX = x;
                        if (y < minY) minY = y;
                        if (x > maxX) maxX = x;
                        if (y > maxY) maxY = y;
                    }

                    const centerX = (minX + maxX) / 2;
                    const centerY = (minY + maxY) / 2;
                    const radiusX = (maxX - minX) / 2;
                    const radiusY = (maxY - minY) / 2;

                    ctx.beginPath();
                    ctx.ellipse(centerX, centerY * 1.05, radiusX * 0.9, radiusY * 0.95, 0, 0, 2 * Math.PI);
                    ctx.fillStyle = "white"; 
                    
                    ctx.shadowColor = 'white';
                    ctx.shadowBlur = 15;
                    ctx.fill();

                    resolve(canvas.toDataURL("image/jpeg", 0.95));
                } catch (err) {
                    console.error("Masking model error:", err);
                    resolve(null);
                }
            }, 50);
        };
        img.onerror = () => resolve(null);
        img.src = imageBase64;
    });
};

export interface DetailedMasks {
    lips: string | null;
    eyes: string | null;
    skin: string | null;
}

export const generateDetailedMasks = async (imageBase64: string): Promise<DetailedMasks> => {
    console.log("Initializing detailed mask generator...");
    const model = await initFaceLandmarker();
    if (!model) {
        console.warn("Masking model failed to initialize.");
        return { lips: null, eyes: null, skin: null };
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            setTimeout(() => {
                try {
                    const result = model.detect(img);
                    if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
                        resolve({ lips: null, eyes: null, skin: null });
                        return;
                    }

                    const landmarks = result.faceLandmarks[0];
                    const w = img.width;
                    const h = img.height;

                    const drawPolygon = (ctx: CanvasRenderingContext2D, indices: number[], fillStyle: string) => {
                        ctx.fillStyle = fillStyle;
                        ctx.beginPath();
                        for (let i = 0; i < indices.length; i++) {
                            const lm = landmarks[indices[i]];
                            if (i === 0) ctx.moveTo(lm.x * w, lm.y * h);
                            else ctx.lineTo(lm.x * w, lm.y * h);
                        }
                        ctx.closePath();
                        ctx.fill();
                    };

                    const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
                    const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
                    
                    // Left eye contour + upper eyebrow to include eyelids
                    const LEFT_EYE_AREA = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]; 
                    const RIGHT_EYE_AREA = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
                    
                    const createMask = (drawLogic: (ctx: CanvasRenderingContext2D) => void) => {
                        const canvas = document.createElement("canvas");
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext("2d");
                        if (!ctx) return null;
                        ctx.fillStyle = "black";
                        ctx.fillRect(0, 0, w, h);
                        
                        // Add some soft blur for AI masks
                        ctx.shadowColor = 'white';
                        ctx.shadowBlur = 10;
                        
                        drawLogic(ctx);
                        return canvas.toDataURL("image/jpeg", 0.95);
                    };

                    const lipsMask = createMask((ctx) => {
                        drawPolygon(ctx, LIPS_OUTER, "white");
                    });

                    const eyesMask = createMask((ctx) => {
                        drawPolygon(ctx, LEFT_EYE_AREA, "white");
                        drawPolygon(ctx, RIGHT_EYE_AREA, "white");
                    });

                    const skinMask = createMask((ctx) => {
                        drawPolygon(ctx, FACE_OVAL, "white");
                        // Cut out eyes and lips from skin mask so makeup doesn't overlap
                        ctx.globalCompositeOperation = "destination-out";
                        ctx.shadowBlur = 5;
                        drawPolygon(ctx, LIPS_OUTER, "black");
                        drawPolygon(ctx, LEFT_EYE_AREA, "black");
                        drawPolygon(ctx, RIGHT_EYE_AREA, "black");
                        // Restore
                        ctx.globalCompositeOperation = "source-over";
                    });

                    resolve({
                        lips: lipsMask,
                        eyes: eyesMask,
                        skin: skinMask
                    });
                } catch (err) {
                    console.error("Detailed masking error:", err);
                    resolve({ lips: null, eyes: null, skin: null });
                }
            }, 50);
        };
        img.onerror = () => resolve({ lips: null, eyes: null, skin: null });
        img.src = imageBase64;
    });
};
