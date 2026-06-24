import { ImageResponse } from '@vercel/og';

export default async function handler() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 64,
          fontWeight: 300,
          color: '#F5F0E8',
          background: '#0D0C0B',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
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
            background: '#DA7756',
            marginBottom: 32,
            fontSize: 40,
            fontWeight: 700,
            color: 'white',
          }}
        >
          M
        </div>
        MusicSpace
        <div style={{ fontSize: 24, color: '#9B9590', marginTop: 16 }}>
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
