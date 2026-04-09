import { redirect } from 'next/navigation'

export default function LegacyFirstLogRedirectPage() {
  redirect('/log/new?returnTo=/app')
}
