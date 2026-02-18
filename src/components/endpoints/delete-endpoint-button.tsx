'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface DeleteEndpointButtonProps {
  endpointId: string
  endpointName: string
}

export function DeleteEndpointButton({ endpointId, endpointName }: DeleteEndpointButtonProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${endpointName}"? This action cannot be undone.`
    )

    if (!confirmed) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/endpoints/${endpointId}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        const data = await res.json()
        alert(data.error ?? 'Failed to delete endpoint')
        setDeleting(false)
      }
    } catch {
      alert('Network error. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
      {deleting ? 'Deleting...' : 'Delete Endpoint'}
    </Button>
  )
}
