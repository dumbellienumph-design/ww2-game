import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Helicopter {
    constructor(scene, world, position, audio, particles) {
        this.scene = scene;
        this.world = world;
        this.audio = audio;
        this.particles = particles;
        
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.initPhysics(position);
        this.initVisuals();
        
        this.isOccupied = false;
        this.rotorRotation = 0;
        this.fireTimer = 0;
        this.fireRate = 0.15;

        // --- 5.1 DAMAGE & DEGRADATION ---
        this.maxHealth = 100;
        this.health = 100;
        this.maxFuel = 100;
        this.fuel = 100;
        this.ammo = 500;
        this.isDestroyed = false;
        this.damageTimer = 0;

        this.body.onHit = (damage) => this.takeDamage(damage);
    }

    takeDamage(amount) {
        if(this.isDestroyed) return;
        this.health -= amount;
        if(this.health <= 0) {
            this.health = 0;
            this.isDestroyed = true;
            VFX.createExplosion(this.scene, this.world, this.group.position, 10, 50, this.audio);
        }
    }

    initPhysics(position) {
        const bodyShape = new CANNON.Box(new CANNON.Vec3(1, 1, 3));
        this.body = new CANNON.Body({
            mass: 1500, 
            shape: bodyShape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            linearDamping: 0.1,
            angularDamping: 0.8
        });
        this.world.addBody(this.body);
        this.body.mesh = this.group;
    }

    initVisuals() {
        const fuseGeo = new THREE.BoxGeometry(2, 2, 6);
        const fuseMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
        this.fuselage = new THREE.Mesh(fuseGeo, fuseMat);
        this.group.add(this.fuselage);

        this.rotorGroup = new THREE.Group();
        this.rotorGroup.position.set(0, 1.2, 0);
        this.group.add(this.rotorGroup);

        const bladeGeo = new THREE.BoxGeometry(10, 0.05, 0.5);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const blade1 = new THREE.Mesh(bladeGeo, bladeMat);
        const blade2 = new THREE.Mesh(bladeGeo, bladeMat);
        blade2.rotation.y = Math.PI / 2;
        this.rotorGroup.add(blade1, blade2);

        const tailGeo = new THREE.BoxGeometry(0.5, 0.5, 4);
        const tail = new THREE.Mesh(tailGeo, fuseMat);
        tail.position.set(0, 0, 4);
        this.group.add(tail);

        this.tailRotorGroup = new THREE.Group();
        this.tailRotorGroup.position.set(0.3, 0, 5.5);
        this.group.add(this.tailRotorGroup);
        
        const tailBladeGeo = new THREE.BoxGeometry(0.05, 2, 0.2);
        const tailBlade = new THREE.Mesh(tailBladeGeo, bladeMat);
        this.tailRotorGroup.add(tailBlade);

        this.chaseCameraAnchor = new THREE.Object3D();
        this.chaseCameraAnchor.position.set(0, 10, 20); 
        this.group.add(this.chaseCameraAnchor);
    }

    update(delta, controls, camera) {
        if(this.isDestroyed) {
            this.body.velocity.y -= 9.82 * delta; // Crash to ground
            if(this.particles) {
                this.particles.createFire(this.group.position);
                this.particles.createExhaustSmoke(this.group.position, new THREE.Vector3(0, 2, 0), true);
            }
            return;
        }

        const targetRotorSpeed = this.isOccupied ? 20 : 0;
        this.rotorRotation += targetRotorSpeed * delta * 5;
        this.rotorGroup.rotation.y = this.rotorRotation;
        this.tailRotorGroup.rotation.x = this.rotorRotation * 1.5;

        if (!this.isOccupied) {
            this.body.angularDamping = 0.99;
            if(this.audio) this.audio.stop('heli_engine');
            return;
        }

        // --- FUEL DEGRADATION ---
        this.fuel -= delta * 0.2;
        if(this.fuel <= 0) { this.fuel = 0; }

        // --- VISUAL DAMAGE STATES ---
        this.damageTimer += delta;
        if (this.damageTimer > 0.2 && this.health < 60) {
            if(this.particles) {
                this.particles.createExhaustSmoke(this.group.position, new THREE.Vector3(0, 2, 0), true);
                if(this.health < 30) this.particles.createFire(this.group.position);
            }
            this.damageTimer = 0;
        }

        if (this.audio) {
            this.audio.play('heli_engine');
            const pitchRate = 0.8 + (targetRotorSpeed / 20) * 0.4;
            this.audio.setPlaybackRate('heli_engine', pitchRate);
        }

        this.body.angularDamping = 0.8;
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.group.quaternion);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.group.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.group.quaternion);

        const upForce = 9.82 * this.body.mass;
        let liftFactor = (this.fuel > 0) ? 1.0 : 0;
        if (controls.jump && this.fuel > 0) liftFactor = 1.6;
        if (controls.crouch && this.fuel > 0) liftFactor = 0.4;
        
        const liftForce = up.clone().multiplyScalar(upForce * liftFactor);
        this.body.applyForce(new CANNON.Vec3(liftForce.x, liftForce.y, liftForce.z), this.body.position);

        const torqueMult = 8000;
        if (controls.forward) this.body.applyTorque(new CANNON.Vec3(-right.x * torqueMult, -right.y * torqueMult, -right.z * torqueMult));
        if (controls.backward) this.body.applyTorque(new CANNON.Vec3(right.x * torqueMult, right.y * torqueMult, right.z * torqueMult));
        if (controls.left) this.body.applyTorque(new CANNON.Vec3(forward.x * torqueMult, forward.y * torqueMult, forward.z * torqueMult));
        if (controls.right) this.body.applyTorque(new CANNON.Vec3(-forward.x * torqueMult, -forward.y * torqueMult, -forward.z * torqueMult));

        const camEuler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        const bodyEuler = new THREE.Euler().setFromQuaternion(this.group.quaternion, 'YXZ');
        let yawError = camEuler.y - bodyEuler.y;
        while (yawError > Math.PI) yawError -= Math.PI * 2;
        while (yawError < -Math.PI) yawError += Math.PI * 2;
        this.body.applyTorque(new CANNON.Vec3(0, yawError * 20000, 0));

        this.fireTimer += delta;
        if (controls.shoot && this.fireTimer >= this.fireRate && this.ammo > 0) {
            this.fire();
            this.fireTimer = 0;
        }
    }

    fire() {
        this.ammo--;
        if(this.audio) this.audio.play('heli_fire');
        const tip = this.group.position.clone().add(new THREE.Vector3(0, -0.5, -3).applyQuaternion(this.group.quaternion));
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.group.quaternion);
        if(this.particles) this.particles.createMuzzleFlash(tip, dir, false);
        const bulletMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        this.scene.add(bulletMesh);
        const bulletBody = new CANNON.Body({
            mass: 5, shape: new CANNON.Sphere(0.2),
            position: new CANNON.Vec3(tip.x, tip.y, tip.z),
            velocity: new CANNON.Vec3(dir.x * 150, dir.y * 150, dir.z * 150)
        });
        this.world.addBody(bulletBody);
        bulletBody.mesh = bulletMesh;
        bulletBody.addEventListener('collide', (e) => {
            VFX.createExplosion(this.scene, this.world, bulletBody.position.clone(), 3, 30, this.audio);
            setTimeout(() => { if(bulletBody.world) { this.world.removeBody(bulletBody); this.scene.remove(bulletMesh); } }, 20);
        });
        setTimeout(() => { if(bulletBody.world) { this.world.removeBody(bulletBody); this.scene.remove(bulletMesh); } }, 3000);
    }
}