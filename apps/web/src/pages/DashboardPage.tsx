import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Layout, LogOut, FolderPlus, Search, ChevronRight, Folder } from 'lucide-react';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 頂部導覽列 */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Layout className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">專案大廳</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right mr-2">
            <div className="text-sm font-medium text-gray-900">{user?.displayName || user?.email}</div>
            <div className="text-xs text-gray-500">{user?.email}</div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-lg transition-colors"
            title="登出"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </nav>

      {/* 主要內容區 */}
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">我的專案</h2>
            <p className="text-gray-500 mt-1">管理與協作您的階層式專案</p>
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-md active:scale-95">
            <FolderPlus className="h-4 w-4" />
            建立新專案
          </button>
        </div>

        {/* 搜尋與篩選 */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="搜尋專案名稱..." 
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <select className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
            <option>所有專案</option>
            <option>活躍中</option>
            <option>已封存</option>
          </select>
        </div>

        {/* 專案列表 (暫時靜態) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div className="bg-blue-50 p-3 rounded-xl group-hover:bg-blue-100 transition-colors">
                <Folder className="h-6 w-6 text-blue-600" />
              </div>
              <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">範例頂層專案</h3>
            <p className="text-gray-500 text-sm mt-2 line-clamp-2">這是您的第一個專案，您可以在此建立無限層級的子專案並邀請成員。</p>
            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
              <span>建立於 2024/04/02</span>
              <span className="px-2 py-1 bg-green-50 text-green-600 rounded-full font-medium uppercase tracking-wider">Active</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
