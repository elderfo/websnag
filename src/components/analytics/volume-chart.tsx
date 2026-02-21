'use client'

import { useState } from 'react'
import type { VolumeByDay } from '@/types'

interface VolumeChartProps {
  data: VolumeByDay[]
}

const CHART_HEIGHT = 200
const BAR_GAP = 2
const LABEL_HEIGHT = 20
const Y_AXIS_WIDTH = 40
const TOOLTIP_OFFSET = 10

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function VolumeChart({ data }: VolumeChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-border bg-surface">
        <p className="text-sm text-text-muted">No request data for this period</p>
      </div>
    )
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const totalRequests = data.reduce((sum, d) => sum + d.count, 0)

  // Y-axis tick marks (4 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((maxCount / 4) * i))

  const chartWidth = 600
  const plotWidth = chartWidth - Y_AXIS_WIDTH
  const barWidth = Math.max((plotWidth - BAR_GAP * data.length) / data.length, 1)

  // Determine which date labels to show to avoid overlap
  const maxLabels = Math.floor(plotWidth / 50)
  const labelInterval = Math.max(1, Math.ceil(data.length / maxLabels))

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-text-primary">Request Volume</h3>
        <p className="font-mono text-xs text-text-muted">
          {totalRequests.toLocaleString()} total requests
        </p>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT + LABEL_HEIGHT + 10}`}
          className="w-full"
          style={{ minWidth: Math.max(300, data.length * 8) }}
          role="img"
          aria-label={`Bar chart showing request volume over ${data.length} days. Total: ${totalRequests} requests.`}
        >
          {/* Y-axis grid lines and labels */}
          {yTicks.map((tick, tickIndex) => {
            const y = CHART_HEIGHT - (tick / maxCount) * CHART_HEIGHT
            return (
              <g key={`tick-${tickIndex}`}>
                <line
                  x1={Y_AXIS_WIDTH}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="currentColor"
                  className="text-border"
                  strokeWidth="0.5"
                  strokeDasharray="4 4"
                />
                <text
                  x={Y_AXIS_WIDTH - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-text-muted"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {tick}
                </text>
              </g>
            )
          })}

          {/* Bars */}
          {data.map((d, i) => {
            const barHeight = maxCount > 0 ? (d.count / maxCount) * CHART_HEIGHT : 0
            const x = Y_AXIS_WIDTH + i * (barWidth + BAR_GAP)
            const y = CHART_HEIGHT - barHeight
            const isHovered = hoveredIndex === i

            return (
              <g
                key={d.date}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                role="graphics-symbol"
                aria-label={`${formatDateLabel(d.date)}: ${d.count} requests`}
              >
                {/* Invisible hit area for hover */}
                <rect x={x} y={0} width={barWidth} height={CHART_HEIGHT} fill="transparent" />

                {/* Visible bar */}
                <rect
                  x={x}
                  y={d.count > 0 ? y : CHART_HEIGHT - 1}
                  width={barWidth}
                  height={d.count > 0 ? barHeight : 1}
                  rx={Math.min(barWidth / 4, 2)}
                  className={isHovered ? 'fill-accent-hover' : 'fill-accent'}
                  opacity={isHovered ? 1 : 0.8}
                  style={{ transition: 'opacity 0.15s' }}
                />

                {/* Tooltip on hover */}
                {isHovered && (
                  <g>
                    <rect
                      x={Math.min(x + barWidth / 2 - 45, chartWidth - 96)}
                      y={Math.max(y - 32 - TOOLTIP_OFFSET, 0)}
                      width="90"
                      height="28"
                      rx="4"
                      className="fill-surface"
                      stroke="currentColor"
                      strokeWidth="0.5"
                    />
                    <text
                      x={Math.min(x + barWidth / 2, chartWidth - 51)}
                      y={Math.max(y - 32 - TOOLTIP_OFFSET, 0) + 12}
                      textAnchor="middle"
                      className="fill-text-muted"
                      fontSize="8"
                    >
                      {formatDateLabel(d.date)}
                    </text>
                    <text
                      x={Math.min(x + barWidth / 2, chartWidth - 51)}
                      y={Math.max(y - 32 - TOOLTIP_OFFSET, 0) + 23}
                      textAnchor="middle"
                      className="fill-text-primary"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {d.count.toLocaleString()}
                    </text>
                  </g>
                )}
              </g>
            )
          })}

          {/* X-axis date labels */}
          {data.map((d, i) => {
            if (i % labelInterval !== 0 && i !== data.length - 1) return null
            const x = Y_AXIS_WIDTH + i * (barWidth + BAR_GAP) + barWidth / 2
            return (
              <text
                key={d.date}
                x={x}
                y={CHART_HEIGHT + LABEL_HEIGHT}
                textAnchor="middle"
                className="fill-text-muted"
                fontSize="8"
              >
                {formatDateLabel(d.date)}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
