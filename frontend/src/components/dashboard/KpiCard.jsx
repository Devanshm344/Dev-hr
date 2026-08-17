import React, { useEffect, useId, useRef, useState, memo } from 'react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import clsx from 'clsx'
import { CHART_THEMES } from '../../theme/charts'

function useCountUp(target, duration = 1200) {
  const [count, setCount] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    if (typeof target !== 'number') return
    const start = prev.current
    const diff = target - start
    if (diff === 0) return
    const t0 = performance.now()
    const tick = now => {
      const p = Math.min((now - t0) / duration, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setCount(Math.round(start + diff * e))
      if (p < 1) requestAnimationFrame(tick)
      else prev.current = target
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return count
}

export const KPI_THEMES = CHART_THEMES

const TREND_STYLES = {
  up:      { icon: TrendingUp,  cls: 'text-emerald-600 bg-emerald-50' },
  down:    { icon: TrendingDown, cls: 'text-red-600 bg-red-50' },
  neutral: { icon: Minus,       cls: 'text-gray-500 bg-gray-50' },
}

// Shared dimensions — kept in one place so the skeleton and the loaded
// card can never drift apart and cause layout shift.
const CARD_CLS = 'rounded-2xl bg-white border border-gray-100 p-3.5 shadow-sm'
const ICON_BOX_CLS = 'w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-lg'
const SPARKLINE_CLS = 'h-7 mt-2'

function KpiCardSkeleton() {
  return (
    <div className={clsx(CARD_CLS, 'animate-pulse')} aria-busy="true" aria-label="Loading metric">
      <div className={clsx(ICON_BOX_CLS, 'bg-gray-100 mb-3')} />
      <div className="h-2.5 w-20 bg-gray-100 rounded mb-2" />
      <div className="h-6 w-12 bg-gray-100 rounded mb-1.5" />
      <div className="h-2.5 w-24 bg-gray-100 rounded mb-3" />
      <div className={clsx(SPARKLINE_CLS, 'w-full bg-gray-50 rounded')} />
    </div>
  )
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'primary',
  trendDelta,
  trendLabel,
  sparkline = [],
  loading = false,
  error = null,
  onClick,
  delay = 0,
}) {
  const gradientId = useId()
  const theme = KPI_THEMES[color] || KPI_THEMES.primary
  const displayed = useCountUp(typeof value === 'number' ? value : null)

  if (loading) return <KpiCardSkeleton />

  const direction = typeof trendDelta !== 'number' ? null
    : trendDelta > 0 ? 'up' : trendDelta < 0 ? 'down' : 'neutral'
  const TrendStyle = direction ? TREND_STYLES[direction] : null

  const chartData = (sparkline || []).map((v, i) => ({ i, v }))
  const hasSparkline = chartData.length > 1

  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={clsx(
        CARD_CLS,
        'w-full text-left',
        'hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 animate-fade-up',
        onClick && 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-400',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={clsx(ICON_BOX_CLS, 'flex items-center justify-center')}
        style={{ background: theme.iconBg }}
      >
        {typeof Icon === 'string' ? (
          <img src={Icon} alt="" className="w-full h-full object-cover rounded-lg" />
        ) : (
          Icon && <Icon size={16} style={{ color: theme.icon }} aria-hidden="true" />
        )}
      </div>

      <p className="text-xs sm:text-sm lg:text-base font-semibold text-gray-500 mt-2.5 truncate">{title}</p>

      {error ? (
        <p className="text-xs sm:text-sm lg:text-base text-red-500 mt-0.5">{error}</p>
      ) : (
        <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tabular-nums leading-none mt-0.5">
          {typeof value === 'number' ? displayed.toLocaleString('en-IN') : (value ?? '—')}
        </p>
      )}
      {subtitle && !error && <p className="text-dense sm:text-xs lg:text-sm text-gray-400 mt-0.5 truncate">{subtitle}</p>}

      {TrendStyle && (
        <div className={clsx('inline-flex items-center gap-0.5 text-dense-tight font-semibold px-1.5 py-0.5 rounded-full mt-1.5', TrendStyle.cls)}>
          <TrendStyle.icon size={10} aria-hidden="true" />
          <span>{trendDelta > 0 ? '+' : ''}{trendDelta}{trendLabel ? ` ${trendLabel}` : ''}</span>
        </div>
      )}

      <div className={clsx(SPARKLINE_CLS, '-mx-1')}>
        {hasSparkline ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.line} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={theme.line} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={theme.line}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                isAnimationActive
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full rounded bg-gray-50" />
        )}
      </div>
    </Wrapper>
  )
}

export default memo(KpiCard)
