<template>
  <div class="card" :style="cardStyle">
    <div class="card__head">
      <div class="card__title">
        <span class="term">{{ word.term }}</span>
        <span v-if="word.phonetic" class="phonetic">/{{ word.phonetic }}/</span>
      </div>
      <div class="card__meta">
        <button class="speak" @click="speak()">🔊 发音</button>
      </div>
    </div>

    <div class="card__body">
      <div class="meaning">
        <template v-for="(line, i) in meaningLines" :key="i">
          <p class="meaning__line">{{ line }}</p>
        </template>
      </div>
      <ul v-if="word.examples?.length" class="examples">
        <li v-for="(e, i) in word.examples" :key="i">{{ e }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Word } from '@/types'
import { computed } from 'vue'

type Stage = 'new' | 'seen' | 'block' | 'session' | 'due2d'
const props = defineProps<{ word: Word; index: number; total: number; stage?: Stage; forceDeep?: boolean }>()

import { speakWordWithExample } from '@/utils/speech'

const speak = () => {
  speakWordWithExample(props.word)
}

// Split meaning by newline into clean lines
const meaningLines = computed(() => String(props.word.meaning || '')
  .split('\n')
  .map(s => s.trim())
  .filter(Boolean))

// Background color based on stage; forceDeep overrides to deepest green
const cardStyle = computed(() => {
  if (props.forceDeep) return { backgroundColor: '#2e7d32' }
  const stage = props.stage ?? 'new'
  const map: Record<Stage, string> = {
    new: '#ffffff',
    seen: '#fff7e6', // beige for seen-but-not-in-5min
    block: '#e6fffb',   // light cyan
    session: '#e8f8e6', // light green
    due2d: '#c6efc6',   // deeper green
  }
  return { backgroundColor: map[stage] }
})
</script>

<style scoped>
.card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 22px 18px;
  box-shadow: 0 2px 10px rgb(0 0 0 / 8%);
}
.fly-up {
  animation: flyUp .45s ease forwards;
}
@keyframes flyUp {
  0% { transform: translateY(0); opacity: 1; }
  60% { transform: translateY(-40px); opacity: .9; }
  100% { transform: translateY(-80px); opacity: 0; }
}
.card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.card__title {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.term {
  font-size: 30px;
  font-weight: 700;
}
.phonetic {
  color: #6b7280;
}
.card__meta {
  display: flex;
  gap: 10px;
  align-items: center;
}
.speak {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.meaning {
  margin-top: 8px;
  font-size: 18px;
}
.meaning__line { margin: 4px 0; line-height: 1.6; }
.examples {
  margin-top: 8px;
  color: #374151;
}
</style>
