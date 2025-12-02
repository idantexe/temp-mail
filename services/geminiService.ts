import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateIdeas = async (category: string) => {
  const prompt = `Berikan 3 ide ${category} yang aesthetic, romantis, dan unik untuk pasangan. 
  Gunakan Bahasa Indonesia yang santai dan hangat. 
  Format output: Berikan poin-poin singkat tanpa markup markdown yang berat.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("AI Error:", error);
    throw new Error("Gagal menghubungi AI.");
  }
};

export const generatePlan = async (title: string, category: string) => {
  const prompt = `Saya ingin melakukan '${title}' (${category}) bersama pasangan. 
  Buatkan checklist persiapan singkat (3-4 poin) agar momen ini jadi aesthetic dan berkesan. 
  Bahasa Indonesia santai.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("AI Error:", error);
    throw new Error("Gagal menghubungi AI.");
  }
};
