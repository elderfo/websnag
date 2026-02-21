import { createClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/auth/redirect'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // For authenticated users without a username, redirect to settings to set one first
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle()

        // New user (no profile row yet) — send welcome email in the background
        if (!profile) {
          const email = user.email ?? user.user_metadata?.email
          if (email) {
            // Fire-and-forget: don't block the auth redirect
            void sendWelcomeEmail(email)
          }
        }

        if (!profile?.username) {
          const redirectParam = `&redirect=${encodeURIComponent(next)}`
          return NextResponse.redirect(`${origin}/settings?setup=username${redirectParam}`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
