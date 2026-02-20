'use client'

import { useState, useEffect } from 'react'
import type { RequestFilters } from '@/types'

interface FilterBarProps {
  filters: RequestFilters
  onFiltersChange: (filters: RequestFilters) => void
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  const [searchInput, setSearchInput] = useState(filters.search ?? '')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (filters.search ?? '')) {
        onFiltersChange({ ...filters, search: searchInput || undefined })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, filters, onFiltersChange])

  const hasActiveFilters = filters.method || filters.search || filters.dateFrom || filters.dateTo

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      {/* Method filter */}
      <select
        value={filters.method ?? ''}
        onChange={(e) =>
          onFiltersChange({ ...filters, method: e.target.value || undefined })
        }
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-text-primary"
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
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-text-primary"
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
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-text-primary"
        aria-label="To date"
        placeholder="To"
      />

      {/* Search */}
      <input
        type="text"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search body content..."
        className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-1.5 text-sm text-text-primary placeholder-text-muted"
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
          className="text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
