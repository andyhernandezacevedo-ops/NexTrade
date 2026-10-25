import { useEffect, useRef, useState } from 'react'

const SCRIPT_ID = 'tradingview-widget-script'

export default function TradingViewWidget({ symbol = 'NASDAQ:AAPL', interval = 'D', height = 360 }) {
  const containerRef = useRef(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true

    function mountWidget() {
      if (!active || !containerRef.current || !window.TradingView) return
      containerRef.current.replaceChildren()
      new window.TradingView.widget({
        autosize: true,
        symbol,
        interval,
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'es',
        enable_publishing: false,
        hide_top_toolbar: false,
        save_image: false,
        container_id: containerRef.current.id,
      })
    }

    let script = document.getElementById(SCRIPT_ID)
    if (window.TradingView) {
      mountWidget()
    } else {
      if (!script) {
        script = document.createElement('script')
        script.id = SCRIPT_ID
        script.src = 'https://s3.tradingview.com/tv.js'
        script.async = true
        script.onerror = () => active && setLoadError(true)
        document.head.appendChild(script)
      }
      script.addEventListener('load', mountWidget)
    }

    return () => {
      active = false
      script?.removeEventListener('load', mountWidget)
      containerRef.current?.replaceChildren()
    }
  }, [symbol, interval])

  return (
    <div className="relative overflow-hidden border border-line bg-panel" style={{ height }}>
      {loadError && (
        <div className="absolute inset-0 grid place-items-center px-5 text-center text-sm text-muted">
          No se pudo cargar el gráfico. Comprueba tu conexión e inténtalo de nuevo.
        </div>
      )}
      <div id={`tradingview-${symbol.replace(/[^a-z0-9]/gi, '-')}`} ref={containerRef} className="h-full w-full" />
    </div>
  )
}
