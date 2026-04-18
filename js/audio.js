import * as THREE from 'three';

export class AudioManager {
    constructor(camera) {
        this.listener = new THREE.AudioListener();
        camera.add(this.listener);

        this.sounds = new Map();
        this.loader = new THREE.AudioLoader();
        
        this.isAudioContextStarted = false;
        this.globalVolume = 0.5;
    }

    async loadSound(name, url, isPositional = false, loop = false, volume = 1.0) {
        return new Promise((resolve) => {
            this.loader.load(url, (buffer) => {
                const audio = isPositional ? new THREE.PositionalAudio(this.listener) : new THREE.Audio(this.listener);
                audio.setBuffer(buffer);
                audio.setLoop(loop);
                audio.setVolume(volume * this.globalVolume);
                
                // Add realistic distance model for 3D sounds
                if (isPositional) {
                    audio.setRefDistance(5);
                    audio.setMaxDistance(100);
                    audio.setRolloffFactor(1);
                }

                this.sounds.set(name, audio);
                resolve(audio);
            });
        });
    }

    startAudioContext() {
        if (this.isAudioContextStarted) return;
        const context = THREE.AudioContext.getContext();
        if (context.state === 'suspended') { context.resume(); }
        this.isAudioContextStarted = true;
        this.play('anthem');
    }

    play(name, options = {}) {
        const sound = this.sounds.get(name);
        if (!sound) return;

        // Reset and play for non-looping sounds
        if (sound.isPlaying && !sound.loop) {
            sound.stop();
        }
        
        // Dynamic pitch variation for realism (random +/- 5%)
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