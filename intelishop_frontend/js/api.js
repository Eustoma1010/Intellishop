const DEFAULT_TIMEOUT_MS = 15000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAuthHeaders() {
    const headers = {};
    const token = localStorage.getItem('access_token');
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

function mapHttpError(status, fallbackMessage) {
    if (status === 401) return 'Phien dang nhap da het han. Vui long dang nhap lai.';
    if (status === 403) return 'Ban khong co quyen thuc hien thao tac nay.';
    if (status === 404) return 'Khong tim thay du lieu hoac API.';
    if (status >= 500) return 'Server dang loi tam thoi. Vui long thu lai sau it phut.';
    return fallbackMessage;
}

async function parseResponsePayload(response) {
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
        return response.json().catch(() => ({}));
    }

    const text = await response.text().catch(() => '');
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch (_error) {
        return { message: text };
    }
}

export async function requestJson(url, options = {}, config = {}) {
    const {
        timeoutMs = DEFAULT_TIMEOUT_MS,
        retryGet = 1,
        attachAuth = true,
        includeCredentials = true,
        onUnauthorized = null,
    } = config;

    const method = (options.method || 'GET').toUpperCase();
    const maxAttempts = method === 'GET' ? retryGet + 1 : 1;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

        try {
            const headers = {
                Accept: 'application/json',
                ...(attachAuth ? getAuthHeaders() : {}),
                ...(options.headers || {}),
            };

            const response = await fetch(url, {
                ...options,
                headers,
                credentials: includeCredentials ? 'include' : options.credentials,
                signal: controller.signal,
            });

            window.clearTimeout(timeout);
            const data = await parseResponsePayload(response);

            if (!response.ok || data?.success === false) {
                const apiMessage = data?.message || data?.detail || '';
                const normalizedMessage = mapHttpError(response.status, apiMessage || `Yeu cau that bai (${response.status})`);
                const error = new Error(normalizedMessage);
                error.status = response.status;
                throw error;
            }

            return data;
        } catch (error) {
            window.clearTimeout(timeout);
            const isAbort = error?.name === 'AbortError';
            const status = error?.status || 0;
            const shouldRetry = method === 'GET' && attempt < maxAttempts && (isAbort || status >= 500 || status === 0);

            if (!shouldRetry) {
                if (isAbort) {
                    throw new Error('Ket noi server qua lau. Vui long thu lai.');
                }
                if (status === 401 && typeof onUnauthorized === 'function') {
                    onUnauthorized();
                }
                throw error;
            }

            lastError = error;
            await sleep(350 * attempt);
        }
    }

    throw lastError || new Error('Khong the ket noi server.');
}

