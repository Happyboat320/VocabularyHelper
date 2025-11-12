<template>
  <div class="app">
    <header class="app__header">
      <div class="brand">
        <h1>Vocabulary Helper</h1>
        <select v-model="selectedLib" class="library-select" title="选择词库">
          <option v-for="lib in libs" :key="lib.id" :value="lib.id">{{ lib.name }}<span v-if="libCountLabel(lib.id)"> ({{ libCountLabel(lib.id) }})</span></option>
        </select>
      </div>
      <div class="status">
        <span>可见时间：{{ visibleMinutes }} 分钟</span>
        <div class="stagebar-wrap">
          <div class="stagebar__stars" :title="starsTitle">
            <span v-for="i in starsCount" :key="i" class="star">★</span>
          </div>
          <div class="stagebar-multi" :title="stageBarTitle">
            <div class="stagebar-row" v-for="(row, rIndex) in barRows" :key="rIndex">
              <span
                v-for="seg in row"
                :key="seg.key + '-' + rIndex"
                class="stagebar__seg"
                :style="{ width: seg.width, backgroundColor: seg.color, borderColor: seg.border || 'transparent' }"
                :aria-label="`${seg.key}: ${seg.count}`"
              />
            </div>
          </div>
        </div>
        <div class="settings" @click="toggleSettings">⚙ 设置</div>
        <div v-if="showSettings" class="settings__panel">
          <button @click="onReinitialize">重新初始化会话</button>
        </div>
      </div>
    </header>

    <main class="app__main">
      <Transition :name="directionClass">
        <div v-if="currentWord" :key="currentWord.id" :class="[{ 'fly-up': skipFly }, 'card-wrap']">
          <WordCard
            :word="currentWord"
            :index="currentIndexDisplay"
            :total="totalCountDisplay"
            :stage="currentStage"
            :force-deep="skipFly"
          />
        </div>
      </Transition>
      <div v-if="!currentWord" class="empty">暂无词条或会话已完成</div>
    </main>

    <footer class="app__footer">
      <p>提示：使用键盘左右方向键切换（左：上一个，右：下一个）。</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch } from 'vue'
import WordCard from './components/WordCard.vue'
import { useSessionStore } from './stores/session'
import { libraries, loadLibrary, type LibraryId } from '@/data/libraries'
import { speakWordWithExample, cancelSpeech, preloadWords } from '@/utils/speech'

const store = useSessionStore()
const libs = libraries
const selectedLib = computed({
  get: () => store.currentLibrary,
  set: async (v: any) => { await store.changeLibrary(v) },
})
// Track navigation direction for animation
const direction = ref<'forward' | 'back'>('forward')
const directionClass = computed(() => direction.value === 'forward' ? 'slide-left' : 'slide-right')
const showSettings = ref(false)
const toggleSettings = () => { showSettings.value = !showSettings.value }
const skipFly = ref(false)

onMounted(async () => {
  await store.initialize()
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      direction.value = 'forward'
      cancelSpeech()
      store.next()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      direction.value = 'back'
      store.prev()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const w = store.currentWord
      if (w) speakWordWithExample(w)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      skipFly.value = true
      setTimeout(async () => {
        await (store as any).skipCurrent()
        skipFly.value = false
        direction.value = 'forward'
        store.next()
      }, 480)
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault()
      cancelSpeech()
      const w = store.currentWord
      if (w) speakWordWithExample(w)
    }
  }
  window.addEventListener('keydown', handler)
  window.addEventListener('visibilitychange', store.onVisibilityChange)
  onUnmounted(() => {
    window.removeEventListener('keydown', handler)
    window.removeEventListener('visibilitychange', store.onVisibilityChange)
  })
})

const currentWord = computed(() => store.currentWord)
const currentIndexDisplay = computed(() => store.uiIndex)
const totalCountDisplay = computed(() => store.totalWords)
const currentStage = computed(() => {
  const w = store.currentWord
  if (!w) return 'new'
  // @ts-ignore - getStage exposed from store
  return (store as any).getStage(w.id)
})
const visibleMinutes = computed(() => (store.visibleElapsedSec / 60).toFixed(1))
const reviewQueueCount = computed(() => store.reviewQueue.length)
const dueNowCount = computed(() => store.dueNow.length)
const newQueueCount = computed(() => store.newQueue.length)

