import { ImageResponse } from '@vercel/og';

export default async function handler() {
  const html = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0D0C0B',
        fontFamily: 'sans-serif',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 80,
              height: 80,
              borderRadius: 20,
              backgroundColor: '#DA7756',
              marginBottom: 32,
            },
            children: {
              type: 'span',
              props: {
                style: { fontSize: 40, fontWeight: 700, color: 'white' },
                children: 'M',
              },
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontSize: 64,
              fontWeight: 300,
              color: '#F5F0E8',
              marginBottom: 16,
            },
            children: 'MusicSpace',
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontSize: 24,
              color: '#9B9590',
            },
            children: 'Music Industry Intelligence Platform',
          },
        },
      ],
    },
  };

  return new ImageResponse(html, { width: 1200, height: 630 });
}
