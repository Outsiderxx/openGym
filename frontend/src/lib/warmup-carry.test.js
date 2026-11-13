import { describe, expect, it } from 'vitest'
import { buildPlannedEntry } from './session-start.js'
import { lastWarmupsFor } from './history.js'

// Warm-ups are personal (an empty bar for twelve, then a mid weight for eight), so a planned
// session opens them at what was done in them last time instead of re-deriving the ramp.
const logged = (warm, work, extra = {}) => ({
  d: '2026-11-13',
  entries: [{
    id: 'squat',
    target: { id: 'squat', sets: work.length, reps: 6, weight: 90 },
    sets: [
      ...warm.map(([w, r]) => ({ w, r, done: true, phase: 'warmup', warmup: true })),
      ...work.map(([w, r]) => ({ w, r, done: true })),
    ],
    ...extra,
  }],
})
const state = workouts => ({ workouts, exWeights: {}, routines: [], unit: 'kg' })
const cfg = { id: 'squat', sets: 4, reps: 6, weight: 90, warmupSets: 3 }
const routine = { id: 'legs', ex: [cfg] }
const warmOf = entry => entry.sets.filter(s => s.phase === 'warmup').map(s => [s.w, s.r])

describe('planned warm-ups carry over from last time', () => {
  it('opens each warm-up at the weight and reps logged in it last session', () => {
    const S = state([logged([[20, 12], [60, 8], [90, 2]], [[90, 6], [90, 6], [90, 6], [90, 6]])])
    const entry = buildPlannedEntry(S, cfg, routine)
    expect(warmOf(entry)).toEqual([[20, 12], [60, 8], [90, 2]])
    expect(entry.sets.every(s => !s.done)).toBe(true)
  })

  it('keeps the computed ramp for a warm-up that has no logged counterpart', () => {
    const S = state([logged([[20, 12]], [[90, 6], [90, 6], [90, 6], [90, 6]])])
    const w = warmOf(buildPlannedEntry(S, cfg, routine))
    expect(w[0]).toEqual([20, 12])
    expect(w).toHaveLength(3)
    for (const [kg] of w) expect(kg).toBeLessThanOrEqual(90)
  })

  it('never opens a warm-up above today’s first work set', () => {
    const S = state([logged([[20, 12], [100, 2]], [[90, 6], [90, 6], [90, 6], [90, 6]])])
    const w = warmOf(buildPlannedEntry(S, { ...cfg, warmupSets: 2 }, routine))
    expect(w[0]).toEqual([20, 12])
    expect(w[1][0]).toBeLessThanOrEqual(90)
  })

  it('without logged warm-ups the ramp is unchanged', () => {
    const S = state([logged([], [[90, 6], [90, 6], [90, 6], [90, 6]])])
    const before = buildPlannedEntry(state([]), cfg, routine)
    expect(warmOf(buildPlannedEntry(S, cfg, routine)).length).toBe(warmOf(before).length)
    expect(lastWarmupsFor(S, 'squat', 'legs')).toEqual([])
  })

  it('a routine kept out of progression keeps its computed ramp', () => {
    const S = state([logged([[20, 12], [60, 8], [90, 2]], [[90, 6], [90, 6], [90, 6], [90, 6]])])
    const w = warmOf(buildPlannedEntry(S, cfg, { ...routine, excludeFromProgression: true }, { noProg: true }))
    expect(w).not.toEqual([[20, 12], [60, 8], [90, 2]])
  })
})
