import { describe, it, expect, vi, beforeEach } from 'vitest';
import API from '../api.js';

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Suppress session-expired event side-effects
const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

function jsonResponse(body, status = 200) {
  return Promise.resolve({
    status,
    json: () => Promise.resolve(body)
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  dispatchSpy.mockClear();
  // Reset CSRF token between tests
  API.setCsrfToken(null);
});

describe('API.get', () => {
  it('sends GET request with correct URL and credentials', async () => {
    mockFetch.mockReturnValue(jsonResponse({ success: true }));

    const result = await API.get('/books/index.php');

    expect(mockFetch).toHaveBeenCalledWith('/api/books/index.php', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    expect(result).toEqual({ success: true });
  });

  it('dispatches session-expired on 401 for non-auth endpoints', async () => {
    mockFetch.mockReturnValue(jsonResponse({ success: false }, 401));

    await API.get('/books/index.php');

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'session-expired' })
    );
  });

  it('does NOT dispatch session-expired on 401 for auth endpoints', async () => {
    mockFetch.mockReturnValue(jsonResponse({ success: false }, 401));

    await API.get('/auth/check.php');

    expect(dispatchSpy).not.toHaveBeenCalled();
  });
});

describe('API.post', () => {
  it('sends POST request with JSON body', async () => {
    mockFetch.mockReturnValue(jsonResponse({ success: true }));

    const data = { username: 'test', password: 'pass' };
    await API.post('/auth/login.php', data);

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/login.php', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  });

  it('includes CSRF token when set', async () => {
    API.setCsrfToken('abc123');
    mockFetch.mockReturnValue(jsonResponse({ success: true }));

    await API.post('/books/index.php', { title: 'Test' });

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders['X-CSRF-Token']).toBe('abc123');
  });

  it('omits CSRF header when token is null', async () => {
    mockFetch.mockReturnValue(jsonResponse({ success: true }));

    await API.post('/books/index.php', {});

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders['X-CSRF-Token']).toBeUndefined();
  });
});

describe('API.put', () => {
  it('sends PUT request with CSRF token', async () => {
    API.setCsrfToken('token-xyz');
    mockFetch.mockReturnValue(jsonResponse({ success: true }));

    await API.put('/books/index.php', { id: 1, title: 'Updated' });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/books/index.php');
    expect(options.method).toBe('PUT');
    expect(options.headers['X-CSRF-Token']).toBe('token-xyz');
  });
});

describe('API.delete', () => {
  it('sends DELETE request with CSRF token', async () => {
    API.setCsrfToken('del-token');
    mockFetch.mockReturnValue(jsonResponse({ success: true }));

    await API.delete('/books/index.php?id=5');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/books/index.php?id=5');
    expect(options.method).toBe('DELETE');
    expect(options.headers['X-CSRF-Token']).toBe('del-token');
  });

  it('dispatches session-expired on 401 for non-auth endpoints', async () => {
    mockFetch.mockReturnValue(jsonResponse({}, 401));

    await API.delete('/books/index.php?id=1');

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'session-expired' })
    );
  });
});

describe('API.checkAuth', () => {
  it('stores CSRF token from response', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ success: true, csrf_token: 'new-csrf-token' })
    );

    await API.checkAuth();

    // Verify the token is stored by making a POST and checking headers
    mockFetch.mockReturnValue(jsonResponse({ success: true }));
    await API.post('/test', {});

    const callHeaders = mockFetch.mock.calls[1][1].headers;
    expect(callHeaders['X-CSRF-Token']).toBe('new-csrf-token');
  });
});
