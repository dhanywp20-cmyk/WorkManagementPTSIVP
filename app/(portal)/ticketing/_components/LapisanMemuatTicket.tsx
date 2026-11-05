'use client';
import { ModalPortal } from '@/components/shared';
import { Ikon } from '@/components/shared/Ikon';

export function LapisanMemuatTicket({ showLoadingPopup, loadingMessage, uploading }: {
  showLoadingPopup: boolean; loadingMessage: string; uploading: boolean;
}) {
  if (showLoadingPopup) return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" aria-live="polite" className="fixed inset-0 flex items-center justify-center z-[1100]" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
        <div className="bg-white rounded-kartu shadow-modal p-8 max-w-sm w-full mx-4">
          <div className="flex flex-col items-center">
            {loadingMessage.includes("✅") ? (
              <div className="text-6xl mb-4 animate-bounce"><Ikon nama="✅" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
            ) : (
              <div className="relative w-16 h-16 mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
                <div className="absolute inset-0 rounded-full border-4 border-merek border-t-transparent animate-spin"></div>
              </div>
            )}
            <p className="text-base font-bold text-slate-800 text-center">{loadingMessage}</p>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
  if (uploading) return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200">
      <div className="h-full bg-merek animate-pulse" style={{ width: "100%", transition: "width 0.3s" }}></div>
    </div>
  );
  return null;
}
