import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ChatRoom',
  description: 'Real-time WebSocket chat built with Next.js + NestJS',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
