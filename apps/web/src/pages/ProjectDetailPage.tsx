import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Layout, 
  LogOut, 
  ChevronRight, 
  Folder, 
  Users, 
  Settings, 
  FolderPlus, 
  ArrowLeft,
  Lock,
  Mail,
  Loader2,
  Plus,
  ClipboardList,
  HardHat,
  Receipt,
  TrendingUp,
  FileText,
  CheckCircle,
  Trash2,
  Paperclip,
  Calendar,
  Activity,
  History,
  ArrowUpCircle,
  ArrowDownCircle,
  DollarSign,
  Layers
} from 'lucide-react';
import { api, type Project, type User, type ProjectLog, type AuditLog, type FinanceSummary } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import CreateProjectModal from '../components/CreateProjectModal';
import CreateProjectLogModal from '../components/CreateProjectLogModal';

const LOG_TYPE_MAP: Record<string, { label: string; icon: any; colorClass: string; bgClass: string }> = {
  ENGINEERING: { label: '工程', icon: HardHat, colorClass: 'text-blue-600', bgClass: 'bg-blue-50' },
  EXPENSE: { label: '支出', icon: Receipt, colorClass: 'text-red-600', bgClass: 'bg-red-50' },
  INCOME: { label: '收入', icon: TrendingUp, colorClass: 'text-green-600', bgClass: 'bg-green-50' },
  REPORT: { label: '報告', icon: FileText, colorClass: 'text-orange-600', bgClass: 'bg-orange-50' },
  COMPLETION: { label: '完工', icon: CheckCircle, colorClass: 'text-purple-600', bgClass: 'bg-purple-50' },
};

