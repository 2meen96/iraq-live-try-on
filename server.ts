import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // API Route: AI proxy
  app.post('/api/ai/generateContent', async (req, res) => {
    try {
      const apiKey = process.env.USER_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Missing Gemini API Key on server.' });
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const { model, contents, config } = req.body;

      let response;
      let lastError;
      const PARALLEL_RETRIES = 5;

      for (let attempt = 0; attempt < PARALLEL_RETRIES; attempt++) {
        try {
          response = await ai.models.generateContent({
            model,
            contents,
            config
          });
          break; // success
        } catch (error: any) {
          lastError = error;
          console.error(`AI Proxy attempt ${attempt + 1} failed:`, error.message);
          
          if (attempt < PARALLEL_RETRIES - 1) {
              const is503 = error.message && error.message.includes('503');
              // Backoff strategy: 4s, 8s, 12s, 16s... + more if 503
              const waitTime = (is503 ? 6000 : 4000) * (attempt + 1);
              console.log(`Waiting for ${waitTime}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
      
      if (!response) {
        throw lastError;
      }

      res.json({
        text: response.text,
        candidates: response.candidates
      });
    } catch (error: any) {
      console.error('AI Proxy Error:', error);
      res.status(500).json({ error: error.message || 'Internal AI Error' });
    }
  });

  // API Route: AI Interactions proxy (for image gen models)
  app.post('/api/ai/interactions', async (req, res) => {
    try {
      const apiKey = process.env.USER_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'Missing Gemini API Key' });
      
      const ai = new GoogleGenAI({ apiKey });
      const { model, input, response_modalities, generation_config } = req.body;
      let response;
      let lastError;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          response = await ai.interactions.create({
             model, input, response_modalities, generation_config
          });
          break;
        } catch (error: any) {
          lastError = error;
          const waitTime = error.message?.includes('503') ? 6000 : 4000;
          await new Promise(resolve => setTimeout(resolve, waitTime * (attempt + 1)));
        }
      }
      if (!response) throw lastError;
      res.json(response);
    } catch (error: any) {
      console.error('AI Interactions Proxy Error:', error);
      res.status(500).json({ error: error.message || 'Internal AI Error' });
    }
  });

  // API Route: YouCam Makeup Proxy
  app.post('/api/ai/youcam', async (req, res) => {
    try {
      const youcamKey = process.env.YOUCAM_API_KEY;
      if (!youcamKey) {
        return res.status(500).json({ error: 'Missing YouCam API Key. Add YOUCAM_API_KEY to Secrets.' });
      }
      
      const { targetImage, referenceImage } = req.body;
      if (!targetImage || !referenceImage) {
        return res.status(400).json({ error: 'Missing targetImage or referenceImage base64 strings' });
      }

      // Helper function to upload an image
      const uploadImageToYouCam = async (base64Img: string, fileName: string) => {
          let mimeType = 'image/jpeg';
          let base64Data = base64Img;
          
          if (base64Img.includes('base64,')) {
              mimeType = base64Img.split(';')[0].split(':')[1];
              base64Data = base64Img.split('base64,')[1];
          }
          
          const buffer = Buffer.from(base64Data, 'base64');
          const fileSize = buffer.length;

          // 1. Get upload URL
          const initRes = await fetch("https://yce-api-01.makeupar.com/s2s/v2.0/file/mu-transfer", {
              method: "POST",
              headers: {
                  "Authorization": `Bearer ${youcamKey}`,
                  "Content-Type": "application/json"
              },
              body: JSON.stringify({
                  files: [{ content_type: mimeType, file_name: fileName, file_size: fileSize }]
              })
          });

          if (!initRes.ok) {
              const err = await initRes.text();
              throw new Error(`Init Upload Error [${initRes.status}]: ${err}`);
          }

          const initData = await initRes.json();
          const fileInfo = initData.data.files[0];
          const uploadRequest = fileInfo.requests[0];

          // 2. Upload binary data
          const uploadRes = await fetch(uploadRequest.url, {
              method: uploadRequest.method, // usually PUT
              headers: uploadRequest.headers,
              body: buffer
          });

          if (!uploadRes.ok) {
              const err = await uploadRes.text();
              throw new Error(`Binary Upload Error [${uploadRes.status}]: ${err}`);
          }

          return fileInfo.file_id;
      };

      console.log('Uploading target image...');
      const src_file_url = await uploadImageToYouCam(targetImage, 'target.jpg');
      console.log('Uploading reference image...');
      const ref_file_url = await uploadImageToYouCam(referenceImage, 'reference.jpg');

      // 3. Start Task
      console.log('Starting makeup transfer task...');
      const taskRes = await fetch("https://yce-api-01.makeupar.com/s2s/v2.0/task/mu-transfer", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${youcamKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          src_file_id: src_file_url,
          ref_file_id: ref_file_url
        })
      });

      if (!taskRes.ok) {
          const err = await taskRes.text();
          throw new Error(`Task Start Error [${taskRes.status}]: ${err}`);
      }

      const taskData = await taskRes.json();
      const taskId = taskData.data.task_id;
      console.log(`Task started with ID: ${taskId}`);

      // 4. Poll for result
      let resultUrl = '';
      for (let i = 0; i < 30; i++) { // Poll for up to ~1 minute
          await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2 seconds
          console.log(`Polling task ${taskId} (attempt ${i + 1})...`);
          
          const pollRes = await fetch(`https://yce-api-01.makeupar.com/s2s/v2.0/task/mu-transfer/${taskId}`, {
              method: 'GET',
              headers: {
                  "Authorization": `Bearer ${youcamKey}`
              }
          });

          if (pollRes.ok) {
              const pollData = await pollRes.json();
              if (pollData.data) {
                  if (pollData.data.task_status === 'success' && pollData.data.results && pollData.data.results.url) {
                      resultUrl = pollData.data.results.url;
                      break;
                  } else if (pollData.data.task_status === 'error') {
                      throw new Error(`Task failed: ${pollData.data.error_message || pollData.data.error || 'Unknown error'}`);
                  }
              }
          } else {
              console.warn(`Poll request failed: ${pollRes.status}`);
          }
      }

      if (!resultUrl) {
          throw new Error('Timeout waiting for makeup transfer task to complete.');
      }

      console.log('Downloading result image...');
      const imgRes = await fetch(resultUrl);
      const arrayBuffer = await imgRes.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const finalImageBase64 = `data:image/jpeg;base64,${base64}`;

      res.json({ resultImage: finalImageBase64 });
      
    } catch (error: any) {
      console.error('YouCam Proxy Error:', error);
      res.status(500).json({ error: error.message || 'Internal YouCam Error' });
    }
  });

  // API Route: AI Super Resolution (Upscaling) via YouCam
  app.post('/api/ai/upscale', async (req, res) => {
    try {
      const youcamKey = process.env.YOUCAM_API_KEY;
      if (!youcamKey) {
        return res.status(500).json({ error: 'Missing YouCam API Key.' });
      }
      
      const { image } = req.body;
      if (!image) return res.status(400).json({ error: 'Missing image' });

      // Helper function to upload an image
      const uploadImageToYouCam = async (base64Img: string, fileName: string, slug: string) => {
          let mimeType = 'image/jpeg';
          let base64Data = base64Img;
          if (base64Img.includes('base64,')) {
              mimeType = base64Img.split(';')[0].split(':')[1];
              base64Data = base64Img.split('base64,')[1];
          }
          const buffer = Buffer.from(base64Data, 'base64');
          
          const initRes = await fetch(`https://yce-api-01.makeupar.com/s2s/v2.0/file/${slug}`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${youcamKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ files: [{ content_type: mimeType, file_name: fileName, file_size: buffer.length }] })
          });
          if (!initRes.ok) throw new Error(`Upload Error [${initRes.status}]`);
          const initData = await initRes.json();
          const fileInfo = initData.data.files[0];
          const uploadRequest = fileInfo.requests[0];

          await fetch(uploadRequest.url, { method: uploadRequest.method, headers: uploadRequest.headers, body: buffer });
          return fileInfo.file_id;
      };

      // Try multiple possible slugs for YouCam's enhancement API (usually it's photo-enhancer or generic image-restoration)
      // Actually, perfect corp usually uses 'photo-enhancer' for Super Resolution
      const slug = 'photo-enhancer'; 
      const file_id = await uploadImageToYouCam(image, 'upscale.jpg', slug);

      const taskRes = await fetch(`https://yce-api-01.makeupar.com/s2s/v2.0/task/${slug}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${youcamKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ src_file_id: file_id }) // typically src_file_id
      });
      
      if (!taskRes.ok) {
          throw new Error('Enhancer API not found or failed: ' + taskRes.status);
      }

      const taskData = await taskRes.json();
      const taskId = taskData.data.task_id;

      let resultUrl = '';
      for (let i = 0; i < 20; i++) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const pollRes = await fetch(`https://yce-api-01.makeupar.com/s2s/v2.0/task/${slug}/${taskId}`, {
              headers: { "Authorization": `Bearer ${youcamKey}` }
          });
          if (pollRes.ok) {
              const pollData = await pollRes.json();
              if (pollData.data?.task_status === 'success') {
                  resultUrl = pollData.data.results.url;
                  break;
              } else if (pollData.data?.task_status === 'error') {
                  throw new Error(`Task failed`);
              }
          }
      }

      if (!resultUrl) throw new Error('Timeout');

      const imgRes = await fetch(resultUrl);
      const arrayBuffer = await imgRes.arrayBuffer();
      const finalImageBase64 = `data:image/jpeg;base64,${Buffer.from(arrayBuffer).toString('base64')}`;

      res.json({ resultImage: finalImageBase64 });
      
    } catch (error: any) {
      console.warn('YouCam Upscale Proxy Error (Falling back to Canvas):', error.message);
      res.status(500).json({ error: 'YouCam Enhance API Failed', details: error.message });
    }
  });

  // API Route: Replicate Enhancer / Fallback Proxy
  app.post('/api/ai/replicate', async (req, res) => {
    try {
      const replicateKey = process.env.REPLICATE_API_KEY;
      if (!replicateKey) {
        return res.status(500).json({ error: 'Missing Replicate API Key.' });
      }
      
      const { image, mode = 'enhance', prompt } = req.body;
      if (!image) {
        return res.status(400).json({ error: 'Missing image for Replicate processing' });
      }

      // Initialize Replicate lazily
      const Replicate = (await import('replicate')).default;
      const replicate = new Replicate({ auth: replicateKey });

      let output;

      if (mode === 'enhance') {
        // Use CodeFormer for face restoration, enhancement, and AR-makeup blending
        // It smooths out digital artifacts and makes AR makeup look photorealistic.
        console.log("Running Replicate CodeFormer enhancement...");
        output = await replicate.run(
          "sczhou/codeformer:7de2ea26c616d5bf2245ad0d5e24f0ff9a6204578a5c876db53142edd9d2cd56",
          {
            input: {
              image: image,
              upscale: 2,
              face_upsample: true,
              background_enhance: true,
              codeformer_fidelity: 0.65 // 0.65 adds a slight extra beautification/smoothing effect
            }
          }
        );
      } else if (mode === 'generate') {
        console.log(`Running Replicate Instruct-Pix2Pix with prompt: ${prompt}`);
        output = await replicate.run(
          "timbrooks/instruct-pix2pix:30c1d0b916a6f8efce20493f5d61ee27491ab2a60437c13c588468b9810ec23f",
          {
            input: {
              image: image,
              prompt: prompt || "apply professional and beautiful evening makeup, apply eyeshadow and lipstick",
              image_guidance_scale: 1.5,
              num_inference_steps: 50,
              guidance_scale: 7.5
            }
          }
        );
      } else {
         return res.status(400).json({ error: 'Unsupported Replicate mode' });
      }

      // output from CodeFormer is typically a URI string
      if (!output) {
          throw new Error('Replicate returned no result');
      }

      res.json({ resultImage: typeof output === 'string' ? output : output[0] });

    } catch (error: any) {
      console.error('Replicate Proxy Error:', error);
      res.status(500).json({ error: error.message || 'Internal Replicate Error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
