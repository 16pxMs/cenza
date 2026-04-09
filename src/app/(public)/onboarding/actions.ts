'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function saveOnboardingName(formData: FormData) {
  const firstName = String(formData.get('firstName') ?? formData.get('name') ?? '').trim()
  const lastName = String(formData.get('lastName') ?? '').trim()
  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  if (!firstName) {
    redirect('/onboarding/name')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?tab=login')
  }

  const { error: updateError, data: updatedRows } = await (supabase.from('user_profiles') as any)
    .update({ name: firstName })
    .eq('id', user.id)
    .select('id')

  if (updateError) {
    console.error('Onboarding name update error:', updateError)
  }

  if (!updatedRows || updatedRows.length === 0) {
    const { error: upsertError } = await (supabase.from('user_profiles') as any)
      .upsert({
        id: user.id,
        name: firstName,
        currency: '',
        pay_schedule_type: null,
        pay_schedule_days: null,
        goals: [],
        onboarding_complete: false,
      }, { onConflict: 'id' })

    if (upsertError) {
      console.error('Onboarding name upsert error:', upsertError)
      redirect('/onboarding/name?error=name_save_failed')
    }
  }

  const { error: userMetaError } = await supabase.auth.updateUser({
    data: {
      first_name: firstName,
      last_name: lastName || null,
      full_name: fullName || firstName,
    },
  })

  if (userMetaError) {
    console.error('Onboarding user metadata update error:', userMetaError)
  }

  redirect('/onboarding/currency')
}

export async function saveOnboardingCurrency(formData: FormData) {
  const currency = String(formData.get('currency') ?? '').trim().toUpperCase()
  if (!currency) {
    redirect('/onboarding/currency')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?tab=login')
  }

  await (supabase.from('user_profiles') as any)
    .update({ currency })
    .eq('id', user.id)

  redirect('/onboarding/pin')
}
