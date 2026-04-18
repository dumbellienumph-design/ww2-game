import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Player {
    constructor(scene, world, domElement, audio, particles) {
        this.scene = scene;
        this.world = world;
        this.domElement = domElement;
        this.audio = audio;
        this.particles = particles;
        
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.layers.enable(1); 

        this.walkSpeed = 8;
        this.canJump = true;
        this.health = 100;
        this.ammo = 30;
        this.enabled = true;
        
        this.moveState = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            shoot: false
        };

        this.fireRate = 0.6; 
        this.fireTimer = 0;

        this.initPhysics();
        this.initControls();
        this.initWeapon();
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
                this.euler.y -= e.movementX * 0.002;
                this.euler.x -= e.movementY * 0.002;
                this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
                this.camera.quaternion.setFromEuler(this.euler);
            }
        });
        document.addEventListener('keydown', (e) => this.onKey(e.code, true));
        document.addEventListener('keyup', (e) => this.onKey(e.code, false));
        document.addEventListener('mousedown', (e) => {
            if (document.pointerLockElement === this.domElement && e.button === 0) this.moveState.shoot = true;
        });
        document.addEventListener('mouseup', (e) => {
            if (document.pointerLockElement === this.domElement && e.button === 0) this.moveState.shoot = false;
        });
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

    initWeapon() {
        this.gunGroup = new THREE.Group();
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.2 });
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x4d2a15, roughness: 0.9 });
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.6), metalMat);
        this.gunGroup.add(receiver);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5), metalMat);
        barrel.rotateX(Math.PI / 2); barrel.position.set(0, 0, -0.45);
        this.gunGroup.add(barrel);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.4), woodMat);
        stock.position.set(0, -0.05, 0.4);
        this.gunGroup.add(stock);
        
        // Muzzle position helper
        this.muzzle = new THREE.Object3D();
        this.muzzle.position.set(0, 0, -0.7);
        this.gunGroup.add(this.muzzle);

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
        if (this.ammo <= 0) { 
            if(this.audio) this.audio.play('ui_click');
            return; 
        }
        this.ammo--;

        if(this.audio) {
            this.audio.play('rifle_fire', { randomPitch: true });
            setTimeout(() => { this.audio.play('rifle_cycle'); }, 250);
        }

        // --- VFX: MUZZLE FLASH ---
        if(this.particles) {
            const muzzleWorldPos = new THREE.Vector3();
            this.muzzle.getWorldPosition(muzzleWorldPos);
            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            this.particles.createMuzzleFlash(muzzleWorldPos, dir, false);
        }

        this.gunGroup.position.z += 0.05;
        setTimeout(() => this.gunGroup.position.z -= 0.05, 50);

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const intersects = raycaster.intersectObjects(this.scene.children, true);
        if (intersects.length > 0) {
            const hit = intersects[0];
            const hitBody = this.findPhysicsBody(hit.object);
            if (hitBody && hitBody.onHit) hitBody.onHit(15);
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

        if (this.moveState.shoot) {
            this.fireTimer += delta;
            if (this.fireTimer >= this.fireRate) {
                this.shoot();
                this.fireTimer = 0;
            }
        } else {
            this.fireTimer = this.fireRate;
        }

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
            this.body.velocity.x = moveDir.x * this.walkSpeed;
            this.body.velocity.z = moveDir.z * this.walkSpeed;
            this.body.velocity.y = currentY;
        } else {
            this.body.velocity.x *= 0.5;
            this.body.velocity.z *= 0.5;
        }

        if (this.moveState.jump && this.canJump) {
            this.body.velocity.y = 10;
            this.canJump = false;
        }

        this.camera.position.x = this.body.position.x;
        this.camera.position.y = this.body.position.y + 0.7;
        this.camera.position.z = this.body.position.z;
    }
}