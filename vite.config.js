import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',          // show our own in-app update prompt
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.svg',
        'icon-*.svg',
      ],

      /* ── Web App Manifest ── */
      manifest: {
        name: 'CMM Checklist',
        short_name: 'CMM',
        description: 'Central Mechanical Maintenance — Job Checklists & Inspection Reports',
        theme_color: '#050b18',
        background_color: '#050b18',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'any',
        scope: '/',
        start_url: '/?pwa=1',
        lang: 'en',
        categories: ['productivity', 'utilities', 'business'],
        id: 'cmm-checklist-app',

        icons: [
          { src: '/icon-72x72.svg',             sizes: '72x72',     type: 'image/svg+xml' },
          { src: '/icon-96x96.svg',             sizes: '96x96',     type: 'image/svg+xml' },
          { src: '/icon-128x128.svg',           sizes: '128x128',   type: 'image/svg+xml' },
          { src: '/icon-144x144.svg',           sizes: '144x144',   type: 'image/svg+xml' },
          { src: '/icon-152x152.svg',           sizes: '152x152',   type: 'image/svg+xml' },
          { src: '/icon-192x192.svg',           sizes: '192x192',   type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-384x384.svg',           sizes: '384x384',   type: 'image/svg+xml' },
          { src: '/icon-512x512.svg',           sizes: '512x512',   type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-maskable-512x512.svg',  sizes: '512x512',   type: 'image/svg+xml', purpose: 'maskable' },
          { src: '/apple-touch-icon.svg',       sizes: '180x180',   type: 'image/svg+xml' },
        ],

        screenshots: [
          {
            src: '/icon-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            form_factor: 'wide',
            label: 'CMM Checklist Desktop View'
          },
          {
            src: '/icon-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            form_factor: 'narrow',
            label: 'CMM Checklist Mobile View'
          }
        ],

        shortcuts: [
          {
            name: 'Fill a Checklist',
            short_name: 'Fill',
            description: 'Start filling a CMM checklist',
            url: '/?tab=fill',
            icons: [{ src: '/icon-192x192.svg', sizes: '192x192', type: 'image/svg+xml' }]
          }
        ],

        related_applications: [],
        prefer_related_applications: false,
      },

      /* ── Workbox Service Worker strategy ── */
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        cleanupOutdatedCaches: true,
        skipWaiting: false,     // we control this via our in-app prompt
        clientsClaim: false,

        runtimeCaching: [
          /* Firebase Auth API — network first, fallback to cache */
          {
            urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase-auth-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 10, maxAgeSeconds: 86400 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          /* Firestore REST API — network first */
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 50, maxAgeSeconds: 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          /* Google Fonts — stale while revalidate */
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          /* App shell (JS/CSS) — stale while revalidate */
          {
            urlPattern: /\.(?:js|css)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources',
              expiration: { maxEntries: 60, maxAgeSeconds: 86400 },
            },
          },
          /* Images/SVGs — cache first */
          {
            urlPattern: /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      devOptions: {
        enabled: true,     // enable SW in dev so you can test
        type: 'module',
      },
    }),
  ],
})
