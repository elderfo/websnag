'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface BulkActionsProps {
  selectedCount: number
  onDelete: () => Promise<void>
  onExport: () => void
  onSelectAll: () => void
  onClearSelection: () => void
  allSelected: boolean
}

export function BulkActions({
  selectedCount,
  onDelete,
  onExport,
  onSelectAll,
  onClearSelection,
  allSelected,
}: BulkActionsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await onDelete()
      onClearSelection()
    } catch {
      setError('Failed to delete requests. Please try again.')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (selectedCount === 0) return null

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2">
        <span className="text-xs font-medium text-text-secondary">{selectedCount} selected</span>

        <button
          type="button"
          onClick={allSelected ? onClearSelection : onSelectAll}
          className="text-xs text-accent hover:underline min-h-[44px] px-2"
        >
          {allSelected ? 'Clear selection' : 'Select all on page'}
        </button>

        <div className="ml-auto flex items-center gap-2">
          {error && <span className="text-xs text-red-400">{error}</span>}
          <Button variant="secondary" size="sm" onClick={onExport}>
            Export selected
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            Delete selected
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete requests"
        message={`Are you sure you want to delete ${selectedCount} request${selectedCount !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
