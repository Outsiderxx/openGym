// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { decideBack, makeBackHandler, routeOf, HOME } from './back.js'

// Back on Android serves the sheet stack on top, then the page: any screen other than Home goes
// straight to Home, and Home sends the app to the background. It never walks the page history,
// which used to bring back every screen visited, one press at a time.
describe('routeOf', () => {
  it('reads the route out of a hash URL', () => {
    expect(routeOf('#/home')).toBe('/home')
    expect(routeOf('#/plan/r/1?x=1')).toBe('/plan/r/1')
    expect(routeOf('')).toBe('/')
    expect(routeOf(undefined)).toBe('/')
  })
})

describe('decideBack', () => {
  it('dismisses the top sheet before touching the page', () => {
    expect(decideBack({ top: { id: 's1' }, route: '/plan' })).toBe('sheet')
    expect(decideBack({ top: { id: 's1' }, route: HOME })).toBe('sheet')
  })

  it('lets a locked sheet swallow the press', () => {
    expect(decideBack({ top: { id: 's1', locked: true }, route: '/plan' })).toBe('ignore')
  })

  it('goes straight to Home from any other screen, however deep', () => {
    expect(decideBack({ top: undefined, route: '/plan' })).toBe('home')
    expect(decideBack({ top: undefined, route: '/plan/r/abc' })).toBe('home')
    expect(decideBack({ top: undefined, route: '/settings/backup' })).toBe('home')
    expect(decideBack({ top: undefined, route: '/workout' })).toBe('home')
    expect(decideBack({ top: undefined, route: '/' })).toBe('home')
  })

  it('minimizes the app on Home', () => {
    expect(decideBack({ top: undefined, route: HOME })).toBe('minimize')
  })
})

function harness(route = HOME) {
  const calls = { closed: [], home: 0, minimize: 0 }
  let sheets = []
  const handler = makeBackHandler({
    getSheets: () => sheets,
    closeSheet: id => { calls.closed.push(id); sheets = sheets.filter(s => s.id !== id) },
    getRoute: () => route,
    goHome: () => { calls.home++; route = HOME },
    minimize: () => { calls.minimize++ },
  })
  return { calls, handler, setSheets: s => { sheets = s } }
}

describe('makeBackHandler', () => {
  it('closes stacked sheets one press at a time', () => {
    const h = harness('/plan')
    h.setSheets([{ id: 'a' }, { id: 'b' }])
    expect(h.handler()).toBe('sheet')
    expect(h.handler()).toBe('sheet')
    expect(h.calls.closed).toEqual(['b', 'a'])
    expect(h.calls.home).toBe(0)
  })

  it('does not close a locked sheet, and does nothing else behind it', () => {
    const h = harness('/plan')
    h.setSheets([{ id: 'a', locked: true }])
    expect(h.handler()).toBe('ignore')
    expect(h.calls).toEqual({ closed: [], home: 0, minimize: 0 })
  })

  // The complaint this fixes: from a screen deep in the app, two presses are the way out.
  it('takes one press to Home and one more to the background', () => {
    const h = harness('/settings/backup')
    expect(h.handler()).toBe('home')
    expect(h.handler()).toBe('minimize')
    expect(h.calls.home).toBe(1)
    expect(h.calls.minimize).toBe(1)
  })

  it('minimizes on every press on Home, with no press-again step', () => {
    const h = harness(HOME)
    expect(h.handler()).toBe('minimize')
    expect(h.handler()).toBe('minimize')
    expect(h.calls.minimize).toBe(2)
  })
})
