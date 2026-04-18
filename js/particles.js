import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
    }

    createEmitter(options) {
        const {
            position,
            velocity,
            color,
            size,
            life,
            decay = 0.98,
            gravity = 0,
            opacity = 1.0,
            count = 1
        } = options;

        for (let i = 0; i < count; i++) {
            const geo = new THREE.PlaneGeometry(size, size);
            const mat = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: opacity,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(position);
            
            // Randomize velocity slightly
            const v = velocity.clone().add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5
            ));

            this.scene.add(mesh);
            this.particles.push({
                mesh: mesh,
                velocity: v,
                life: life,
                maxLife: life,
                decay: decay,
                gravity: gravity,
                startSize: size,
                startOpacity: opacity
            });
        }
    }

    createMuzzleFlash(position, direction, isLarge = false) {
        // Primary Core
        this.createEmitter({
            position: position,
            velocity: new THREE.Vector3(0, 0, 0),
            color: 0xffffff,
            size: isLarge ? 2.5 : 0.5,
            life: 0.05,
            opacity: 1.0
        });

        // Lateral Wings for Large Caliber (Tiger)
        if (isLarge) {
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction));
            const left = right.clone().negate();

            [right, left].forEach(sideDir => {
                this.createEmitter({
                    position: position,
                    velocity: sideDir.multiplyScalar(20),
                    color: 0xff8800,
                    size: 1.5,
                    life: 0.1,
                    decay: 0.8,
                    count: 5
                });
            });

            // Ground Kick-up
            const groundPos = position.clone(); groundPos.y = 0.5;
            this.createEmitter({
                position: groundPos,
                velocity: new THREE.Vector3(0, 5, 0),
                color: 0x887766, // Dust color
                size: 3.0,
                life: 1.0,
                decay: 0.95,
                opacity: 0.4,
                count: 10
            });
        }
    }

    createExhaustSmoke(position, velocity) {
        this.createEmitter({
            position: position,
            velocity: velocity.clone().add(new THREE.Vector3(0, 2, 0)),
            color: 0x333333,
            size: 0.5,
            life: 0.8,
            decay: 0.97,
            opacity: 0.3,
            count: 1
        });
    }

    update(delta, camera) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= delta;

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
                continue;
            }

            // Physics
            p.velocity.y -= p.gravity * delta;
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
            p.velocity.multiplyScalar(p.decay);

            // Billboarding
            p.mesh.lookAt(camera.position);

            // Scale and Fade
            const progress = p.life / p.maxLife;
            const s = p.startSize * (1 + (1 - progress) * 2);
            p.mesh.scale.set(s, s, s);
            p.mesh.material.opacity = p.startOpacity * progress;
        }
    }
}