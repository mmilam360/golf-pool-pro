import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Golf Pools Pro',
    short_name: 'GPP',
    description: 'Run golf pools with live tournament standings.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fbf7ed',
    theme_color: '#0b2f24',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
