import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default function og() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0D0C0B',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Accent glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 600,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(218,119,86,0.15) 0%, transparent 70%)',
          }}
        />

        {/* Logo mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 80,
            height: 80,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #DA7756, #C75F4F)',
            marginBottom: 32,
          }}
        >
          <span style={{ fontSize: 40, fontWeight: 700, color: 'white' }}>M</span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 300,
            color: '#F5F0E8',
            letterSpacing: '-0.02em',
            marginBottom: 16,
          }}
        >
          MusicSpace
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 24,
            color: '#9B9590',
            letterSpacing: '0.05em',
          }}
        >
          Music Industry Intelligence Platform
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
