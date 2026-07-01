import api from './api';

const animationApi = {
  generate: (sessionId: number) =>
    api.post(`/api/sessions/${sessionId}/animation/generate`).then(r => r.data),
  status: (sessionId: number) =>
    api.get(`/api/sessions/${sessionId}/animation/status`).then(r => r.data),
  script: (sessionId: number) =>
    api.get(`/api/sessions/${sessionId}/animation/script`).then(r => r.data),
};

export default animationApi;
