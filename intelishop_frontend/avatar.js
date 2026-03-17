import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';

const API_BASE_URL = 'https://intelishop-backend.onrender.com';

const container = document.getElementById('avatar-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
camera.position.set(0, 1.4, 1.2);
camera.lookAt(0, 1.35, 0);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        }
    }
});
resizeObserver.observe(container);

const light = new THREE.DirectionalLight(0xffffff, 1.0);
light.position.set(1, 1, 1).normalize();
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

let currentVrm = undefined;
const loader = new GLTFLoader();

loader.register((parser) => { return new VRMLoaderPlugin(parser); });

loader.load(
    `${API_BASE_URL}/media/AvatarSample_U.vrm`,
    (gltf) => {
        const vrm = gltf.userData.vrm;
        currentVrm = vrm;
        scene.add(vrm.scene);
        vrm.scene.position.set(0, -0.3, 0);
        console.log("Đã tải xong Avatar 3D toàn thân!");
    },
    (progress) => console.log('Đang tải...', 100.0 * (progress.loaded / progress.total), '%'),
    (error) => console.error("Lỗi tải VRM:", error)
);

// --- BỘ QUẢN LÝ TRẠNG THÁI VÀ ÂM THANH ---
let analyser;
let dataArray;
let isSpeaking = false;
let currentAction = 'idle'; // Các trạng thái: 'idle', 'thinking', 'explaining', 'apologizing'
let actionTimeout;

// Hàm đồng bộ từ script.js sang
window.setAvatarAction = (action, duration = null) => {
    currentAction = action;

    // Xóa timeout cũ nếu có để tránh đụng độ
    if (actionTimeout) clearTimeout(actionTimeout);

    // Tự động quay về trạng thái idle sau một khoảng thời gian (dành cho xin lỗi/vui mừng)
    if (duration) {
        actionTimeout = setTimeout(() => {
            currentAction = 'idle';
        }, duration);
    }
};

