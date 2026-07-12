import type { MetadataRoute } from 'next'

const icon192 = '/icons/icon-192.png?v=4'
const icon512 = '/icons/icon-512.png?v=4'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/dashboard',
    name: 'Golf Pools Pro',
    short_name: 'GPP',
    description: 'Run golf pools with live tournament standings.',
    lang: 'en',
    categories: ['sports', 'productivity'],
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#fbf7ed',
    theme_color: '#0b2f24',
    orientation: 'portrait',
    icons: [
      {
        src: icon192,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: icon192,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: icon512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: icon512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        description: 'Open your active golf pools.',
        url: '/dashboard',
        icons: [{ src: icon192, sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Create a pool',
        short_name: 'Create',
        description: 'Start a new golf pool.',
        url: '/pool/create',
        icons: [{ src: icon192, sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Join a pool',
        short_name: 'Join',
        description: 'Enter a pool code or invite link.',
        url: '/pool/join',
        icons: [{ src: icon192, sizes: '192x192', type: 'image/png' }],
      },
    ],
  }
}
