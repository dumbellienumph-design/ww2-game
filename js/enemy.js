import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Enemy {
    constructor(scene, world, position) {
        this.scene = scene;
        this.world = world;
        
        this.health = 30;
        this.speed = 3;
        this.isDead = false;
        this.fireRate = 2.0; // Seconds between shots
        this.fireTimer = Math.random() * 2;
        this.shootDist = 30;

        this.initVisuals(position);
        this.initPhysics(position);
    }

    initVisuals(position) {
        this.group = new THREE.Group();
        
        // Basic soldier shape
        const bodyGeo = new THREE.CapsuleGeometry(0.4, 1.0, 4, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2f4f4f }); // Dark slate gray (uniform)
        this.mesh = new THREE.Mesh(bodyGeo, bodyMat);
        this.mesh.castShadow = true;
        this.group.add(this.mesh);

        // Head
        const headGeo = new THREE.SphereGeometry(0.25);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xd2b48c }); // Tan skin
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.8;
        this.group.add(head);

        // Helmet
        const helmetGeo = new THREE.SphereGeometry(0.27, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const helmetMat = new THREE.MeshStandardMaterial({ color: 0x556b2f }); // Olive drab
        const helmet = new THREE.Mesh(helmetGeo, helmetMat);
        helmet.position.y = 0.85;
        this.group.add(helmet);

        this.scene.add(this.group);
    }

    initPhysics(position) {
        const shape = new CANNON.Sphere(0.5); // Simple sphere for base
        this.body = new CANNON.Body({
            mass: 50,
            shape: shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            linearDamping: 0.5,
            fixedRotation: true
        });
        
        this.world.addBody(this.body);
        this.body.mesh = this.group;

        // Custom hit handler
        this.body.onHit = (damage) => this.takeDamage(damage);
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.health -= amount;
        
        // Flash red
        this.mesh.material.emissive.setHex(0xff0000);
        setTimeout(() => {
            if (this.mesh) this.mesh.material.emissive.setHex(0x000000);
        }, 100);

        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        this.isDead = true;
        // Ragdoll-ish effect: allow rotation and fall
        this.body.fixedRotation = false;
        this.body.applyImpulse(new CANNON.Vec3(0, 5, 0), this.body.position);
        
        // Cleanup after 5 seconds
        setTimeout(() => {
            this.scene.remove(this.group);
            this.world.removeBody(this.body);
        }, 5000);
    }

    update(delta, playerPosition, player) {
        if (this.isDead) return;

        // Move towards player
        const target = new THREE.Vector3(playerPosition.x, this.body.position.y, playerPosition.z);
        const current = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
        
        const dir = target.clone().sub(current);
        const dist = dir.length();

        if (dist > 5 && dist < 60) { // Only move if in range but not too close
            const moveDir = dir.clone().normalize();
            this.body.velocity.x = moveDir.x * this.speed;
            this.body.velocity.z = moveDir.z * this.speed;
            
            // Look at player
            this.group.lookAt(playerPosition.x, this.group.position.y, playerPosition.z);
        } else {
            this.body.velocity.x *= 0.9;
            this.body.velocity.z *= 0.9;
        }

        // Shooting logic
        if (dist < this.shootDist) {
            this.fireTimer += delta;
            if (this.fireTimer >= this.fireRate) {
                this.shoot(player);
                this.fireTimer = 0;
            }
        }
    }

    shoot(player) {
        // Simple bullet visual
        const bulletGeo = new THREE.SphereGeometry(0.1);
        const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const bullet = new THREE.Mesh(bulletGeo, bulletMat);
        
        const startPos = this.group.position.clone().add(new THREE.Vector3(0, 0.8, 0));
        bullet.position.copy(startPos);
        this.scene.add(bullet);

        const targetPos = player.camera.position.clone();
        const dir = targetPos.sub(startPos).normalize();
        
        const speed = 40;
        const duration = 2000;
        const startTime = Date.now();

        const animateBullet = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed > duration || this.isDead) {
                this.scene.remove(bullet);
                return;
            }
            bullet.position.add(dir.clone().multiplyScalar(speed * 0.016));
            
            // Hit detection (simple distance based for enemy bullets)
            if (bullet.position.distanceTo(player.camera.position) < 1) {
                player.takeDamage(5);
                this.scene.remove(bullet);
                return;
            }
            requestAnimationFrame(animateBullet);
        };
        animateBullet();
    }
}