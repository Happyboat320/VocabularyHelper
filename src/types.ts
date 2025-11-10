export type Word = {
  id: string
  term: string
  phonetic?: string
  audio?: string
  meaning: string
  examples?: string[]
}

export type SeenLog = {
  wordId: string
  seenAtSec: number
}

export type ScheduledReview = {
  wordId: string
  dueAt: number // epoch ms
  reason: '2d' | '7d'
}
