import { ImageResponse } from '@vercel/og';

export default async function handler() {
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
          backgroundColor: '#0D0C0B',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 80,
            height: 80,
            borderRadius: 20,
            backgroundColor: '#DA7756',
            marginBottom: 32,
          }}
        >
          <span style={{ fontSize: 40, fontWeight: 700, color: 'white' }}>M</span>
        </div>

        <div
          style={{
            fontSize: 64,
            fontWeight: 300,
            color: '#F5F0E8',
            marginBottom: 16,
          }}
        >
          MusicSpace
        </div>

        <div
          style={{
            fontSize: 24,
            color: '#9B9590',
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
