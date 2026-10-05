export class ApiError extends Error {
  constructor(code, status) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function createApiClient(fetchImpl = globalThis.fetch.bind(globalThis)) {
  async function request(route, { body, ...options } = {}) {
    const response = await fetchImpl(route, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(options.headers ?? {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(data.error ?? 'request_failed', response.status);
    return data;
  }

  return {
    async register(email, password, children) {
      return (await request('/api/auth/register', { method: 'POST', body: { email, password, children } })).user;
    },
    async login(email, password) {
      return (await request('/api/auth/login', { method: 'POST', body: { email, password } })).user;
    },
    async logout() {
      await request('/api/auth/logout', { method: 'POST' });
    },
    async getCurrentUser() {
      return (await request('/api/auth/me')).user;
    },
    async updateProfile(email, children) {
      return (await request('/api/profile', { method: 'PATCH', body: { email, children } })).user;
    },
    async getProgress() {
      return request('/api/progress');
    },
    async saveProgress(state) {
      return request('/api/progress', { method: 'PUT', body: state });
    },
    async createResult(result) {
      return (await request('/api/results', { method: 'POST', body: result })).result;
    },
    async getResults() {
      return (await request('/api/results')).results;
    },
    async getGallery() {
      return (await request('/api/gallery')).results;
    },
    async setResultPublished(id, isPublished) {
      return (await request(`/api/results/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: { isPublished }
      })).result;
    },
    async deleteResult(id) {
      await request(`/api/results/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }
  };
}
