import * as THREE from 'three';

export class AudioManager {
    constructor(camera) {
        this.listener = new THREE.AudioListener();
        camera.add(this.listener);

        this.sounds = new Map();
        this.loader = new THREE.AudioLoader();
        
        this.isAudioContextStarted = false;
        this.globalVolume = 0.5;

        // --- REALISM FILTERS ---
        this.altitudeFilter = this.listener.context.createBiquadFilter();
        this.altitudeFilter.type = 'lowpass';
        this.altitudeFilter.frequency.value = 20000; // Start open
        this.listener.gain.connect(this.altitudeFilter);
        this.altitudeFilter.connect(this.listener.context.destination);
    }

    async loadSound(name, url, isPositional = false, loop = false, volume = 1.0) {
        return new Promise((resolve) => {
            this.loader.load(url, (buffer) => {
                const audio = isPositional ? new THREE.PositionalAudio(this.listener) : new THREE.Audio(this.listener);
                audio.setBuffer(buffer);
                audio.setLoop(loop);
                audio.setVolume(volume * this.globalVolume);
                
                if (isPositional) {
                    audio.setRefDistance(5);
                    audio.setMaxDistance(100);
                    audio.setRolloffFactor(1);
                }

                this.sounds.set(name, audio);
                resolve(audio);
            }, (xhr) => {
                if (this.onProgress) {
                    this.onProgress(name, xhr.loaded / xhr.total);
                }
            });
        });
    }

    startAudioContext() {
        if (this.isAudioContextStarted) return;
        const context = THREE.AudioContext.getContext();
        if (context.state === 'suspended') { context.resume(); }
        this.isAudioContextStarted = true;
    }

    fadeSound(name, targetVolume, duration = 1.0) {
        const sound = this.sounds.get(name);
        if (!sound) return;

        const startVolume = sound.getVolume();
        const startTime = performance.now();

        const animateFade = () => {
            const now = performance.now();
            const elapsed = (now - startTime) / (duration * 1000);

            if (elapsed < 1) {
                const currentVolume = startVolume + (targetVolume * this.globalVolume - startVolume) * elapsed;
                sound.setVolume(currentVolume);
                requestAnimationFrame(animateFade);
            } else {
                sound.setVolume(targetVolume * this.globalVolume);
                if (targetVolume === 0) sound.stop();
            }
        };

        if (targetVolume > 0 && !sound.isPlaying) {
            sound.setVolume(0);
            sound.play();
        }
        
        animateFade();
    }

    setVolume(name, volume) {
        const sound = this.sounds.get(name);
        if (sound) {
            sound.setVolume(volume * this.globalVolume);
        }
    }

    updateAltitudeEffects(y) {
        // --- ALTITUDE REALISM LOGIC ---
        // As we go higher (up to 100m), air gets thinner
        // 1. High Frequency Absorption (LPF)
        const minFreq = 4000; // Muffled at peak
        const maxFreq = 20000; // Clear at base
        const altitudeFactor = Math.min(Math.max(y / 100, 0), 1);
        
        const targetFreq = maxFreq - (altitudeFactor * (maxFreq - minFreq));
        this.altitudeFilter.frequency.setTargetAtTime(targetFreq, this.listener.context.currentTime, 0.5);

        // 2. Volume Attenuation (-3dB at peak)
        const targetGain = 1.0 - (altitudeFactor * 0.3);
        this.listener.setMasterVolume(targetGain * this.globalVolume);

        // 3. Wind Intensity
        const wind = this.sounds.get('ambient_wind');
        if (wind) {
            wind.setVolume(0.2 + (altitudeFactor * 0.8));
            wind.setPlaybackRate(1.0 + (altitudeFactor * 0.2)); // Wind screams higher at peak
        }
    }

    play(name, options = {}) {
        const sound = this.sounds.get(name);
        if (!sound) return;
        if (sound.isPlaying && !sound.loop) { sound.stop(); }
        if (options.randomPitch) {
            const p = 1.0 + (Math.random() - 0.5) * 0.1;
            sound.setPlaybackRate(p);
        }
        sound.play();
    }

    stop(name) {
        const sound = this.sounds.get(name);
        if (sound && sound.isPlaying) { sound.stop(); }
    }

    setPlaybackRate(name, rate) {
        const sound = this.sounds.get(name);
        if (sound && sound.isPlaying) { sound.setPlaybackRate(rate); }
    }

    createPositionalSource(name, mesh) {
        const sound = this.sounds.get(name);
        if (sound && sound instanceof THREE.PositionalAudio) {
            mesh.add(sound);
            return sound;
        }
        return null;
    }
}