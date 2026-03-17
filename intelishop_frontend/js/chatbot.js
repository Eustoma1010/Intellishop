import { API_BASE_URL, $ } from './config.js';
import { addToCart, proceedToCheckout } from './cart.js';

// ==================================================
// BIẾN TOÀN CỤC & TRẠNG THÁI KHÓA UI
// ==================================================
let isProcessingAI = false; // Biến cờ: True là đang gửi/xử lý, cấm mọi thao tác

function setInputState(isDisabled, placeholderText) {
    const inputField = $('chat-input');
    const sendBtn = document.querySelector('button[onclick="sendChatMessage()"]');
    const micBtn = $('mic-btn');

    inputField.disabled = isDisabled;
    if (placeholderText) inputField.placeholder = placeholderText;

    if (isDisabled) {
        inputField.classList.add('bg-gray-200', 'cursor-not-allowed', 'opacity-70');
        inputField.classList.remove('bg-pink-50/50');
        if(sendBtn) {
            sendBtn.disabled = true;
            sendBtn.classList.add('opacity-50', 'cursor-not-allowed');
            sendBtn.classList.remove('hover:shadow-lg', 'hover:scale-105', 'hover:bg-pink-700');
        }
        if(micBtn && !isCallMode) {
            // Khóa luôn nút mic nếu không phải đang trong chế độ gọi
            micBtn.disabled = true;
            micBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    } else {
        inputField.classList.remove('bg-gray-200', 'cursor-not-allowed', 'opacity-70');
        inputField.classList.add('bg-pink-50/50');
        if(sendBtn) {
            sendBtn.disabled = false;
            sendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            sendBtn.classList.add('hover:shadow-lg', 'hover:scale-105');
        }
        if(micBtn) {
            micBtn.disabled = false;
            micBtn.classList.remove('opacity-50', 'cursor-not-allowed');
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
    // KHÓA: Nếu đang xử lý AI thì không cho gửi text
    if (isProcessingAI) return;

    const inputField = $('chat-input');
    const message = inputField.value.trim();

    if (!message || inputField.disabled) return;

    appendMessage('user', message);
    inputField.value = '';

    const formData = new FormData();
    formData.append('message', message);
    await processAIRequest(formData, false);
}

// ==================================================
// HỆ THỐNG VOICE CALL (HYBRID: HIỆN CHỮ REALTIME + WHISPER)
// ==================================================
let mediaRecorder;
let audioChunks = [];
let isCallMode = false;
let silenceTimeout = null;
let recognition;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.interimResults = true;
    recognition.continuous = true;
}

export async function toggleVoiceRecording() {
    // KHÓA: Nếu hệ thống đang bận gửi/nhận AI, cấm bấm Mic
    if (isProcessingAI) return;

    const micBtn = $('mic-btn');
    const inputField = $('chat-input');

    // NẾU ĐANG GHI ÂM -> BẤM VÀO ĐỂ TẮT CHỦ ĐỘNG
    if (isCallMode) {
        stopRecordingAndSend();
        return;
    }

    // BẮT ĐẦU GHI ÂM MỚI
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) audioChunks.push(event.data);
        };

        // Khi MediaRecorder dừng -> Đóng gói gửi đi
        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(track => track.stop()); // Tắt biểu tượng Mic đỏ trên tab

            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const formData = new FormData();
            formData.append('audio', audioBlob, 'voice.webm');

            // Gửi chữ tạm thời từ Web Speech API lên cùng để dự phòng (nếu cần)
            formData.append('interim_text', inputField.value);

            await processAIRequest(formData, true);
        };

        mediaRecorder.start();
        isCallMode = true;

        micBtn.classList.remove('text-pink-500', 'hover:bg-pink-50');
        micBtn.classList.add('bg-red-500', 'text-white', 'animate-pulse');

        // Khóa ô input text, hiện chữ đang nghe
        setInputState(true, "Đang nghe... (Sẽ tự gửi khi dừng nói)");
        inputField.value = "";

        // Bật Web Speech API để hiện từng chữ và đếm giờ im lặng
        if (recognition) {
            try { recognition.start(); } catch (e) {}

            recognition.onresult = (event) => {
                if (!isCallMode) return;
                clearTimeout(silenceTimeout); // Có tiếng động -> Hủy đếm ngược tắt mic

                let interimTranscript = '';
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + " ";
                    else interimTranscript += event.results[i][0].transcript;
                }

                inputField.value = finalTranscript + interimTranscript;

                // NẾU IM LẶNG QUÁ 1.5 GIÂY -> TỰ ĐỘNG NGẮT MIC VÀ GỬI
                silenceTimeout = setTimeout(() => {
                    if (isCallMode) stopRecordingAndSend();
                }, 1500);
            };

            recognition.onend = () => {
                if (isCallMode) try { recognition.start(); } catch (e) {}
            };
        }

    } catch (err) {
        console.error("Lỗi Mic:", err);
        alert("Không thể truy cập Micro. Vui lòng cấp quyền!");
    }
}