const AUDIT_ACTION_MAP: Record<string, string> = {
  PROJECT_CREATE: '建立了專案',
  SUBPROJECT_CREATE: '建立了子專案',
  MEMBER_INVITE: '發送了成員邀請',
  INVITE_ACCEPT: '接受了邀請並加入專案',
  INVITE_REJECT: '拒絕了專案邀請',
  INVITE_CANCEL: '撤回了成員邀請',
  LOG_CREATE: '新增了一條項目日誌',
  LOG_DELETE: '刪除了項目日誌',
  MEMBER_REMOVE: '將成員移出了專案',
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'subprojects' | 'members' | 'logs' | 'activities' | 'settings'>('subprojects');
  const [isFinanceRecursive, setIsFinanceRecursive] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'VIEWER' | 'MANAGER'>('VIEWER');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: 'success' | 'error', text: string, data?: any } | null>(null);

  // 取得專案詳情
  const { data: project, isLoading: isLoadingProject, isError: isErrorProject, error: projectError } = useQuery<Project>({
    queryKey: ['projects', id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}`);
      return data;
    },
    enabled: !!id,
    retry: false // 如果沒權限，不需要重試
  });

  // 取得成員列表
  const { data: members, isLoading: isLoadingMembers } = useQuery<any[]>({
    queryKey: ['projects', id, 'members'],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}/members`);
      return data;
    },
    enabled: !!id && activeTab === 'members',
    refetchInterval: 5000, // 每 5 秒自動重新整理成員列表
  });

  // 取得待處理邀請
  const { data: invitations, refetch: refetchInvitations } = useQuery<any[]>({
    queryKey: ['projects', id, 'invitations'],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}/invitations`);
      return data;
    },
    enabled: !!id && activeTab === 'members',
    refetchInterval: 5000, // 每 5 秒自動重新整理邀請狀態
  });

  // 取得專案日誌
  const { data: logs, isLoading: isLoadingLogs, isError: isErrorLogs } = useQuery<ProjectLog[]>({
    queryKey: ['projects', id, 'logs'],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}/logs`);
      return data;
    },
    enabled: !!id && activeTab === 'logs'
  });

  // 取得活動記錄
  const { data: auditLogs, isLoading: isLoadingAudit } = useQuery<AuditLog[]>({
    queryKey: ['projects', id, 'audit-logs'],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}/audit-logs`);
      return data;
    },
    enabled: !!id && activeTab === 'activities'
  });

  // 取得遞迴財務匯總
  const { data: recursiveFinance } = useQuery<FinanceSummary>({
    queryKey: ['projects', id, 'finance-recursive'],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}/finance-recursive`);
      return data;
    },
    enabled: !!id && activeTab === 'logs' && isFinanceRecursive
  });

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await api.post(`/invitations/${inviteId}/cancel`);
      refetchInvitations();
    } catch (err: any) {
      alert(err.response?.data?.message || '撤回邀請失敗');
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    try {
      await api.delete(`/invitations/${inviteId}`);
      refetchInvitations();
    } catch (err: any) {
      alert(err.response?.data?.message || '刪除邀請紀錄失敗');
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('確定要刪除這條日誌嗎？')) return;
    try {
      await api.delete(`/logs/${logId}`);
      queryClient.invalidateQueries({ queryKey: ['projects', id, 'logs'] });
    } catch (err: any) {
      alert(err.response?.data?.message || '刪除日誌失敗');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('確定要將此成員移出專案嗎？')) return;
    try {
      await api.delete(`/projects/${id}/members/${userId}`);
      queryClient.invalidateQueries({ queryKey: ['projects', id, 'members'] });
    } catch (err: any) {
      alert(err.response?.data?.message || '移除成員失敗');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setIsInviting(true);
    setInviteMsg(null);
    try {
      const { data } = await api.post(`/projects/${id}/invitations`, { email: inviteEmail, role: inviteRole });
      setInviteMsg({ 
        type: 'success', 
        text: `已向 ${inviteEmail} 發送邀請！`,
        data: data // 包含 token
      });
      setInviteEmail('');
      refetchInvitations();
    } catch (err: any) {
      setInviteMsg({ type: 'error', text: err.response?.data?.message || '發送邀請失敗' });
    } finally {
      setIsInviting(false);
    }
  };

  // 取得子專案樹
  const { data: treeData, isLoading: isLoadingTree } = useQuery<any>({
    queryKey: ['projects', id, 'tree'],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}/tree`);
      return data;
    },
    enabled: !!id
  });

  // 取得父專案資訊 (用於麵包屑)
  const { data: parentData } = useQuery({
    queryKey: ['projects', id, 'parent'],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}/parent`);
      return data.parent;
    },
    enabled: !!id
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCreateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['projects', id, 'tree'] });
  };

  const myRole = members?.find(m => m.user.id === user?.id)?.role || (project?.ownerUserId === user?.id ? 'OWNER' : null);
  const isManager = myRole === 'OWNER' || myRole === 'MANAGER';

  // 財務加總
  const totalIncome = logs?.filter(l => l.type === 'INCOME').reduce((acc, l) => acc + Number(l.amount || 0), 0) || 0;
  const totalExpense = logs?.filter(l => l.type === 'EXPENSE').reduce((acc, l) => acc + Number(l.amount || 0), 0) || 0;
  const totalEngineering = logs?.filter(l => l.type === 'ENGINEERING').reduce((acc, l) => acc + Number(l.amount || 0), 0) || 0;
  const balance = totalIncome - totalExpense;

  const displayFinance = isFinanceRecursive && recursiveFinance ? recursiveFinance : {
    INCOME: totalIncome,
    EXPENSE: totalExpense,
    ENGINEERING: totalEngineering,
    balance: balance
  };

  if (isLoadingProject) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (isErrorProject) {
    const errorMsg = (projectError as any)?.response?.data?.message || '您沒有權限存取此專案，或專案不存在。';
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-10 shadow-xl border border-gray-100 text-center max-w-md w-full">
          <div className="bg-red-50 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="h-10 w-10 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">存取受限</h3>
          <p className="text-gray-500 mb-8">{errorMsg}</p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            回儀表板
          </button>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 頂部導覽列 */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Layout className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 hidden sm:block">專案詳情</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right mr-2 border-r border-gray-200 pr-4">
            <div className="text-sm font-bold text-gray-900">{user?.displayName || user?.email}</div>
            <div className="text-xs text-gray-500">{user?.email}</div>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </nav>

      {/* 專案標題與麵包屑 */}
      <div className="bg-white border-b border-gray-100 px-6 md:px-10 py-6">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <Link to="/dashboard" className="hover:text-blue-600 transition-colors">專案大廳</Link>
            {parentData && (
              <>
                <ChevronRight className="h-4 w-4" />
                <Link to={`/projects/${parentData.id}`} className="hover:text-blue-600 transition-colors">{parentData.name}</Link>
              </>
            )}
            <ChevronRight className="h-4 w-4" />
            <span className="text-gray-600 font-medium">{project.name}</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">{project.name}</h1>
              <p className="text-gray-500 mt-2 font-medium">{project.description || '目前暫無專案描述。'}</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-100 font-bold active:scale-95"
              >
                <FolderPlus className="h-4 w-4" />
                建立子專案
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 分頁標籤 */}
      <div className="bg-white px-6 md:px-10 border-b border-gray-200 sticky top-[61px] z-30">
        <div className="max-w-7xl mx-auto w-full flex gap-8">
          <button 
            onClick={() => setActiveTab('subprojects')}
            className={`py-4 px-2 font-bold text-sm transition-all border-b-2 relative ${
              activeTab === 'subprojects' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4" />
              子專案結構
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('members')}
            className={`py-4 px-2 font-bold text-sm transition-all border-b-2 relative ${
              activeTab === 'members' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              成員管理
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`py-4 px-2 font-bold text-sm transition-all border-b-2 relative ${
              activeTab === 'logs' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              項目日誌
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('activities')}
            className={`py-4 px-2 font-bold text-sm transition-all border-b-2 relative ${
              activeTab === 'activities' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              活動記錄
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`py-4 px-2 font-bold text-sm transition-all border-b-2 relative ${
              activeTab === 'settings' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              專案設定
            </div>
          </button>
        </div>
      </div>

      {/* 內容區 */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {activeTab === 'subprojects' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <ChevronRight className="h-5 w-5 text-blue-600" />
                階層樹狀圖
              </h3>
              
              {isLoadingTree ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                </div>
              ) : treeData ? (
                <div className="pl-4 border-l-2 border-blue-50 space-y-4">
                  <ProjectTreeNode node={treeData} isRoot setIsModalOpen={setIsModalOpen} />
                </div>
              ) : (
                <p className="text-gray-400 text-center py-10">目前尚無子專案結構成長。</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* 邀請區塊 */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-8 text-white shadow-xl shadow-blue-100 relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-2xl font-black mb-2 flex items-center gap-2">
                  <Mail className="h-6 w-6" />
                  邀請新夥伴
                </h3>
                <p className="text-blue-100 font-medium mb-6">透過 Email 邀請成員加入，並賦予檢視或管理權限。</p>
                <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 max-w-2xl">
                  <input 
                    type="email" 
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="partner@example.com" 
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 outline-none focus:bg-white/20 transition-all placeholder:text-blue-200"
                  />
                  <select 
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 outline-none text-white transition-all cursor-pointer"
                  >
                    <option value="VIEWER" className="text-gray-900">檢視者 (Viewer)</option>
                    <option value="MANAGER" className="text-gray-900">管理者 (Manager)</option>
                  </select>
                  <button 
                    disabled={isInviting}
                    className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition-all active:scale-95 whitespace-nowrap disabled:opacity-50"
                  >
                    {isInviting ? '發送中...' : '發送邀請'}
                  </button>
                </form>
                {inviteMsg && (
                  <div className={`mt-6 p-4 rounded-2xl border ${
                    inviteMsg.type === 'success' ? 'bg-green-500/20 border-green-400 text-green-100' : 'bg-red-500/20 border-red-400 text-red-100'
                  }`}>
                    <p className="font-bold mb-2">{inviteMsg.text}</p>
                    {inviteMsg.data && (
                      <div className="space-y-2 text-xs font-mono bg-black/20 p-3 rounded-xl">
                        <div className="flex justify-between items-center">
                          <span>邀請 ID:</span>
                          <span className="bg-white/10 px-2 py-1 rounded select-all">{inviteMsg.data.id}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>邀請 Token:</span>
                          <span className="bg-white/10 px-2 py-1 rounded select-all">{inviteMsg.data.token}</span>
                        </div>
                        <p className="text-[10px] text-blue-200 mt-2 italic">* 請複製以上資訊傳送給受邀者。</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Users className="h-48 w-48" />
              </div>
            </div>

            {/* 成員列表 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/30">
                    <h3 className="font-bold text-gray-900">成員名單</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {isLoadingMembers ? (
                      <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
                    ) : members?.map((m: any) => (
                      <div key={m.user.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold overflow-hidden">
                            {m.user.avatarUrl ? <img src={m.user.avatarUrl} alt="" /> : (m.user.displayName?.[0] || 'U')}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900">{m.user.displayName || m.user.email}</div>
                            <div className="text-xs text-gray-500 font-medium">{m.user.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            m.role === 'OWNER' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'
                          }`}>{m.role}</span>
                          
                          {isManager && m.role !== 'OWNER' && m.user.id !== user?.id && (
                            <button
                              onClick={() => handleRemoveMember(m.user.id)}
                              className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                              title="移出專案"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 待處理邀請 */}
              <div className="space-y-4">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/30">
                    <h3 className="font-bold text-gray-900">待處理邀請</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {!invitations || invitations.length === 0 ? (
                      <p className="p-8 text-center text-gray-400 text-sm">暫無待處理邀請</p>
                    ) : invitations.map((inv: any) => (
                      <div key={inv.id} className="p-4 group/inv">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-gray-900">{inv.inviteeEmail}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${
                            inv.status === 'PENDING' ? 'bg-yellow-50 text-yellow-600' :
                            inv.status === 'REJECTED' ? 'bg-red-50 text-red-600' :
                            'bg-gray-50 text-gray-400'
                          }`}>{inv.status}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center justify-between">
                          <span>角色: {inv.role}</span>
                          <div className="flex gap-2">
                            {inv.status === 'PENDING' ? (
                              <button 
                                onClick={() => handleCancelInvite(inv.id)}
                                className="opacity-0 group-hover/inv:opacity-100 text-red-500 font-bold hover:underline transition-all"
                              >
                                撤回
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleDeleteInvite(inv.id)}
                                className="opacity-0 group-hover/inv:opacity-100 text-gray-400 font-bold hover:underline transition-all"
                              >
                                刪除
                              </button>
                            )}
                          </div>
                        </div>
                        {inv.status === 'PENDING' && (
                          <div className="mt-2 text-[8px] text-gray-300 break-all select-all">ID: {inv.id}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* 財務匯總切換與標題 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-blue-600" />
                財務數據概覽
              </h3>
              <div className="flex bg-gray-100 p-1 rounded-xl self-start">
                <button
                  onClick={() => setIsFinanceRecursive(false)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                    !isFinanceRecursive ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  僅本層項目
                </button>
                <button
                  onClick={() => setIsFinanceRecursive(true)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    isFinanceRecursive ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Layers className="h-3 w-3" />
                  包含子專案
                </button>
              </div>
            </div>

            {/* 財務概覽卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="bg-green-50 p-3 rounded-2xl text-green-600">
                  <ArrowUpCircle className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider">總收入</div>
                  <div className="text-xl font-black text-gray-900">HK$ {displayFinance.INCOME.toLocaleString()}</div>
                </div>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="bg-red-50 p-3 rounded-2xl text-red-600">
                  <ArrowDownCircle className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider">總支出</div>
                  <div className="text-xl font-black text-gray-900">HK$ {displayFinance.EXPENSE.toLocaleString()}</div>
                </div>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="bg-blue-50 p-3 rounded-2xl text-blue-600">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider">結餘 / 淨利</div>
                  <div className={`text-xl font-black ${displayFinance.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    HK$ {displayFinance.balance.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 pt-6">
              <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <ClipboardList className="h-6 w-6 text-blue-600" />
                項目日誌紀錄
              </h3>
              <button
                onClick={() => setIsLogModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-100 font-bold active:scale-95"
              >
                <Plus className="h-4 w-4" />
                新增日誌
              </button>
            </div>

            {isLoadingLogs ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
              </div>
            ) : isErrorLogs ? (
              <div className="bg-red-50 border border-red-100 rounded-3xl py-20 flex flex-col items-center justify-center text-center">
                <h4 className="text-lg font-bold text-red-900 mb-2">無法載入日誌</h4>
                <p className="text-red-500 max-w-xs px-4">您可能沒有權限查看此專案的日誌內容。</p>
              </div>
            ) : !logs || logs.length === 0 ? (
              <div className="bg-white rounded-3xl p-20 shadow-sm border border-gray-100 text-center">
                <div className="bg-gray-50 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ClipboardList className="h-10 w-10 text-gray-300" />
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">尚無日誌紀錄</h4>
                <p className="text-gray-400 max-w-xs mx-auto mb-8">開始為您的專案紀錄進度、支出或回報工作報告吧！</p>
                <button
                  onClick={() => setIsLogModalOpen(true)}
                  className="text-blue-600 font-bold hover:underline"
                >
                  立即建立第一條日誌
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {logs.map((log) => {
                  const typeInfo = LOG_TYPE_MAP[log.type] || LOG_TYPE_MAP.REPORT;
                  const Icon = typeInfo.icon;
                  return (
                    <div key={log.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:border-blue-200 transition-all group">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2 rounded-lg ${typeInfo.bgClass} ${typeInfo.colorClass}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${typeInfo.bgClass} ${typeInfo.colorClass}`}>
                              {typeInfo.label}
                            </span>
                            <span className="text-xs text-gray-400 font-medium">
                              {new Date(log.createdAt).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                          </div>
                          
                          <h4 className="text-lg font-black text-gray-900 mb-2">{log.title}</h4>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed mb-4">{log.content}</p>
                          
                          <div className="flex flex-wrap items-center gap-6 text-xs border-t border-gray-50 pt-4">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-[10px]">
                                {log.author?.displayName?.[0] || 'U'}
                              </div>
                              <span className="font-bold text-gray-700">{log.author?.displayName || log.author?.email}</span>
                            </div>
                            
                            {log.amount !== null && (
                              <div className="flex items-center gap-1 font-black text-gray-900">
                                <span className="text-gray-400">金額:</span>
                                <span className={log.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}>
                                  HK$ {Number(log.amount).toLocaleString()}
                                </span>
                              </div>
                            )}

                            {log.startDate && (
                              <div className="flex items-center gap-1 text-gray-500 font-bold">
                                <Calendar className="h-3 w-3" />
                                <span>{new Date(log.startDate).toLocaleDateString()}</span>
                                {log.endDate && (
                                  <>
                                    <span>~</span>
                                    <span>{new Date(log.endDate).toLocaleDateString()}</span>
                                  </>
                                )}
                              </div>
                            )}
                            
                            {log.attachments && (log.attachments as any[]).length > 0 && (
                              <div className="flex items-center gap-2">
                                <Paperclip className="h-3 w-3 text-gray-400" />
                                <div className="flex gap-2">
                                  {(log.attachments as any[]).map((file, idx) => (
                                    <a 
                                      key={idx} 
                                      href={file.url} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="text-blue-500 hover:underline font-bold"
                                    >
                                      {file.name}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {(log.userId === user?.id || project.ownerUserId === user?.id) && (
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2 mb-6">
              <History className="h-6 w-6 text-blue-600" />
              專案活動記錄
            </h3>

            {isLoadingAudit ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
              </div>
            ) : !auditLogs || auditLogs.length === 0 ? (
              <p className="text-gray-400 text-center py-20">尚無任何活動記錄。</p>
            ) : (
              <div className="relative pl-8 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                {auditLogs.map((log) => (
                  <div key={log.id} className="relative group">
                    <div className="absolute -left-8 top-1 h-6 w-6 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center z-10 group-hover:scale-110 transition-transform">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-gray-900">{log.actor.displayName || log.actor.email}</span>
                        <span className="text-gray-500">{AUDIT_ACTION_MAP[log.actionType] || log.actionType}</span>
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-2">
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                        {log.payload?.name && <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-bold">{log.payload.name}</span>}
                        {log.payload?.title && <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-bold">{log.payload.title}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-3xl p-10 shadow-sm border border-gray-100 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-gray-50 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Settings className="h-10 w-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">專案進階設定</h3>
            <p className="text-gray-400 max-w-sm mx-auto mb-8">在這裡您可以修改專案名稱、封存專案或進行更進階的權限配置。此功能開發中。</p>
            <div className="flex justify-center gap-4">
              <button className="border border-gray-200 px-6 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">封存此專案</button>
              <button className="bg-red-50 text-red-600 px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-red-100 transition-all">刪除專案</button>
            </div>
          </div>
        )}
      </main>

      <CreateProjectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={handleCreateSuccess}
        parentId={id}
      />

      <CreateProjectLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['projects', id, 'logs'] })}
        projectId={id!}
      />
    </div>
  );
}

function ProjectTreeNode({ node, isRoot = false, setIsModalOpen }: { node: any, isRoot?: boolean, setIsModalOpen: (open: boolean) => void }) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className={`${!isRoot ? 'ml-6' : ''}`}>
      <div className="group flex items-center gap-3 py-2 px-3 hover:bg-blue-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-blue-100 active:scale-[0.99]">
        <div 
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setIsExpanded(!isExpanded);
          }}
          className={`p-1 rounded-md transition-colors ${hasChildren ? 'hover:bg-blue-100 text-blue-400' : 'opacity-0 cursor-default'}`}
        >
          <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </div>
        
        <div 
          onClick={() => navigate(`/projects/${node.id}`)}
          className="flex-1 flex items-center gap-3"
        >
          <div className={`p-2 rounded-lg ${isRoot ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'} group-hover:bg-blue-600 group-hover:text-white transition-all`}>
            <Folder className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{node.name}</div>
            {node.description && <div className="text-[10px] text-gray-400 line-clamp-1">{node.description}</div>}
          </div>
        </div>

        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsModalOpen(true);
          }}
          className="opacity-0 group-hover:opacity-100 p-2 hover:bg-blue-100 text-blue-500 rounded-lg transition-all"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {isExpanded && hasChildren && (
        <div className="mt-2 space-y-2 border-l-2 border-gray-50 ml-6 pl-2">
          {node.children.map((child: any) => (
            <ProjectTreeNode key={child.id} node={child} setIsModalOpen={setIsModalOpen} />
          ))}
        </div>
      )}
    </div>
  );
}
