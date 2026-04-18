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
                this.sounds.set(name, audio);
                resolve(audio);
            });
        });
    }

    startAudioContext() {
        if (this.isAudioContextStarted) return;
        
        const context = THREE.AudioContext.getContext();
        if (context.state === 'suspended') {
            context.resume();
        }
        this.isAudioContextStarted = true;
        
        // Start background music once context is ready
        this.play('anthem');
    }

    play(name) {
        const sound = this.sounds.get(name);
        if (sound && !sound.isPlaying) {
            sound.play();
        }
    }

    stop(name) {
        const sound = this.sounds.get(name);
        if (sound && sound.isPlaying) {
            sound.stop();
        }
    }

    setVolume(name, volume) {
        const sound = this.sounds.get(name);
        if (sound) {
            sound.setVolume(volume * this.globalVolume);
        }
    }

    setPlaybackRate(name, rate) {
        const sound = this.sounds.get(name);
        if (sound && sound.isPlaying) {
            sound.setPlaybackRate(rate);
        }
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