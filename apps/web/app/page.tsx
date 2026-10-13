'use client';

import dynamic from 'next/dynamic';

const CaptifyApp = dynamic(() => import('../src/App'), { ssr: false });

export default function HomePage() {
  return <CaptifyApp />;
}
