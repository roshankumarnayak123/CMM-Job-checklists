// generate-icons.cjs — Run with: node generate-icons.cjs
const fs = require('fs');
const path = require('path');

// CMM Checklist icon as a clean SVG — purple gradient gear + checklist
const iconSVG = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0d0a1f"/>
      <stop offset="100%" style="stop-color:#1a0a3d"/>
    </linearGradient>
    <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#8b5cf6"/>
      <stop offset="100%" style="stop-color:#22d3ee"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- Background -->
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <!-- Subtle grid lines -->
  <line x1="0" y1="128" x2="512" y2="128" stroke="rgba(139,92,246,0.1)" stroke-width="1"/>
  <line x1="0" y1="256" x2="512" y2="256" stroke="rgba(139,92,246,0.1)" stroke-width="1"/>
  <line x1="0" y1="384" x2="512" y2="384" stroke="rgba(139,92,246,0.1)" stroke-width="1"/>
  <line x1="128" y1="0" x2="128" y2="512" stroke="rgba(139,92,246,0.1)" stroke-width="1"/>
  <line x1="256" y1="0" x2="256" y2="512" stroke="rgba(139,92,246,0.1)" stroke-width="1"/>
  <line x1="384" y1="0" x2="384" y2="512" stroke="rgba(139,92,246,0.1)" stroke-width="1"/>
  <!-- Gear shape (gear outline) -->
  <g filter="url(#glow)" transform="translate(256,220)">
    <path fill="url(#iconGrad)" d="
      M0,-90 L15,-75 L35,-85 L45,-65 L65,-60 L60,-40 L75,-25 L65,-5 L80,10 L65,25
      L70,45 L50,50 L45,70 L25,65 L10,80 L-5,68 L-25,75 L-35,58 L-55,55 L-55,35
      L-75,25 L-70,5 L-85,-10 L-70,-28 L-78,-48 L-58,-55 L-55,-75 L-35,-72 L-20,-85 Z
    " opacity="0.15"/>
    <path fill="none" stroke="url(#iconGrad)" stroke-width="18" stroke-linejoin="round" d="
      M0,-90 L15,-75 L35,-85 L45,-65 L65,-60 L60,-40 L75,-25 L65,-5 L80,10 L65,25
      L70,45 L50,50 L45,70 L25,65 L10,80 L-5,68 L-25,75 L-35,58 L-55,55 L-55,35
      L-75,25 L-70,5 L-85,-10 L-70,-28 L-78,-48 L-58,-55 L-55,-75 L-35,-72 L-20,-85 Z
    "/>
    <circle cx="0" cy="0" r="36" fill="none" stroke="url(#iconGrad)" stroke-width="18"/>
  </g>
  <!-- Checklist lines below gear -->
  <g transform="translate(148, 358)">
    <!-- Check mark -->
    <circle cx="16" cy="16" r="14" fill="rgba(139,92,246,0.2)" stroke="#8b5cf6" stroke-width="3"/>
    <polyline points="8,16 13,22 24,10" fill="none" stroke="#22d3ee" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Lines -->
    <rect x="42" y="10" width="170" height="12" rx="6" fill="rgba(139,92,246,0.6)"/>
    <!-- Row 2 -->
    <circle cx="16" cy="52" r="14" fill="rgba(139,92,246,0.2)" stroke="#8b5cf6" stroke-width="3"/>
    <polyline points="8,52 13,58 24,46" fill="none" stroke="#22d3ee" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="42" y="46" width="125" height="12" rx="6" fill="rgba(139,92,246,0.4)"/>
    <!-- Row 3 -->
    <circle cx="16" cy="88" r="14" fill="rgba(139,92,246,0.1)" stroke="rgba(139,92,246,0.4)" stroke-width="3"/>
    <rect x="42" y="82" width="145" height="12" rx="6" fill="rgba(139,92,246,0.25)"/>
  </g>
  <!-- Bottom accent glow -->
  <ellipse cx="256" cy="490" rx="160" ry="14" fill="rgba(139,92,246,0.25)"/>
</svg>`;

const publicDir = path.join(__dirname, 'public');

// Write SVG icons at all needed sizes
const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];
sizes.forEach(size => {
  const filename = size === 180 ? 'apple-touch-icon.svg' : `icon-${size}x${size}.svg`;
  fs.writeFileSync(path.join(publicDir, filename), iconSVG(size));
  console.log(`✓ Generated ${filename}`);
});

// Write a maskable icon (full bleed — no safe zone padding)
const maskableSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0d0a1f"/>
      <stop offset="100%" style="stop-color:#1a0a3d"/>
    </linearGradient>
    <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#8b5cf6"/>
      <stop offset="100%" style="stop-color:#22d3ee"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(256,230)">
    <path fill="none" stroke="url(#iconGrad)" stroke-width="22" stroke-linejoin="round" d="
      M0,-85 L14,-72 L33,-81 L43,-62 L62,-57 L57,-38 L71,-24 L62,-5 L76,9 L62,24
      L66,43 L48,48 L43,67 L24,62 L10,76 L-5,65 L-24,72 L-33,55 L-52,52 L-52,33
      L-71,24 L-67,5 L-81,-10 L-67,-27 L-74,-46 L-55,-52 L-52,-71 L-33,-69 L-19,-81 Z"/>
    <circle cx="0" cy="0" r="34" fill="none" stroke="url(#iconGrad)" stroke-width="22"/>
  </g>
  <g transform="translate(148, 368)">
    <circle cx="16" cy="16" r="14" fill="rgba(139,92,246,0.25)" stroke="#8b5cf6" stroke-width="3"/>
    <polyline points="8,16 13,22 24,10" fill="none" stroke="#22d3ee" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="42" y="10" width="170" height="11" rx="5.5" fill="rgba(139,92,246,0.7)"/>
    <circle cx="16" cy="50" r="14" fill="rgba(139,92,246,0.2)" stroke="#8b5cf6" stroke-width="3"/>
    <polyline points="8,50 13,56 24,44" fill="none" stroke="#22d3ee" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="42" y="44" width="120" height="11" rx="5.5" fill="rgba(139,92,246,0.45)"/>
  </g>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'icon-maskable-512x512.svg'), maskableSVG);
console.log('✓ Generated icon-maskable-512x512.svg');

console.log('\n✅ All icons generated in /public!');
