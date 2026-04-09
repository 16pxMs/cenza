export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getOnboardingPageRedirect } from '@/lib/auth/auth-flow'
import { createClient } from '@/lib/supabase/server'
import styles from '../onboarding.module.css'
import { saveOnboardingName } from '../actions'
import { SubmitButton } from '../SubmitButton'

export default async function OnboardingNamePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?tab=login')
  }

  const { data: profile } = await (supabase as any)
    .from('user_profiles')
    .select('name, currency, pin_hash, onboarding_complete')
    .eq('id', user.id)
    .single()

  const pinVerified = (await cookies()).get('cenza-pin-verified')?.value === '1'
  const redirectPath = getOnboardingPageRedirect({
    requestedStep: 'name',
    name: profile?.name,
    currency: profile?.currency,
    hasPin: !!profile?.pin_hash,
    onboardingComplete: !!profile?.onboarding_complete,
    pinVerified,
  })

  if (redirectPath) {
    redirect(redirectPath)
  }

  const metadataFirstName =
    typeof user.user_metadata?.first_name === 'string'
      ? user.user_metadata.first_name.trim()
      : ''
  const metadataLastName =
    typeof user.user_metadata?.last_name === 'string'
      ? user.user_metadata.last_name.trim()
      : ''
  const metadataFullName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name.trim()
      : ''
  const metadataParts = metadataFullName ? metadataFullName.split(/\s+/).filter(Boolean) : []

  const initialFirstName =
    profile?.name?.trim() ||
    metadataFirstName ||
    metadataParts[0] ||
    user.email?.split('@')[0] ||
    ''

  const initialLastName =
    metadataLastName ||
    (metadataParts.length > 1 ? metadataParts.slice(1).join(' ') : '')
  const hasSaveError = params.error === 'name_save_failed'

  return (
    <form action={saveOnboardingName}>
      <div className={styles.pageWrapper} style={{ minHeight: '100vh' }}>
        <div className={styles.content} style={{ paddingTop: 72 }}>
          <p style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--text-muted)',
            margin: '0 0 var(--space-lg)',
            letterSpacing: '0.01em',
          }}>
            Welcome to Cenza
          </p>

          <h1 style={{
            fontSize: 'var(--text-3xl)',
            color: 'var(--text-1)',
            margin: '0 0 var(--space-sm)',
          }}>
            What should we
            <br />
            call you?
          </h1>

          <p style={{
            fontSize: 'var(--text-base)',
            color: 'var(--text-2)',
            margin: '0 0 var(--space-xl)',
            lineHeight: 1.6,
          }}>
            We'll use your first name throughout the app.
          </p>

          {/* If a prior save failed, show a clear inline message instead of silently looping */}
          {hasSaveError && (
            <p style={{ margin: '0 0 var(--space-md)', fontSize: 'var(--text-sm)', color: '#D93025' }}>
              We couldn't save your name. Please try again.
            </p>
          )}

          <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
            <input
              name="firstName"
              defaultValue={initialFirstName}
              placeholder="First name"
              autoFocus
              required
              autoCapitalize="words"
              autoComplete="given-name"
              style={{
                width: '100%',
                height: 56,
                border: '1.5px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: '0 var(--space-md)',
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-1)',
                background: 'var(--white)',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
            <input
              name="lastName"
              defaultValue={initialLastName}
              placeholder="Last name (optional)"
              autoCapitalize="words"
              autoComplete="family-name"
              style={{
                width: '100%',
                height: 56,
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '0 var(--space-md)',
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-1)',
                background: 'var(--white)',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        <div className={styles.ctaArea}>
          <SubmitButton idleLabel="Continue" pendingLabel="Saving…" />
        </div>
      </div>
    </form>
  )
}
