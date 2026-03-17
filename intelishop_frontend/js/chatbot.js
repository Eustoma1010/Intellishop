import { API_BASE_URL, $ } from './config.js';
import { addToCart, proceedToCheckout } from './cart.js';

// ==================================================
// HÀM QUẢN LÝ TRẠNG THÁI Ô NHẬP LIỆU (MỚI)
// ==================================================
function setInputState(isDisabled, placeholderText) {
    const inputField = $('chat-input');
    // Tìm nút Gửi dựa trên thuộc tính onclick
    const sendBtn = document.querySelector('button[onclick="sendChatMessage()"]');

    inputField.disabled = isDisabled;
    if (placeholderText) inputField.placeholder = placeholderText;

    if (isDisabled) {
        // Giao diện khi bị khóa
        inputField.classList.add('bg-gray-200', 'cursor-not-allowed', 'opacity-70');
        inputField.classList.remove('bg-pink-50/50');
        if(sendBtn) {
            sendBtn.disabled = true;
            sendBtn.classList.add('opacity-50', 'cursor-not-allowed');
            sendBtn.classList.remove('hover:shadow-lg', 'hover:scale-105', 'hover:bg-pink-700');
        }
    } else {
        // Giao diện khi mở khóa
        inputField.classList.remove('bg-gray-200', 'cursor-not-allowed', 'opacity-70');
        inputField.classList.add('bg-pink-50/50');
        if(sendBtn) {
            sendBtn.disabled = false;
            sendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            sendBtn.classList.add('hover:shadow-lg', 'hover:scale-105');
        }
    }
}

export function toggleAIPanel() {
    const panel = $('ai-side-panel');
    const toggleBtn = $('chat-toggle-btn');
    if (panel.classList.contains('translate-x-full')) {
        panel.classList.remove('translate-x-full');
        toggleBtn.classList.add('hidden');
        if(window.innerWidth > 640) document.body.style.paddingRight = '400px';
        setTimeout(() => $('chat-input').focus(), 300);
    } else {
        panel.classList.add('translate-x-full');
        toggleBtn.classList.remove('hidden');
        document.body.style.paddingRight = '0';
    }
}

export function handleChatKeyPress(event) {
    if (event.key === 'Enter') sendChatMessage();
}

export async function sendChatMessage() {
    const inputField = $('chat-input');
    const message = inputField.value.trim();

    // Nếu ô chat đang bị khóa hoặc không có chữ thì không làm gì cả
    if (!message || inputField.disabled) return;

    appendMessage('user', message);
    inputField.value = '';

    const formData = new FormData();
    formData.append('message', message);
    await processAIRequest(formData);
}

// ==================================================
// HỆ THỐNG VOICE CALL (TỰ ĐỘNG GỬI & KHÓA UI)
// ==================================================
let recognition;
let isCallMode = false;
let silenceTimeout = null;
let finalMessageBuffer = "";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.interimResults = true;
    recognition.continuous = true;
}

export async function toggleVoiceRecording() {
    const micBtn = $('mic-btn');
    const inputField = $('chat-input');

    if (!recognition) {
        alert("Trình duyệt không hỗ trợ nhận diện giọng nói. Vui lòng dùng Chrome.");
        return;
    }

    // NẾU ĐANG TRONG CUỘC GỌI -> BẤM ĐỂ TẮT (CÚP MÁY)
    if (isCallMode) {
        isCallMode = false;
        recognition.stop();
        clearTimeout(silenceTimeout);

        micBtn.classList.remove('bg-red-500', 'text-white', 'animate-pulse');
        micBtn.classList.add('text-pink-500', 'hover:bg-pink-50');

        // Mở khóa UI khi cúp máy
        setInputState(false, "Nhập tin nhắn...");
        inputField.value = '';
        return;
    }

    // BẮT ĐẦU CHẾ ĐỘ CUỘC GỌI
    isCallMode = true;
    finalMessageBuffer = "";
    inputField.value = "";

    micBtn.classList.remove('text-pink-500', 'hover:bg-pink-50');
    micBtn.classList.add('bg-red-500', 'text-white', 'animate-pulse');

    // Khóa luôn UI gõ phím khi đang bật Mic
    setInputState(true, "Đang nghe... (Tự động gửi khi bạn dừng nói)");

    try { recognition.start(); } catch (e) {}

    recognition.onresult = (event) => {
        if (!isCallMode) return;
        clearTimeout(silenceTimeout);

        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) finalMessageBuffer += event.results[i][0].transcript + " ";
            else interimTranscript += event.results[i][0].transcript;
        }

        inputField.value = finalMessageBuffer + interimTranscript;

        silenceTimeout = setTimeout(() => {
            const finalMessage = inputField.value.trim();
            if (finalMessage) {
                recognition.stop();
                inputField.value = '';
                finalMessageBuffer = '';

                appendMessage('user', finalMessage);

                const formData = new FormData();
                formData.append('message', finalMessage);
                processAIRequest(formData, true);
            }
        }, 1500);
    };

    recognition.onerror = (event) => {
        if (event.error !== 'no-speech') console.warn("Lỗi mic:", event.error);
    };

    recognition.onend = () => {
        if (isCallMode && $('chat-input').placeholder.includes("Đang nghe")) {
            try { recognition.start(); } catch (e) {}
        }
    };
}

