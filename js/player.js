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
        this.camera = new THREE.PerspectiveCamera(this.baseFOV, window.innerWidth / window.innerHeight, 0.1, 1500);
        this.camera.rotation.order = 'YXZ';
        
        this.walkSpeed = 8;
        this.canJump = true;
        this.health = 100;
        this.enabled = true;
        
        this.isBleeding = false;
        this.bandages = 3;
        this.isHealing = false;
        this.healTimer = 0;

        this.moveState = {
            forward: false, backward: false, left: false, right: false,
            jump: false, shoot: false, ads: false,
            crouch: false, prone: false, leanLeft: false, leanRight: false
        };

        this.weapons = [
            { 
                name: 'M1 Garand', type: 'semi', damage: 65, fireRate: 0.3, 
                capacity: 8, ammo: 8, reserve: 40, reloadTime: 2.5,
                color: 0x3d2817, length: 1.1, adsFOV: 50
            },
            { 
                name: 'Thompson M1A1', type: 'auto', damage: 30, fireRate: 0.08, 
                capacity: 30, ammo: 30, reserve: 120, reloadTime: 2.8,
                color: 0x221100, length: 0.8, adsFOV: 65
            },
            { 
                name: 'Kar98k', type: 'bolt', damage: 150, fireRate: 1.5, 
                capacity: 5, ammo: 5, reserve: 25, reloadTime: 4.0,
                color: 0x2a1a0a, length: 1.2, adsFOV: 25
            }
        ];
        this.currentWeaponIndex = 0;
        this.grenades = 3;
        this.grenadeList = [];
        this.projectiles = []; 

        this.fireTimer = 0;
        this.reloadTimer = 0;
        this.isReloading = false;
        this.adsFactor = 0;
        
        this.currentHeight = 0.7; 
        this.bobTimer = 0;
        this.sway = new THREE.Vector3(0,0,0);
        this.currentVelocity = new THREE.Vector3();
        this.targetVelocity = new THREE.Vector3();
        
        this.pitch = 0;
        this.yaw = 0;

        this.initPhysics();
        this.initControls();
        this.initWeaponVisuals();
    }

    initPhysics() {
        const radius = 0.5;
        this.body = new CANNON.Body({
            mass: 100, shape: new CANNON.Sphere(radius),
            fixedRotation: true, linearDamping: 0.9,
            position: new CANNON.Vec3(-150, 10, 0)
        });
        this.world.addBody(this.body);
        this.body.addEventListener('collide', (e) => {
            const contactNormal = new CANNON.Vec3();
            e.contact.ni.negate(contactNormal);
            if (contactNormal.y > 0.5) this.canJump = true;
        });
    }

    initControls() {
        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === this.domElement) {
                const sensitivity = this.moveState.ads ? 0.001 : 0.002;
                this.yaw -= e.movementX * sensitivity;
                this.pitch -= e.movementY * sensitivity;
                this.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.pitch));
                this.sway.x = -e.movementX * 0.0003;
                this.sway.y = e.movementY * 0.0003;
            }
        });

        document.addEventListener('keydown', (e) => {
            if(e.code === 'Digit1') this.switchWeapon(0);
            if(e.code === 'Digit2') this.switchWeapon(1);
            if(e.code === 'Digit3') this.switchWeapon(2);
            if(e.code === 'KeyR') this.reload();
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
            case 'Space': this.moveState.jump = isPressed; break;
        }
    }

    switchWeapon(index) {
        if (index >= 0 && index < this.weapons.length && index !== this.currentWeaponIndex && !this.isReloading) {
            this.currentWeaponIndex = index;
            this.initWeaponVisuals();
        }
    }

    reload() {
        const weapon = this.weapons[this.currentWeaponIndex];
        if (this.isReloading || weapon.ammo === weapon.capacity || weapon.reserve <= 0) return;
        this.isReloading = true;
        this.reloadTimer = weapon.reloadTime;
    }

    initWeaponVisuals() {
        if(this.gunGroup) this.camera.remove(this.gunGroup);
        const weapon = this.weapons[this.currentWeaponIndex];
        this.gunGroup = new THREE.Group();
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8 });
        const woodMat = new THREE.MeshStandardMaterial({ color: weapon.color });

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, weapon.length), woodMat);
        this.gunGroup.add(body);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, weapon.length), metalMat);
        barrel.rotation.x = Math.PI / 2; barrel.position.z = -weapon.length/2;
        this.gunGroup.add(barrel);

        this.muzzle = new THREE.Object3D();
        this.muzzle.position.z = -weapon.length;
        this.gunGroup.add(this.muzzle);

        this.gunGroup.position.set(0.35, -0.35, -0.6);
        this.camera.add(this.gunGroup);
        this.scene.add(this.camera);
    }

    shoot() {
        const weapon = this.weapons[this.currentWeaponIndex];
        if (weapon.ammo <= 0 || this.isReloading) return;
        weapon.ammo--;

        const muzzlePos = new THREE.Vector3();
        this.muzzle.getWorldPosition(muzzlePos);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        
        this.particles.createMuzzleFlash(muzzlePos, dir);
        this.gunGroup.position.z += 0.05; // Kickback
        
        // Bullet Tracer
        const tracer = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 2), new THREE.MeshBasicMaterial({color: 0xffffff}));
        tracer.position.copy(muzzlePos);
        tracer.lookAt(muzzlePos.clone().add(dir));
        this.scene.add(tracer);

        const projectile = {
            mesh: tracer, velocity: dir.clone().multiplyScalar(200), life: 2.0, damage: weapon.damage
        };
        this.projectiles.push(projectile);
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 100;
            this.body.position.set(-150, 5, 0);
        }
    }

    suppress(amt) {
        const overlay = document.getElementById('suppression-overlay');
        if (overlay) overlay.classList.add('active');
        setTimeout(() => overlay.classList.remove('active'), 200);
    }

    update(delta, terrain) {
        const weapon = this.weapons[this.currentWeaponIndex];
        if(this.moveState.shoot) {
            this.fireTimer += delta;
            if(this.fireTimer >= weapon.fireRate) { this.shoot(); this.fireTimer = 0; }
        } else { this.fireTimer = weapon.fireRate; }

        if (this.isReloading) {
            this.reloadTimer -= delta;
            if (this.reloadTimer <= 0) {
                const transfer = Math.min(weapon.capacity - weapon.ammo, weapon.reserve);
                weapon.ammo += transfer; weapon.reserve -= transfer; this.isReloading = false;
            }
        }

        // Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i]; p.life -= delta;
            const step = p.velocity.clone().multiplyScalar(delta);
            const ray = new THREE.Raycaster(p.mesh.position, p.velocity.clone().normalize(), 0, step.length() + 0.1);
            const hits = ray.intersectObjects(this.scene.children, true);
            
            if (hits.length > 0 && hits[0].object !== p.mesh) {
                const h = hits[0];
                VFX.createImpactVFX(this.scene, h.point, h.face.normal, 'concrete');
                // Check if hit body
                let obj = h.object;
                while(obj) {
                    const body = this.world.bodies.find(b => b.mesh === obj);
                    if(body && body.onHit) { body.onHit(p.damage); break; }
                    obj = obj.parent;
                }
                this.scene.remove(p.mesh); this.projectiles.splice(i, 1); continue;
            }
            p.mesh.position.add(step);
            if (p.life <= 0) { this.scene.remove(p.mesh); this.projectiles.splice(i, 1); }
        }

        // Movement
        const speed = this.walkSpeed * (this.moveState.ads ? 0.5 : 1.0);
        const forward = new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion); forward.y = 0; forward.normalize();
        const right = new THREE.Vector3(1,0,0).applyQuaternion(this.camera.quaternion); right.y = 0; right.normalize();
        const moveDir = new THREE.Vector3(0,0,0);
        if(this.moveState.forward) moveDir.add(forward); if(this.moveState.backward) moveDir.sub(forward);
        if(this.moveState.left) moveDir.sub(right); if(this.moveState.right) moveDir.add(right);
        
        if(moveDir.length() > 0) {
            moveDir.normalize();
            this.targetVelocity.copy(moveDir.multiplyScalar(speed));
        } else { this.targetVelocity.set(0,0,0); }
        
        this.currentVelocity.lerp(this.targetVelocity, delta * 10);
        this.body.velocity.x = this.currentVelocity.x;
        this.body.velocity.z = this.currentVelocity.z;

        if (this.moveState.jump && this.canJump) { this.body.velocity.y = 10; this.canJump = false; }

        this.camera.rotation.set(this.pitch, this.yaw, 0);
        this.adsFactor = THREE.MathUtils.lerp(this.adsFactor, this.moveState.ads ? 1.0 : 0, 0.2);
        
        const hipPos = new THREE.Vector3(0.35, -0.35, -0.6);
        const adsPos = new THREE.Vector3(0, -0.15, -0.4);
        this.gunGroup.position.lerpVectors(hipPos, adsPos, this.adsFactor);
        this.camera.fov = THREE.MathUtils.lerp(this.baseFOV, weapon.adsFOV, this.adsFactor);
        this.camera.updateProjectionMatrix();

        this.camera.position.copy(this.body.position);
        this.camera.position.y += this.currentHeight;
    }
}