/**
 * Text-to-Speech (TTS) helper for reading petition status and confirmation aloud
 * in the citizen's selected language (Tamil, Hindi, English).
 */

export function speakText(
  text: string,
  lang: string = "ta",
  onEnd?: () => void,
  onError?: () => void
): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    console.warn("[TTS] Speech synthesis not supported in this browser.");
    if (onError) onError();
    return false;
  }

  // Stop any active speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  // Map language to BCP 47 code
  const langMap: Record<string, string> = {
    ta: "ta-IN",
    hi: "hi-IN",
    en: "en-IN",
  };
  utterance.lang = langMap[lang] || "en-IN";
  utterance.rate = 0.95; // Slightly slower, clearer for low-literacy clarity
  utterance.pitch = 1.0;

  // Try to pick a native voice for the language if available
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find(
    (v) => v.lang === utterance.lang || v.lang.startsWith(lang)
  );
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  utterance.onend = () => {
    if (onEnd) onEnd();
  };

  utterance.onerror = (e) => {
    console.warn("[TTS] Speech synthesis error:", e);
    if (onError) onError();
  };

  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeaking(): boolean {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    return window.speechSynthesis.speaking;
  }
  return false;
}

