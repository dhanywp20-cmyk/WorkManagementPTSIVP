import './globals.css';
import type { Viewport } from 'next';

export const metadata = {
  title: 'Dashboard PTS IVP - IndoVisual',
  description: 'Portal Terpadu Support IndoVisual',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="antialiased">
        {children}
        {/* Fix modal sizing inside iframes — caps height so modal never overflows */}
        <script dangerouslySetInnerHTML={{ __html: `
(function(){
  if(typeof window==='undefined')return;
  if(window.parent===window)return;
  var st=document.createElement('style');
  st.textContent=
    '.fixed.inset-0>*{max-height:85vh!important;overflow-y:auto!important;}'+
    '.fixed.inset-0.z-\\[9999\\]>*{max-height:none!important;}';
  document.head.appendChild(st);
})();
        ` }} />
      </body>
    </html>
  );
}
