import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Enemy {
    constructor(scene, world, position, audio, type = 'infantry') {
        this.scene = scene;
        this.world = world;
        this.audio = audio;
        this.type = type;
        
        this.health = (type === 'tank') ? 300 : 50;
        this.speed = (type === 'tank') ? 3 : 5;
        this.isDead = false;
        
        // --- AI COVER STATE ---
        this.state = 'patrol'; // patrol, combat, cover
        this.coverPoint = null;
        this.coverTimer = 0;
        this.isPeeking = false;

        this.fireTimer = Math.random() * 2;
        this.fireRate = (type === 'tank') ? 5 : 2;
        this.detectionDist = 120;

        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.initPhysics(position);
        this.initVisuals();
    }

    initPhysics(position) {
        let shape = (this.type === 'tank') ? new CANNON.Box(new CANNON.Vec3(2, 1, 3)) : new CANNON.Box(new CANNON.Vec3(0.4, 0.9, 0.4));
        this.body = new CANNON.Body({
            mass: (this.type === 'tank') ? 5000 : 80,
            shape: shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            fixedRotation: true,
            linearDamping: 0.5
        });
        this.world.addBody(this.body);
        this.body.mesh = this.group;
        this.body.onHit = (damage) => this.takeDamage(damage);
    }

    initVisuals() {
        const grey = new THREE.MeshStandardMaterial({ color: 0x4a4e4d });
        if (this.type === 'tank') {
            const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 6), grey);
            hull.castShadow = true; hull.receiveShadow = true;
            this.group.add(hull);
        } else {
            const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), grey);
            torso.castShadow = true; torso.receiveShadow = true;
            torso.position.y = 0.4;
            this.group.add(torso);
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health < 40 && this.type !== 'tank') {
            this.state = 'cover';
        }
        if (this.health <= 0 && !this.isDead) {
            this.isDead = true;
            if (this.type === 'tank') {
                VFX.createExplosion(this.scene, this.world, this.group.position, 10, 0, this.audio);
                this.scene.remove(this.group);
            } else {
                this.group.rotation.x = Math.PI / 2.5;
                this.body.mass = 0; this.body.type = CANNON.Body.STATIC;
                setTimeout(() => this.scene.remove(this.group), 10000);
            }
        }
    }

    findCover(playerPos) {
        let bestPoint = null;
        let minDist = 30;
        this.world.bodies.forEach(b => {
            if (b.mass === 0 && b !== this.body) {
                const dist = this.body.position.distanceTo(b.position);
                if (dist < minDist) {
                    minDist = dist;
                    const dirFromPlayer = b.position.vsub(new CANNON.Vec3(playerPos.x, playerPos.y, playerPos.z)).unit();
                    bestPoint = b.position.vadd(dirFromPlayer.scale(2.5));
                }
            }
        });
        return bestPoint;
    }

    update(delta, playerPos, player) {
        if (this.isDead) return;

        // Ensure playerPos is a THREE.Vector3 for distance calculations
        const pPos = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
        const currentPos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
        const dist = currentPos.distanceTo(pPos);

        if (dist < this.detectionDist) {
            if (this.state === 'cover') {
                if (!this.coverPoint) this.coverPoint = this.findCover(playerPos);
                
                if (this.coverPoint) {
                    const moveDir = new CANNON.Vec3().copy(this.coverPoint).vsub(this.body.position).unit();
                    const distToCover = new CANNON.Vec3().copy(this.coverPoint).vsub(this.body.position).length();
                    
                    if (distToCover > 1.0) {
                        this.body.velocity.x = moveDir.x * this.speed;
                        this.body.velocity.z = moveDir.z * this.speed;
                        this.group.lookAt(this.coverPoint.x, this.group.position.y, this.coverPoint.z);
                    } else {
                        this.body.velocity.set(0, 0, 0);
                        this.coverTimer += delta;
                        if (this.coverTimer > 3.0) {
                            this.isPeeking = true;
                            if (this.coverTimer > 4.5) {
                                this.isPeeking = false;
                                this.coverTimer = 0;
                            }
                        }
                        this.group.lookAt(pPos.x, this.group.position.y, pPos.z);
                        if (this.isPeeking) {
                            this.fireTimer += delta;
                            if (this.fireTimer >= this.fireRate) { this.shoot(pPos, player); this.fireTimer = 0; }
                        }
                    }
                } else { this.state = 'combat'; }
            } else {
                this.group.lookAt(pPos.x, this.group.position.y, pPos.z);
                const moveDir = new THREE.Vector3().subVectors(pPos, currentPos).normalize();
                if (dist > 25) {
                    this.body.velocity.x = moveDir.x * this.speed;
                    this.body.velocity.z = moveDir.z * this.speed;
                } else { this.body.velocity.set(0, 0, 0); }

                this.fireTimer += delta;
                if (this.fireTimer >= this.fireRate) {
                    this.shoot(pPos, player);
                    this.fireTimer = 0;
                }
            }
        } else {
            this.body.velocity.set(0, 0, 0);
        }
    }

    shoot(targetPos, player) {
        if (this.audio && typeof this.audio.play === 'function') this.audio.play('rifle_fire', { randomPitch: true });
        
        const startPos = this.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        const inaccuracy = 0.04;
        
        // FIXED: Convert targetPos to THREE.Vector3 to ensure .clone().add() exists
        const tPos = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);
        const target = tPos.clone().add(new THREE.Vector3((Math.random()-0.5)*15, (Math.random()-0.5)*5, (Math.random()-0.5)*15));
        
        const dir = new THREE.Vector3().subVectors(target, startPos).normalize();
        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({color: 0xff0000}));
        bullet.position.copy(startPos);
        this.scene.add(bullet);
        const startTime = Date.now();
        const anim = () => {
            if (Date.now() - startTime > 2000 || this.isDead) { this.scene.remove(bullet); return; }
            bullet.position.add(dir.clone().multiplyScalar(1.5));
            const distToPlayer = bullet.position.distanceTo(player.camera.position);
            if (distToPlayer < 1.5) { player.takeDamage(10); this.scene.remove(bullet); return; }
            if (distToPlayer < 4.0) { player.suppress(0.1); }
            requestAnimationFrame(anim);
        };
        anim();
    }
}