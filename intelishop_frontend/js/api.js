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

function resolveCredentialsMode(url, includeCredentials, explicitCredentials) {
    if (explicitCredentials) return explicitCredentials;
    if (includeCredentials === true) return 'include';
    if (includeCredentials === false) return 'omit';

    try {
        const targetUrl = new URL(url, window.location.origin);
        return targetUrl.origin === window.location.origin ? 'same-origin' : 'omit';
    } catch (_error) {
        return 'omit';
    }
}

function mapHttpError(status, serverMessage) {
    // Nếu server có trả về message cụ thể (và không phải lỗi hệ thống 500), hãy dùng nó.
    // Ví dụ: Login sai pass trả về 401 + "Sai mật khẩu" -> Hiển thị "Sai mật khẩu".
    if (serverMessage && status < 500) {
        return serverMessage;
    }

    if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
    if (status === 404) return 'Không tìm thấy dữ liệu hoặc API.';
    if (status >= 500) return 'Máy chủ đang lỗi tạm thời. Vui lòng thử lại sau ít phút.';
    return serverMessage || `Yêu cầu thất bại (${status})`;
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
        includeCredentials = null,
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
                credentials: resolveCredentialsMode(url, includeCredentials, options.credentials),
                signal: controller.signal,
            });

            window.clearTimeout(timeout);
            const data = await parseResponsePayload(response);

            if (!response.ok || data?.success === false) {
                const apiMessage = data?.message || data?.detail || '';
                // Pass apiMessage as the second argument (previously fallbackMessage)
                const normalizedMessage = mapHttpError(response.status, apiMessage);
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
                    throw new Error('Kết nối máy chủ quá lâu. Vui lòng thử lại.');
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

    throw lastError || new Error('Không thể kết nối máy chủ.');
}
