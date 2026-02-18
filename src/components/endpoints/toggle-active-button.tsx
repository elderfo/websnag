'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface ToggleActiveButtonProps {
  endpointId: string
  isActive: boolean
}

export function ToggleActiveButton({ endpointId, isActive }: ToggleActiveButtonProps) {
  const router = useRouter()
  const [toggling, setToggling] = useState(false)

  async function handleToggle() {
    setToggling(true)
    try {
      const res = await fetch(`/api/endpoints/${endpointId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      })

      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error ?? 'Failed to update endpoint')
      }
    } catch {
      alert('Network error. Please try again.')
    } finally {
      setToggling(false)
    }
  }

  return (
    <Button variant="secondary" onClick={handleToggle} disabled={toggling}>
      {toggling ? 'Updating...' : isActive ? 'Pause Endpoint' : 'Activate Endpoint'}
    </Button>
  )
}
