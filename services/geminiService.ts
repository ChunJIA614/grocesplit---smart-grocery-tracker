import { GoogleGenAI, Type } from "@google/genai";
import { User } from "../types";

// Use the correct environment variable name
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Using Gemma 3 4B model
const MODEL_NAME = "gemma-3-4b-it";

export const parseGroceryText = async (text: string, users: User[]) => {
  if (!apiKey) {
    console.error("API Key missing. Make sure GEMINI_API_KEY is set in .env");
    throw new Error("API Key is missing. Please check your configuration.");
  }

  const userNames = users.map(u => u.name).join(', ');

  const prompt = `You are a grocery parsing assistant. Extract grocery items from this text and return valid JSON.

Text: "${text}"

Available users for cost splitting: ${userNames}

Instructions:
- If text mentions who items are for (e.g. "for everyone", "for me and Alice"), map to matching user names
- If not specified, include all users
- Return ONLY a JSON array, no other text

JSON format:
[{"name": "item name", "quantity": 1, "unit": "pcs", "totalPrice": 0.00, "sharedBy": ["User1", "User2"]}]

Parse the text now:`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    const responseText = response.text || '[]';
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      // Try to find JSON array directly
      const arrayMatch = responseText.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }
    }
    
    const parsed = JSON.parse(jsonStr);
    console.log("AI parsed items:", parsed);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Gemma parsing error:", error);
    return [];
  }
};

export const suggestRecipe = async (ingredients: string[]) => {
  if (!apiKey) return "Please configure API Key for recipe suggestions.";
  
  try {
    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `I have these ingredients: ${ingredients.join(', ')}. 
Suggest ONE simple recipe in this exact format:
**Recipe Name** - Brief one-sentence description.`,
    });
    return response.text || "Could not generate recipe.";
  } catch (error) {
    console.error("Recipe suggestion error:", error);
    return "Could not generate recipe.";
  }
}