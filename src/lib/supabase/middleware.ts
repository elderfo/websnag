import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isValidOrigin } from '@/lib/security'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Allow public routes without auth
  const publicPaths = ['/', '/login', '/auth', '/api/wh', '/api/stripe/webhook', '/api/health']
  const isPublicPath = publicPaths.some((path) => request.nextUrl.pathname.startsWith(path))

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // CSRF protection: validate Origin header on state-changing requests
  // to authenticated API routes (skip webhook capture and Stripe webhook which have their own auth)
  const isMutatingMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')
  const isWebhookCapture = request.nextUrl.pathname.startsWith('/api/wh/')
  const isStripeWebhook = request.nextUrl.pathname.startsWith('/api/stripe/webhook')

  if (isMutatingMethod && isApiRoute && !isWebhookCapture && !isStripeWebhook) {
    const origin = request.headers.get('origin')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    if (!isValidOrigin(origin, appUrl)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // CORS: explicitly set headers for authenticated API routes
  const isHealthRoute = request.nextUrl.pathname.startsWith('/api/health')
  if (isApiRoute && !isWebhookCapture && !isStripeWebhook && !isHealthRoute) {
    const origin = request.headers.get('origin')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

    // Vary: Origin tells caches the response depends on the request Origin header
    supabaseResponse.headers.append('Vary', 'Origin')

    if (origin && isValidOrigin(origin, appUrl)) {
      supabaseResponse.headers.set('Access-Control-Allow-Origin', origin)
      supabaseResponse.headers.set('Access-Control-Allow-Credentials', 'true')
      supabaseResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE')
      supabaseResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    }
  }

  return supabaseResponse
}
