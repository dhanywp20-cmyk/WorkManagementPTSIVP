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
        {/* Auto-detect modals inside iframes — notify parent + fix modal centering */}
        <script dangerouslySetInnerHTML={{ __html: `
(function(){
  if(typeof window==='undefined')return;
  if(window.parent===window)return;

  /* ── 1. CSS fixes: give all modals comfortable top/bottom spacing ───────── */
  var st=document.createElement('style');
  st.textContent=
    /* ALL direct children of modal backdrops: cap height so ~10% margins remain */
    /* !important overrides both Tailwind max-h-[92vh] AND inline style maxHeight */
    '.fixed.inset-0>*{max-height:80vh!important;overflow-y:auto!important;}'+
    /* scrollable backdrops (daily-report) + items-start: push down past header */
    '.fixed.inset-0.overflow-y-auto{padding-top:80px!important;}'+
    '.fixed.inset-0.items-start{padding-top:80px!important;}'+
    /* restore full-size for loading screens (they have a small centered card, not a form) */
    '.fixed.inset-0.z-\\[9999\\]>*{max-height:none!important;}';
  document.head.appendChild(st);

  /* ── 2. postMessage: tell parent to expand iframe to full screen ─────────── */
  var last=false,t;
  function chk(){
    clearTimeout(t);
    t=setTimeout(function(){
      var open=!!document.querySelector('.fixed.inset-0');
      if(open!==last){last=open;window.parent.postMessage({type:open?'IFRAME_MODAL_OPEN':'IFRAME_MODAL_CLOSE'},'*');}
    },0);
  }
  function init(){var o=new MutationObserver(chk);o.observe(document.body,{childList:true,subtree:true});chk();}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
        ` }} />
      </body>
    </html>
  );
}
