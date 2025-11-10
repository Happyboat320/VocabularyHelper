<template>
  <div class="app">
    <header class="app__header">
      <h1>Vocabulary Helper</h1>
      <div class="status">
        <span>会话可见时间：{{ visibleMinutes }} 分钟</span>
        <span>队列：复习 {{ reviewQueueCount }} | 待办 {{ dueNowCount }} | 新词 {{ newQueueCount }}</span>
      </div>
    </header>

    <main class="app__main">
      <WordCard
        v-if="currentWord"
        :word="currentWord"
        :index="currentIndexDisplay"
        :total="totalCountDisplay"
      />

      <div v-else class="empty">暂无词条或会话已完成</div>
    </main>

    <footer class="app__footer">
      <p>提示：使用键盘左右方向键切换（左：上一个，右：下一个）。</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import WordCard from './components/WordCard.vue'
import { useSessionStore } from './stores/session'

const store = useSessionStore()

onMounted(async () => {
  await store.initialize()
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      store.next()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
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
const totalCountDisplay = computed(() => store.uiTotal)
const visibleMinutes = computed(() => (store.visibleElapsedSec / 60).toFixed(1))
const reviewQueueCount = computed(() => store.reviewQueue.length)
const dueNowCount = computed(() => store.dueNow.length)
const newQueueCount = computed(() => store.newQueue.length)
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
.status {
  color: #555;
  font-size: 14px;
  display: flex;
  gap: 12px;
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
</style>
