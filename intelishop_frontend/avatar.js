import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { API_BASE_URL } from './js/config.js';

const container = document.getElementById('avatar-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
camera.position.set(0.04, 1.53, 0.9);
camera.lookAt(0, 1.45, 0);

const CAMERA_VIEW_PRESETS = {
    torso: {
        basePosition: new THREE.Vector3(0.04, 1.53, 0.9),
        lookOffset: new THREE.Vector3(0.0, 0.1, 0.06),
    },
    full_body: {
        basePosition: new THREE.Vector3(0.0, 1.1, 1.75),
        lookOffset: new THREE.Vector3(0.0, -0.2, 0.02),
    },
};

let cameraViewMode = 'torso';

const CAMERA_CONFIG = {
    basePosition: CAMERA_VIEW_PRESETS.torso.basePosition.clone(),
    lookOffset: CAMERA_VIEW_PRESETS.torso.lookOffset.clone(),
    positionSmooth: 8,
    lookSmooth: 9,
};
const cameraTargetPosition = CAMERA_CONFIG.basePosition.clone();
const cameraCurrentLookAt = new THREE.Vector3(0, 1.45, 0);
const cameraTargetLookAt = new THREE.Vector3(0, 1.45, 0);
const _tmpHeadWorldPos = new THREE.Vector3();

window.setAvatarViewMode = (mode) => {
    const nextMode = mode === 'full_body' ? 'full_body' : 'torso';
    cameraViewMode = nextMode;
    CAMERA_CONFIG.basePosition.copy(CAMERA_VIEW_PRESETS[nextMode].basePosition);
    CAMERA_CONFIG.lookOffset.copy(CAMERA_VIEW_PRESETS[nextMode].lookOffset);
};

// Tối ưu: Ép trình duyệt dùng GPU hiệu suất cao và quản lý pixelRatio
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Giới hạn pixel ratio để tránh lag trên màn hình retina (4k)
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

// Tối ưu: Dùng LoadingManager để quản lý luồng tải tốt hơn
const loadingManager = new THREE.LoadingManager();
const loader = new GLTFLoader(loadingManager);

loader.register((parser) => { return new VRMLoaderPlugin(parser); });

loader.load(
    `${API_BASE_URL}/media/AvatarSample_U.vrm`,
    (gltf) => {
        const vrm = gltf.userData.vrm;
        currentVrm = vrm;
        scene.add(vrm.scene);
        vrm.scene.position.set(0, -0.3, 0);
        console.log("✅ Đã tải xong Avatar 3D toàn thân!");
    },
    (progress) => { /* Xóa log console rác để tăng tốc render */ },
    (error) => console.error("Lỗi tải VRM:", error)
);

// --- BỘ QUẢN LÝ TRẠNG THÁI VÀ ÂM THANH ---
let analyser;
let dataArray;
let isSpeaking = false;
let currentAction = 'idle';
let actionTimeout;
let audioContext = null;
let currentAudio = null;
let currentAudioSource = null;
let pausedByVisibility = false;

const ACTION_DEFAULT_DURATION = {
    cart_add: 1500,
    checkout: 1800,
    success: 2200,
    error: 2600,
    apologizing: 2600,
};

function setExpressionSafe(expressionName, value) {
    if (!currentVrm || !currentVrm.expressionManager) return;
    try {
        currentVrm.expressionManager.setValue(expressionName, value);
    } catch (_e) {
        // Ignore unsupported preset names on different VRM rigs.
    }
}

function resetPrimaryExpressions() {
    setExpressionSafe('aa', 0);
    setExpressionSafe('happy', 0);
    setExpressionSafe('sad', 0);
    setExpressionSafe('angry', 0);
    setExpressionSafe('relaxed', 0);
    setExpressionSafe('surprised', 0);
}

window.setAvatarAction = (action, duration = null) => {
    currentAction = action || 'idle';
    if (actionTimeout) clearTimeout(actionTimeout);
    const resolvedDuration = duration ?? ACTION_DEFAULT_DURATION[currentAction];
    if (resolvedDuration) {
        actionTimeout = setTimeout(() => {
            currentAction = 'idle';
        }, resolvedDuration);
    }
};

function stopCurrentAudioPlayback() {
    if (currentAudio) {
        currentAudio.onended = null;
        try { currentAudio.pause(); } catch (_e) {}
        currentAudio = null;
    }
    if (currentAudioSource) {
        try { currentAudioSource.disconnect(); } catch (_e) {}
        currentAudioSource = null;
    }
    isSpeaking = false;
}

window.playAvatarAudio = (audioUrl) => {
    if (!audioUrl) return;

    stopCurrentAudioPlayback();

    if (!audioContext) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioContext = new Ctx();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.connect(audioContext.destination);
    }

    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
    }

    const audio = new Audio(audioUrl);
    audio.crossOrigin = 'anonymous';
    currentAudio = audio;
    currentAudioSource = audioContext.createMediaElementSource(audio);
    currentAudioSource.connect(analyser);

    audio.play().catch(() => {
        isSpeaking = false;
        window.dispatchEvent(new Event('ai-audio-ended'));
    });
    isSpeaking = true;
    currentAction = 'explaining';

    audio.onended = () => {
        if (currentAudioSource) {
            try { currentAudioSource.disconnect(); } catch (_e) {}
            currentAudioSource = null;
        }
        currentAudio = null;
        isSpeaking = false;
        currentAction = 'idle';
        resetPrimaryExpressions();
        window.dispatchEvent(new Event('ai-audio-ended'));
    };
};

