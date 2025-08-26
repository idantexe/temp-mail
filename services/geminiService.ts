import { GoogleGenAI } from "@google/genai";
import type { VectorStyle } from '../types';

const getPromptForStyle = (style: VectorStyle, palette?: string[]): string => {
  let prompt = `Analyze the attached image and convert it into a high-quality, clean, and scalable SVG.

**CRITICAL INSTRUCTIONS:**
1.  **SVG-ONLY RESPONSE:** Your entire response MUST be the raw SVG code and nothing else. Start with \`<svg ...>\` and end with \`</svg>\`. Do NOT include markdown code blocks like \`\`\`svg, explanations, or any other text.
2.  **SCALABILITY:** The root \`<svg>\` element MUST include a \`viewBox\` attribute that accurately captures the dimensions of the artwork. Set \`width="100%"\` and \`height="100%"\` to ensure it's responsive.
3.  **STYLE:** The vector style must be: **${style}**.`;

  switch (style) {
    case 'Minimalist':
      prompt += ` Adopt a minimalist, simplified, and iconic style. Use as few shapes and lines as possible while retaining the subject's identity. Abstract details into clean geometric forms.`;
      break;
    case 'Black & White':
      prompt += ` The output must ONLY use black, white, and shades of gray (e.g., #111, #888, #eee). No other colors are allowed. Focus on strong contrasts, outlines, shadows, and highlights to define the form.`;
      break;
    case 'Pop Art':
      prompt += ` Recreate the image in a bold Pop Art style. Use vibrant, saturated colors, thick black outlines, and simplified, graphic shading reminiscent of comic book art.`;
      break;
    case 'Detailed':
    default:
      prompt += ` Capture as much detail from the original image as possible. Replicate shading, textures, and a rich color palette to create a clean, scalable vector graphic that is faithful to the source.`;
      break;
  }

  if (palette && palette.length > 0) {
    prompt += `\n4. **COLOR PALETTE:** You MUST strictly and exclusively use the colors from the following palette: ${palette.join(', ')}. Do not introduce any other colors. Map the image's colors to the closest available color in this palette. If the style is 'Black & White', this instruction is overridden, and you must only use a grayscale palette.`;
  }
  
  return prompt;
};

export const generateVector = async (
  apiKey: string,
  base64ImageData: string,
  mimeType: string,
  style: VectorStyle,
  palette?: string[]
): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please add it in the control panel.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const prompt = getPromptForStyle(style, palette);

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64ImageData,
      },
    };
    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
    });

    if (response.text) {
      // Basic check to ensure it looks like an SVG
      const trimmedText = response.text.trim();
      if (trimmedText.startsWith('<svg') && trimmedText.endsWith('</svg>')) {
        return trimmedText;
      } else {
        console.warn("AI response did not seem to be a valid SVG:", trimmedText);
        throw new Error("The AI returned a response that was not valid SVG. It might be an error message. Please check your API key and try again.");
      }
    } else {
      throw new Error("The API returned an empty response. This may be due to a billing issue or an invalid API key.");
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        if (error.message.includes('API key not valid')) {
            throw new Error('Your API key is not valid. Please check it and try again.');
        }
        if (error.message.includes('malformed')) {
            throw error;
        }
    }
    throw new Error("Failed to generate vector image from the AI service. Check the console for more details.");
  }
};