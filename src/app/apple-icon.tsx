import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** PNG home-screen icon for iOS (it ignores SVG manifest icons). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#13284b' }}>
        <svg width="132" height="110" viewBox="0 0 120 100">
          <path d="M22 84 C 12 64, 12 40, 28 25 C 42 12, 70 8, 88 18 C 104 27, 112 44, 112 62 L 112 66 L 70 66 L 60 84 Z" fill="none" stroke="#fff" strokeWidth="7" strokeLinejoin="round" />
          <path d="M66 46 H 112" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          <circle cx="60" cy="13" r="8" fill="#c8102e" />
        </svg>
      </div>
    ),
    size,
  );
}
