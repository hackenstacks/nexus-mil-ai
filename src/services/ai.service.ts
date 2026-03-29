
import { Injectable } from '@angular/core';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  
  private getAI(): GoogleGenAI {
    // Always create a new instance to use the most up-to-date API key
    // The platform injects the key into process.env.GEMINI_API_KEY
    return new GoogleGenAI({ apiKey: (window as any).process?.env?.GEMINI_API_KEY || '' });
  }

  async generateResponse(
    prompt: string, 
    systemInstruction: string = '', 
    history: {role: 'user' | 'model', text: string}[] = [],
    context: string = ''
  ): Promise<string> {
    const ai = this.getAI();
    try {
      const historyContext = history.map(h => `${h.role.toUpperCase()}: ${h.text}`).join('\n');
      const fullPrompt = context 
        ? `[DOCUMENT_CONTEXT:\n${context}\n]\n${historyContext}\nUSER: ${prompt}`
        : `${historyContext}\nUSER: ${prompt}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: fullPrompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.9,
        }
      });

      return response.text || '...[COMMUNICATION ERROR]...';
    } catch (e) {
      console.error('AI Error', e);
      return '⚠️ SYSTEM FAILURE: CONNECTION SEVERED.';
    }
  }

  async generateImage(prompt: string, negativePrompt?: string): Promise<string | null> {
    const ai = this.getAI();
    try {
      // For Gemini, we incorporate the negative prompt into the main prompt text
      const fullPrompt = negativePrompt 
        ? `${prompt}\n[NEGATIVE_PROMPT: ${negativePrompt}]` 
        : prompt;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: fullPrompt }]
        }
      });
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (e) {
      console.error('Image Gen Error', e);
      return null;
    }
  }

  async generateImageHorde(prompt: string, apiKey: string, negativePrompt?: string): Promise<string | null> {
    try {
      // AI Horde API: https://stablehorde.net/api/v2/generate/async
      const response = await fetch('https://stablehorde.net/api/v2/generate/async', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey || '0000000000' // Default anonymous key
        },
        body: JSON.stringify({
          prompt: prompt,
          params: {
            n: 1,
            steps: 20,
            width: 512,
            height: 512,
            sampler_name: 'k_euler',
            negative_prompt: negativePrompt || ''
          }
        })
      });

      const data = await response.json();
      if (!data.id) throw new Error('Horde request failed');

      // Poll for completion
      let finished = false;
      let checkCount = 0;
      while (!finished && checkCount < 30) {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await fetch(`https://stablehorde.net/api/v2/generate/check/${data.id}`);
        const statusData = await statusRes.json();
        if (statusData.done) {
          finished = true;
        }
        checkCount++;
      }

      if (!finished) throw new Error('Horde request timed out');

      // Get result
      const resultRes = await fetch(`https://stablehorde.net/api/v2/generate/status/${data.id}`);
      const resultData = await resultRes.json();
      if (resultData.generations?.[0]?.img) {
        // Horde returns a URL or base64 depending on config, usually a URL to their CDN
        return resultData.generations[0].img;
      }
      return null;
    } catch (e) {
      console.error('AI Horde Error', e);
      return null;
    }
  }

  async generateImagePollinations(prompt: string): Promise<string | null> {
    try {
      // Pollinations.ai is simple: https://pollinations.ai/p/{prompt}
      // We can just return the URL directly as it's an image endpoint
      const encodedPrompt = encodeURIComponent(prompt);
      const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
      
      // Verify it's reachable (optional but good for error handling)
      const res = await fetch(url);
      if (res.ok) return url;
      return null;
    } catch (e) {
      console.error('Pollinations Error', e);
      return null;
    }
  }

  async summarize(text: string): Promise<string> {
    const ai = this.getAI();
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Summarize the following chat log into a concise tactical memory string:\n${text}`,
      });
      return response.text;
    } catch (e) {
      return 'Data corrupted during compression.';
    }
  }

  async embedText(text: string): Promise<number[]> {
    const ai = this.getAI();
    try {
      const result = await ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: [text]
      });
      return result.embeddings?.[0]?.values || [];
    } catch (e) {
      console.error('Embedding Error', e);
      return [];
    }
  }
}
