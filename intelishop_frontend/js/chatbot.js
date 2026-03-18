import { API_BASE_URL, $ } from './config.js';
import { addToCart, proceedToCheckout } from './cart.js';

function setInputState(isDisabled, placeholderText) {
    const inputField = $('chat-input');
    const sendBtn = document.querySelector('button[onclick="sendChatMessage()"]');
    if (!inputField) return;

    inputField.disabled = isDisabled;
    if (placeholderText) inputField.placeholder = placeholderText;

    if (isDisabled) {
        inputField.classList.add('bg-gray-100', 'cursor-not-allowed', 'opacity-80');
        inputField.classList.remove('bg-pink-50/50');
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.classList.add('opacity-50', 'cursor-not-allowed');
            sendBtn.classList.remove('hover:shadow-lg', 'hover:scale-105', 'hover:bg-pink-700');
        }
    } else {
        inputField.classList.remove('bg-gray-100', 'cursor-not-allowed', 'opacity-80');
        inputField.classList.add('bg-pink-50/50');
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            sendBtn.classList.add('hover:shadow-lg', 'hover:scale-105');
        }
    }
}

export function toggleAIPanel() {
    const panel = $('ai-side-panel');
    const toggleBtn = $('chat-toggle-btn');
    if (!panel || !toggleBtn) return;

    if (panel.classList.contains('translate-x-full')) {
        panel.classList.remove('translate-x-full');
        toggleBtn.classList.add('hidden');
        if (window.innerWidth > 640) document.body.style.paddingRight = '400px';
        setTimeout(() => { const input = $('chat-input'); if(input) input.focus(); }, 300);
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
    if (!inputField) return;

    const message = inputField.value.trim();
    if (!message || inputField.disabled) return;

    appendMessage('user', message);
    inputField.value = '';

    const formData = new FormData();
    formData.append('message', message);
    await processAIRequest(formData);
}

// KHỞI TẠO SPEECH API AN TOÀN
let recognition = null;
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
    if (!micBtn || !inputField) return;

    if (!recognition) {
        alert("Trình duyệt không hỗ trợ nhận diện giọng nói. Vui lòng sử dụng Google Chrome.");
        return;
    }

    if (isCallMode) {
        // Cúp máy an toàn
        isCallMode = false;
        try { recognition.stop(); } catch(e) {}
        if (silenceTimeout) clearTimeout(silenceTimeout);

        micBtn.classList.remove('bg-red-500', 'text-white', 'animate-pulse');
        micBtn.classList.add('text-pink-500', 'hover:bg-pink-50');

        setInputState(false, "Nhập tin nhắn...");
        inputField.value = '';
        return;
    }

    // Bật máy
    isCallMode = true;
    finalMessageBuffer = "";
    inputField.value = "";

    micBtn.classList.remove('text-pink-500', 'hover:bg-pink-50');
    micBtn.classList.add('bg-red-500', 'text-white', 'animate-pulse');

    setInputState(true, "Đang nghe... (Tự động gửi khi bạn dừng nói)");

    try { recognition.start(); } catch (e) { console.warn("Mic đã đang bật."); }

    recognition.onresult = (event) => {
        if (!isCallMode) return;
        if (silenceTimeout) clearTimeout(silenceTimeout);

        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) finalMessageBuffer += event.results[i][0].transcript + " ";
            else interimTranscript += event.results[i][0].transcript;
        }

        inputField.value = finalMessageBuffer + interimTranscript;

        silenceTimeout = setTimeout(() => {
            const finalMessage = inputField.value.trim();
            if (finalMessage) {
                try { recognition.stop(); } catch(e) {}
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
        if (isCallMode && $('chat-input')?.placeholder.includes("Đang nghe")) {
            try { recognition.start(); } catch (e) {}
        }
    };
}

export async function processAIRequest(formData, isVoice = false) {
    setInputState(true, "AI đang suy nghĩ...");
    const typingId = appendMessage('bot', '<i class="fa-solid fa-circle-notch fa-spin text-pink-500"></i> Đang phân tích...', true);
    if (window.setAvatarAction) window.setAvatarAction('thinking');

    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/`, { method: 'POST', body: formData });
        if (!response.ok) throw new Error("Server Error");

        const data = await response.json();
        removeMessage(typingId);

        if (data.success) {
            const formattedReply = data.reply.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b class="text-pink-700">$1</b>');
            appendMessage('bot', formattedReply);

            if (data.action && data.action.type !== 'none') {
                if (data.action.type === 'add_to_cart' && data.action.product_id) {
                    addToCart(data.action.product_id);
                    appendMessage('bot', `<i class="text-green-600 text-sm">*Đã tự động thêm vào giỏ hàng*</i>`);
                } else if (data.action.type === 'checkout') {
                    proceedToCheckout();
                }
            }

            if (data.audio_url) {
                if (window.setAvatarAction) window.setAvatarAction('explaining');
                setInputState(true, "AI đang trả lời...");

                if (window.playAvatarAudio) {
                    window.playAvatarAudio(data.audio_url);
                } else {
                    const audio = new Audio(data.audio_url);
                    audio.play().catch(e => console.error("Autoplay bị chặn", e));
                    audio.onended = () => window.dispatchEvent(new Event('ai-audio-ended'));
                }
            } else {
                if (window.setAvatarAction) window.setAvatarAction('idle');
                window.dispatchEvent(new Event('ai-audio-ended'));
            }
        } else {
             appendMessage('bot', 'Hệ thống báo lỗi: ' + data.reply);
             if (window.setAvatarAction) window.setAvatarAction('apologizing', 3000);
             window.dispatchEvent(new Event('ai-audio-ended'));
        }
    } catch (error) {
        removeMessage(typingId);
        appendMessage('bot', '<span class="text-red-500">Lỗi kết nối đến máy chủ AI!</span>');
        if (window.setAvatarAction) window.setAvatarAction('apologizing', 3000);
        window.dispatchEvent(new Event('ai-audio-ended'));
    }
}

window.addEventListener('ai-audio-ended', () => {
    if (isCallMode) {
        setInputState(true, "Đang nghe... (Tự động gửi khi bạn dừng nói)");
        try { recognition.start(); } catch (e) {}
    } else {
        setInputState(false, "Nhập tin nhắn...");
    }
});

export function appendMessage(sender, text, isTyping = false) {
    const chatMessages = $('chat-messages');
    if (!chatMessages) return null;

    const msgDiv = document.createElement('div');
    const msgId = `msg-${Date.now()}`;
    msgDiv.id = msgId;

    if (sender === 'user') {
        msgDiv.className = 'flex items-start justify-end space-x-2 mb-4';
        msgDiv.innerHTML = `<div class="bg-gradient-to-r from-pink-500 to-purple-500 text-white p-3.5 rounded-2xl rounded-tr-none shadow-md text-sm max-w-[85%] break-words">${text}</div>`;
    } else {
        msgDiv.className = `flex items-start space-x-3 mb-4 ${isTyping ? 'opacity-70' : ''} animate-fade-in-up`;
        msgDiv.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-white text-xs shrink-0 shadow-sm"><i class="fa-solid fa-robot"></i></div>
            <div class="bg-white p-3.5 rounded-2xl rounded-tl-none shadow-sm text-sm text-gray-700 max-w-[85%] border border-pink-100 break-words leading-relaxed">${text}</div>
        `;
    }
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
    return msgId;
}

export function removeMessage(id) {
    const el = $(id);
    if (el) el.remove();
}