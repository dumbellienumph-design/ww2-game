import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Player {
    constructor(scene, world, domElement, audio, particles) {
        this.scene = scene;
        this.world = world;
        this.domElement = domElement;
        this.audio = audio;
        this.particles = particles;
        
        this.baseFOV = 75;
        this.camera = new THREE.PerspectiveCamera(this.baseFOV, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.layers.enable(1); 

        this.walkSpeed = 8;
        this.canJump = true;
        this.health = 100;
        this.enabled = true;
        
        this.moveState = {
            forward: false, backward: false, left: false, right: false,
            jump: false, shoot: false, ads: false
        };

        this.weapons = [
            { 
                name: 'Kar98k', type: 'bolt', damage: 150, fireRate: 1.2, 
                capacity: 5, ammo: 5, reserve: 25, muzzleVel: 1.5,
                color: 0x4d2a15, length: 0.9, auto: false, adsFOV: 50, adsSpeed: 0.4
            },
            { 
                name: 'M1 Garand', type: 'semi', damage: 60, fireRate: 0.3, 
                capacity: 8, ammo: 8, reserve: 40, muzzleVel: 1.3,
                color: 0x5c4033, length: 0.8, auto: false, adsFOV: 55, adsSpeed: 0.5
            },
            { 
                name: 'MP40', type: 'auto', damage: 25, fireRate: 0.1, 
                capacity: 32, ammo: 32, reserve: 128, muzzleVel: 0.8,
                color: 0x111111, length: 0.6, auto: true, adsFOV: 65, adsSpeed: 0.7
            }
        ];
        this.currentWeaponIndex = 0;
        this.fireTimer = 0;
        
        // ADS Lerp Factor
        this.adsFactor = 0; // 0: Hip, 1: Sights

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
            fixedRotation: true, linearDamping: 0.5,
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
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === this.domElement) {
                // Lower sensitivity when aiming
                const sensitivity = this.moveState.ads ? 0.001 : 0.002;
                this.euler.y -= e.movementX * sensitivity;
                this.euler.x -= e.movementY * sensitivity;
                this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
                this.camera.quaternion.setFromEuler(this.euler);
            }
        });
        document.addEventListener('keydown', (e) => {
            this.onKey(e.code, true);
            if(e.code === 'Digit1') this.switchWeapon(0);
            if(e.code === 'Digit2') this.switchWeapon(1);
            if(e.code === 'Digit3') this.switchWeapon(2);
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

    switchWeapon(index) {
        if (index >= 0 && index < this.weapons.length && index !== this.currentWeaponIndex) {
            this.currentWeaponIndex = index;
            this.fireTimer = 0;
            this.moveState.ads = false; // Cancel ADS on switch
            if(this.audio) this.audio.play('ui_click');
            this.initWeaponVisuals();
        }
    }

    onKey(code, isPressed) {
        switch (code) {
            case 'KeyW': this.moveState.forward = isPressed; break;
            case 'KeyS': this.moveState.backward = isPressed; break;
            case 'KeyA': this.moveState.left = isPressed; break;
            case 'KeyD': this.moveState.right = isPressed; break;
            case 'ShiftLeft': this.moveState.crouch = isPressed; break;
            case 'Space': this.moveState.jump = isPressed; break;
        }
    }

    initWeaponVisuals() {
        if(this.gunGroup) this.camera.remove(this.gunGroup);
        const weapon = this.weapons[this.currentWeaponIndex];
        this.gunGroup = new THREE.Group();
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.2 });
        const stockMat = new THREE.MeshStandardMaterial({ color: weapon.color, roughness: 0.9 });
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.5), metalMat);
        this.gunGroup.add(receiver);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, weapon.length), metalMat);
        barrel.rotateX(Math.PI / 2); barrel.position.set(0, 0, -weapon.length/2);
        this.gunGroup.add(barrel);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.4), stockMat);
        stock.position.set(0, -0.05, 0.3);
        this.gunGroup.add(stock);

        // --- 6.2 ADD IRON SIGHTS ---
        const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.08, 0.02), metalMat);
        frontSight.position.set(0, 0.05, -weapon.length);
        this.gunGroup.add(frontSight);
        
        const rearSight = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.005, 8, 16, Math.PI), metalMat);
        rearSight.rotation.y = Math.PI/2;
        rearSight.position.set(0, 0.1, -0.2);
        this.gunGroup.add(rearSight);
        
        this.muzzle = new THREE.Object3D();
        this.muzzle.position.set(0, 0, -weapon.length);
        this.gunGroup.add(this.muzzle);

        // Initial Hip Position
        this.gunGroup.position.set(0.3, -0.3, -0.5);
        this.camera.add(this.gunGroup);
        this.scene.add(this.camera);
    }

    requestPointerLock() {
        this.domElement.requestPointerLock();
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.body.position.set(-50, 5, -50);
            this.health = 100;
        }
    }

    shoot() {
        const weapon = this.weapons[this.currentWeaponIndex];
        if (weapon.ammo <= 0) { if(this.audio) this.audio.play('ui_click'); return; }
        weapon.ammo--;
        if(this.audio) {
            this.audio.play('rifle_fire', { randomPitch: true });
            if (weapon.type === 'bolt') { setTimeout(() => { this.audio.play('rifle_cycle'); }, 400); }
        }
        if(this.particles) {
            const muzzleWorldPos = new THREE.Vector3();
            this.muzzle.getWorldPosition(muzzleWorldPos);
            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            this.particles.createMuzzleFlash(muzzleWorldPos, dir, false);
        }
        // Visual Recoil (Lowered during ADS)
        const recoilAmount = this.moveState.ads ? 0.02 : 0.05;
        this.gunGroup.position.z += recoilAmount;
        setTimeout(() => this.gunGroup.position.z -= recoilAmount, 50);

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const intersects = raycaster.intersectObjects(this.scene.children, true);
        if (intersects.length > 0) {
            const hit = intersects[0];
            const hitBody = this.findPhysicsBody(hit.object);
            if (hitBody && hitBody.onHit) hitBody.onHit(weapon.damage);
        }
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
        if (!this.enabled) {
            if (this.gunGroup) this.gunGroup.visible = false;
            return;
        }
        if (this.gunGroup) this.gunGroup.visible = true;

        const weapon = this.weapons[this.currentWeaponIndex];

        // --- 6.2 ADS LOGIC ---
        const targetAdsFactor = this.moveState.ads ? 1.0 : 0;
        this.adsFactor = THREE.MathUtils.lerp(this.adsFactor, targetAdsFactor, 0.2);

        // Smoothly interpolate position: Hip to Center
        const hipPos = new THREE.Vector3(0.3, -0.3, -0.5);
        const adsPos = new THREE.Vector3(0, -0.12, -0.3); // Aligned with eye relief
        this.gunGroup.position.lerpVectors(hipPos, adsPos, this.adsFactor);

        // Dynamic FOV Zoom
        const targetFOV = THREE.MathUtils.lerp(this.baseFOV, weapon.adsFOV, this.adsFactor);
        if (Math.abs(this.camera.fov - targetFOV) > 0.1) {
            this.camera.fov = targetFOV;
            this.camera.updateProjectionMatrix();
        }

        // --- MOVEMENT ---
        if (this.moveState.shoot) {
            this.fireTimer += delta;
            if (this.fireTimer >= weapon.fireRate) { this.shoot(); this.fireTimer = 0; }
        } else if(!weapon.auto) this.fireTimer = weapon.fireRate;

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        forward.y = 0; forward.normalize();
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        right.y = 0; right.normalize();

        const moveDir = new THREE.Vector3(0, 0, 0);
        if (this.moveState.forward) moveDir.add(forward);
        if (this.moveState.backward) moveDir.sub(forward);
        if (this.moveState.left) moveDir.sub(right);
        if (this.moveState.right) moveDir.add(right);

        if (moveDir.length() > 0) {
            moveDir.normalize();
            const currentY = this.body.velocity.y;
            // Movement speed penalty during ADS
            const currentSpeed = this.walkSpeed * THREE.MathUtils.lerp(1.0, weapon.adsSpeed, this.adsFactor);
            this.body.velocity.x = moveDir.x * currentSpeed;
            this.body.velocity.z = moveDir.z * currentSpeed;
            this.body.velocity.y = currentY;
        } else {
            this.body.velocity.x *= 0.5;
            this.body.velocity.z *= 0.5;
        }

        if (this.moveState.jump && this.canJump && !this.moveState.ads) {
            this.body.velocity.y = 10;
            this.canJump = false;
        }

        this.camera.position.x = this.body.position.x;
        this.camera.position.y = this.body.position.y + 0.7;
        this.camera.position.z = this.body.position.z;
    }
}