import { GoogleGenAI } from "@google/genai";

const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '');
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export const translateText = async (text: string, targetLanguage: string = "Arabic") => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate the following text to ${targetLanguage}. Maintain the emotional and romantic tone. Return only the translated text.\n\n${text}`,
    });
    return response.text;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
};

export const generateSpeech = async (text: string, voiceName: string = "Kore", style: string = "emotional") => {
  try {
    // We can't change the physical voice waveform style directly in the current TTS API beyond voiceName,
    // but we can prompt Gemini to structure the text/prosody if it were generating SSML (future support).
    // For now, we select the best matching prebuilt voice for the style.
    
    // Voice mapping logic
    let selectedVoice = voiceName;
    if (style === "news") selectedVoice = "Puck"; // More authoritative
    if (style === "singing") selectedVoice = "Zephyr"; // Lighter
    if (style === "emotional") selectedVoice = "Kore"; // Soft/Gentle
    if (style === "breathing") selectedVoice = "Charon"; // Deeper

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice as any },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return base64Audio;
    }
    throw new Error("No audio data received");
  } catch (error) {
    console.error("TTS error:", error);
    throw error;
  }
};

export const chatWithVoice = async (message: string, history: { role: string; parts: string }[] = []) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history.map(h => ({ role: h.role, parts: [{ text: h.parts }] })),
        { role: "user", parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: "You are a kind, loving, and supportive partner. Your tone is romantic, gentle, and poetic. Use emojis sparingly but effectively. You speak in the language requested by the user, but you have a slight preference for elegant and romantic phrasing.",
      }
    });
    return response.text;
  } catch (error) {
    console.error("Chat error:", error);
    return "Something went wrong in my heart... can we try again?";
  }
};
