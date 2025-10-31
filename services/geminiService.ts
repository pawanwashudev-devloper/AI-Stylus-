
import { GoogleGenAI, Modality } from "@google/genai";

const getMimeTypeAndData = (base64: string) => {
    const [meta, data] = base64.split(',');
    const mimeType = meta.split(';')[0].split(':')[1];
    return { mimeType, data };
};

const handleApiError = (error: unknown): never => {
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        // Check for specific keywords that indicate a quota/billing issue.
        if (
            message.includes('quota') || 
            message.includes('resource_exhausted') ||
            message.includes('billing')
        ) {
            throw new Error(
                'API Quota Exceeded or Billing not enabled. Please ensure the Google Cloud project for your API key has billing enabled. For more info, see: ai.google.dev/gemini-api/docs/billing'
            );
        }
        if (message.includes('api key not valid')) {
            throw new Error('Invalid API Key. Please check your key and try again.');
        }
        // Re-throw original error if it's not a known issue
        throw error;
    }
    // Throw a generic error for non-Error types
    throw new Error('An unknown error occurred.');
};

/**
 * Validates a Gemini API key by making a simple, non-streaming call.
 * @param apiKey The API key to validate.
 * @returns A promise that resolves to true if the key is valid, false otherwise.
 */
export const validateApiKey = async (apiKey: string): Promise<boolean> => {
    if (!apiKey) {
        return false;
    }
    try {
        const ai = new GoogleGenAI({ apiKey });
        const model = 'gemini-2.5-flash';
        await ai.models.generateContent({
            model: model,
            contents: 'hello', // A simple, non-empty prompt to test connectivity.
        });
        return true;
    } catch (error) {
        console.error('API Key validation failed:', error);
        return false;
    }
};


/**
 * Analyzes user inputs to generate a detailed prompt for image creation.
 * It can handle initial ideas and iterative enhancements.
 * @param apiKey The user's Gemini API key.
 * @param rawImageBase64 Optional base64 string of the main subject image.
 * @param styleImageBase64 Optional base64 string of the style reference image.
 * @param userPrompt Text description of the user's goal.
 * @param previousPrompt Optional prompt from a previous generation for refinement.
 * @param editSuggestion Optional text for how to edit or enhance the image.
 * @returns A detailed and creative prompt string.
 */
export const analyzeIdea = async (
    apiKey: string,
    rawImageBase64: string | null, 
    styleImageBase64: string | null, 
    userPrompt: string,
    previousPrompt?: string,
    editSuggestion?: string
): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        const model = 'gemini-2.5-pro';
        
        let systemInstruction = `You are a master prompt creator for an AI image generator. Your task is to synthesize user inputs into a single, detailed, and evocative prompt. The user might write in simple or imperfect English; your goal is to understand their core intent.

**Rules:**
1.  **Analyze all inputs:** Consider the raw image (the subject), the style image (the aesthetic reference), and the user's text prompt (if provided).
2.  **If no text is provided:** Infer the goal from the combination of the raw and style images. For example, if the raw image is a person and the style image is a watercolor painting, the goal is likely to render the person in a watercolor style.
3.  **Combine concepts:** Merge the elements into a cohesive vision. The raw image is the primary subject to be modified. The style image dictates the artistic direction (e.g., mood, color, texture).
4.  **Output only the prompt:** Do not add any extra explanations, greetings, or conversational text. Your entire output should be the final, usable prompt.`;

        const parts: any[] = [];
        let textContent = `User's goal: "${userPrompt}"\n`;

        if (rawImageBase64) {
            const { mimeType, data } = getMimeTypeAndData(rawImageBase64);
            parts.push({ text: "This is the RAW IMAGE (the subject):" }, {
                inlineData: { mimeType, data }
            });
        }

        if (styleImageBase64) {
            const { mimeType, data } = getMimeTypeAndData(styleImageBase64);
            parts.push({ text: "This is the STYLE IMAGE (the reference for aesthetics):" }, {
                inlineData: { mimeType, data }
            });
        }

        if (previousPrompt && editSuggestion) {
            systemInstruction += `
**Enhancement Mode:**
You are now refining a previous attempt.
- The user was shown an image generated from the 'PREVIOUS PROMPT'.
- They have provided an 'EDIT SUGGESTION' to improve it.
- Your task is to intelligently modify the 'PREVIOUS PROMPT' based on the 'EDIT SUGGESTION' to create a new, superior prompt. Do not just tack on the suggestion; integrate it thoughtfully. Refer back to the original images and goal if necessary.`;
            
            textContent += `\nPREVIOUS PROMPT: "${previousPrompt}"\nEDIT SUGGESTION: "${editSuggestion}"`;
        }

        parts.push({ text: textContent });

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: parts },
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.8,
            }
        });

        return response.text.trim();
    } catch (error) {
        handleApiError(error);
    }
};


/**
 * Generates an image based on a prompt, optionally using a raw image for editing.
 * @param apiKey The user's Gemini API key.
 * @param prompt The detailed prompt for image generation.
 * @param rawImageBase64 Optional base64 encoded image to be edited or transformed.
 * @returns A base64 encoded string of the generated PNG image.
 */
export const generateImage = async (apiKey: string, prompt: string, rawImageBase64: string | null): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        const model = 'gemini-2.5-flash-image';
        
        const parts: any[] = [{ text: prompt }];

        if (rawImageBase64) {
            const { mimeType, data } = getMimeTypeAndData(rawImageBase64);
            // For image generation, the image part should usually come first.
            parts.unshift({
                inlineData: { mimeType, data }
            });
        }

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: parts },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                return part.inlineData.data;
            }
        }

        throw new Error("No image data found in the AI's response.");
    } catch (error) {
        handleApiError(error);
    }
};
