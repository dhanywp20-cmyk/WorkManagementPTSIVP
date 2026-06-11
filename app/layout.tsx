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
        {/* Auto-detect modals inside iframes and notify parent dashboard */}
        <script dangerouslySetInnerHTML={{ __html: `
(function(){
  if(typeof window==='undefined')return;
  if(window.parent===window)return;
  var last=false,t;
  function chk(){
    clearTimeout(t);
    t=setTimeout(function(){
      var open=!!document.querySelector('.fixed.inset-0');
      if(open!==last){last=open;window.parent.postMessage({type:open?'IFRAME_MODAL_OPEN':'IFRAME_MODAL_CLOSE'},'*');}
    },80);
  }
  function init(){var o=new MutationObserver(chk);o.observe(document.body,{childList:true,subtree:true});chk();}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
        ` }} />
      </body>
    </html>
  );
}
