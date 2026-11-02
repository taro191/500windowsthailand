// Server storage for Life Space (public/kap/life-space.html). The page reads and writes
// synchronously, so its data is loaded before it opens and saves go out in the background.
import { get, post, put } from './api'

export interface LifeSpaceStorage {
  get(): string | null
  set(data: string): void
  /** Sends the latest data now; false when the server didn't take it. */
  flush(): Promise<boolean>
  /** Deletes the server copy (consent withdrawn). */
  clear(): Promise<boolean>
  /** Sends a save that is still waiting, e.g. when the page closes. */
  settle(): void
}

const SAVE_DELAY = 1000

/** Loads the signed-in user's Life Space; null when the server can't be reached. */
export async function openLifeSpaceStorage(): Promise<LifeSpaceStorage | null> {
  const res = await get<{ data: string | null }>('/me/life-space')
  if (!res.success) return null
  let data = res.data
  let timer: ReturnType<typeof setTimeout> | undefined

  const push = async () => {
    clearTimeout(timer)
    timer = undefined
    if (data === null) return true
    return (await put('/me/life-space', { data })).success
  }

  return {
    get: () => data,
    set: (next) => {
      data = next
      clearTimeout(timer)
      timer = setTimeout(push, SAVE_DELAY)
    },
    flush: push,
    clear: async () => {
      clearTimeout(timer)
      timer = undefined
      return (await post('/me/life-space/delete')).success
    },
    settle: () => {
      if (timer) void push()
    },
  }
}
