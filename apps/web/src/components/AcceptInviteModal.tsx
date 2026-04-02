import React, { useState } from 'react';
import { X, Mail, Loader2, Key, CheckCircle2, UserPlus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface AcceptInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AcceptInviteModal({ isOpen, onClose, onSuccess }: AcceptInviteModalProps) {
  const queryClient = useQueryClient();
  const [manualInviteId, setManualInviteId] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [loading, setLoading] = useState<string | null>(null); // 存正在處理的 inviteId
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  // 取得屬於我的邀請
  const { data: myInvites, isLoading: isLoadingInvites } = useQuery<any[]>({
    queryKey: ['auth', 'invitations'],
    queryFn: async () => {
      const { data } = await api.get('/auth/invitations');
      return data;
    },
    enabled: isOpen
  });

  if (!isOpen) return null;

  const handleAccept = async (inviteId: string, token?: string) => {
    setLoading(inviteId);
    setError(null);

    try {
      // 邏輯優化：如果是在受邀列表中的邀請，後端現在支援「本人免 Token 加入」
      await api.post(`/invitations/${inviteId}/accept`, { token: token });
      
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'invitations'] });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || '加入專案失敗');
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async (inviteId: string) => {
    setLoading(inviteId);
    setError(null);
    try {
      await api.post(`/invitations/${inviteId}/reject`);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'invitations'] });
    } catch (err: any) {
      setError(err.response?.data?.message || '拒絕邀請失敗');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-100">
              <UserPlus className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">您的專案邀請</h3>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">Pending Invitations</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 text-gray-400 rounded-full transition-all">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {isLoadingInvites ? (
            <div className="py-20 flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
              <p className="text-gray-400 font-bold">尋找您的邀請中...</p>
            </div>
          ) : myInvites && myInvites.length > 0 ? (
            <div className="space-y-4">
              {myInvites.map((inv) => (
                <div key={inv.id} className="bg-gray-50 border border-gray-100 p-6 rounded-3xl hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors">{inv.project.name}</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-black rounded uppercase">{inv.role}</span>
                      </div>
                      <p className="text-sm text-gray-500 font-medium line-clamp-1">{inv.project.description || '暫無描述'}</p>
                      <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                        <div className="h-6 w-6 bg-gray-200 rounded-full flex items-center justify-center font-bold text-[10px]">{inv.inviter.displayName?.[0] || 'U'}</div>
                        <span className="font-bold text-gray-600">{inv.inviter.displayName || inv.inviter.email}</span>
                        <span>邀請您加入</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(inv.id)}
                        disabled={!!loading}
                        className="px-4 py-2 border border-red-200 text-red-500 rounded-xl font-bold text-sm hover:bg-red-50 transition-all disabled:opacity-50"
                      >
                        拒絕
                      </button>
                      <button
                        onClick={() => handleAccept(inv.id)}
                        disabled={!!loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg shadow-blue-100 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                      >
                        {loading === inv.id && <Loader2 className="h-4 w-4 animate-spin" />}
                        同意加入
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="bg-gray-50 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="h-10 w-10 text-gray-300" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">目前沒有收到邀請</h4>
              <p className="text-gray-400 text-sm max-w-xs mx-auto">如果朋友已發送邀請，請確認您的 Email 是否正確，或是使用下方的「手動輸入」功能。</p>
            </div>
          )}

          {/* 手動輸入區塊 */}
          <div className="pt-6 border-t border-gray-100">
            {!showManual ? (
              <button 
                onClick={() => setShowManual(true)}
                className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold text-sm hover:border-blue-300 hover:text-blue-500 transition-all"
              >
                + 手動輸入邀請代碼 (Token)
              </button>
            ) : (
              <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-black text-blue-900 uppercase tracking-wider">手動加入</h4>
                  <button onClick={() => setShowManual(false)} className="text-xs font-bold text-blue-600 hover:underline">取消</button>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-blue-400 uppercase mb-1 ml-1">邀請 ID</label>
                  <input
                    type="text"
                    value={manualInviteId}
                    onChange={(e) => setManualInviteId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium outline-none"
                    placeholder="例如：c40dea18-..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-blue-400 uppercase mb-1 ml-1">安全 Token</label>
                  <input
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium outline-none"
                    placeholder="輸入發送者提供的加密 Token"
                  />
                </div>
                {error && <p className="text-xs font-bold text-red-500 ml-1">{error}</p>}
                <button
                  onClick={() => handleAccept(manualInviteId)}
                  disabled={!manualInviteId || !manualToken || !!loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  驗證並加入專案
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