// ==================================================
// XỬ LÝ GIAO TIẾP VỚI BACKEND VÀ MỞ KHÓA
// ==================================================
export async function processAIRequest(formData, isVoice = false) {
    // Luôn khóa UI và đổi chữ khi AI đang gọi API (Dù là Text hay Voice)
    setInputState(true, "AI đang suy nghĩ...");

    const typingId = appendMessage('bot', '<i class="fa-solid fa-ellipsis hover:animate-ping"></i> Đang phân tích...', true);
    if (window.setAvatarAction) window.setAvatarAction('thinking');

    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/`, { method: 'POST', body: formData });
        const data = await response.json();

        removeMessage(typingId);

        if (data.success) {
            const formattedReply = data.reply.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b class="text-pink-700">$1</b>');
            appendMessage('bot', formattedReply);

            if (data.action && data.action.type !== 'none') {
                if (data.action.type === 'add_to_cart' && data.action.product_id) {
                    addToCart(data.action.product_id);
                    appendMessage('bot', `<i>*AI đã thêm sản phẩm vào giỏ hàng giúp bạn*</i>`);
                } else if (data.action.type === 'checkout') {
                    proceedToCheckout();
                    appendMessage('bot', `<i>*Đang chuyển hướng đến trang thanh toán...*</i>`);
                }
            }

            // NẾU CÓ ÂM THANH
            if (data.audio_url) {
                if (window.setAvatarAction) window.setAvatarAction('explaining');

                // Đổi chữ hiển thị khi AI đang nói
                setInputState(true, "AI đang trả lời...");

                if (window.playAvatarAudio) {
                    window.playAvatarAudio(data.audio_url);
                } else {
                    const audio = new Audio(data.audio_url);
                    audio.play();
                    audio.onended = () => window.dispatchEvent(new Event('ai-audio-ended'));
                }
            } else {
                if (window.setAvatarAction) window.setAvatarAction('idle');
                // Nếu không có Audio, phát sự kiện kết thúc ngay
                window.dispatchEvent(new Event('ai-audio-ended'));
            }
        } else {
             appendMessage('bot', 'Hệ thống báo lỗi: ' + data.reply);
             if (window.setAvatarAction) window.setAvatarAction('apologizing', 3000);
             window.dispatchEvent(new Event('ai-audio-ended'));
        }
    } catch (error) {
        removeMessage(typingId);
        appendMessage('bot', 'Lỗi kết nối đến máy chủ AI!');
        if (window.setAvatarAction) window.setAvatarAction('apologizing', 3000);
        window.dispatchEvent(new Event('ai-audio-ended'));
    }
}

// LẮNG NGHE SỰ KIỆN AI NÓI XONG ĐỂ QUYẾT ĐỊNH MỞ KHÓA HAY NGHE TIẾP
window.addEventListener('ai-audio-ended', () => {
    if (isCallMode) {
        // Nếu đang gọi Voice Call -> Giữ trạng thái Khóa phím, bật lại Mic
        setInputState(true, "Đang nghe... (Tự động gửi khi bạn dừng nói)");
        try { recognition.start(); } catch (e) {}
    } else {
        // Nếu chat bằng Text -> Mở khóa phím bình thường
        setInputState(false, "Nhập tin nhắn...");
    }
});

// ... (Giữ nguyên các hàm appendMessage và removeMessage ở cuối file) ...
export function appendMessage(sender, text, isTyping = false) {
    const chatMessages = $('chat-messages');
    const msgDiv = document.createElement('div');
    const msgId = `msg-${Date.now()}`;
    msgDiv.id = msgId;

    if (sender === 'user') {
        msgDiv.className = 'flex items-start justify-end space-x-2';
        msgDiv.innerHTML = `<div class="bg-gradient-to-r from-pink-500 to-purple-500 text-white p-3 rounded-2xl rounded-tr-none shadow-sm text-sm max-w-[85%] break-words">${text}</div>`;
    } else {
        msgDiv.className = `flex items-start space-x-2 ${isTyping ? 'opacity-70' : ''}`;
        msgDiv.innerHTML = `<div class="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-white text-xs shrink-0"><i class="fa-solid fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm text-sm text-gray-700 max-w-[85%] border border-pink-100 break-words">${text}</div>`;
    }
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return msgId;
}

export function removeMessage(id) {
    const el = $(id);
    if (el) el.remove();
}