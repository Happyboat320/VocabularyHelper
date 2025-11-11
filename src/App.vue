<template>
  <div class="app">
    <header class="app__header">
      <div class="brand">
        <h1>Vocabulary Helper</h1>
        <select v-model="selectedLib" class="library-select" title="选择词库">
          <option v-for="lib in libs" :key="lib.id" :value="lib.id">{{ lib.name }}</option>
        </select>
      </div>
      <div class="status">
        <span>可见时间：{{ visibleMinutes }} 分钟</span>
        <span>复习 {{ reviewQueueCount }} | 到期 {{ dueNowCount }} | 新词 {{ newQueueCount }}</span>
      </div>
    </header>

    <main class="app__main">
      <Transition :name="directionClass">
        <WordCard
          v-if="currentWord"
          :key="currentWord.id"
          :word="currentWord"
          :index="currentIndexDisplay"
          :total="totalCountDisplay"
        />
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
import { libraries } from '@/data/libraries'
import { speakWordWithExample, cancelSpeech } from '@/utils/speech'

const store = useSessionStore()
const libs = libraries
const selectedLib = computed({
  get: () => store.currentLibrary,
  set: async (v: any) => { await store.changeLibrary(v) },
})
// Track navigation direction for animation
const direction = ref<'forward' | 'back'>('forward')
const directionClass = computed(() => direction.value === 'forward' ? 'slide-left' : 'slide-right')

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
const visibleMinutes = computed(() => (store.visibleElapsedSec / 60).toFixed(1))
const reviewQueueCount = computed(() => store.reviewQueue.length)
const dueNowCount = computed(() => store.dueNow.length)
const newQueueCount = computed(() => store.newQueue.length)

// 自动播放：仅在前进 (next) 导航后新词出现时播放；切换词库也执行
watch(currentWord, (w, prev) => {
  if (!w) return
  if (direction.value === 'forward' || prev == null) {
    // 若有前一个发音未完成，speech util 内部会取消
    speakWordWithExample(w)
  }
})
// 切换库时取消当前发音
watch(selectedLib, () => { cancelSpeech() })

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
