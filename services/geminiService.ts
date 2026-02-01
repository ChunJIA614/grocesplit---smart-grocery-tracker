import { GoogleGenAI, Type } from "@google/genai";
import { User } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const parseGroceryText = async (text: string, users: User[]) => {
  if (!apiKey) {
    console.error("API Key missing");
    throw new Error("API Key is missing. Please check your configuration.");
  }

  const userNames = users.map(u => u.name).join(', ');

  const prompt = `
    Extract grocery items from the following text: "${text}".
    
    The available users for splitting costs are: ${userNames}.
    If the text implies who it is for (e.g. "for everyone", "for me and Alice"), try to map them to the available users. 
    If not specified, assume it is shared by everyone.
    
    Return a JSON array where each object has:
    - name (string)
    - quantity (number)
    - unit (string, e.g. "kg", "pcs", "pack")
    - totalPrice (number)
    - sharedBy (array of strings, matching the EXACT names provided above)
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              unit: { type: Type.STRING },
              totalPrice: { type: Type.NUMBER },
              sharedBy: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Gemini parsing error:", error);
    return [];
  }
};

export const suggestRecipe = async (ingredients: string[]) => {
  if (!apiKey) return "Please provide an API Key to get recipe suggestions.";
  
  try {
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `I have these ingredients in my fridge: ${ingredients.join(', ')}. 
        Suggest one simple recipe title and a very short description (1 sentence) I can make.`,
    });
    return response.text;
  } catch (error) {
    return "Could not generate recipe.";
  }
}