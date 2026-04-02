import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Layout, LogOut, FolderPlus, Search, ChevronRight, Folder, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Project } from '../lib/api';
import CreateProjectModal from '../components/CreateProjectModal';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 取得最近專案
  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['projects', 'recent'],
    queryFn: async () => {
      const { data } = await api.get('/projects/recent');
      return data;
    }
  });

  // 搜尋功能
  const { data: searchResults, isFetching: isSearching } = useQuery<Project[]>({
    queryKey: ['projects', 'search', searchQuery],
    queryFn: async () => {
      if (!searchQuery) return [];
      const { data } = await api.get(`/projects/search?q=${searchQuery}`);
      return data;
    },
    enabled: searchQuery.length > 0
  });

  const displayProjects = searchQuery ? searchResults : projects;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCreateSuccess = (newProject: Project) => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    // 可以選擇直接跳轉到專案詳情頁面 (待實作)
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 頂部導覽列 */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-40 backdrop-blur-md bg-white/80">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg shadow-blue-200 shadow-md">
            <Layout className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">專案協作平台</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right mr-2 border-r border-gray-200 pr-4">
            <div className="text-sm font-bold text-gray-900 leading-tight">{user?.displayName || user?.email}</div>
            <div className="text-xs text-gray-500 font-medium">{user?.email}</div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-xl transition-all active:scale-90"
            title="登出"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </nav>

      {/* 主要內容區 */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">我的專案</h2>
            <p className="text-gray-500 mt-2 font-medium text-lg">管理與協作您的階層式專案</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-xl shadow-blue-200 active:scale-95 font-bold"
          >
            <FolderPlus className="h-5 w-5" />
            建立新專案
          </button>
        </div>

        {/* 搜尋與篩選 */}
        <div className="bg-white p-5 rounded-3xl shadow-xl shadow-gray-100 border border-gray-100 mb-8 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="搜尋專案名稱..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-500 outline-none transition-all font-medium text-gray-700"
            />
            {isSearching && (
              <div className="absolute right-4 top-3.5">
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              </div>
            )}
          </div>
          <select className="bg-gray-50 border border-transparent rounded-2xl px-6 py-3 text-sm font-bold text-gray-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer">
            <option>所有專案</option>
            <option>活躍中</option>
            <option>已封存</option>
          </select>
        </div>

        {/* 專案列表 */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
            <p className="text-gray-400 font-medium">載入專案中...</p>
          </div>
        ) : !displayProjects || displayProjects.length === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-dashed border-gray-100 py-24 flex flex-col items-center justify-center text-center">
            <div className="bg-gray-50 p-6 rounded-full mb-6">
              <Folder className="h-12 w-12 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {searchQuery ? '找不到相關專案' : '目前還沒有專案'}
            </h3>
            <p className="text-gray-500 max-w-xs px-4">
              {searchQuery ? '試試其他關鍵字，或是建立一個新專案。' : '點擊右上角的按鈕開始建立您的第一個頂層專案吧！'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {displayProjects.map((project) => (
              <div 
                key={project.id}
                className="bg-white p-7 rounded-3xl border border-gray-100 shadow-lg shadow-gray-50 hover:shadow-2xl hover:shadow-blue-100 hover:border-blue-100 transition-all group cursor-pointer relative overflow-hidden active:scale-[0.98]"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="bg-blue-50 p-4 rounded-2xl group-hover:bg-blue-600 group-hover:rotate-6 transition-all duration-300">
                    <Folder className="h-7 w-7 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <ChevronRight className="h-6 w-6 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 group-hover:text-blue-600 transition-colors mb-3 line-clamp-1">
                  {project.name}
                </h3>
                <p className="text-gray-500 text-sm font-medium line-clamp-2 min-h-[40px]">
                  {project.description || '暫無描述'}
                </p>
                <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    project.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {project.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <CreateProjectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
