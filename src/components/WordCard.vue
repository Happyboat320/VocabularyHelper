<template>
  <div class="card">
    <div class="card__head">
      <div class="card__title">
        <span class="term">{{ word.term }}</span>
        <span v-if="word.phonetic" class="phonetic">/{{ word.phonetic }}/</span>
      </div>
      <div class="card__meta">
        <span>{{ index }} / {{ total }}</span>
        <button class="speak" @click="speak()">🔊 发音</button>
      </div>
    </div>

    <div class="card__body">
      <p class="meaning">{{ word.meaning }}</p>
      <ul v-if="word.examples?.length" class="examples">
        <li v-for="(e, i) in word.examples" :key="i">{{ e }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Word } from '@/types'

const props = defineProps<{ word: Word; index: number; total: number }>()

const speak = () => {
  const text = `${props.word.term}. ${props.word.examples?.[0] ?? ''}`.trim()
  if ('speechSynthesis' in window && text) {
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'en-US'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  }
}
</script>

<style scoped>
.card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 18px 16px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 6%);
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
  font-size: 28px;
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
.examples {
  margin-top: 8px;
  color: #374151;
}
</style>
