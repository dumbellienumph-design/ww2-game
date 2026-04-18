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
            count = 1,
            blending = THREE.AdditiveBlending
        } = options;

        for (let i = 0; i < count; i++) {
            const geo = new THREE.PlaneGeometry(size, size);
            const mat = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: opacity,
                depthWrite: false,
                blending: blending,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(position);
            
            const v = velocity.clone().add(new THREE.Vector3(
                (Math.random() - 0.5) * 2.0,
                (Math.random() - 0.5) * 2.0,
                (Math.random() - 0.5) * 2.0
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
        this.createEmitter({
            position: position,
            velocity: new THREE.Vector3(0, 0, 0),
            color: 0xffffff,
            size: isLarge ? 2.5 : 0.5,
            life: 0.05,
            opacity: 1.0
        });

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
            const groundPos = position.clone(); groundPos.y = 0.5;
            this.createEmitter({
                position: groundPos,
                velocity: new THREE.Vector3(0, 5, 0),
                color: 0x887766,
                size: 3.0,
                life: 1.0,
                decay: 0.95,
                opacity: 0.4,
                count: 10
            });
        }
    }

    createExhaustSmoke(position, velocity, isHeavy = false) {
        this.createEmitter({
            position: position,
            velocity: velocity.clone().add(new THREE.Vector3(0, 2, 0)),
            color: isHeavy ? 0x111111 : 0x333333,
            size: isHeavy ? 1.2 : 0.5,
            life: isHeavy ? 1.5 : 0.8,
            decay: 0.97,
            opacity: isHeavy ? 0.6 : 0.3,
            count: isHeavy ? 3 : 1,
            blending: THREE.NormalBlending
        });
    }

    createFire(position) {
        this.createEmitter({
            position: position,
            velocity: new THREE.Vector3(0, 4, 0),
            color: 0xff4400,
            size: 1.5,
            life: 0.6,
            decay: 0.98,
            count: 2
        });
        this.createEmitter({
            position: position,
            velocity: new THREE.Vector3(0, 5, 0),
            color: 0xffaa00,
            size: 0.8,
            life: 0.4,
            decay: 0.95,
            count: 1
        });
    }

    createDebris(position, color, count = 10) {
        this.createEmitter({
            position: position,
            velocity: new THREE.Vector3(0, 5, 0),
            color: color,
            size: 0.4,
            life: 1.5,
            decay: 0.96,
            gravity: 15,
            opacity: 1.0,
            count: count,
            blending: THREE.NormalBlending
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
            p.velocity.y -= p.gravity * delta;
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
            p.velocity.multiplyScalar(p.decay);
            p.mesh.lookAt(camera.position);
            const progress = p.life / p.maxLife;
            const s = p.startSize * (0.5 + progress * 0.5);
            p.mesh.scale.set(s, s, s);
            p.mesh.material.opacity = p.startOpacity * progress;
        }
    }
}