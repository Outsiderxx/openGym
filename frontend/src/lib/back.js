// Android system back (the gesture and the hardware/nav button are the same event).
//
// Capacitor's BridgeActivity does not handle back at all — without a JS listener the
// activity simply finishes, so a back swipe quit the app from anywhere, whatever the
// WebView history said. That made the sheet history entries from #63 dead weight in the
// packaged app: they only ever worked in a browser tab, where the browser walks history
// itself.
//
// Once a `backButton` listener exists, the plugin stops falling through to finish().
//
// Back used to walk the WebView history, which meant every tab switch and every page ever
// opened came back one press at a time: after a while in the app, getting out took a long
// string of presses through screens already left behind. It now works the way Android apps
// with a bottom bar do: a sheet closes first, any other screen goes straight to Home, and
// back on Home sends the app to the background (minimize, not exit, so a running workout
// and its rest timer are where they were when the app comes back).
import { MOBILE } from './mobile.js'
import { useUI } from '../store/useUI.js'
import { nav } from './nav.js'

export const HOME = '/home'

// The route a hash URL points at: "#/plan/r/1?x=1" -> "/plan/r/1".
export function routeOf(hash) {
  const path = String(hash || '').replace(/^#/, '').split(/[?#]/)[0]
  return path || '/'
}

// What a back press means, given what is on screen. Pure, so the table below is testable.
export function decideBack({ top, route }) {
  if (top) return top.locked ? 'ignore' : 'sheet'   // a locked sheet swallows back on purpose
  return route === HOME ? 'minimize' : 'home'
}

export function makeBackHandler({ getSheets, closeSheet, getRoute, goHome, minimize }) {
  return () => {
    const sheets = getSheets()
    const action = decideBack({ top: sheets[sheets.length - 1], route: getRoute() })
    if (action === 'sheet') closeSheet(sheets[sheets.length - 1].id)
    else if (action === 'home') goHome()
    else if (action === 'minimize') minimize()
    return action
  }
}

// Registers the listener for the native shell. No-op in web builds, where the browser
// (or the PWA shell) walks history on its own and there is no plugin to talk to.
export async function initBackButton() {
  if (!MOBILE) return () => {}
  try {
    const { App } = await import('@capacitor/app')
    const handler = makeBackHandler({
      getSheets: () => useUI.getState().sheets,
      closeSheet: id => useUI.getState().closeSheet(id),
      getRoute: () => routeOf(window.location.hash),
      // Replace, so the history under Home does not keep growing with every press.
      goHome: () => nav(HOME, { replace: true }),
      minimize: () => App.minimizeApp(),
    })
    const sub = await App.addListener('backButton', handler)
    return () => sub.remove()
  } catch (e) {
    return () => {}   // no plugin (older install): leave back to the default behaviour
  }
}
