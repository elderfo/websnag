import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CodeSnippet } from './code-snippet'

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
})

const nodeCode = `app.post('/webhook', (req, res) => {
  const event = req.body;
  console.log(event.type);
  res.sendStatus(200);
});`

const pythonCode = `@app.route('/webhook', methods=['POST'])
def webhook():
    event = request.get_json()
    print(event['type'])
    return '', 200`

describe('CodeSnippet', () => {
  it('renders Node.js code by default', () => {
    render(<CodeSnippet handlerNode={nodeCode} handlerPython={pythonCode} />)
    expect(screen.getByText(/app\.post/)).toBeInTheDocument()
  })

  it('renders both language tabs', () => {
    render(<CodeSnippet handlerNode={nodeCode} handlerPython={pythonCode} />)
    expect(screen.getByRole('tab', { name: 'Node.js' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Python' })).toBeInTheDocument()
  })

  it('switches to Python on tab click', async () => {
    const user = userEvent.setup()
    render(<CodeSnippet handlerNode={nodeCode} handlerPython={pythonCode} />)

    await user.click(screen.getByRole('tab', { name: 'Python' }))
    expect(screen.getByText(/@app\.route/)).toBeInTheDocument()
  })

  it('shows Node.js tab as selected by default', () => {
    render(<CodeSnippet handlerNode={nodeCode} handlerPython={pythonCode} />)
    const nodeTab = screen.getByRole('tab', { name: 'Node.js' })
    expect(nodeTab.getAttribute('aria-selected')).toBe('true')
  })

  it('renders copy button', () => {
    render(<CodeSnippet handlerNode={nodeCode} handlerPython={pythonCode} />)
    expect(screen.getByText('Copy Code')).toBeInTheDocument()
  })
})
