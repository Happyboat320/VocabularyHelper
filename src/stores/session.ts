// Vocabulary session store (clean implementation)
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
// Data loading is delegated to library loader so we can switch vocab sources at runtime
import { loadLibrary, libraries, type LibraryId } from '@/data/libraries'
import type { Word, SeenLog, ScheduledReview } from '@/types'
import { addDays, now } from '@/utils/time'

export type Mode = 'review' | 'due' | 'new' | 'done'

const STORAGE_GLOBAL = 'vh_global_v1' // 保存全局信息（如当前词库）
const stateKey = (lib: string) => `vh_state_${lib}_v1`
const scheduleKey = (lib: string) => `vh_schedule_${lib}_v1`

export const useSessionStore = defineStore('session', () => {
  const sessionId = ref('')
  // Track which vocabulary library is currently selected
  const currentLibrary = ref<LibraryId>('ielts')
  // Immutable base words loaded from the current library (used to resolve history items)
  const baseWords = ref<Word[]>([])
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
  // Track how many times a word has been reviewed (viewed after coming from reviewQueue) in this session
  const reviewPasses = ref<Record<string, number>>({})
  const mode = ref<Mode>('new')
  const timerId = ref<number | 0>(0)
  type Stage = 'new' | 'seen' | 'block' | 'session' | 'due2d'
  const wordStage = ref<Record<string, Stage>>({})
  const skippedIds = ref<Record<string, true>>({})
  // 已完成“2天复习”的计数（按词库累计，用于成就星星展示）
  const completed2dCount = ref(0)

  // 阶段计数（用于颜色柱形图）
  const stageCounts = computed(() => {
    const setIds = new Set(baseWords.value.map(w => w.id))
    const skipped = new Set(Object.keys(skippedIds.value))
    const counts: Record<Stage, number> & { new: number } = { new: 0, seen: 0, block: 0, session: 0, due2d: 0 }
    for (const [id, st] of Object.entries(wordStage.value)) {
      if (!setIds.has(id)) continue
      if (skipped.has(id)) continue
      if (st === 'seen' || st === 'block' || st === 'session' || st === 'due2d') counts[st]++
    }
    const nonNew = counts.seen + counts.block + counts.session + counts.due2d
    // new = 总词数 - 已有阶段 - 已跳过
    counts.new = Math.max(0, baseWords.value.length - nonNew - skipped.size)
    return counts
  })

  const totalCount = computed(() => dueNow.value.length + reviewQueue.value.length + newQueue.value.length)
  const totalWords = computed(() => baseWords.value.length)
  const currentWord = computed<Word | null>(() => {
    const id = history.value[histPos.value]
    if (id) {
      // Resolve by immutable base map to ensure prev() shows correct content even if queues shifted
      const found = baseWords.value.find(w => w.id === id)
      if (found) return found
    }
    // Fallback to head-of-queue when there's no history yet
    if (reviewQueue.value.length) return reviewQueue.value[0]
    if (dueNow.value.length) return dueNow.value[0]
    if (newQueue.value.length) return newQueue.value[0]
    return null
  })
  const uiIndex = computed(() => (histPos.value >= 0 ? histPos.value + 1 : 0))
  const uiTotal = computed(() => Math.max(history.value.length, totalCount.value))
  // Provide upcoming words for preloading speech (does not mutate state)
  function upcomingWords(n = 3): Word[] {
    const out: Word[] = []
    // If we have forward history, use it first
    if (histPos.value < history.value.length - 1) {
      for (let i = histPos.value + 1; i < history.value.length && out.length < n; i++) {
        const id = history.value[i]
        const w = baseWords.value.find(w => w.id === id)
        if (w) out.push(w)
      }
    }
    if (out.length >= n) return out.slice(0, n)
    // Otherwise, read from current queues in priority order without consuming
    const pushFrom = (arr: Word[]) => {
      for (let i = 0; i < arr.length && out.length < n; i++) out.push(arr[i])
    }
    if (reviewQueue.value.length) pushFrom(reviewQueue.value)
    else if (dueNow.value.length) pushFrom(dueNow.value)
    else if (newQueue.value.length) pushFrom(newQueue.value)
    return out.slice(0, n)
  }

  function loadSchedules(lib?: string): ScheduledReview[] {
    const key = scheduleKey(lib ?? currentLibrary.value)
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : [] } catch { return [] }
  }
  function saveSchedules(lib?: string) {
    const key = scheduleKey(lib ?? currentLibrary.value)
    localStorage.setItem(key, JSON.stringify(scheduled.value))
  }
  function loadState(lib?: string): any | null {
    const key = stateKey(lib ?? currentLibrary.value)
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null } catch { return null }
  }
  function persist(lib?: string) {
    const key = stateKey(lib ?? currentLibrary.value)
    localStorage.setItem(key, JSON.stringify({
      sessionId: sessionId.value,
      currentLibrary: currentLibrary.value,
      dueNow: dueNow.value,
      reviewQueue: reviewQueue.value,
      newQueue: newQueue.value,
      history: history.value,
      histPos: histPos.value,
      visibleElapsedSec: visibleElapsedSec.value,
      lastProcessedBlock: lastProcessedBlock.value,
      thirtyTriggered: thirtyTriggered.value,
      seen: seen.value,
      reviewPasses: reviewPasses.value,
      wordStage: wordStage.value,
      skippedIds: skippedIds.value,
      completed2dCount: completed2dCount.value,
    }))
    // 同步保存当前选择到全局
    try {
      const raw = localStorage.getItem(STORAGE_GLOBAL)
      const obj = raw ? JSON.parse(raw) : {}
      obj.currentLibrary = currentLibrary.value
      localStorage.setItem(STORAGE_GLOBAL, JSON.stringify(obj))
    } catch {}
  }
  function persistShallow() {
    const key = stateKey(currentLibrary.value)
    const raw = localStorage.getItem(key)
    if (!raw) return persist()
    try {
      const snapshot = JSON.parse(raw)
      snapshot.visibleElapsedSec = visibleElapsedSec.value
      snapshot.lastProcessedBlock = lastProcessedBlock.value
      snapshot.thirtyTriggered = thirtyTriggered.value
      localStorage.setItem(key, JSON.stringify(snapshot))
    } catch { persist() }
  }

  // 取出下一个词并从队列消费（用于初始化避免首词重复）
  function consumeNext(): Word | null {
    let w: Word | undefined
    if (reviewQueue.value.length) {
      w = reviewQueue.value.shift()
      if (w) reviewPasses.value[w.id] = (reviewPasses.value[w.id] ?? 0) + 1
    } else if (dueNow.value.length) {
      w = dueNow.value.shift()
    } else if (newQueue.value.length) {
      w = newQueue.value.shift()
    }
    return w || null
  }
  function ensureCurrent() {
    if (history.value.length === 0) {
      const w = consumeNext()
      if (w) {
        const cur = wordStage.value[w.id] ?? 'new'
        if (cur === 'new') wordStage.value[w.id] = 'seen'
        pushHistory(w.id); seen.value.push({ wordId: w.id, seenAtSec: visibleElapsedSec.value })
      }
    }
  }
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
    if (reviewQueue.value.length) {
      w = reviewQueue.value.shift()
      if (w) reviewPasses.value[w.id] = (reviewPasses.value[w.id] ?? 0) + 1
    }
    else if (dueNow.value.length) w = dueNow.value.shift()
    else if (newQueue.value.length) w = newQueue.value.shift()
    if (w) {
      // 若是 2 天回归词，视为本次完成一次 2d 复习
      if (wordStage.value[w.id] === 'due2d') {
        completed2dCount.value = (completed2dCount.value || 0) + 1
      }
      const cur = wordStage.value[w.id] ?? 'new'
      if (cur === 'new') wordStage.value[w.id] = 'seen'
      pushHistory(w.id)
      seen.value.push({ wordId: w.id, seenAtSec: visibleElapsedSec.value })
    }
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
      let ids = Array.from(new Set(seen.value.filter(s => s.seenAtSec >= blockStart && s.seenAtSec < blockEnd).map(s => s.wordId)))
      // 不升级当前正在看的词，避免 5 分钟边界立即变色
      const curId = history.value[histPos.value]
      if (curId) ids = ids.filter(id => id !== curId)
      if (ids.length) {
        // Map against baseWords to ensure we can re-queue words already consumed earlier
        const map = new Map(baseWords.value.map(w => [w.id, w]))
        const existingIds = new Set(reviewQueue.value.map(w => w.id))
        const toReview = ids
          .filter(id => !skippedIds.value[id])
          .map(id => map.get(id))
          .filter(Boolean) as Word[]
        const items = toReview.filter(w => !existingIds.has(w.id))
        if (items.length) {
          items.forEach(w => {
            const cur = wordStage.value[w.id] ?? 'new'
            if (cur === 'new') wordStage.value[w.id] = 'block'
          })
          reviewQueue.value.push(...items)
        }
      }
      lastProcessedBlock.value = currentBlock
    }
    checkThirtyReview(); persistShallow()
  }
  function checkThirtyReview() {
    if (!thirtyTriggered.value && visibleElapsedSec.value >= totalSessionSec.value) {
      const ids = Array.from(new Set(seen.value.map(s => s.wordId)))
      const map = new Map(baseWords.value.map(w => [w.id, w]))
      const toReview = ids
        .filter(id => !skippedIds.value[id])
        .map(id => map.get(id))
        .filter(Boolean) as Word[]
      const existingIds = new Set(reviewQueue.value.map(w => w.id))
      const items = toReview.filter(w => !existingIds.has(w.id))
      if (items.length) {
        items.forEach(w => { wordStage.value[w.id] = 'session' })
        reviewQueue.value.push(...items)
      }
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
    // 恢复当前词库选择（全局）
    try {
      const raw = localStorage.getItem(STORAGE_GLOBAL)
      const g = raw ? JSON.parse(raw) : null
      if (g?.currentLibrary) currentLibrary.value = g.currentLibrary as LibraryId
    } catch {}
    // 预先载入本库计划
    scheduled.value = loadSchedules(currentLibrary.value)
    // Load words for the current library
    const words: Word[] = await loadLibrary(currentLibrary.value)
    baseWords.value = words
    const saved = loadState(currentLibrary.value)
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
      reviewPasses.value = saved.reviewPasses || {}
      wordStage.value = saved.wordStage || {}
      skippedIds.value = saved.skippedIds || {}
      completed2dCount.value = saved.completed2dCount || 0
    } else {
      sessionId.value = `s_${Date.now()}`
      newQueue.value = [...words]
    }
    const nowMs = now()
    const due = scheduled.value.filter(s => s.dueAt <= nowMs)
    if (due.length) {
      const allWords = new Map(words.map(w => [w.id, w]))
      const existingIds = new Set([
        ...dueNow.value.map(w => w.id),
        ...reviewQueue.value.map(w => w.id),
        ...newQueue.value.map(w => w.id),
      ])
      const toRemove: string[] = []
      for (const d of due) {
        const id = d.wordId
        if (skippedIds.value[id]) { toRemove.push(id); continue }
        if (existingIds.has(id)) { toRemove.push(id); continue }
        const w = allWords.get(id)
        if (w) {
          dueNow.value.unshift(w)
          if (d.reason === '2d') wordStage.value[id] = 'due2d'
          toRemove.push(id)
        }
      }
      if (toRemove.length) {
        const rm = new Set(toRemove)
        scheduled.value = scheduled.value.filter(s => !rm.has(s.wordId))
        saveSchedules(currentLibrary.value)
      }
    }
    startTicker(); persist(); ensureCurrent()
  }

  // Change library and reset session queues while preserving schedules
  async function changeLibrary(id: LibraryId) {
    if (currentLibrary.value === id) return
    // 先保存当前库状态
    persist(currentLibrary.value)
    saveSchedules(currentLibrary.value)
    currentLibrary.value = id
    // 载入新库计划
    scheduled.value = loadSchedules(id)
    const words = await loadLibrary(id)
    baseWords.value = words
    // 尝试恢复该库的状态
    const saved = loadState(id)
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
      reviewPasses.value = saved.reviewPasses || {}
      wordStage.value = saved.wordStage || {}
      skippedIds.value = saved.skippedIds || {}
    } else {
      // 新库初始化
      dueNow.value = []
      reviewQueue.value = []
      newQueue.value = [...words]
      history.value = []
      histPos.value = -1
      visibleElapsedSec.value = 0
      lastProcessedBlock.value = 0
      thirtyTriggered.value = false
      seen.value = []
      reviewPasses.value = {}
      wordStage.value = {}
      skippedIds.value = {}
    }
    // 写入全局当前库
    try {
      const raw = localStorage.getItem(STORAGE_GLOBAL)
      const obj = raw ? JSON.parse(raw) : {}
      obj.currentLibrary = currentLibrary.value
      localStorage.setItem(STORAGE_GLOBAL, JSON.stringify(obj))
    } catch {}
    persist()
    ensureCurrent()
  }

  // Reinitialize session with the current library (keep schedules and library selection)
  async function reinitialize() {
    const words: Word[] = await loadLibrary(currentLibrary.value)
    baseWords.value = words
    dueNow.value = []
    reviewQueue.value = []
    newQueue.value = [...words]
    history.value = []
    histPos.value = -1
    visibleElapsedSec.value = 0
    lastProcessedBlock.value = 0
    thirtyTriggered.value = false
    seen.value = []
    reviewPasses.value = {}
    wordStage.value = {}
    skippedIds.value = {}
    completed2dCount.value = 0
    persist(); ensureCurrent()
  }

  function getStage(id: string): Stage { return wordStage.value[id] ?? 'new' }
  function skipCurrent() {
    const id = history.value[histPos.value]
    if (!id) return
    skippedIds.value[id] = true
    dueNow.value = dueNow.value.filter(w => w.id !== id)
    reviewQueue.value = reviewQueue.value.filter(w => w.id !== id)
    newQueue.value = newQueue.value.filter(w => w.id !== id)
    scheduled.value = scheduled.value.filter(s => s.wordId !== id)
    saveSchedules(); persist()
  }

  return {
    sessionId, dueNow, reviewQueue, newQueue, history, histPos, visibleElapsedSec,
    blockSizeSec, totalSessionSec, lastProcessedBlock, thirtyTriggered, seen,
    scheduled, mode, timerId,
    currentWord, uiIndex, uiTotal, totalCount, totalWords,
    currentLibrary, changeLibrary, reinitialize, upcomingWords,
    initialize, next, prev, onVisibilityChange, getStage, skipCurrent,
    stageCounts, completed2dCount,
  }
})
