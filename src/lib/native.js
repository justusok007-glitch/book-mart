// Only runs inside the Android app (Capacitor). On the web it does nothing.
export async function setupNative() {
  if (!window.Capacitor?.isNativePlatform?.()) return
  const { App } = await import('@capacitor/app')
  // phone Back button: go back a screen, or close the app from the Home screen
  App.addListener('backButton', ({ canGoBack }) => {
    const home = !location.hash || location.hash === '#/' || location.hash === '#'
    if (canGoBack && !home) window.history.back()
    else App.exitApp()
  })
}
