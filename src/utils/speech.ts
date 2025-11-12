import type { Word } from '@/types'

let activeUtter: SpeechSynthesisUtterance | null = null
let voiceReady = false
const cache = new Map<string, SpeechSynthesisUtterance>()

function selectVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  return voices.find(v => v.lang.toLowerCase().startsWith(lang.toLowerCase())) || voices[0]
}

function ensureVoices(callback?: () => void) {
  if (voiceReady) { callback?.(); return }
  const handler = () => {
    voiceReady = true
    window.speechSynthesis.removeEventListener('voiceschanged', handler)
    callback?.()
  }
  window.speechSynthesis.addEventListener('voiceschanged', handler)
  // Some browsers already have voices; trigger callback immediately if available
  if (window.speechSynthesis.getVoices().length) handler()
}

export function cancelSpeech() {
  try { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); activeUtter = null } } catch {}
}

function buildUtter(text: string, lang: string): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  if (voiceReady) {
    const v = selectVoice(lang)
    if (v) u.voice = v
  }
  // Mild tuning for smoothness
  u.rate = 0.95
  u.pitch = 1
  return u
}

export function preloadWords(words: Word[], lang = 'en-US') {
  if (!('speechSynthesis' in window)) return
  ensureVoices()
  for (const w of words) {
    if (cache.has(w.id)) continue
    const text = [w.term, ...(w.examples?.slice(0, 1) ?? [])].join('. ')
    cache.set(w.id, buildUtter(text, lang))
  }
}

export function speakText(text: string, lang = 'en-US') {
  if (!('speechSynthesis' in window)) return
  ensureVoices(() => {
    cancelSpeech()
    if (!text) return
    // Small delay to let previous cancel settle
    setTimeout(() => {
      const utter = buildUtter(text, lang)
      activeUtter = utter
      window.speechSynthesis.speak(utter)
    }, 40)
  })
}

export function speakWordTerm(word: Word, lang = 'en-US') {
  const cached = cache.get(word.id)
  if (cached) {
    cancelSpeech(); setTimeout(() => { activeUtter = cached; window.speechSynthesis.speak(cached) }, 40); return
  }
  speakText(word.term, lang)
}

export function speakWordWithExample(word: Word, lang = 'en-US') {
  const text = [word.term, ...(word.examples?.slice(0, 1) ?? [])].join('. ')
  const cached = cache.get(word.id)
  if (cached) { cancelSpeech(); setTimeout(() => { activeUtter = cached; window.speechSynthesis.speak(cached) }, 40); return }
  speakText(text, lang)
}
