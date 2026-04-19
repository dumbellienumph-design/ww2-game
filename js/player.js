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
        this.camera = new THREE.PerspectiveCamera(this.baseFOV, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.rotation.order = 'YXZ';
        this.camera.layers.enable(1); 

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
                color: 0x3d2817, length: 1.1, auto: false, adsFOV: 50, adsSpeed: 0.5
            },
            { 
                name: 'Thompson M1A1', type: 'auto', damage: 30, fireRate: 0.08, 
                capacity: 30, ammo: 30, reserve: 120, reloadTime: 2.8,
                color: 0x221100, length: 0.8, auto: true, adsFOV: 65, adsSpeed: 0.7
            },
            { 
                name: 'Kar98k', type: 'bolt', damage: 150, fireRate: 1.5, 
                capacity: 5, ammo: 5, reserve: 25, reloadTime: 4.0,
                color: 0x2a1a0a, length: 1.2, auto: false, adsFOV: 25, adsSpeed: 0.3
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
        this.leanAngle = 0;
        this.leanOffset = 0;
        this.bobTimer = 0;
        this.sway = new THREE.Vector3(0,0,0);

        this.currentVelocity = new THREE.Vector3();
        this.targetVelocity = new THREE.Vector3();
        this.tiltAngle = 0; 

        this.pitch = 0;
        this.yaw = 0;

        this.suppression = 0; 
        this.suppressionOverlay = document.getElementById('suppression-overlay');
        this.scopeOverlay = document.getElementById('scope-overlay');

        this.initPhysics();
        this.initControls();
        this.initWeaponVisuals();
    }

    initPhysics() {
        const radius = 0.5;
        const playerMaterial = new CANNON.Material('player');
        this.shape = new CANNON.Sphere(radius);
        this.body = new CANNON.Body({
            mass: 100, shape: this.shape,
            fixedRotation: true, linearDamping: 0.9,
            material: playerMaterial,
            position: new CANNON.Vec3(0, 10, 0)
        });
        this.world.addBody(this.body);
        this.body.addEventListener('collide', (e) => {
            const contactNormal = new CANNON.Vec3();
            e.contact.ni.negate(contactNormal);
            if (contactNormal.y > 0.5) { this.canJump = true; }
        });
        this.world.addContactMaterial(new CANNON.ContactMaterial(playerMaterial, this.world.defaultContactMaterial, { friction: 0.8, restitution: 0.0 }));
    }

    initControls() {
        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === this.domElement) {
                const sensitivity = (this.moveState.ads ? 0.001 : 0.002) * (1 - this.suppression * 0.5);
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
            if(e.code === 'KeyG') this.throwGrenade();
            if(e.code === 'KeyH') this.startHealing();
            this.onKey(e.code, true);
        });
        document.addEventListener('keyup', (e) => {
            this.onKey(e.code, false);
            if(e.code === 'KeyH') this.stopHealing();
        });
        
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

    startHealing() {
        if (this.bandages > 0 && this.health < 100) { this.isHealing = true; this.healTimer = 0; }
    }

    stopHealing() { this.isHealing = false; }

    onKey(code, isPressed) {
        switch (code) {
            case 'KeyW': this.moveState.forward = isPressed; break;
            case 'KeyS': this.moveState.backward = isPressed; break;
            case 'KeyA': this.moveState.left = isPressed; break;
            case 'KeyD': this.moveState.right = isPressed; break;
            case 'KeyQ': this.moveState.leanLeft = isPressed; break;
            case 'KeyE': this.moveState.leanRight = isPressed; break;
            case 'Space': this.moveState.jump = isPressed; break;
        }
    }

    suppress(amount) { this.suppression = Math.min(1.0, this.suppression + amount); }

    switchWeapon(index) {
        if (index >= 0 && index < this.weapons.length && index !== this.currentWeaponIndex && !this.isReloading) {
            this.currentWeaponIndex = index;
            this.fireTimer = 0;
            this.moveState.ads = false;
            this.initWeaponVisuals();
        }
    }

    reload() {
        const weapon = this.weapons[this.currentWeaponIndex];
        if (this.isReloading || weapon.ammo === weapon.capacity || weapon.reserve <= 0) return;
        this.isReloading = true;
        this.reloadTimer = weapon.reloadTime;
        this.moveState.ads = false;
    }

    throwGrenade() {
        if (this.grenades <= 0 || this.isReloading) return;
        this.grenades--;
        const throwPos = this.camera.position.clone();
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        dir.y += 0.2; dir.normalize();
        const velocity = dir.multiplyScalar(25);
        const grenade = new Grenade(this.scene, this.world, throwPos, velocity, null);
        this.grenadeList.push(grenade);
    }

    initWeaponVisuals() {
        if(this.gunGroup) this.camera.remove(this.gunGroup);
        const weapon = this.weapons[this.currentWeaponIndex];
        this.gunGroup = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: weapon.color, roughness: 0.9 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.3 });
        const sightMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

        if (weapon.name === 'M1 Garand') {
            const stockMain = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.6), woodMat);
            stockMain.position.z = 0.2; this.gunGroup.add(stockMain);
            const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.5), woodMat);
            handguard.position.z = -0.35; this.gunGroup.add(handguard);
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.0), metalMat);
            barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.4; this.gunGroup.add(barrel);
            const clip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.1), metalMat);
            clip.position.set(0, 0.08, -0.1); this.gunGroup.add(clip);
            this.muzzle = new THREE.Object3D(); this.muzzle.position.set(0, 0, -0.9); this.gunGroup.add(this.muzzle);
        } else if (weapon.name === 'Thompson M1A1') {
            const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.5), metalMat);
            this.gunGroup.add(receiver);
            const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.12), woodMat);
            grip.position.set(0, -0.15, 0.2); grip.rotation.x = 0.3; this.gunGroup.add(grip);
            const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.15), metalMat);
            mag.position.set(0, -0.2, -0.05); this.gunGroup.add(mag);
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4), metalMat);
            barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.45; this.gunGroup.add(barrel);
            this.muzzle = new THREE.Object3D(); this.muzzle.position.set(0, 0, -0.65); this.gunGroup.add(this.muzzle);
        } else {
            const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.8), woodMat);
            this.gunGroup.add(stock);
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2), metalMat);
            barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.4; this.gunGroup.add(barrel);
            this.muzzle = new THREE.Object3D(); this.muzzle.position.set(0, 0, -1.0); this.gunGroup.add(this.muzzle);
        }

        this.gunGroup.position.set(0.35, -0.35, -0.6);
        this.camera.add(this.gunGroup);
    }

    requestPointerLock() { this.domElement.requestPointerLock(); }

    takeDamage(amount) {
        this.health -= amount; this.suppress(0.3); this.isBleeding = true; 
        if (this.health <= 0) { this.health = 100; this.body.position.set(-150, 5, 0); this.isBleeding = false; }
    }

    showHitmarker(isKill) {
        const hm = document.getElementById('hitmarker'); if (!hm) return;
        hm.classList.remove('active', 'kill'); void hm.offsetWidth; hm.classList.add('active');
        if (isKill) hm.classList.add('kill'); setTimeout(() => { hm.classList.remove('active', 'kill'); }, 150);
    }

    shoot() {
        if (this.isReloading || this.isHealing) return;
        const weapon = this.weapons[this.currentWeaponIndex];
        if (weapon.ammo <= 0) return;
        weapon.ammo--;
        const muzzlePos = new THREE.Vector3();
        if(this.muzzle) this.muzzle.getWorldPosition(muzzlePos); else muzzlePos.copy(this.camera.position);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        this.particles.createMuzzleFlash(muzzlePos, dir, false);
        const kick = this.moveState.ads ? 0.03 : 0.07;
        this.gunGroup.position.z += kick; this.pitch += kick * 0.2;
        this.createProjectile(muzzlePos, dir, weapon);
    }

    createProjectile(pos, dir, weapon) {
        const tracerGeo = new THREE.BoxGeometry(0.05, 0.05, 1.5);
        const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
        const tracer = new THREE.Mesh(tracerGeo, tracerMat);
        tracer.position.copy(pos); tracer.lookAt(pos.clone().add(dir));
        this.scene.add(tracer);
        const projectile = {
            mesh: tracer, velocity: dir.clone().multiplyScalar(180), 
            gravity: new THREE.Vector3(0, -9.8, 0), damage: weapon.damage, life: 2.0
        };
        this.projectiles.push(projectile);
    }

    findPhysicsBody(mesh) {
        let obj = mesh;
        while(obj) {
            const body = this.world.bodies.find(b => b.mesh === obj);
            if(body) return body;
            obj = obj.parent;
        }
        return null;
    }

    update(delta, terrain) {
        if (!this.enabled) { if (this.gunGroup) this.gunGroup.visible = false; return; }
        if (this.gunGroup) this.gunGroup.visible = true;

        const weapon = this.weapons[this.currentWeaponIndex];
        if(this.moveState.shoot) {
            this.fireTimer += delta;
            if(this.fireTimer >= weapon.fireRate) { this.shoot(); this.fireTimer = 0; }
        } else { this.fireTimer = weapon.fireRate; }

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i]; p.life -= delta;
            p.velocity.add(p.gravity.clone().multiplyScalar(delta));
            const nextPos = p.mesh.position.clone().add(p.velocity.clone().multiplyScalar(delta));
            const ray = new THREE.Raycaster(p.mesh.position, p.velocity.clone().normalize(), 0, p.velocity.length() * delta + 0.1);
            const intersects = ray.intersectObjects(this.scene.children, true);
            if (intersects.length > 0 && intersects[0].object !== p.mesh) {
                const hit = intersects[0]; const hitBody = this.findPhysicsBody(hit.object);
                if (hit.object.name !== 'minimap') {
                    const isDirt = hit.object.name === 'terrain' || hit.object.geometry?.type === 'PlaneGeometry';
                    VFX.createImpactVFX(this.scene, hit.point, hit.face.normal, isDirt ? 'dirt' : 'concrete');
                    if (!hitBody || !hitBody.onHit) VFX.createBulletHole(this.scene, hit);
                }
                if (hitBody && hitBody.onHit) {
                    hitBody.onHit(p.damage);
                    this.showHitmarker((hitBody.health !== undefined && hitBody.health <= 0) || hitBody.isDead);
                }
                this.scene.remove(p.mesh); this.projectiles.splice(i, 1); continue;
            }
            p.mesh.position.copy(nextPos); p.mesh.lookAt(nextPos.clone().add(p.velocity));
            if (p.life <= 0) { this.scene.remove(p.mesh); this.projectiles.splice(i, 1); }
        }

        if (this.isHealing) {
            this.healTimer += delta;
            if (this.healTimer >= 2.0) { this.health = Math.min(100, this.health + 40); this.bandages--; this.isBleeding = false; this.isHealing = false; }
        }
        if (this.isBleeding && !this.isHealing) this.health -= delta * 1.5;

        if (this.isReloading) {
            this.reloadTimer -= delta;
            if (this.reloadTimer <= 0) {
                const transfer = Math.min(weapon.capacity - weapon.ammo, weapon.reserve);
                weapon.ammo += transfer; weapon.reserve -= transfer; this.isReloading = false;
            }
        }

        this.suppression = Math.max(0, this.suppression - delta * 0.5);
        if (this.suppressionOverlay) {
            if (this.suppression > 0.1) this.suppressionOverlay.classList.add('active');
            else this.suppressionOverlay.classList.remove('active');
        }

        this.grenadeList.forEach((g, i) => { g.update(delta); if (g.isExploded) this.grenadeList.splice(i, 1); });

        let targetHeight = 0.7, speedMult = 1.0;
        if (this.moveState.prone) { targetHeight = -0.2; speedMult = 0.2; this.moveState.crouch = false; }
        else if (this.moveState.crouch) { targetHeight = 0.2; speedMult = 0.5; }
        this.currentHeight = THREE.MathUtils.lerp(this.currentHeight, targetHeight, 0.1);

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion); forward.y = 0; forward.normalize();
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion); right.y = 0; right.normalize();
        const moveDir = new THREE.Vector3(0, 0, 0);
        if (this.moveState.forward) moveDir.add(forward); if (this.moveState.backward) moveDir.sub(forward);
        if (this.moveState.left) moveDir.sub(right); if (this.moveState.right) moveDir.add(right);

        if (moveDir.length() > 0) {
            moveDir.normalize();
            this.targetVelocity.copy(moveDir.multiplyScalar(this.walkSpeed * speedMult * (this.moveState.ads ? 0.5 : 1.0)));
        } else { this.targetVelocity.set(0, 0, 0); }

        this.currentVelocity.lerp(this.targetVelocity, delta * 10);
        this.body.velocity.x = this.currentVelocity.x; this.body.velocity.z = this.currentVelocity.z;

        if (this.moveState.jump && this.canJump && !this.moveState.ads && !this.moveState.prone) { this.body.velocity.y = 10; this.canJump = false; }

        let targetTilt = 0; if (this.moveState.left) targetTilt = 0.02; if (this.moveState.right) targetTilt = -0.02;
        let targetLean = 0, targetLeanOffset = 0;
        if (this.moveState.leanLeft) { targetLean = 0.2; targetLeanOffset = -0.4; }
        else if (this.moveState.leanRight) { targetLean = -0.2; targetLeanOffset = 0.4; }

        this.tiltAngle = THREE.MathUtils.lerp(this.tiltAngle, targetTilt, delta * 5);
        this.leanAngle = THREE.MathUtils.lerp(this.leanAngle, targetLean, 0.1);
        this.leanOffset = THREE.MathUtils.lerp(this.leanOffset, targetLeanOffset, 0.1);

        const targetAdsFactor = this.moveState.ads ? 1.0 : 0;
        this.adsFactor = THREE.MathUtils.lerp(this.adsFactor, targetAdsFactor, 0.2);
        this.camera.rotation.set(this.pitch, this.yaw, this.leanAngle + this.tiltAngle);

        if (this.scopeOverlay) {
            if (this.adsFactor > 0.8 && weapon.name === 'Kar98k') {
                this.scopeOverlay.classList.remove('hidden'); document.getElementById('crosshair').classList.add('hidden'); this.gunGroup.visible = false;
            } else {
                this.scopeOverlay.classList.add('hidden'); document.getElementById('crosshair').classList.remove('hidden'); this.gunGroup.visible = true;
            }
        }

        const speed = this.currentVelocity.length(); this.sway.lerp(new THREE.Vector3(0,0,0), 0.1); 
        this.bobTimer += delta * (speed > 1 ? speed * 1.2 : 2.0);
        const bobOffset = Math.sin(this.bobTimer) * (speed > 1 ? 0.04 : 0.01) * (1 - this.adsFactor * 0.8);
        const bobSide = Math.cos(this.bobTimer * 0.5) * (speed > 1 ? 0.02 : 0) * (1 - this.adsFactor * 0.8);
        const hipPos = new THREE.Vector3(0.35 + this.sway.x + bobSide, -0.35 + this.sway.y + Math.abs(bobOffset), -0.6);
        const adsPos = new THREE.Vector3(0 + this.sway.x * 0.1, -0.15 + this.sway.y * 0.1, -0.4);
        
        this.gunGroup.rotation.x = THREE.MathUtils.lerp(this.gunGroup.rotation.x, 0, 0.1);
        if (this.isReloading) {
            const reloadDip = Math.sin((this.reloadTimer / weapon.reloadTime) * Math.PI) * 0.5;
            this.gunGroup.position.set(0.35, -0.35 - reloadDip, -0.6); this.gunGroup.rotation.x = -reloadDip;
        } else if (this.isHealing) { this.gunGroup.position.lerp(new THREE.Vector3(0, -1.5, -0.5), 0.1); }
        else { this.gunGroup.position.lerpVectors(hipPos, adsPos, this.adsFactor); }

        this.camera.fov = THREE.MathUtils.lerp(this.baseFOV, weapon.adsFOV, this.adsFactor);
        this.camera.updateProjectionMatrix();
        this.camera.position.x = this.body.position.x; this.camera.position.y = this.body.position.y + this.currentHeight + bobOffset;
        this.camera.position.z = this.body.position.z;
        const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        this.camera.position.add(camRight.multiplyScalar(this.leanOffset));
    }
}