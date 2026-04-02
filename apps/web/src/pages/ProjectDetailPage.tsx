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
  Mail,
  Loader2,
  Plus
} from 'lucide-react';
import { api, type Project, type User } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import CreateProjectModal from '../components/CreateProjectModal';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'subprojects' | 'members' | 'settings'>('subprojects');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'VIEWER' | 'MANAGER'>('VIEWER');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // 取得專案詳情
  const { data: project, isLoading: isLoadingProject } = useQuery<Project>({
    queryKey: ['projects', id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}`);
      return data;
    },
    enabled: !!id
  });

  // 取得成員列表
  const { data: members, isLoading: isLoadingMembers } = useQuery<any[]>({
    queryKey: ['projects', id, 'members'],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}/members`);
      return data;
    },
    enabled: !!id && activeTab === 'members'
  });

  // 取得待處理邀請
  const { data: invitations, refetch: refetchInvitations } = useQuery<any[]>({
    queryKey: ['projects', id, 'invitations'],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}/invitations`);
      return data;
    },
    enabled: !!id && activeTab === 'members'
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setIsInviting(true);
    setInviteMsg(null);
    try {
      await api.post(`/projects/${id}/invitations`, { email: inviteEmail, role: inviteRole });
      setInviteMsg({ type: 'success', text: `已向 ${inviteEmail} 發送邀請！` });
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

  if (isLoadingProject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">找不到專案</h2>
        <button 
          onClick={() => navigate('/dashboard')}
          className="text-blue-600 hover:underline flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> 返回儀表板
        </button>
      </div>
    );
  }

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
                  <p className={`mt-4 text-sm font-bold ${inviteMsg.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                    {inviteMsg.text}
                  </p>
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
                      <div key={inv.id} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-gray-900">{inv.inviteeEmail}</span>
                          <span className="text-[10px] bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded font-black uppercase">PENDING</span>
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center justify-between">
                          <span>角色: {inv.role}</span>
                          <span>邀請人: {inv.inviter.displayName || inv.inviter.email}</span>
                        </div>
                        {/* 這裡可以加一個複製 Token 的功能，方便開發測試 */}
                        <div className="mt-2 text-[8px] text-gray-300 break-all select-all">ID: {inv.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
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
