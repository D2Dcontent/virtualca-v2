import axios from 'axios'

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
})

API.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  const cid = localStorage.getItem('company_id')
  if (token) cfg.headers['Authorization'] = `Bearer ${token}`
  if (cid) cfg.headers['X-Company-ID'] = cid
  return cfg
})

export const authAPI = {
  login: (email: string, password: string) => API.post('/api/auth/login', { email, password }),
  signup: (email: string, password: string) => API.post('/api/auth/signup', { email, password }),
}

export const companyAPI = {
  list: () => API.get('/api/companies'),
  create: (name: string) => API.post('/api/companies', { name }),
  delete: (id: number) => API.delete(`/api/companies/${id}`),
}

export const uploadAPI = {
  uploadFiles: (form: FormData) => API.post('/api/upload/files', form),
  status: () => API.get('/api/files/status'),
}

export const auditAPI = {
  run: () => API.post('/api/audit'),
  result: () => API.get('/api/audit/result'),
  history: () => API.get('/api/audit/history'),
}

export const askCAAPI = {
  chat: (question: string, context: string, history: any[]) =>
    API.post('/api/ca-chat', { question, context, history }),
}

export const dashboardAPI = {
  get: () => API.get('/api/dashboard'),
}

export default API
