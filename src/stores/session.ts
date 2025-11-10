// Vocabulary session store (clean implementation)
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import vocabData from '@/data/vocab.example.json'
import type { Word, SeenLog, ScheduledReview } from '@/types'
import { addDays, now } from '@/utils/time'

export type Mode = 'review' | 'due' | 'new' | 'done'

const STORAGE_STATE = 'vh_state_v1'
const STORAGE_SCHEDULE = 'vh_schedule_v1'

export const useSessionStore = defineStore('session', () => {
  const sessionId = ref('')
  const dueNow = ref<Word[]>([])
  const reviewQueue = ref<Word[]>([])
  const newQueue = ref<Word[]>([])
  const history = ref<string[]>([])
  const histPos = ref(-1)
  const visibleElapsedSec = ref(0)
  const blockSizeSec = ref(300)
  const totalSessionSec = ref(1800)
  const lastProcessedBlock = ref(0)
  const thirtyTriggered = ref(false)
  const seen = ref<SeenLog[]>([])
  const scheduled = ref<ScheduledReview[]>([])
  const mode = ref<Mode>('new')
  const timerId = ref<number | 0>(0)

  const totalCount = computed(() => dueNow.value.length + reviewQueue.value.length + newQueue.value.length)
  const currentWord = computed<Word | null>(() => {
    const id = history.value[histPos.value]
    const all = [...reviewQueue.value, ...dueNow.value, ...newQueue.value]
    if (id) {
      const found = all.find(w => w.id === id)
      if (found) return found
    }
    if (reviewQueue.value.length) return reviewQueue.value[0]
    if (dueNow.value.length) return dueNow.value[0]
    if (newQueue.value.length) return newQueue.value[0]
    return null
  })
  const uiIndex = computed(() => (histPos.value >= 0 ? histPos.value + 1 : 0))
  const uiTotal = computed(() => Math.max(history.value.length, totalCount.value))

  function loadSchedules(): ScheduledReview[] {
    try { const raw = localStorage.getItem(STORAGE_SCHEDULE); return raw ? JSON.parse(raw) : [] } catch { return [] }
  }
  function saveSchedules() { localStorage.setItem(STORAGE_SCHEDULE, JSON.stringify(scheduled.value)) }
  function loadState(): any | null { try { const raw = localStorage.getItem(STORAGE_STATE); return raw ? JSON.parse(raw) : null } catch { return null } }
  function persist() {
    localStorage.setItem(STORAGE_STATE, JSON.stringify({
      sessionId: sessionId.value,
      dueNow: dueNow.value,
      reviewQueue: reviewQueue.value,
      newQueue: newQueue.value,
      history: history.value,
      histPos: histPos.value,
      visibleElapsedSec: visibleElapsedSec.value,
      lastProcessedBlock: lastProcessedBlock.value,
      thirtyTriggered: thirtyTriggered.value,
      seen: seen.value,
    }))
  }
  function persistShallow() {
    const raw = localStorage.getItem(STORAGE_STATE)
    if (!raw) return persist()
    try {
      const snapshot = JSON.parse(raw)
      snapshot.visibleElapsedSec = visibleElapsedSec.value
      snapshot.lastProcessedBlock = lastProcessedBlock.value
      snapshot.thirtyTriggered = thirtyTriggered.value
      localStorage.setItem(STORAGE_STATE, JSON.stringify(snapshot))
    } catch { persist() }
  }

  function ensureCurrent() { if (history.value.length === 0) { const nxt = peekNext(); if (nxt) pushHistory(nxt.id) } }
  function peekNext(): Word | null {
    if (reviewQueue.value.length) { mode.value = 'review'; return reviewQueue.value[0] }
    if (dueNow.value.length) { mode.value = 'due'; return dueNow.value[0] }
    if (newQueue.value.length) { mode.value = 'new'; return newQueue.value[0] }
    mode.value = 'done'; return null
  }
  function pushHistory(id: string) {
    if (histPos.value < history.value.length - 1) history.value = history.value.slice(0, histPos.value + 1)
    history.value.push(id); histPos.value = history.value.length - 1
  }
  function next() {
    if (histPos.value < history.value.length - 1) { histPos.value++; return }
    let w: Word | undefined
    if (reviewQueue.value.length) w = reviewQueue.value.shift()
    else if (dueNow.value.length) w = dueNow.value.shift()
    else if (newQueue.value.length) w = newQueue.value.shift()
    if (w) { pushHistory(w.id); seen.value.push({ wordId: w.id, seenAtSec: visibleElapsedSec.value }) }
    checkThirtyReview(); persist()
  }
  function prev() { if (histPos.value > 0) histPos.value-- }
  function startTicker() {
    if (timerId.value) window.clearInterval(timerId.value)
    timerId.value = window.setInterval(() => { if (document.visibilityState === 'visible') { visibleElapsedSec.value++; onTick() } }, 1000)
  }
  function onVisibilityChange() {/* no-op */}
  function onTick() {
    const currentBlock = Math.floor(visibleElapsedSec.value / blockSizeSec.value)
    if (currentBlock > lastProcessedBlock.value) {
      const blockStart = lastProcessedBlock.value * blockSizeSec.value
      const blockEnd = currentBlock * blockSizeSec.value
      const ids = Array.from(new Set(seen.value.filter(s => s.seenAtSec >= blockStart && s.seenAtSec < blockEnd).map(s => s.wordId)))
      if (ids.length) {
        const all = [...reviewQueue.value, ...dueNow.value, ...newQueue.value]
        const map = new Map(all.map(w => [w.id, w]))
        const toReview = ids.map(id => map.get(id)).filter(Boolean) as Word[]
        reviewQueue.value.push(...toReview)
      }
      lastProcessedBlock.value = currentBlock
    }
    checkThirtyReview(); persistShallow()
  }
  function checkThirtyReview() {
    if (!thirtyTriggered.value && visibleElapsedSec.value >= totalSessionSec.value) {
      const ids = Array.from(new Set(seen.value.map(s => s.wordId)))
      const allWords = [...reviewQueue.value, ...dueNow.value, ...newQueue.value]
      const map = new Map(allWords.map(w => [w.id, w]))
      const toReview = ids.map(id => map.get(id)).filter(Boolean) as Word[]
      const existingIds = new Set(reviewQueue.value.map(w => w.id))
      reviewQueue.value.push(...toReview.filter(w => !existingIds.has(w.id)))
      thirtyTriggered.value = true
    }
    if (thirtyTriggered.value && reviewQueue.value.length === 0 && dueNow.value.length === 0 && newQueue.value.length === 0) finishSession()
  }
  function finishSession() {
    const wordsSeen = Array.from(new Set(seen.value.map(s => s.wordId)))
    const at = now()
    const add: ScheduledReview[] = wordsSeen.flatMap(id => [
      { wordId: id, dueAt: addDays(at, 2), reason: '2d' },
      { wordId: id, dueAt: addDays(at, 7), reason: '7d' },
    ])
    scheduled.value.push(...add); saveSchedules(); mode.value = 'done'
  }
  async function initialize() {
    scheduled.value = loadSchedules()
    const words: Word[] = vocabData as Word[]
    const saved = loadState()
    if (saved) {
      sessionId.value = saved.sessionId || `s_${Date.now()}`
      dueNow.value = saved.dueNow || []
      reviewQueue.value = saved.reviewQueue || []
      newQueue.value = saved.newQueue && saved.newQueue.length ? saved.newQueue : [...words]
      history.value = saved.history || []
      histPos.value = typeof saved.histPos === 'number' ? saved.histPos : -1
      visibleElapsedSec.value = saved.visibleElapsedSec || 0
      lastProcessedBlock.value = saved.lastProcessedBlock || 0
      thirtyTriggered.value = !!saved.thirtyTriggered
      seen.value = saved.seen || []
    } else {
      sessionId.value = `s_${Date.now()}`
      newQueue.value = [...words]
    }
    const nowMs = now()
    const dueIds = new Set(scheduled.value.filter(s => s.dueAt <= nowMs).map(s => s.wordId))
    if (dueIds.size) {
      const allWords = new Map(words.map(w => [w.id, w]))
      const existingIds = new Set([
        ...dueNow.value.map(w => w.id),
        ...reviewQueue.value.map(w => w.id),
        ...newQueue.value.map(w => w.id),
      ])
      const newlyDue = Array.from(dueIds)
        .filter(id => !existingIds.has(id))
        .map(id => allWords.get(id))
        .filter(Boolean) as Word[]
      dueNow.value = [...newlyDue, ...dueNow.value]
      scheduled.value = scheduled.value.filter(s => !dueIds.has(s.wordId))
      saveSchedules()
    }
    startTicker(); persist(); ensureCurrent()
  }

  return {
    sessionId, dueNow, reviewQueue, newQueue, history, histPos, visibleElapsedSec,
    blockSizeSec, totalSessionSec, lastProcessedBlock, thirtyTriggered, seen,
    scheduled, mode, timerId,
    currentWord, uiIndex, uiTotal, totalCount,
    initialize, next, prev, onVisibilityChange,
  }
})
