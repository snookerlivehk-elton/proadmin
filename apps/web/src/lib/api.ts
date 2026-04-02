import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://hpbackend-production-4b7e.up.railway.app';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 使用者介面定義
export interface User {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl?: string;
}

// 專案介面定義
export interface Project {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  ownerUserId: string;
  status: 'active' | 'archived';
  path: string;
  createdAt: string;
  updatedAt: string;
}
