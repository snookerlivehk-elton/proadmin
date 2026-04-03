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

export type ProjectLogType = 'ENGINEERING' | 'EXPENSE' | 'INCOME' | 'REPORT' | 'COMPLETION';

export interface ProjectLog {
  id: string;
  projectId: string;
  userId: string;
  type: ProjectLogType;
  title: string;
  content: string;
  amount: number | null;
  startDate: string | null;
  endDate: string | null;
  attachments: { name: string; url: string }[] | null;
  createdAt: string;
  updatedAt: string;
  author?: {
    displayName: string | null;
    email: string;
    avatarUrl?: string;
  };
}

export interface FinanceSummary {
  INCOME: number;
  EXPENSE: number;
  ENGINEERING: number;
  balance: number;
}

export interface AuditLog {
  id: string;
  actorUserId: string;
  actionType: string;
  entityType: string;
  entityId: string;
  projectId: string | null;
  payload: any;
  createdAt: string;
  actor: {
    displayName: string | null;
    email: string;
    avatarUrl?: string;
  };
}
