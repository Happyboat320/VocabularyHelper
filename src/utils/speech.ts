import type { Word } from '@/types'

let activeUtter: SpeechSynthesisUtterance | null = null

export function cancelSpeech() {
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      activeUtter = null
    }
  } catch {}
}

export function speakText(text: string, lang = 'en-US') {
  if (!('speechSynthesis' in window)) return
  cancelSpeech()
  if (!text) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  activeUtter = u
  window.speechSynthesis.speak(u)
}

export function speakWordTerm(word: Word, lang = 'en-US') {
  speakText(word.term, lang)
}

export function speakWordWithExample(word: Word, lang = 'en-US') {
  const text = [word.term, ...(word.examples?.slice(0, 1) ?? [])].join('. ')
  speakText(text, lang)
}
