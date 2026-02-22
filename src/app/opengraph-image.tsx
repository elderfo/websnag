import { ImageResponse } from 'next/og'

export const alt = 'Websnag — AI-Powered Webhook Debugger'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0b',
        padding: '60px',
      }}
    >
      {/* Wordmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '24px' }}>
        <span
          style={{
            fontSize: '72px',
            fontWeight: 700,
            color: '#a0a0a0',
            letterSpacing: '-2px',
          }}
        >
          web
        </span>
        <span
          style={{
            fontSize: '72px',
            fontWeight: 700,
            color: '#00ff88',
            letterSpacing: '-2px',
          }}
        >
          snag
        </span>
      </div>

      {/* Tagline */}
      <p
        style={{
          fontSize: '28px',
          color: '#e0e0e0',
          margin: '0 0 48px 0',
        }}
      >
        See what your webhooks are really saying.
      </p>

      {/* Feature pills */}
      <div style={{ display: 'flex', gap: '16px' }}>
        {['Real-time capture', 'AI analysis', 'Replay requests'].map((label) => (
          <div
            key={label}
            style={{
              padding: '10px 24px',
              borderRadius: '9999px',
              border: '1px solid #1f1f23',
              backgroundColor: '#111113',
              color: '#a0a0a0',
              fontSize: '18px',
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>,
    { ...size }
  )
}