document.addEventListener('visibilitychange', () => {
    if (!currentAudio) return;
    if (document.hidden && !currentAudio.paused) {
        pausedByVisibility = true;
        try { currentAudio.pause(); } catch (_e) {}
    } else if (!document.hidden && pausedByVisibility) {
        pausedByVisibility = false;
        currentAudio.play().catch(() => {});
    }
});

const clock = new THREE.Clock();

function dampTo(current, target, smooth, deltaTime) {
    return THREE.MathUtils.damp(current, target, smooth, deltaTime);
}

function dampBoneRotation(bone, targetX, targetY, targetZ, smooth, deltaTime) {
    if (!bone) return;
    bone.rotation.x = dampTo(bone.rotation.x, targetX, smooth, deltaTime);
    bone.rotation.y = dampTo(bone.rotation.y, targetY, smooth, deltaTime);
    bone.rotation.z = dampTo(bone.rotation.z, targetZ, smooth, deltaTime);
}

const FINGER_CHAIN_WEIGHTS = [0.45, 0.75, 1.0];
let cachedFingerRig = { vrm: null, left: null, right: null };

function getNormalizedBoneSafe(name) {
    if (!currentVrm?.humanoid) return null;
    try {
        return currentVrm.humanoid.getNormalizedBoneNode(name) || null;
    } catch (_e) {
        return null;
    }
}

function buildFingerRigForSide(sidePrefix) {
    const find = (baseNames) => {
        for (const base of baseNames) {
            const node = getNormalizedBoneSafe(`${sidePrefix}${base}`);
            if (node) return node;
        }
        return null;
    };

    const chain = (fingerName) => [
        find([`${fingerName}Proximal`, `${fingerName}Metacarpal`]),
        find([`${fingerName}Intermediate`]),
        find([`${fingerName}Distal`]),
    ].filter(Boolean);

    return {
        thumb: [
            find(['ThumbMetacarpal', 'ThumbProximal']),
            find(['ThumbProximal', 'ThumbIntermediate']),
            find(['ThumbDistal']),
        ].filter(Boolean),
        index: chain('Index'),
        middle: chain('Middle'),
        ring: chain('Ring'),
        little: chain('Little'),
    };
}

function ensureFingerRig() {
    if (!currentVrm) {
        cachedFingerRig = { vrm: null, left: null, right: null };
        return;
    }
    if (cachedFingerRig.vrm === currentVrm) return;
    cachedFingerRig = {
        vrm: currentVrm,
        left: buildFingerRigForSide('left'),
        right: buildFingerRigForSide('right'),
    };
}

