/**
 * SpeechSynthesis (Voice Out) service for Voca.
 * Provides natural text-to-speech for AI confirmation messages.
 */

const MUTE_STORAGE_KEY = 'voca_voice_muted';

export const isSpeechSynthesisSupported = () => {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
};

export const getStoredMutePreference = () => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setStoredMutePreference = (muted) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false');
  } catch {}
};

/**
 * Normalizes speech text for natural browser voice reading.
 * Replaces symbols like '₹' with 'rupees' so browsers don't skip or mispronounce currency.
 */
export const prepareTextForSpeech = (text) => {
  if (!text) return '';
  return text
    .replace(/₹\s*(\d+)/g, '$1 rupees')
    .replace(/₹/g, 'rupees ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Finds the most natural English voice available in the current browser.
 * Prioritizes en-IN (Indian English) or high-quality natural voices.
 */
export const selectBestVoice = () => {
  if (!isSpeechSynthesisSupported()) return null;

  const voices = window.speechSynthesis.getVoices() || [];
  if (voices.length === 0) return null;

  // 1. Try en-IN voice (Indian English)
  const inVoice = voices.find(v =>
    (v.lang === 'en-IN' || v.lang.replace('_', '-').startsWith('en-IN'))
  );
  if (inVoice) return inVoice;

  // 2. Try natural/online quality English voices (Google, Natural, Microsoft)
  const naturalVoice = voices.find(v =>
    v.lang.startsWith('en') && (
      v.name.includes('Google') ||
      v.name.includes('Natural') ||
      v.name.includes('Online')
    )
  );
  if (naturalVoice) return naturalVoice;

  // 3. Fallback to any English voice
  const anyEnglish = voices.find(v => v.lang.startsWith('en'));
  if (anyEnglish) return anyEnglish;

  // 4. Default voice
  return voices.find(v => v.default) || voices[0] || null;
};

/**
 * Stops any ongoing browser speech immediately.
 */
export const stopSpeaking = () => {
  if (!isSpeechSynthesisSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch (err) {
    console.warn('[SpeechSynthesis] Error cancelling speech:', err);
  }
};

/**
 * Speaks an assistant confirmation text aloud.
 */
export const speakMessage = (text, options = {}) => {
  if (!isSpeechSynthesisSupported()) {
    console.warn('[SpeechSynthesis] SpeechSynthesis API is not supported in this browser.');
    return null;
  }

  const {
    isMuted = false,
    rate = 0.98,
    pitch = 1.0,
    onStart,
    onEnd,
    onError
  } = options;

  if (isMuted) {
    console.log('[SpeechSynthesis] Voice output is muted by user.');
    return null;
  }

  // Cancel any currently playing speech to prevent overlapping voices
  stopSpeaking();

  const speechText = prepareTextForSpeech(text);
  if (!speechText) return null;

  try {
    const utterance = new SpeechSynthesisUtterance(speechText);
    const voice = selectBestVoice();

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || 'en-IN';
    } else {
      utterance.lang = 'en-IN';
    }

    utterance.rate = rate;
    utterance.pitch = pitch;

    utterance.onstart = () => {
      if (typeof onStart === 'function') onStart();
    };

    utterance.onend = () => {
      if (typeof onEnd === 'function') onEnd();
    };

    utterance.onerror = (event) => {
      // 'canceled' or 'interrupted' errors are normal when user clicks stop or starts new recording
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        console.warn('[SpeechSynthesis] Utterance event error:', event.error);
      }
      if (typeof onError === 'function') onError(event);
    };

    window.speechSynthesis.speak(utterance);
    return utterance;
  } catch (err) {
    console.warn('[SpeechSynthesis] Failed to initialize speech:', err);
    if (typeof onError === 'function') onError(err);
    return null;
  }
};
