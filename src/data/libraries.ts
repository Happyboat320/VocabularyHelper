import type { Word } from '@/types'

export type LibraryId = 'ielts' | 'ielts_vocabulary' | 'example'

// Statically resolve asset URLs, then fetch at runtime to avoid bundling huge JSON directly into JS
import ieltsUrl from '@/data/ielts.json?url'
import ieltsVocabularyUrl from '@/data/ielts_vocabulary.json?url'
import exampleUrl from '@/data/vocab.example_1.json?url'

export type LibraryMeta = { id: LibraryId; name: string; url: string }

export const libraries: LibraryMeta[] = [
  { id: 'ielts', name: 'IELTS 词库 (ielts.json)', url: ieltsUrl },
  { id: 'ielts_vocabulary', name: 'IELTS 扩展 (ielts_vocabulary.json)', url: ieltsVocabularyUrl },
  { id: 'example', name: '示例小词库 (vocab.example_1.json)', url: exampleUrl },
]

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`加载词库失败: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

function normalizeText(input: any): string {
  const s = String(input ?? '')
  // Normalize Windows/Mac line breaks and turn literal "\n" into real newlines
  return s.replace(/\r\n?/g, '\n').replace(/\\n/g, '\n')
}

// Map IELTS-shaped entries to internal Word type
function mapIelts(entries: any[]): Word[] {
  return entries.map((e, i) => {
    const term = normalizeText(e.word ?? e.term).trim()
    const phonetic = (e.phonetic ? normalizeText(e.phonetic).trim() : undefined) || undefined
    const translation = normalizeText(e.translation).trim()
    const definition = normalizeText(e.definition).trim()
    const example = normalizeText(e.example).trim()
    const meaning = translation || definition || ''
    const examples = example ? example.split('\n').map((s: string) => s.trim()).filter(Boolean) : undefined
    const id = `${term || 'w'}#${i}`
    const word: Word = { id, term: term || `word_${i}`, phonetic, meaning, examples }
    return word
  })
}

// Map our example array (already in Word shape)
function mapExample(entries: any[]): Word[] {
  return entries.map((e, i) => {
    const id = String(e.id ?? `${e.term ?? 'w'}#${i}`)
    const term = normalizeText(e.term).trim()
    const meaning = normalizeText(e.meaning).trim()
    const phonetic = e.phonetic ? normalizeText(e.phonetic).trim() : undefined
  const ex: any[] = Array.isArray(e.examples) ? e.examples : []
  const examples = ex.map((x: any) => normalizeText(x).trim()).filter(Boolean)
    return { id, term, meaning, phonetic, examples }
  })
}

export async function loadLibrary(id: LibraryId): Promise<Word[]> {
  switch (id) {
    case 'ielts': {
      const raw = await fetchJson<any[]>(libraries.find(l => l.id === 'ielts')!.url)
      return mapIelts(raw)
    }
    case 'ielts_vocabulary': {
      const raw = await fetchJson<any[]>(libraries.find(l => l.id === 'ielts_vocabulary')!.url)
      return mapIelts(raw)
    }
    case 'example': {
      const raw = await fetchJson<any[]>(libraries.find(l => l.id === 'example')!.url)
      return mapExample(raw)
    }
    default:
      return []
  }
}
