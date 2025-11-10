export const now = () => Date.now()
export const seconds = (ms: number) => Math.floor(ms / 1000)
export const minutes = (ms: number) => Math.floor(ms / 60000)
export const addDays = (ms: number, days: number) => ms + days * 24 * 60 * 60 * 1000