// 多行柱形图与星星
const stageCounts = computed(() => (store as any).stageCounts as { new: number; seen: number; block: number; session: number; due2d: number })
const MAX_BAR = 500
const colors = { new: '#ffffff', seen: '#fff7e6', block: '#e6fffb', session: '#e8f8e6', due2d: '#c6efc6' }
const starsCount = computed(() => Math.floor((((store as any).completed2dCount || 0)) / 500))
const buildRows = (counts: { new: number; seen: number; block: number; session: number; due2d: number }) => {
  let remaining = { ...counts }
  const rows: Array<Array<{ key: string; count: number; width: string; color: string; border?: string }>> = []
  // 全局转换：每颗星代表已完成 2d 的 500 个词，从 due2d 总量中按 500 为单位扣减
  const convertible = Math.min(starsCount.value, Math.floor(remaining.due2d / MAX_BAR))
  if (convertible > 0) remaining.due2d -= convertible * MAX_BAR
  const toWidth = (n: number) => `${(n / MAX_BAR * 100).toFixed(2)}%`
  while (remaining.new + remaining.block + remaining.session + remaining.due2d > 0) {
    let cap = MAX_BAR
    const row: Array<{ key: string; count: number; width: string; color: string; border?: string }> = []
    const takeDue = Math.min(remaining.due2d, cap)
    if (takeDue > 0) { row.push({ key: 'due2d', count: takeDue, width: toWidth(takeDue), color: colors.due2d }); remaining.due2d -= takeDue; cap -= takeDue }
    const takeSes = Math.min(remaining.session, cap)
    if (takeSes > 0) { row.push({ key: 'session', count: takeSes, width: toWidth(takeSes), color: colors.session }); remaining.session -= takeSes; cap -= takeSes }
    const takeBlk = Math.min(remaining.block, cap)
    if (takeBlk > 0) { row.push({ key: 'block', count: takeBlk, width: toWidth(takeBlk), color: colors.block }); remaining.block -= takeBlk; cap -= takeBlk }
    const takeSeen = Math.min(remaining.seen, cap)
    if (takeSeen > 0) { row.push({ key: 'seen', count: takeSeen, width: toWidth(takeSeen), color: colors.seen }); remaining.seen -= takeSeen; cap -= takeSeen }
    const takeNew = Math.min(remaining.new, cap)
    if (takeNew > 0) { row.push({ key: 'new', count: takeNew, width: toWidth(takeNew), color: colors.new, border: '#d1d5db' }); remaining.new -= takeNew; cap -= takeNew }
    if (row.length === 0) break
    rows.push(row)
  }
  if (rows.length === 0) rows.push([])
  return rows
}
const barRows = computed(() => buildRows(stageCounts.value))
const stageBarTitle = computed(() => {
  const c = stageCounts.value
  return `单行上限500 | 2天:${c.due2d} | 30分:${c.session} | 5分:${c.block} | 已见:${c.seen} | 新:${c.new}`
})
const starsTitle = computed(() => `2天复习完成数:${(store as any).completed2dCount || 0} | 每完成500出现一颗星`)

// 词库计数（在下拉中显示）
const libCounts = ref<Record<string, number>>({})
function libCountLabel(id: string) { return libCounts.value[id] ?? (id === store.currentLibrary ? store.totalWords : '') }
onMounted(async () => {
  const ids = libs.map(l => l.id as LibraryId)
  await Promise.all(ids.map(async id => {
    try {
      if (id === store.currentLibrary) { libCounts.value[id] = store.totalWords; return }
      const ws = await loadLibrary(id)
      libCounts.value[id] = ws.length
    } catch {}
  }))
})

// 自动播放：仅在前进 (next) 导航后新词出现时播放；切换词库也执行
watch(currentWord, (w, prev) => {
  if (!w) return
  if (direction.value === 'forward' || prev == null) {
    // 若有前一个发音未完成，speech util 内部会取消
    speakWordWithExample(w)
  }
  // 预加载附近词语的发音（提高流畅度）
  const upcoming = store.upcomingWords(3)
  preloadWords(upcoming)
})
// 切换库时取消当前发音
watch(selectedLib, () => { cancelSpeech() })

async function onReinitialize() {
  cancelSpeech()
  await store.reinitialize()
  showSettings.value = false
}

</script>

<style scoped>
.app {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 16px 40px;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
}
.app__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.brand { display:flex; align-items:center; gap:10px; }
.status {
  color: #555;
  font-size: 14px;
  display: flex;
  gap: 12px;
}
.stagebar-wrap { display:flex; flex-direction:column; gap:4px; align-items:flex-start; }
.stagebar__stars { height: 14px; line-height: 14px; color:#2e7d32; text-shadow:0 0 1px #a7f3d0; }
.stagebar-multi { display:flex; flex-direction:column; gap:4px; }
.stagebar-row { display:flex; align-items:center; height: 10px; width: 220px; border:1px solid #e5e7eb; border-radius:6px; overflow:hidden; background:#fff; }
.stagebar__seg { height: 100%; border-right: 1px solid transparent; }
.settings { cursor:pointer; user-select:none; padding: 2px 6px; border:1px solid #e5e7eb; border-radius:6px; }
.settings__panel { position: absolute; right: 16px; top: 56px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:8px; box-shadow:0 4px 16px rgb(0 0 0 / 12%); display:flex; flex-direction:column; gap:8px; }
.library-select {
  padding: 4px 6px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 14px;
}
.app__main {
  margin-top: 16px;
}
.card-wrap { will-change: transform, opacity; }
.empty {
  color: #666;
  text-align: center;
  padding: 36px 0;
}
.app__footer {
  margin-top: 16px;
  color: #777;
  font-size: 13px;
}

/* Transition animations */
/* 更柔和的滑动 + 透明渐变动画 */
.slide-left-enter-active, .slide-left-leave-active,
.slide-right-enter-active, .slide-right-leave-active {
  transition: transform .4s cubic-bezier(.23,.82,.28,1), opacity .4s ease;
}
.slide-left-enter-from { opacity:0; transform: translateX(40px) scale(.98); }
.slide-left-leave-to { opacity:0; transform: translateX(-40px) scale(.98); }
.slide-right-enter-from { opacity:0; transform: translateX(-40px) scale(.98); }
.slide-right-leave-to { opacity:0; transform: translateX(40px) scale(.98); }
</style>
