import React, { useState } from 'react';
import { X, Mail, Loader2, Key } from 'lucide-react';
import { api } from '../lib/api';

interface AcceptInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AcceptInviteModal({ isOpen, onClose, onSuccess }: AcceptInviteModalProps) {
  const [inviteId, setInviteId] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.post(`/invitations/${inviteId.trim()}/accept`, { token: token.trim() });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || '接受邀請失敗，請檢查代碼與 Token 是否正確');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
              <Mail className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">加入邀請專案</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 text-gray-400 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-500 mb-4">請輸入您收到的邀請 ID 與安全 Token 以加入專案。</p>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">邀請 ID</label>
            <input
              type="text"
              required
              value={inviteId}
              onChange={(e) => setInviteId(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium outline-none"
              placeholder="例如：c40dea18-..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">邀請 Token</label>
            <div className="relative">
              <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium outline-none"
                placeholder="輸入 64 位加密 Token"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-xs px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-gray-600 font-bold hover:bg-gray-100 rounded-xl">取消</button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              加入專案
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
