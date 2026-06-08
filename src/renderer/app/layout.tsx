import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KernelAI - PC Optimization & Storage Intelligence',
  description: 'High-performance desktop PC optimization tool powered by Google Gen AI',
  keywords: ['PC optimization', 'storage intelligence', 'AI agent', 'system tools'],
  authors: [{ name: 'KernelAI Team' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
