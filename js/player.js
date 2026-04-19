import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Grenade } from './grenade.js';
import { VFX } from './vfx.js';

export class Player {
    constructor(scene, world, domElement, audio, particles) {
        this.scene = scene;
        this.world = world;
        this.domElement = domElement;
        this.particles = particles;
        
        this.baseFOV = 75;
        this.camera = new THREE.PerspectiveCamera(this.baseFOV, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.camera.rotation.order = 'YXZ';
        
        this.walkSpeed = 8;
        this.health = 100;
        this.enabled = true;

        this.moveState = {
            forward: false, backward: false, left: false, right: false,
            jump: false, shoot: false, ads: false
        };

        this.weapons = [
            { name: 'M1 Garand', fireRate: 0.3, damage: 65, ammo: 8, reserve: 40, adsFOV: 50, length: 1.1, color: 0x3d2817 },
            { name: 'Thompson M1A1', fireRate: 0.08, damage: 30, ammo: 30, reserve: 120, adsFOV: 65, length: 0.8, color: 0x221100 },
            { name: 'Kar98k', fireRate: 1.5, damage: 150, ammo: 5, reserve: 25, adsFOV: 20, length: 1.2, color: 0x2a1a0a }
        ];
        this.currentWeaponIndex = 0;
        this.projectiles = []; 
        this.fireTimer = 0;
        
        this.adsFactor = 0;
        this.currentVelocity = new THREE.Vector3();
        this.targetVelocity = new THREE.Vector3();
        this.pitch = 0;
        this.yaw = 0;

        this.initPhysics();
        this.initControls();
        this.initWeaponVisuals();
    }

    initPhysics() {
        this.body = new CANNON.Body({
            mass: 100, shape: new CANNON.Sphere(0.5),
            fixedRotation: true, linearDamping: 0.9,
            position: new CANNON.Vec3(-150, 10, 0)
        });
        this.world.addBody(this.body);
    }

    initControls() {
        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === this.domElement) {
                const sensitivity = this.moveState.ads ? 0.001 : 0.002;
                this.yaw -= e.movementX * sensitivity;
                this.pitch -= e.movementY * sensitivity;
                this.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.pitch));
            }
        });
        document.addEventListener('keydown', (e) => {
            if(e.code === 'Digit1') this.switchWeapon(0);
            if(e.code === 'Digit2') this.switchWeapon(1);
            if(e.code === 'Digit3') this.switchWeapon(2);
            this.onKey(e.code, true);
        });
        document.addEventListener('keyup', (e) => this.onKey(e.code, false));
        document.addEventListener('mousedown', (e) => {
            if (document.pointerLockElement === this.domElement) {
                if(e.button === 0) this.moveState.shoot = true;
                if(e.button === 2) this.moveState.ads = true;
            }
        });
        document.addEventListener('mouseup', (e) => {
            if (document.pointerLockElement === this.domElement) {
                if(e.button === 0) this.moveState.shoot = false;
                if(e.button === 2) this.moveState.ads = false;
            }
        });
    }

    onKey(code, isPressed) {
        switch (code) {
            case 'KeyW': this.moveState.forward = isPressed; break;
            case 'KeyS': this.moveState.backward = isPressed; break;
            case 'KeyA': this.moveState.left = isPressed; break;
            case 'KeyD': this.moveState.right = isPressed; break;
        }
    }

    switchWeapon(index) {
        this.currentWeaponIndex = index;
        this.initWeaponVisuals();
    }

    initWeaponVisuals() {
        if(this.gunGroup) this.camera.remove(this.gunGroup);
        const w = this.weapons[this.currentWeaponIndex];
        this.gunGroup = new THREE.Group();
        const metal = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 });
        const wood = new THREE.MeshStandardMaterial({ color: w.color });
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, w.length), wood);
        this.gunGroup.add(body);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, w.length), metal);
        barrel.rotation.x = Math.PI/2; barrel.position.z = -w.length/2;
        this.gunGroup.add(barrel);
        this.muzzle = new THREE.Object3D(); this.muzzle.position.z = -w.length;
        this.gunGroup.add(this.muzzle);
        this.gunGroup.position.set(0.35, -0.35, -0.6);
        this.camera.add(this.gunGroup);
        this.scene.add(this.camera);
    }

    requestPointerLock() { this.domElement.requestPointerLock(); }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) { this.health = 100; this.body.position.set(-150, 15, 0); }
    }

    update(delta, terrain) {
        // --- HOLISTIC REALISM: PLAYER GROUNDING ---
        if (window.game && window.game.terrain && window.game.terrain.getHeight) {
            const groundY = window.game.terrain.getHeight(this.body.position.x, this.body.position.z);
            // Player height offset 1.7m (standing)
            const targetY = groundY + 1.7;
            this.body.position.y = THREE.MathUtils.lerp(this.body.position.y, targetY, 0.2);
            this.body.velocity.y = 0; 
        }

        const weapon = this.weapons[this.currentWeaponIndex];
        if(this.moveState.shoot) {
            this.fireTimer += delta;
            if(this.fireTimer >= weapon.fireRate) { this.shoot(); this.fireTimer = 0; }
        } else { this.fireTimer = weapon.fireRate; }

        const speed = this.walkSpeed * (this.moveState.ads ? 0.5 : 1.0);
        const forward = new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion); forward.y = 0; forward.normalize();
        const right = new THREE.Vector3(1,0,0).applyQuaternion(this.camera.quaternion); right.y = 0; right.normalize();
        const moveDir = new THREE.Vector3(0,0,0);
        if(this.moveState.forward) moveDir.add(forward); if(this.moveState.backward) moveDir.sub(forward);
        if(this.moveState.left) moveDir.sub(right); if(this.moveState.right) moveDir.add(right);
        
        if(moveDir.length() > 0) this.targetVelocity.copy(moveDir.normalize().multiplyScalar(speed));
        else this.targetVelocity.set(0,0,0);
        
        this.currentVelocity.lerp(this.targetVelocity, delta * 10);
        this.body.velocity.x = this.currentVelocity.x;
        this.body.velocity.z = this.currentVelocity.z;

        this.camera.rotation.set(this.pitch, this.yaw, 0);
        this.adsFactor = THREE.MathUtils.lerp(this.adsFactor, this.moveState.ads ? 1.0 : 0, 0.2);
        this.gunGroup.position.lerpVectors(new THREE.Vector3(0.35, -0.35, -0.6), new THREE.Vector3(0, -0.15, -0.4), this.adsFactor);
        this.camera.fov = THREE.MathUtils.lerp(this.baseFOV, weapon.adsFOV, this.adsFactor);
        this.camera.updateProjectionMatrix();

        this.camera.position.copy(this.body.position);
    }

    shoot() {
        const weapon = this.weapons[this.currentWeaponIndex];
        if (weapon.ammo <= 0) return;
        weapon.ammo--;
        const muzzlePos = new THREE.Vector3(); this.muzzle.getWorldPosition(muzzlePos);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        this.particles.createMuzzleFlash(muzzlePos, dir);
        const tracer = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 2), new THREE.MeshBasicMaterial({color: 0xffffff}));
        tracer.position.copy(muzzlePos); tracer.lookAt(muzzlePos.clone().add(dir));
        this.scene.add(tracer);
        this.projectiles.push({ mesh: tracer, velocity: dir.clone().multiplyScalar(200), life: 2.0, damage: weapon.damage });
    }
}