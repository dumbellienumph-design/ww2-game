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
        this.shootDist = 50;

        if (type === 'tank') {
            this.health = 250;
            this.speed = 3;
            this.fireRate = 6.0; // Slow reload for 88mm
            this.shootDist = 150;
            this.traverseSpeed = 0.3; // Radians per sec
            this.currentTurretYaw = 0;
        } else if (type === 'aa_flak') {
            this.health = 100;
            this.speed = 0; 
            this.fireRate = 4.0;
            this.shootDist = 250;
        }
        
        this.isDead = false;
        this.isCrouching = false;
        this.state = 'patrol'; 
        this.stateTimer = 0;
        this.targetPos = new THREE.Vector3();
        this.fireTimer = Math.random() * 2;
        this.suppressionLevel = 0;

        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.initPhysics(position);
        this.initVisuals();
    }

    initPhysics(position) {
        let shape;
        if (this.type === 'infantry') shape = new CANNON.Box(new CANNON.Vec3(0.4, 0.9, 0.4));
        else if (this.type === 'tank') shape = new CANNON.Box(new CANNON.Vec3(2.6, 1.2, 4.0));
        else if (this.type === 'aa_flak') shape = new CANNON.Box(new CANNON.Vec3(2, 1, 2));

        this.body = new CANNON.Body({
            mass: this.type === 'infantry' ? 80 : 15000,
            shape: shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            fixedRotation: this.type !== 'tank',
            linearDamping: 0.5
        });
        
        if(this.type === 'tank') this.body.shapeOffsets[0].set(0, 0.5, 0);

        this.world.addBody(this.body);
        this.body.mesh = this.group;
        this.body.onHit = (damage) => this.takeDamage(damage);
    }

    initVisuals() {
        const mat = new THREE.MeshStandardMaterial({ color: 0x4a4e4d }); 

        if (this.type === 'infantry') {
            this.visualGroup = new THREE.Group();
            this.group.add(this.visualGroup);
            const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), mat);
            torso.position.y = 0.4;
            this.visualGroup.add(torso);
            const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.2), new THREE.MeshStandardMaterial({color: 0x333333}));
            helmet.position.y = 1.1;
            this.visualGroup.add(helmet);
            this.gun = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.9), new THREE.MeshStandardMaterial({color: 0x111111}));
            this.gun.position.set(0.3, 0.4, -0.4);
            this.visualGroup.add(this.gun);
        } 
        else if (this.type === 'tank') {
            const tigerMat = new THREE.MeshStandardMaterial({ color: 0x3d4131 });
            const hull = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.5, 8), tigerMat);
            this.group.add(hull);
            
            this.turretGroup = new THREE.Group();
            this.turretGroup.position.y = 1.5;
            this.group.add(this.turretGroup);

            const turret = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2, 1.2, 12), tigerMat);
            this.turretGroup.add(turret);
            this.barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 5.5).rotateX(Math.PI/2), new THREE.MeshStandardMaterial({color:0x222222}));
            this.barrel.position.set(0, 0.1, -4);
            this.turretGroup.add(this.barrel);
        }
        else if (this.type === 'aa_flak') {
            const base = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 0.6), mat);
            this.group.add(base);
            const baseCross = base.clone(); baseCross.rotation.y = Math.PI/2;
            this.group.add(baseCross);
            this.turret = new THREE.Group();
            this.turret.position.y = 0.5;
            this.group.add(this.turret);
            const shield = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2, 0.1), mat);
            shield.position.z = -0.5;
            this.turret.add(shield);
            this.barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 6).rotateX(Math.PI/2), mat);
            this.barrel.position.set(0, 0.8, -2.5);
            this.turret.add(this.barrel);
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.type === 'infantry' && !this.isDead) {
            this.suppressionLevel = 1.0;
            this.state = 'cover';
            this.stateTimer = 3;
        }
        if (this.health <= 0 && !this.isDead) {
            this.isDead = true;
            this.state = 'dead';
            this.group.rotation.x = -Math.PI / 2.2;
            this.body.mass = 0;
            this.body.type = CANNON.Body.STATIC;
            setTimeout(() => this.scene.remove(this.group), 10000);
        }
    }

    update(delta, playerPosition, player) {
        if (this.isDead) return;

        const currentPos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
        const dist = currentPos.distanceTo(playerPosition);

        this.suppressionLevel = Math.max(0, this.suppressionLevel - delta * 0.2);

        this.stateTimer -= delta;
        if (this.stateTimer <= 0) {
            this.decideNextState(dist, playerPosition);
        }

        this.executeState(delta, playerPosition, dist, player);

        // --- SHOOTING LOGIC ---
        let canShoot = dist < this.shootDist;
        
        // Tank realism: Only fire if turret is pointed at player
        if (this.type === 'tank') {
            const targetDir = playerPosition.clone().sub(currentPos).normalize();
            const turretWorldDir = new THREE.Vector3(0,0,-1).applyQuaternion(this.turretGroup.getWorldQuaternion(new THREE.Quaternion()));
            const dot = turretWorldDir.dot(targetDir);
            if (dot < 0.95) canShoot = false; // Turret still traversing
        }

        if (canShoot && this.suppressionLevel < 0.8) {
            this.fireTimer += delta;
            if (this.fireTimer >= this.fireRate) {
                this.shoot(player);
                this.fireTimer = 0;
                
                // TANK TACTIC: Reverse to cover after shot
                if (this.type === 'tank') {
                    this.state = 'reload_hide';
                    this.stateTimer = 3; 
                }
            }
        }
    }

    decideNextState(dist, playerPos) {
        if (this.type === 'aa_flak') {
            this.state = dist < this.shootDist ? 'aim' : 'idle';
            this.stateTimer = 5;
            return;
        }

        if (this.type === 'tank') {
            if (dist > 130) this.state = 'stalk';
            else if (dist < 80) this.state = 'reload_hide'; // Back away if too close
            else this.state = 'ambush';
            this.stateTimer = 4 + Math.random() * 4;
            return;
        }

        // Infantry Tactics
        if (this.suppressionLevel > 0.5) {
            this.state = 'cover';
            this.stateTimer = 2 + Math.random() * 2;
        } else if (dist > 60) {
            this.state = 'patrol';
            this.targetPos.set(this.body.position.x + (Math.random()-0.5)*60, 0, this.body.position.z + (Math.random()-0.5)*60);
            this.stateTimer = 5 + Math.random() * 5;
        } else if (dist > 30) {
            this.state = 'rush';
            this.stateTimer = 3 + Math.random() * 2;
            this.targetPos.copy(playerPos);
        } else {
            this.state = 'flank';
            this.stateTimer = 2 + Math.random() * 2;
        }
    }

    executeState(delta, playerPos, dist, player) {
        const moveDir = new THREE.Vector3();
        const currentPos = this.group.position;

        if (this.type === 'tank') {
            // TURRET TRAVERSE (Always track player)
            const targetDir = playerPos.clone().sub(currentPos).normalize();
            const hullQuat = this.group.quaternion.clone();
            const invHullQuat = hullQuat.invert();
            const localTargetDir = targetDir.clone().applyQuaternion(invHullQuat);
            const targetYaw = Math.atan2(localTargetDir.x, localTargetDir.z) + Math.PI;

            let yawDiff = targetYaw - this.currentTurretYaw;
            while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
            while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
            
            const step = this.traverseSpeed * delta;
            if (Math.abs(yawDiff) < step) this.currentTurretYaw = targetYaw;
            else this.currentTurretYaw += Math.sign(yawDiff) * step;
            this.turretGroup.rotation.y = this.currentTurretYaw;

            // HULL MOVEMENT
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.group.quaternion);
            if (this.state === 'stalk') {
                moveDir.subVectors(playerPos, currentPos).normalize();
            } else if (this.state === 'reload_hide') {
                moveDir.subVectors(currentPos, playerPos).normalize(); // Reverse
            } else if (this.state === 'ambush') {
                this.body.velocity.set(0, this.body.velocity.y, 0); // Stop and aim
            }

            if (moveDir.length() > 0) {
                this.body.velocity.x = moveDir.x * this.speed;
                this.body.velocity.z = moveDir.z * this.speed;
                this.group.lookAt(playerPos.x, this.group.position.y, playerPos.z);
            }
            return;
        }

        // Infantry/Flak movement (Existing logic)
        if (this.type === 'infantry') {
            if (this.state === 'patrol') moveDir.subVectors(this.targetPos, currentPos).normalize();
            else if (this.state === 'rush') {
                moveDir.subVectors(playerPos, currentPos).normalize();
                this.body.velocity.x = moveDir.x * (this.speed * 1.5);
                this.body.velocity.z = moveDir.z * (this.speed * 1.5);
            } else if (this.state === 'cover' || this.state === 'flank') {
                const toPlayer = new THREE.Vector3().subVectors(playerPos, currentPos).normalize();
                moveDir.set(-toPlayer.z, 0, toPlayer.x);
                this.isCrouching = true;
            } else moveDir.subVectors(playerPos, currentPos).normalize();

            if (this.state !== 'rush') {
                this.body.velocity.x = moveDir.x * this.speed;
                this.body.velocity.z = moveDir.z * this.speed;
            }
            this.group.lookAt(playerPos.x, this.group.position.y, playerPos.z);
            if (this.isCrouching && this.visualGroup) this.visualGroup.position.y = THREE.MathUtils.lerp(this.visualGroup.position.y, -0.4, 0.1);
            else if (this.visualGroup) this.visualGroup.position.y = THREE.MathUtils.lerp(this.visualGroup.position.y, 0, 0.1);
        } else if (this.type === 'aa_flak') {
            this.turret.lookAt(playerPos.x, this.turret.position.y, playerPos.z);
        }
    }

    shoot(player) {
        if (this.audio) this.audio.play(this.type === 'infantry' ? 'rifle_fire' : 'tank_fire', { randomPitch: true });
        const startPos = new THREE.Vector3();
        if (this.type === 'aa_flak') this.barrel.getWorldPosition(startPos);
        else if (this.type === 'tank') this.barrel.getWorldPosition(startPos);
        else startPos.copy(this.group.position).add(new THREE.Vector3(0, 1.5, 0));

        if (this.type === 'infantry') {
            const dir = player.camera.position.clone().sub(startPos).normalize();
            this.spawnBullet(startPos, dir, player);
        } else {
            VFX.createExplosion(this.scene, this.world, player.camera.position, this.type === 'tank' ? 3 : 6, 30, this.audio);
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