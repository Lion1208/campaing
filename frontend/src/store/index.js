import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nexus-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('nexus-token');
      localStorage.removeItem('nexus-user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth Store
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (username, password) => {
        const response = await api.post('/auth/login', { username, password });
        const { token, user } = response.data;
        localStorage.setItem('nexus-token', token);
        set({ user, token, isAuthenticated: true });
        return user;
      },

      logout: () => {
        localStorage.removeItem('nexus-token');
        set({ user: null, token: null, isAuthenticated: false });
      },

      checkAuth: async () => {
        const token = localStorage.getItem('nexus-token');
        if (!token) {
          set({ isAuthenticated: false });
          return false;
        }
        try {
          const response = await api.get('/auth/me');
          set({ user: response.data, token, isAuthenticated: true });
          return true;
        } catch {
          localStorage.removeItem('nexus-token');
          set({ user: null, token: null, isAuthenticated: false });
          return false;
        }
      },
    }),
    {
      name: 'nexus-auth',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);

// Connections Store
export const useConnectionsStore = create((set, get) => ({
  connections: [],
  loading: false,
  error: null,

  fetchConnections: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/connections');
      set({ connections: response.data, loading: false });
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Erro ao carregar conexões', loading: false });
    }
  },

  createConnection: async (name) => {
    const response = await api.post('/connections', { name });
    set((state) => ({ connections: [...state.connections, response.data] }));
    return response.data;
  },

  connectWhatsApp: async (connectionId) => {
    const response = await api.post(`/connections/${connectionId}/connect`);
    return response.data;
  },

  getQRCode: async (connectionId) => {
    const response = await api.get(`/connections/${connectionId}/qr`);
    return response.data;
  },

  refreshGroups: async (connectionId) => {
    const response = await api.post(`/connections/${connectionId}/refresh-groups`);
    return response.data;
  },

  disconnectWhatsApp: async (connectionId) => {
    await api.post(`/connections/${connectionId}/disconnect`);
    await get().fetchConnections();
  },

  deleteConnection: async (connectionId) => {
    await api.delete(`/connections/${connectionId}`);
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== connectionId),
    }));
  },
}));

// Groups Store
export const useGroupsStore = create((set, get) => ({
  groups: [],
  loading: false,

  fetchGroups: async () => {
    set({ loading: true });
    try {
      const response = await api.get('/groups');
      set({ groups: response.data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchGroupsByConnection: async (connectionId) => {
    const response = await api.get(`/connections/${connectionId}/groups`);
    return response.data;
  },
}));

// Campaigns Store
export const useCampaignsStore = create((set, get) => ({
  campaigns: [],
  loading: false,
  error: null,

  fetchCampaigns: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/campaigns');
      set({ campaigns: response.data, loading: false });
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Erro ao carregar campanhas', loading: false });
    }
  },

  createCampaign: async (data) => {
    const response = await api.post('/campaigns', data);
    set((state) => ({ campaigns: [response.data, ...state.campaigns] }));
    return response.data;
  },

  duplicateCampaign: async (campaignId) => {
    const response = await api.post(`/campaigns/${campaignId}/duplicate`);
    set((state) => ({ campaigns: [response.data, ...state.campaigns] }));
    return response.data;
  },

  updateCampaign: async (campaignId, data) => {
    const response = await api.put(`/campaigns/${campaignId}`, data);
    await get().fetchCampaigns();
    return response.data;
  },

  startCampaign: async (campaignId) => {
    const response = await api.post(`/campaigns/${campaignId}/start`);
    await get().fetchCampaigns();
    return response.data;
  },

  pauseCampaign: async (campaignId) => {
    await api.post(`/campaigns/${campaignId}/pause`);
    await get().fetchCampaigns();
  },

  resumeCampaign: async (campaignId) => {
    await api.post(`/campaigns/${campaignId}/resume`);
    await get().fetchCampaigns();
  },

  deleteCampaign: async (campaignId) => {
    await api.delete(`/campaigns/${campaignId}`);
    set((state) => ({
      campaigns: state.campaigns.filter((c) => c.id !== campaignId),
    }));
  },
}));

// Images Store
export const useImagesStore = create((set, get) => ({
  images: [],
  loading: false,

  fetchImages: async () => {
    set({ loading: true });
    try {
      const response = await api.get('/images');
      set({ images: response.data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    set((state) => ({ images: [...state.images, response.data] }));
    return response.data;
  },

  deleteImage: async (imageId) => {
    await api.delete(`/images/${imageId}`);
    set((state) => ({
      images: state.images.filter((i) => i.id !== imageId),
    }));
  },
}));

// Dashboard Store
export const useDashboardStore = create((set) => ({
  stats: null,
  loading: false,

  fetchStats: async () => {
    set({ loading: true });
    try {
      const response = await api.get('/dashboard/stats');
      set({ stats: response.data, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));

// Admin Store
export const useAdminStore = create((set, get) => ({
  users: [],
  stats: null,
  loading: false,

  fetchUsers: async () => {
    set({ loading: true });
    try {
      const response = await api.get('/admin/users');
      set({ users: response.data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createUser: async (data) => {
    const response = await api.post('/admin/users', data);
    set((state) => ({ users: [...state.users, response.data] }));
    return response.data;
  },

  updateUser: async (userId, data) => {
    const response = await api.put(`/admin/users/${userId}`, data);
    set((state) => ({
      users: state.users.map((u) => (u.id === userId ? response.data : u)),
    }));
    return response.data;
  },

  deleteUser: async (userId) => {
    await api.delete(`/admin/users/${userId}`);
    set((state) => ({
      users: state.users.filter((u) => u.id !== userId),
    }));
  },

  fetchAdminStats: async () => {
    try {
      const response = await api.get('/admin/stats');
      set({ stats: response.data });
    } catch {
      // ignore
    }
  },
}));

// UI Store for mobile menu
export const useUIStore = create((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));

export { api };