function dampFingerPose(fingerRig, side, pose, deltaTime) {
    if (!fingerRig) return;
    const sideSign = side === 'left' ? -1 : 1;
    const curl = Math.min(Math.max(pose?.curl ?? 0.25, 0), 1.2);
    const spread = Math.min(Math.max(pose?.spread ?? 0.03, -0.5), 0.5);
    const thumbCurl = Math.min(Math.max(pose?.thumbCurl ?? (curl * 0.75), 0), 1.1);
    const tension = Math.min(Math.max(pose?.tension ?? 0, 0), 1);
    const smooth = pose?.smooth ?? 12;

    const applyFingerChain = (nodes, baseSpread) => {
        nodes.forEach((bone, idx) => {
            const weight = FINGER_CHAIN_WEIGHTS[Math.min(idx, FINGER_CHAIN_WEIGHTS.length - 1)];
            const targetX = 0.015 + (curl * weight) + (tension * 0.05);
            const targetY = sideSign * (baseSpread + spread * (1 - idx * 0.25));
            const targetZ = sideSign * (baseSpread * 0.12);
            dampBoneRotation(bone, targetX, targetY, targetZ, smooth, deltaTime);
        });
    };

    applyFingerChain(fingerRig.index, 0.18);
    applyFingerChain(fingerRig.middle, 0.06);
    applyFingerChain(fingerRig.ring, -0.06);
    applyFingerChain(fingerRig.little, -0.16);

    fingerRig.thumb.forEach((bone, idx) => {
        const weight = FINGER_CHAIN_WEIGHTS[Math.min(idx, FINGER_CHAIN_WEIGHTS.length - 1)];
        const targetX = -0.06 + (thumbCurl * weight) + (tension * 0.04);
        const targetY = sideSign * (0.22 + spread * 0.6 - idx * 0.06);
        const targetZ = sideSign * (0.24 - idx * 0.09);
        dampBoneRotation(bone, targetX, targetY, targetZ, smooth, deltaTime);
    });
}

