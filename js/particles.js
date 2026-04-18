import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.physicalDebris = [];
    }

    createMuzzleFlash(position, direction, isTank = false) {
        const size = isTank ? 4.0 : 0.8;
        const color = isTank ? 0xffaa00 : 0xffff00;
        
        const flashGeo = new THREE.SphereGeometry(size, 8, 8);
        const flashMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9 });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(position);
        this.scene.add(flash);

        let s = 1.0;
        const anim = () => {
            s *= 0.8;
            flash.scale.set(s, s, s);
            flash.material.opacity *= 0.7;
            if (flash.material.opacity > 0.05) requestAnimationFrame(anim);
            else this.scene.remove(flash);
        };
        anim();
    }

    // --- NEW: PHYSICAL DEBRIS FOR DESTRUCTION ---
    createPhysicalDebris(world, position, color, count = 5) {
        const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const mat = new THREE.MeshStandardMaterial({ color: color });
        
        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = true;
            this.scene.add(mesh);

            const body = new CANNON.Body({
                mass: 5,
                shape: new CANNON.Box(new CANNON.Vec3(0.2, 0.2, 0.2)),
                position: new CANNON.Vec3(
                    position.x + (Math.random() - 0.5) * 2,
                    position.y + Math.random() * 2,
                    position.z + (Math.random() - 0.5) * 2
                ),
                velocity: new CANNON.Vec3(
                    (Math.random() - 0.5) * 10,
                    Math.random() * 15,
                    (Math.random() - 0.5) * 10
                )
            });
            
            world.addBody(body);
            this.physicalDebris.push({ mesh, body, life: 5.0 });
        }
    }

    createFire(position) {
        const emitter = {
            position: position.clone(),
            timer: 0,
            rate: 0.1,
            life: 1.0
        };
        // Simple fire visual logic added to update
    }

    createExhaustSmoke(position, velocity, isBlack = false) {
        const smokeGeo = new THREE.SphereGeometry(0.3, 6, 6);
        const smokeMat = new THREE.MeshBasicMaterial({ 
            color: isBlack ? 0x222222 : 0xaaaaaa, 
            transparent: true, 
            opacity: 0.4 
        });
        const smoke = new THREE.Mesh(smokeGeo, smokeMat);
        smoke.position.copy(position);
        this.scene.add(smoke);

        this.particles.push({
            mesh: smoke,
            velocity: velocity.clone().add(new THREE.Vector3((Math.random()-0.5)*0.5, 0.5, (Math.random()-0.5)*0.5)),
            life: 1.5,
            maxLife: 1.5,
            startSize: 1.0
        });
    }

    update(delta, camera) {
        // Update simple particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= delta;
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
                continue;
            }
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
            const progress = p.life / p.maxLife;
            p.mesh.scale.set(1 + (1 - progress) * 2, 1 + (1 - progress) * 2, 1 + (1 - progress) * 2);
            p.mesh.material.opacity = progress * 0.4;
        }

        // Update physical debris
        for (let i = this.physicalDebris.length - 1; i >= 0; i--) {
            const d = this.physicalDebris[i];
            d.life -= delta;
            if (d.life <= 0) {
                this.scene.remove(d.mesh);
                // world.removeBody is handled via game instance usually, but for simplicity here:
                d.body.world.removeBody(d.body);
                this.physicalDebris.splice(i, 1);
                continue;
            }
            d.mesh.position.copy(d.body.position);
            d.mesh.quaternion.copy(d.body.quaternion);
        }
    }
}