import { User } from '../types';

export const parseGroceryText = async (text: string, users: User[]) => {
  try {
    const response = await fetch('/api/parse-grocery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, users }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }

    const parsed = await response.json();
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Grocery parsing error via API:', error);
    throw error;
  }
};

export const suggestRecipe = async (ingredients: string[]) => {
  try {
    const response = await fetch('/api/suggest-recipe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ingredients }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.recipe || 'Could not generate recipe.';
  } catch (error) {
    console.error('Recipe suggestion error via API:', error);
    return 'Could not generate recipe.';
  }
};
