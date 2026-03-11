import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow Supabase image domain if you later use avatars
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
}

export default nextConfig
