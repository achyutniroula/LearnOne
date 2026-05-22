import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
})

// Attach JWT from in-memory store on every request
let _token: string | null = null

export function setToken(token: string | null) {
  _token = token
}

api.interceptors.request.use((config) => {
  if (_token) {
    config.headers.Authorization = `Bearer ${_token}`
  }
  return config
})

export default api