window.playAvatarAudio = (audioUrl) => {
    const audio = new Audio(audioUrl);
    audio.crossOrigin = "anonymous";

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    const source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    audio.play();
    isSpeaking = true;
    currentAction = 'explaining'; // Tự động chuyển dáng thuyết trình khi nói

    audio.onended = () => {
        isSpeaking = false;
        currentAction = 'idle'; // Nói xong quay về dáng đứng chờ
        if (currentVrm) {
            currentVrm.expressionManager.setValue('aa', 0);
        }
        window.dispatchEvent(new Event('ai-audio-ended'));
    };
};

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    const time = clock.getElapsedTime();

    if (currentVrm) {
        const head = currentVrm.humanoid.getNormalizedBoneNode('head');
        const spine = currentVrm.humanoid.getNormalizedBoneNode('spine');
        const leftUpperArm = currentVrm.humanoid.getNormalizedBoneNode('leftUpperArm');
        const rightUpperArm = currentVrm.humanoid.getNormalizedBoneNode('rightUpperArm');
        const leftLowerArm = currentVrm.humanoid.getNormalizedBoneNode('leftLowerArm');
        const rightLowerArm = currentVrm.humanoid.getNormalizedBoneNode('rightLowerArm');
        const leftHand = currentVrm.humanoid.getNormalizedBoneNode('leftHand');
        const rightHand = currentVrm.humanoid.getNormalizedBoneNode('rightHand');

        // Nhịp thở mặc định (áp dụng cho mọi trạng thái)
        currentVrm.scene.position.y = -0.2 + Math.sin(time * 2) * 0.015;
        if (spine) spine.rotation.x = Math.sin(time * 2) * 0.02;

        // XỬ LÝ NHÉP MÔI (Luôn chạy nếu có âm thanh)
        let volume = 0;
        if (isSpeaking && analyser) {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) { sum += dataArray[i]; }
            volume = (sum / dataArray.length) / 80;
            volume = Math.min(Math.max(volume, 0), 1);
            currentVrm.expressionManager.setValue('aa', volume);
        }

        // --- HỆ THỐNG TRẠNG THÁI (STATE MACHINE) CƠ THỂ ---

        if (currentAction === 'explaining' && isSpeaking) {
            // 1. ĐANG THUYẾT TRÌNH (Dùng volume để cử động tay)
            if (head) {
                head.rotation.x = Math.sin(time * 12) * 0.06 * volume;
                head.rotation.y = Math.sin(time * 4) * 0.04 * volume;
            }
            if (rightUpperArm) {
                rightUpperArm.rotation.z = 1.0 + (Math.sin(time * 5) * 0.1 * volume);
                rightUpperArm.rotation.x = -0.4 * volume;
            }
            if (rightLowerArm) {
                rightLowerArm.rotation.z = 1.2 * volume + (Math.cos(time * 6) * 0.3 * volume);
            }
            if (rightHand) {
                rightHand.rotation.x = Math.sin(time * 10) * 0.4 * volume;
                rightHand.rotation.y = Math.cos(time * 8) * 0.2 * volume;
            }
            if (leftUpperArm) {
                leftUpperArm.rotation.z = -1.1;
                leftUpperArm.rotation.x = -0.2 * volume;
            }
            if (leftLowerArm) {
                leftLowerArm.rotation.z = -0.6 * volume - (Math.sin(time * 3) * 0.1 * volume);
            }
            if (leftHand) {
                leftHand.rotation.x = Math.sin(time * 4) * 0.1 * volume;
            }

        } else if (currentAction === 'thinking') {
            // 2. ĐANG SUY NGHĨ (Gõ phím tìm dữ liệu / Đưa tay lên cằm)
            if (head) {
                head.rotation.x = -0.1; // Cúi nhẹ
                head.rotation.y = Math.sin(time * 2) * 0.1; // Lắc lư đầu nhẹ
            }
            // Tay phải đưa lên gần cằm
            if (rightUpperArm) { rightUpperArm.rotation.z = 1.2; rightUpperArm.rotation.x = -0.3; }
            if (rightLowerArm) { rightLowerArm.rotation.z = 1.8; rightLowerArm.rotation.x = -0.2; }

            // Tay trái ôm hông
            if (leftUpperArm) { leftUpperArm.rotation.z = -1.1; leftUpperArm.rotation.x = 0; }
            if (leftLowerArm) { leftLowerArm.rotation.z = -0.5; leftLowerArm.rotation.x = -0.2; }

        } else if (currentAction === 'apologizing') {
            // 3. XIN LỖI (Cúi đầu, tay để khép)
            if (head) { head.rotation.x = 0.3; head.rotation.y = 0; } // Cúi gập cổ
            if (spine) { spine.rotation.x = 0.15; } // Gập cả người

            // Hai tay khép sát hông
            if (rightUpperArm) { rightUpperArm.rotation.z = 1.1; rightUpperArm.rotation.x = 0; }
            if (rightLowerArm) { rightLowerArm.rotation.z = 0.2; }
            if (leftUpperArm) { leftUpperArm.rotation.z = -1.1; leftUpperArm.rotation.x = 0; }
            if (leftLowerArm) { leftLowerArm.rotation.z = -0.2; }

        } else {
            // 4. ĐỨNG CHỜ (IDLE) - Mặc định
            if (head) {
                head.rotation.x = 0;
                head.rotation.y = Math.sin(time * 1.5) * 0.05;
            }

            // Phục hồi lại trục xương sống nếu vừa đi từ trạng thái xin lỗi về
            if (spine) { spine.rotation.x = Math.sin(time * 2) * 0.02; }

            // Tư thế VTuber: Hai tay hơi gập, để hờ trước bụng
            if (leftUpperArm) { leftUpperArm.rotation.z = -1.1; leftUpperArm.rotation.x = 0.1; }
            if (rightUpperArm) { rightUpperArm.rotation.z = 1.1; rightUpperArm.rotation.x = 0.1; }
            if (leftLowerArm) { leftLowerArm.rotation.z = -0.5; leftLowerArm.rotation.x = -0.3; }
            if (rightLowerArm) { rightLowerArm.rotation.z = 0.5; rightLowerArm.rotation.x = -0.3; }
            if (leftHand) { leftHand.rotation.x = 0.2; leftHand.rotation.y = 0; }
            if (rightHand) { rightHand.rotation.x = 0.2; rightHand.rotation.y = 0; }

            // Chớp mắt ngẫu nhiên
            if (Math.random() > 0.98) {
                currentVrm.expressionManager.setValue('blink', 1.0);
                setTimeout(() => {
                    if(currentVrm) currentVrm.expressionManager.setValue('blink', 0.0);
                }, 150);
            }
        }

        currentVrm.update(deltaTime);
    }

    renderer.render(scene, camera);
}

animate();