// Hàm ngắt ghi âm và kích hoạt onstop để gửi dữ liệu
function stopRecordingAndSend() {
    isCallMode = false;
    clearTimeout(silenceTimeout);

    if (recognition) recognition.stop();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop(); // Lệnh này gọi event mediaRecorder.onstop ở trên
    }

    const micBtn = $('mic-btn');
    micBtn.classList.remove('bg-red-500', 'text-white', 'animate-pulse');
    micBtn.classList.add('text-pink-500', 'hover:bg-pink-50');
}

// ==================================================
// XỬ LÝ GIAO TIẾP VỚI BACKEND VÀ MỞ KHÓA
// ==================================================
export async function processAIRequest(formData, isVoice = false) {
    // BẬT CỜ KHÓA TOÀN BỘ UI
    isProcessingAI = true;
    setInputState(true, "Hệ thống đang xử lý và phân tích...");

    const typingId = appendMessage('bot', '<i class="fa-solid fa-ellipsis hover:animate-ping"></i> Đang phân tích...', true);
    if (window.setAvatarAction) window.setAvatarAction('thinking');

    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/`, { method: 'POST', body: formData });
        const data = await response.json();

        removeMessage(typingId);

        if (data.success) {
            // NẾU LÀ VOICE, IN CÂU CHỮ WHISPER NHẬN DIỆN ĐƯỢC (Độ chính xác cao) RA MÀN HÌNH
            if (isVoice && data.user_text_recognized) {
                $('chat-input').value = ""; // Xóa dòng chữ nháp đi
                appendMessage('user', data.user_text_recognized);
            }

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

            if (data.audio_url) {
                if (window.setAvatarAction) window.setAvatarAction('explaining');
                setInputState(true, "AI đang nói..."); // Đổi text nhưng vẫn khóa UI

                if (window.playAvatarAudio) {
                    window.playAvatarAudio(data.audio_url);
                } else {
                    const audio = new Audio(data.audio_url);
                    audio.play();
                    audio.onended = () => unlockUI();
                }
            } else {
                if (window.setAvatarAction) window.setAvatarAction('idle');
                unlockUI();
            }
        } else {
             appendMessage('bot', 'Hệ thống báo lỗi: ' + data.reply);
             if (window.setAvatarAction) window.setAvatarAction('apologizing', 3000);
             unlockUI();
        }
    } catch (error) {
        removeMessage(typingId);
        appendMessage('bot', 'Lỗi kết nối đến máy chủ AI!');
        if (window.setAvatarAction) window.setAvatarAction('apologizing', 3000);
        unlockUI();
    }
}

// Lắng nghe sự kiện AI đọc xong Audio từ Avatar.js
window.addEventListener('ai-audio-ended', () => {
    unlockUI();
});

// Hàm Mở Khóa UI khi hoàn tất toàn bộ tiến trình
function unlockUI() {
    isProcessingAI = false;
    $('chat-input').value = '';
    setInputState(false, "Nhập tin nhắn hoặc bấm Mic để nói...");
}

// ==================================================
// RENDER GIAO DIỆN TIN NHẮN
// ==================================================
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