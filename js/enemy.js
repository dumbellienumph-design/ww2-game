import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Enemy {
    constructor(scene, world, position, audio, type = 'infantry') {
        this.scene = scene;
        this.world = world;
        this.audio = audio;
        this.type = type;
        
        // Attributes based on type
        this.health = 30;
        this.speed = 4;
        this.fireRate = 2.0;
        this.shootDist = 40;

        if (type === 'tank') {
            this.health = 250;
            this.speed = 2.5;
            this.fireRate = 5.0;
            this.shootDist = 120;
        } else if (type === 'aa_flak') {
            this.health = 100;
            this.speed = 0; // Stationary
            this.fireRate = 4.0;
            this.shootDist = 200; // Extreme range for AA
        }
        
        this.isDead = false;
        this.state = 'idle'; 
        this.stateTimer = 0;
        this.targetPos = new THREE.Vector3();
        this.fireTimer = Math.random() * 2;

        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.initPhysics(position);
        this.initVisuals();
    }

    initPhysics(position) {
        let shape;
        if (this.type === 'infantry') shape = new CANNON.Box(new CANNON.Vec3(0.4, 0.9, 0.4));
        else if (this.type === 'tank') shape = new CANNON.Box(new CANNON.Vec3(2.5, 1.2, 4.0));
        else if (this.type === 'aa_flak') shape = new CANNON.Box(new CANNON.Vec3(2, 1, 2));

        this.body = new CANNON.Body({
            mass: this.type === 'infantry' ? 80 : 15000,
            shape: shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            fixedRotation: this.type !== 'tank'
        });
        this.world.addBody(this.body);
        this.body.mesh = this.group;
        this.body.onHit = (damage) => this.takeDamage(damage);
    }

    initVisuals() {
        const mat = new THREE.MeshStandardMaterial({ color: 0x4a4e4d }); // German Grey

        if (this.type === 'infantry') {
            // Torso
            const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), mat);
            torso.position.y = 0.4;
            this.group.add(torso);
            // Stahlhelm
            const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.2), new THREE.MeshStandardMaterial({color: 0x3d3535}));
            helmet.position.y = 1.1;
            this.group.add(helmet);
            this.gun = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.9), new THREE.MeshStandardMaterial({color: 0x111111}));
            this.gun.position.set(0.3, 0.4, -0.4);
            this.group.add(this.gun);
        } 
        else if (this.type === 'tank') {
            const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 1.8, 8), mat);
            this.group.add(hull);
            this.turret = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2, 1.2, 12), mat);
            this.turret.position.y = 1.5;
            this.group.add(this.turret);
            this.barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5).rotateX(Math.PI/2), mat);
            this.barrel.position.set(0, 1.5, -4);
            this.group.add(this.barrel);
        }
        else if (this.type === 'aa_flak') {
            // Cruciform Carriage
            const base = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 0.6), mat);
            this.group.add(base);
            const baseCross = base.clone(); baseCross.rotation.y = Math.PI/2;
            this.group.add(baseCross);
            
            // Turret & Shield
            this.turret = new THREE.Group();
            this.turret.position.y = 0.5;
            this.group.add(this.turret);
            
            const shield = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2, 0.1), mat);
            shield.position.z = -0.5;
            this.turret.add(shield);
            
            // 8.8cm Barrel
            this.barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 6).rotateX(Math.PI/2), mat);
            this.barrel.position.set(0, 0.8, -2.5);
            this.turret.add(this.barrel);
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.isDead) {
            this.isDead = true;
            this.state = 'dead';
            this.group.rotation.x = -Math.PI / 2.2; // Fall over
            this.body.mass = 0;
            this.body.type = CANNON.Body.STATIC;
            setTimeout(() => this.scene.remove(this.group), 10000);
        }
    }

    update(delta, playerPosition, player) {
        if (this.isDead) return;

        const currentPos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
        const dist = currentPos.distanceTo(playerPosition);

        // --- AI STATE MACHINE ---
        this.stateTimer -= delta;
        if (this.stateTimer <= 0) {
            if (this.type === 'aa_flak') {
                this.state = dist < this.shootDist ? 'aim' : 'idle';
            } else if (dist > 100) {
                this.state = 'patrol';
                this.targetPos.set(currentPos.x + (Math.random()-0.5)*50, 0, currentPos.z + (Math.random()-0.5)*50);
            } else {
                this.state = 'chase';
            }
            this.stateTimer = 3 + Math.random() * 5;
        }

        // Movement & Aiming
        if (this.type !== 'aa_flak') {
            const moveDir = new THREE.Vector3();
            if (this.state === 'chase') {
                moveDir.subVectors(playerPosition, currentPos).normalize();
            } else if (this.state === 'patrol') {
                moveDir.subVectors(this.targetPos, currentPos).normalize();
            }
            this.body.velocity.x = moveDir.x * this.speed;
            this.body.velocity.z = moveDir.z * this.speed;
            this.group.lookAt(playerPosition.x, this.group.position.y, playerPosition.z);
        } else {
            // Flak specific aiming: Pitch and Yaw the turret
            this.turret.lookAt(playerPosition.x, this.turret.position.y, playerPosition.z);
        }

        // Shooting
        if (dist < this.shootDist) {
            this.fireTimer += delta;
            if (this.fireTimer >= this.fireRate) {
                this.shoot(player);
                this.fireTimer = 0;
            }
        }
    }

    shoot(player) {
        if (this.audio) this.audio.play(this.type === 'infantry' ? 'rifle_fire' : 'tank_fire', { randomPitch: true });

        const startPos = new THREE.Vector3();
        if (this.type === 'aa_flak') this.barrel.getWorldPosition(startPos);
        else if (this.type === 'tank') this.barrel.getWorldPosition(startPos);
        else startPos.copy(this.group.position).add(new THREE.Vector3(0, 1.5, 0));

        // FX & Damage
        if (this.type === 'infantry') {
            const dir = player.camera.position.clone().sub(startPos).normalize();
            this.spawnBullet(startPos, dir, player);
        } else {
            // Heavy shells create explosions
            VFX.createExplosion(this.scene, this.world, player.camera.position, this.type === 'tank' ? 2 : 5, 20, this.audio);
        }
    }

    spawnBullet(start, dir, player) {
        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({color: 0xffaa00}));
        bullet.position.copy(start);
        this.scene.add(bullet);
        const startTime = Date.now();
        const anim = () => {
            if (Date.now() - startTime > 2000 || this.isDead) { this.scene.remove(bullet); return; }
            bullet.position.add(dir.clone().multiplyScalar(1.2));
            if (bullet.position.distanceTo(player.camera.position) < 2 && !bullet.userData.whizzed) {
                if (this.audio) this.audio.play('bullet_whiz');
                bullet.userData.whizzed = true;
            }
            if (bullet.position.distanceTo(player.camera.position) < 0.8) {
                player.takeDamage(10);
                VFX.createExplosion(this.scene, this.world, bullet.position.clone(), 1, 0, this.audio);
                this.scene.remove(bullet);
                return;
            }
            requestAnimationFrame(anim);
        };
        anim();
    }
}