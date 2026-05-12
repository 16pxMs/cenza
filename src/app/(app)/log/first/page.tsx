import { redirect } from 'next/navigation'

export default function LegacyFirstLogRedirectPage() {
  redirect('/log/import?returnTo=/app')
}