function animate() {
    requestAnimationFrame(animate);

    // Tối ưu quan trọng: Giới hạn deltaTime tối đa 0.1s.
    // Tránh việc tab bị ẩn (background), sau đó bật lại khiến delta quá lớn làm rách mô hình.
    const deltaTime = Math.min(clock.getDelta(), 0.1);
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
        ensureFingerRig();

        currentVrm.scene.position.y = -0.2 + Math.sin(time * 1.8) * 0.012;

        let volume = 0;
        if (isSpeaking && analyser) {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) { sum += dataArray[i]; }
            volume = (sum / dataArray.length) / 80;
            volume = Math.min(Math.max(volume, 0), 1);
            setExpressionSafe('aa', volume);
        }

        // Keep expression values predictable between action branches.
        if (!isSpeaking) {
            setExpressionSafe('aa', 0);
        }

        let leftFingerPose = { curl: 0.24, spread: 0.03, thumbCurl: 0.2, tension: 0.12, smooth: 12 };
        let rightFingerPose = { curl: 0.26, spread: 0.03, thumbCurl: 0.22, tension: 0.14, smooth: 12 };

        if (currentAction === 'explaining' && isSpeaking) {
            setExpressionSafe('happy', 0.25);
            setExpressionSafe('relaxed', 0.35);
            dampBoneRotation(head, Math.sin(time * 10) * 0.045 * volume, Math.sin(time * 3.8) * 0.04 * volume, head?.rotation.z || 0, 11, deltaTime);
            dampBoneRotation(rightUpperArm, -0.35 * volume, rightUpperArm?.rotation.y || 0, 1.0 + (Math.sin(time * 5) * 0.1 * volume), 12, deltaTime);
            dampBoneRotation(rightLowerArm, rightLowerArm?.rotation.x || 0, rightLowerArm?.rotation.y || 0, 1.1 * volume + (Math.cos(time * 6) * 0.22 * volume), 12, deltaTime);
            dampBoneRotation(rightHand, Math.sin(time * 8) * 0.32 * volume, Math.cos(time * 7) * 0.18 * volume, rightHand?.rotation.z || 0, 13, deltaTime);
            dampBoneRotation(leftUpperArm, -0.18 * volume, leftUpperArm?.rotation.y || 0, -1.05, 10, deltaTime);
            dampBoneRotation(leftLowerArm, leftLowerArm?.rotation.x || 0, leftLowerArm?.rotation.y || 0, -0.55 * volume - (Math.sin(time * 3) * 0.08 * volume), 10, deltaTime);
            dampBoneRotation(leftHand, Math.sin(time * 4) * 0.1 * volume, leftHand?.rotation.y || 0, leftHand?.rotation.z || 0, 10, deltaTime);
            dampBoneRotation(spine, Math.sin(time * 2.2) * 0.025, spine?.rotation.y || 0, spine?.rotation.z || 0, 8, deltaTime);
            leftFingerPose = {
                curl: 0.2 + volume * 0.12,
                spread: 0.04,
                thumbCurl: 0.16 + volume * 0.1,
                tension: 0.25,
                smooth: 13,
            };
            rightFingerPose = {
                curl: 0.34 + volume * 0.42 + Math.sin(time * 7) * 0.04,
                spread: 0.06 + Math.sin(time * 5) * 0.01,
                thumbCurl: 0.26 + volume * 0.28,
                tension: 0.45,
                smooth: 13,
            };

        } else if (currentAction === 'thinking') {
            setExpressionSafe('relaxed', 0.4);
            dampBoneRotation(head, -0.08, Math.sin(time * 2) * 0.08, head?.rotation.z || 0, 8.5, deltaTime);
            dampBoneRotation(rightUpperArm, -0.26, rightUpperArm?.rotation.y || 0, 1.16, 9, deltaTime);
            dampBoneRotation(rightLowerArm, -0.18, rightLowerArm?.rotation.y || 0, 1.65, 9, deltaTime);
            dampBoneRotation(leftUpperArm, 0.02, leftUpperArm?.rotation.y || 0, -1.06, 9, deltaTime);
            dampBoneRotation(leftLowerArm, -0.18, leftLowerArm?.rotation.y || 0, -0.48, 9, deltaTime);
            dampBoneRotation(spine, Math.sin(time * 1.6) * 0.018, spine?.rotation.y || 0, spine?.rotation.z || 0, 7, deltaTime);
            leftFingerPose = { curl: 0.5, spread: 0.02, thumbCurl: 0.4, tension: 0.55, smooth: 11 };
            rightFingerPose = { curl: 0.62, spread: 0.02, thumbCurl: 0.46, tension: 0.62, smooth: 11 };

        } else if (currentAction === 'listening') {
            setExpressionSafe('relaxed', 0.55);
            dampBoneRotation(head, -0.04 + Math.sin(time * 2.8) * 0.026, Math.sin(time * 1.8) * 0.075, head?.rotation.z || 0, 9, deltaTime);
            dampBoneRotation(rightUpperArm, 0.04, rightUpperArm?.rotation.y || 0, 1.05, 9.5, deltaTime);
            dampBoneRotation(leftUpperArm, 0.02, leftUpperArm?.rotation.y || 0, -1.05, 9.5, deltaTime);
            dampBoneRotation(rightHand, Math.sin(time * 4) * 0.08, rightHand?.rotation.y || 0, rightHand?.rotation.z || 0, 10, deltaTime);
            dampBoneRotation(leftHand, Math.cos(time * 4) * 0.08, leftHand?.rotation.y || 0, leftHand?.rotation.z || 0, 10, deltaTime);
            dampBoneRotation(spine, Math.sin(time * 1.8) * 0.02, spine?.rotation.y || 0, spine?.rotation.z || 0, 8, deltaTime);
            leftFingerPose = { curl: 0.28, spread: 0.06, thumbCurl: 0.2, tension: 0.18, smooth: 12 };
            rightFingerPose = { curl: 0.28, spread: 0.06, thumbCurl: 0.2, tension: 0.18, smooth: 12 };

        } else if (currentAction === 'cart_add' || currentAction === 'success') {
            setExpressionSafe('happy', currentAction === 'success' ? 0.85 : 0.65);
            setExpressionSafe('relaxed', 0.5);
            dampBoneRotation(head, -0.02, Math.sin(time * 2.8) * 0.08, head?.rotation.z || 0, 9, deltaTime);
            dampBoneRotation(rightUpperArm, -0.08, rightUpperArm?.rotation.y || 0, 0.9 + Math.sin(time * 6.5) * 0.13, 10, deltaTime);
            dampBoneRotation(rightLowerArm, rightLowerArm?.rotation.x || 0, rightLowerArm?.rotation.y || 0, 0.75 + Math.cos(time * 6.5) * 0.17, 10, deltaTime);
            dampBoneRotation(leftUpperArm, 0.04, leftUpperArm?.rotation.y || 0, -1.0, 10, deltaTime);
            dampBoneRotation(leftLowerArm, leftLowerArm?.rotation.x || 0, leftLowerArm?.rotation.y || 0, -0.38, 10, deltaTime);
            dampBoneRotation(spine, Math.sin(time * 2) * 0.02, spine?.rotation.y || 0, spine?.rotation.z || 0, 8, deltaTime);
            leftFingerPose = { curl: 0.22 + Math.sin(time * 8) * 0.04, spread: 0.09, thumbCurl: 0.16, tension: 0.22, smooth: 13 };
            rightFingerPose = { curl: 0.1 + Math.abs(Math.sin(time * 8.2)) * 0.2, spread: 0.11, thumbCurl: 0.08, tension: 0.26, smooth: 13 };

        } else if (currentAction === 'checkout') {
            setExpressionSafe('happy', 0.4);
            setExpressionSafe('relaxed', 0.65);
            dampBoneRotation(head, Math.sin(time * 3.2) * 0.03, 0, head?.rotation.z || 0, 8.5, deltaTime);
            dampBoneRotation(rightUpperArm, -0.08, rightUpperArm?.rotation.y || 0, 1.08, 9, deltaTime);
            dampBoneRotation(rightLowerArm, rightLowerArm?.rotation.x || 0, rightLowerArm?.rotation.y || 0, 0.45 + Math.sin(time * 3.5) * 0.05, 9, deltaTime);
            dampBoneRotation(leftUpperArm, -0.02, leftUpperArm?.rotation.y || 0, -1.02, 9, deltaTime);
            dampBoneRotation(leftLowerArm, leftLowerArm?.rotation.x || 0, leftLowerArm?.rotation.y || 0, -0.45 + Math.cos(time * 3.5) * 0.05, 9, deltaTime);
            dampBoneRotation(spine, Math.sin(time * 1.4) * 0.015, spine?.rotation.y || 0, spine?.rotation.z || 0, 8, deltaTime);
            leftFingerPose = { curl: 0.46, spread: 0.02, thumbCurl: 0.38, tension: 0.42, smooth: 11 };
            rightFingerPose = { curl: 0.46, spread: 0.02, thumbCurl: 0.38, tension: 0.42, smooth: 11 };

        } else if (currentAction === 'apologizing' || currentAction === 'error') {
            setExpressionSafe('sad', 0.65);
            setExpressionSafe('angry', 0.2);
            dampBoneRotation(head, 0.22, 0, head?.rotation.z || 0, 7, deltaTime);
            dampBoneRotation(spine, 0.12, spine?.rotation.y || 0, spine?.rotation.z || 0, 7, deltaTime);
            dampBoneRotation(rightUpperArm, 0, rightUpperArm?.rotation.y || 0, 1.06, 7.5, deltaTime);
            dampBoneRotation(rightLowerArm, rightLowerArm?.rotation.x || 0, rightLowerArm?.rotation.y || 0, 0.2, 7.5, deltaTime);
            dampBoneRotation(leftUpperArm, 0, leftUpperArm?.rotation.y || 0, -1.06, 7.5, deltaTime);
            dampBoneRotation(leftLowerArm, leftLowerArm?.rotation.x || 0, leftLowerArm?.rotation.y || 0, -0.2, 7.5, deltaTime);
            leftFingerPose = { curl: 0.68, spread: 0.01, thumbCurl: 0.52, tension: 0.72, smooth: 10 };
            rightFingerPose = { curl: 0.68, spread: 0.01, thumbCurl: 0.52, tension: 0.72, smooth: 10 };

        } else {
            resetPrimaryExpressions();
            dampBoneRotation(head, 0, Math.sin(time * 1.5) * 0.05, head?.rotation.z || 0, 8, deltaTime);
            dampBoneRotation(spine, Math.sin(time * 2) * 0.02, spine?.rotation.y || 0, spine?.rotation.z || 0, 8, deltaTime);
            dampBoneRotation(leftUpperArm, 0.1, leftUpperArm?.rotation.y || 0, -1.1, 8, deltaTime);
            dampBoneRotation(rightUpperArm, 0.1, rightUpperArm?.rotation.y || 0, 1.1, 8, deltaTime);
            dampBoneRotation(leftLowerArm, -0.3, leftLowerArm?.rotation.y || 0, -0.5, 8, deltaTime);
            dampBoneRotation(rightLowerArm, -0.3, rightLowerArm?.rotation.y || 0, 0.5, 8, deltaTime);
            dampBoneRotation(leftHand, 0.2, 0, leftHand?.rotation.z || 0, 9, deltaTime);
            dampBoneRotation(rightHand, 0.2, 0, rightHand?.rotation.z || 0, 9, deltaTime);
            leftFingerPose = { curl: 0.24 + Math.sin(time * 2.8) * 0.03, spread: 0.04, thumbCurl: 0.19, tension: 0.16, smooth: 12 };
            rightFingerPose = { curl: 0.24 + Math.cos(time * 2.8) * 0.03, spread: 0.04, thumbCurl: 0.19, tension: 0.16, smooth: 12 };

            if (Math.random() > 0.98) {
                setExpressionSafe('blink', 1.0);
                setTimeout(() => {
                    if(currentVrm) setExpressionSafe('blink', 0.0);
                }, 150);
            }
        }

        dampFingerPose(cachedFingerRig.left, 'left', leftFingerPose, deltaTime);
        dampFingerPose(cachedFingerRig.right, 'right', rightFingerPose, deltaTime);

        const breathingOffsetX = Math.sin(time * 0.45) * 0.018;
        const breathingOffsetY = Math.sin(time * 0.65) * 0.012;
        const conversationalLean = cameraViewMode === 'full_body'
            ? 0
            : (currentAction === 'listening' ? 0.016 : (currentAction === 'explaining' ? 0.01 : 0));
        cameraTargetPosition.set(
            CAMERA_CONFIG.basePosition.x + breathingOffsetX,
            CAMERA_CONFIG.basePosition.y + breathingOffsetY,
            CAMERA_CONFIG.basePosition.z - conversationalLean,
        );

        camera.position.x = dampTo(camera.position.x, cameraTargetPosition.x, CAMERA_CONFIG.positionSmooth, deltaTime);
        camera.position.y = dampTo(camera.position.y, cameraTargetPosition.y, CAMERA_CONFIG.positionSmooth, deltaTime);
        camera.position.z = dampTo(camera.position.z, cameraTargetPosition.z, CAMERA_CONFIG.positionSmooth, deltaTime);

        if (head) {
            head.getWorldPosition(_tmpHeadWorldPos);
            cameraTargetLookAt.copy(_tmpHeadWorldPos).add(CAMERA_CONFIG.lookOffset);
        } else {
            cameraTargetLookAt.set(0, 1.45, 0);
        }

        cameraCurrentLookAt.x = dampTo(cameraCurrentLookAt.x, cameraTargetLookAt.x, CAMERA_CONFIG.lookSmooth, deltaTime);
        cameraCurrentLookAt.y = dampTo(cameraCurrentLookAt.y, cameraTargetLookAt.y, CAMERA_CONFIG.lookSmooth, deltaTime);
        cameraCurrentLookAt.z = dampTo(cameraCurrentLookAt.z, cameraTargetLookAt.z, CAMERA_CONFIG.lookSmooth, deltaTime);
        camera.lookAt(cameraCurrentLookAt);

        currentVrm.update(deltaTime);
    }

    renderer.render(scene, camera);
}

animate();

// Tối ưu bộ nhớ khi người dùng dọn dẹp trang
window.addEventListener('beforeunload', () => {
    stopCurrentAudioPlayback();
    if (audioContext) {
        audioContext.close().catch(() => {});
        audioContext = null;
    }
    resizeObserver.disconnect();
    if (currentVrm) {
        scene.remove(currentVrm.scene);
        currentVrm = null;
    }
    renderer.dispose();
});