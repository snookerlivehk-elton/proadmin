import React, { useState } from 'react';
import { X, ClipboardList, Loader2, HardHat, Receipt, TrendingUp, FileText, CheckCircle, Plus, Paperclip } from 'lucide-react';
import { api, type ProjectLogType } from '../lib/api';

interface CreateProjectLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: string;
}

const LOG_TYPES: { type: ProjectLogType; label: string; icon: any; color: string }[] = [
  { type: 'ENGINEERING', label: '工程', icon: HardHat, color: 'blue' },
  { type: 'EXPENSE', label: '支出', icon: Receipt, color: 'red' },
  { type: 'INCOME', label: '收入', icon: TrendingUp, color: 'green' },
  { type: 'REPORT', label: '工程報告', icon: FileText, color: 'orange' },
  { type: 'COMPLETION', label: '完工', icon: CheckCircle, color: 'purple' },
];

export default function CreateProjectLogModal({ isOpen, onClose, onSuccess, projectId }: CreateProjectLogModalProps) {
  const [type, setType] = useState<ProjectLogType>('ENGINEERING');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.post(`/projects/${projectId}/logs`, {
        type,
        title,
        content,
        amount: amount ? parseFloat(amount) : null,
        startDate: startDate || null,
        endDate: endDate || null,
        attachments: attachments.length > 0 ? attachments : null,
      });
      onSuccess();
      onClose();
      // Reset form
      setTitle('');
      setContent('');
      setAmount('');
      setStartDate('');
      setEndDate('');
      setAttachments([]);
    } catch (err: any) {
      setError(err.response?.data?.message || '建立日誌失敗');
    } finally {
      setLoading(false);
    }
  };

  const addAttachment = () => {
    const url = prompt('請輸入附件網址 (目前暫為手動輸入 URL)');
    if (url) {
      const name = url.split('/').pop() || '附件';
      setAttachments([...attachments, { name, url }]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-100">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">新增項目日誌</h3>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-0.5">Create New Project Log</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 text-gray-400 rounded-full transition-all">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold">
              {error}
            </div>
          )}

          {/* Type Selector */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 ml-1">日誌分類</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {LOG_TYPES.map((item) => {
                const Icon = item.icon;
                const isActive = type === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setType(item.type)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                      isActive 
                        ? `border-blue-600 bg-blue-50 text-blue-600` 
                        : 'border-gray-100 hover:border-blue-200 text-gray-400'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-black">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">標題</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-gray-900 font-bold"
                placeholder="請輸入簡短明確的標題"
              />
            </div>

            {(type === 'ENGINEERING' || type === 'EXPENSE' || type === 'INCOME') && (
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">相關金額 (HKD)</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-black">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-10 pr-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-gray-900 font-bold"
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}

            {type === 'ENGINEERING' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">預計開始日期</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-gray-900 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">預計完工日期</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-gray-900 font-bold"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">詳細內容</label>
              <textarea
                required
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-gray-900 font-medium resize-none"
                placeholder="請輸入詳細的工作回報、支出明細或項目說明..."
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2 ml-1">
                <label className="block text-[10px] font-black text-gray-400 uppercase">附件連結</label>
                <button
                  type="button"
                  onClick={addAttachment}
                  className="text-[10px] font-black text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> 新增連結
                </button>
              </div>
              <div className="space-y-2">
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Paperclip className="h-3 w-3 text-gray-400 shrink-0" />
                      <span className="text-xs font-bold text-gray-600 truncate">{file.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {attachments.length === 0 && (
                  <p className="text-center py-4 border-2 border-dashed border-gray-100 rounded-2xl text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    暫無附件
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ClipboardList className="h-5 w-5" />}
              確認提交日誌
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
