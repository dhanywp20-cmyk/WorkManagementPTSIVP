'use client';

/** PanelChatDetail - dipecah dari app/(portal)/form-require-project/_components/ModalDetailRequest.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { User, ProjectRequest, ProjectMessage } from '../shared';

export interface PanelChatDetailProps {
  chatFileRef: import("react").RefObject<HTMLInputElement | null>;
  chatRoomFilter: string;
  currentUser: User;
  detailMobileTab: "info" | "chat";
  handleFileUpload: (file: File) => Promise<void>;
  handleSendMessage: () => Promise<void>;
  isPTS: boolean;
  messages: ProjectMessage[];
  messagesEndRef: import("react").RefObject<HTMLDivElement | null>;
  msgText: string;
  selectedRequest: ProjectRequest;
  sendingMsg: boolean;
  setChatRoomFilter: import("react").Dispatch<import("react").SetStateAction<string>>;
  setMsgText: import("react").Dispatch<import("react").SetStateAction<string>>;
  uploadingFile: boolean;
}

export function PanelChatDetail({ chatFileRef, chatRoomFilter, currentUser, detailMobileTab, handleFileUpload, handleSendMessage, isPTS, messages, messagesEndRef, msgText, selectedRequest, sendingMsg, setChatRoomFilter, setMsgText, uploadingFile }: PanelChatDetailProps) {
  return (
    <>
      <div className={`${detailMobileTab === 'chat' ? 'flex flex-col' : 'hidden'} sm:flex sm:flex-col flex-[1.5] overflow-hidden bg-white/95 min-w-0`}>
        <div className="px-4 py-2.5 border-b border-gray-100 flex-shrink-0 bg-gray-50">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2"><IkonTeks nama="💬" />Discussion Chat</p>
          {/* Room filter tabs for chat */}
          {(() => {
            const chatRooms = selectedRequest.rooms || [];
            if (chatRooms.length === 0) return <p className="text-[11px] text-gray-500">{messages.filter(m => m.sender_role !== 'system').length} pesan</p>;
            const roomLabels = [
              { key: 'all', label: '📋 Semua' },
              { key: selectedRequest.room_name?.trim() || 'Ruangan 1', label: selectedRequest.room_name?.trim() || 'Ruangan 1' },
              ...chatRooms.map((r, i) => ({ key: r.room_name?.trim() || `Ruangan ${i+2}`, label: r.room_name?.trim() || `Ruangan ${i+2}` })),
            ];
            return (
              <div className="flex flex-wrap gap-1">
                {roomLabels.map(({ key, label }) => (
                  <button key={key} type="button" onClick={() => setChatRoomFilter(key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${chatRoomFilter === key ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                    {label}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {(() => {
            // Filter messages by chatRoomFilter
            const filteredMsgs = chatRoomFilter === 'all'
              ? messages
              : messages.filter(m => {
                  if (m.sender_role === 'system') return true;
                  // Show messages prefixed with this room label, or unprefixed (general/Ruangan 1)
                  const hasPrefix = m.message.startsWith('[') && m.message.includes(']');
                  if (hasPrefix) {
                    const prefix = m.message.match(/^\[([^\]]+)\]/)?.[1] || '';
                    return prefix === chatRoomFilter;
                  }
                  // Unprefixed messages: show only in 'all' or Ruangan 1 (first room)
                  const firstRoomLabel = selectedRequest.room_name?.trim() || 'Ruangan 1';
                  return chatRoomFilter === firstRoomLabel;
                });
            if (filteredMsgs.length === 0) return (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
                <div className="text-4xl"><Ikon nama="💬" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
                <p className="font-medium text-sm">{chatRoomFilter === 'all' ? 'Belum ada pesan' : `Belum ada pesan untuk ${chatRoomFilter}`}</p>
              </div>
            );
            return filteredMsgs.map(msg => {
              const isSystem = msg.sender_role === 'system';
              const isMe = msg.sender_id === currentUser.id;
              if (isSystem) return (
                <div key={msg.id} className="flex justify-center">
                  <div className="bg-gray-100 text-gray-500 text-xs px-4 py-2 rounded-full font-medium max-w-sm text-center">{msg.message}</div>
                </div>
              );
              // Strip room prefix from display
              const displayMsg = msg.message.replace(/^\[[^\]]+\]\s*/, '');
              const msgRoomLabel = msg.message.match(/^\[([^\]]+)\]/)?.[1];
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                    <p className="text-[11px] text-gray-500 font-medium px-1 flex items-center gap-1 flex-wrap">
                      {isMe ? 'Saya' : (
                        <>
                          {msg.sender_role === 'guest' ? '👤' : msg.sender_role === 'team_pts' || msg.sender_role === 'team' ? '👷' : msg.sender_role === 'admin' || msg.sender_role === 'superadmin' ? '⚙️' : '💬'}
                          {' '}{msg.sender_name}
                        </>
                      )}
                      {' · '}{new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      {chatRoomFilter === 'all' && msgRoomLabel && <span className="bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{msgRoomLabel}</span>}
                    </p>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium shadow-sm ${
                      isMe
                        ? 'bg-gradient-to-br from-teal-600 to-teal-800 text-white rounded-tr-sm'
                        : msg.sender_role === 'guest'
                          ? 'bg-blue-50 text-blue-800 border border-blue-200 rounded-tl-sm'
                          : msg.sender_role === 'admin' || msg.sender_role === 'superadmin'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-tl-sm'
                            : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    }`}>
                      {displayMsg}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-gray-50">
          {/* Show which room this message will go to */}
          {chatRoomFilter !== 'all' && selectedRequest.status !== 'rejected' && selectedRequest.status !== 'pending' && (
            <div className="mb-2 px-2.5 py-1.5 bg-teal-50 border border-teal-200 rounded-lg text-[11px] text-teal-700 font-semibold flex items-center gap-1.5">
              <svg aria-hidden="true" focusable="false" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              Mengirim ke: <strong>{chatRoomFilter}</strong>
            </div>
          )}
          {selectedRequest.status === 'rejected' ? (
            <div className="text-center text-xs font-bold text-red-500 bg-red-50 border border-red-200 rounded-xl py-3">Request ditolak. Chat tidak tersedia.{!isPTS && <span className="block mt-1 font-normal text-red-600">Klik &quot;Submit Ulang Request&quot; di atas untuk mengajukan ulang.</span>}</div>
          ) : selectedRequest.status === 'pending' ? (
            <div className="text-center text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl py-3"><IkonTeks nama="🔒" />Chat tersedia setelah di-approve.</div>
          ) : (
            <div className="flex gap-2">
              <div className="flex-1 flex items-end gap-2 bg-white/90 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-teal-500 transition-all">
                <textarea value={msgText} onChange={e => setMsgText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  placeholder="Ketik pesan... (Enter kirim)" rows={1}
                  className="flex-1 bg-transparent text-sm text-gray-800 outline-none resize-none max-h-24 placeholder-gray-400" />
                <button onClick={() => chatFileRef.current?.click()} className="text-gray-500 hover:text-teal-600 transition-colors flex-shrink-0">
                  {uploadingFile ? <div className="w-4 h-4 border-2 border-gray-300 border-t-teal-500 rounded-full animate-spin" /> : <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>}
                </button>
                <input ref={chatFileRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }} />
              </div>
              <button onClick={handleSendMessage} disabled={sendingMsg || !msgText.trim()}
                className="bg-gradient-to-r from-teal-600 to-teal-800 text-white px-4 py-2 rounded-xl font-bold transition-all disabled:opacity-50 shadow-md flex-shrink-0">
                {sendingMsg ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
