
import { Injectable } from '@angular/core';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private genAI: GoogleGenAI;
  
  constructor() {
    // Assuming process.env.API_KEY is available in the environment
    this.genAI = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async generateResponse(
    prompt: string, 
    systemInstruction: string = '', 
    history: {role: 'user' | 'model', text: string}[] = []
  ): Promise<string> {
    try {
      // Convert history to string context for this simple implementation
      // or use chat interface if preferred. Here we construct a single prompt 
      // to keep it stateless and simple for the demo structure.
      const context = history.map(h => `${h.role.toUpperCase()}: ${h.text}`).join('\n');
      const fullPrompt = `${context}\nUSER: ${prompt}`;

      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.9,
          maxOutputTokens: 500
        }
      });

      return response.text || '...[COMMUNICATION ERROR]...';
    } catch (e) {
      console.error('AI Error', e);
      return '⚠️ SYSTEM FAILURE: CONNECTION SEVERED.';
    }
  }

  async generateImage(prompt: string): Promise<string | null> {
    try {
      const response = await this.genAI.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg'
        }
      });
      
      const bytes = response.generatedImages?.[0]?.image?.imageBytes;
      if (bytes) {
        return `data:image/jpeg;base64,${bytes}`;
      }
      return null;
    } catch (e) {
      console.error('Image Gen Error', e);
      return null;
    }
  }

  async summarize(text: string): Promise<string> {
    try {
      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Summarize the following chat log into a concise tactical memory string:\n${text}`,
      });
      return response.text;
    } catch (e) {
      return 'Data corrupted during compression.';
    }
  }
}
