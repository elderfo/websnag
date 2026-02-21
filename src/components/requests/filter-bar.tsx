'use client'

import { useState, useEffect, useRef } from 'react'
import type { RequestFilters } from '@/types'

interface FilterBarProps {
  filters: RequestFilters
  onFiltersChange: (filters: RequestFilters) => void
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  const [searchInput, setSearchInput] = useState(filters.search ?? '')
  // Store latest callback ref to avoid re-triggering the debounce effect when
  // the parent re-renders and passes a new function reference.
  const onFiltersChangeRef = useRef(onFiltersChange)
  useEffect(() => {
    onFiltersChangeRef.current = onFiltersChange
  })

  // Debounce search input — depends only on searchInput and the stable filters
  // values so that a new onFiltersChange reference does not cause an infinite loop.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (filters.search ?? '')) {
        onFiltersChangeRef.current({ ...filters, search: searchInput || undefined })
      }
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, filters.method, filters.dateFrom, filters.dateTo, filters.search])

  const hasActiveFilters = filters.method || filters.search || filters.dateFrom || filters.dateTo

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      {/* Method filter */}
      <select
        value={filters.method ?? ''}
        onChange={(e) => onFiltersChange({ ...filters, method: e.target.value || undefined })}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-text-primary min-h-[44px]"
        aria-label="Filter by method"
      >
        <option value="">All methods</option>
        {HTTP_METHODS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      {/* Date from */}
      <input
        type="datetime-local"
        value={filters.dateFrom?.slice(0, 16) ?? ''}
        onChange={(e) =>
          onFiltersChange({
            ...filters,
            dateFrom: e.target.value ? new Date(e.target.value).toISOString() : undefined,
          })
        }
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-text-primary min-h-[44px]"
        aria-label="From date"
        placeholder="From"
      />

      {/* Date to */}
      <input
        type="datetime-local"
        value={filters.dateTo?.slice(0, 16) ?? ''}
        onChange={(e) =>
          onFiltersChange({
            ...filters,
            dateTo: e.target.value ? new Date(e.target.value).toISOString() : undefined,
          })
        }
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-text-primary min-h-[44px]"
        aria-label="To date"
        placeholder="To"
      />

      {/* Search */}
      <input
        type="text"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search body content..."
        className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-1.5 text-sm text-text-primary placeholder-text-muted min-h-[44px]"
        aria-label="Search requests"
      />

      {/* Clear button */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => {
            setSearchInput('')
            onFiltersChange({})
          }}
          className="text-xs text-text-muted hover:text-text-primary transition-colors min-h-[44px] px-2"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
