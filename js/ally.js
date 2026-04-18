import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Ally {
    constructor(scene, world, position, audio) {
        this.scene = scene;
        this.world = world;
        this.audio = audio;
        
        this.health = 100;
        this.speed = 4.5;
        this.isDead = false;
        this.state = 'waiting'; // Changed from 'follow'
        
        this.fireTimer = Math.random() * 2;
        this.fireRate = 1.5; 
        this.detectionDist = 80;

        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.initPhysics(position);
        this.initVisuals();
    }

    initPhysics(position) {
        const shape = new CANNON.Box(new CANNON.Vec3(0.4, 0.9, 0.4));
        this.body = new CANNON.Body({
            mass: 80,
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
        const oliveDrab = new THREE.MeshStandardMaterial({ color: 0x3b3d2e });
        const tan = new THREE.MeshStandardMaterial({ color: 0x8b7355 });

        this.visualGroup = new THREE.Group();
        this.group.add(this.visualGroup);

        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), oliveDrab);
        torso.position.y = 0.4;
        this.visualGroup.add(torso);

        const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.2), tan);
        helmet.position.y = 1.1;
        this.visualGroup.add(helmet);

        const gun = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.9), new THREE.MeshStandardMaterial({color: 0x111111}));
        gun.position.set(0.3, 0.4, -0.4);
        this.visualGroup.add(gun);
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.isDead) {
            this.isDead = true;
            this.group.rotation.x = -Math.PI / 2.2;
            this.body.mass = 0;
            this.body.type = CANNON.Body.STATIC;
            setTimeout(() => this.scene.remove(this.group), 10000);
        }
    }

    update(delta, playerPos, enemies, objectives, isPlayerActive) {
        if (this.isDead) return;

        // Start acting only when player moves
        if (this.state === 'waiting') {
            if (isPlayerActive) this.state = 'follow';
            return;
        }

        const currentPos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
        const distToPlayer = currentPos.distanceTo(playerPos);

        let nearestEnemy = null;
        let minDist = this.detectionDist;
        enemies.forEach(e => {
            if (e.isDead) return;
            const d = currentPos.distanceTo(e.group.position);
            if (d < minDist) { minDist = d; nearestEnemy = e; }
        });

        if (nearestEnemy) this.state = 'combat';
        else {
            const nearObjective = objectives.find(o => currentPos.distanceTo(o.position) < 25);
            if (nearObjective && distToPlayer > 30) this.state = 'defend';
            else this.state = 'follow';
        }

        const moveDir = new THREE.Vector3();
        
        if (this.state === 'follow') {
            if (distToPlayer > 6) {
                moveDir.subVectors(playerPos, currentPos).normalize();
                this.body.velocity.x = moveDir.x * this.speed;
                this.body.velocity.z = moveDir.z * this.speed;
                this.group.lookAt(playerPos.x, this.group.position.y, playerPos.z);
            } else {
                this.body.velocity.set(0, this.body.velocity.y, 0);
            }
        } 
        else if (this.state === 'combat' && nearestEnemy) {
            this.group.lookAt(nearestEnemy.group.position.x, this.group.position.y, nearestEnemy.group.position.z);
            this.body.velocity.set(0, this.body.velocity.y, 0);
            
            this.fireTimer += delta;
            if (this.fireTimer >= this.fireRate) {
                this.shoot(nearestEnemy);
                this.fireTimer = 0;
            }
        }
        else if (this.state === 'defend') {
            this.body.velocity.set(0, this.body.velocity.y, 0);
        }
    }

    shoot(target) {
        if (this.audio) this.audio.play('rifle_fire', { randomPitch: true });
        
        const startPos = this.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        const targetPos = target.group.position.clone().add(new THREE.Vector3(0, 1.0, 0));
        const dir = targetPos.sub(startPos).normalize();

        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({color: 0x00ff00}));
        bullet.position.copy(startPos);
        this.scene.add(bullet);
        
        const startTime = Date.now();
        const anim = () => {
            if (Date.now() - startTime > 2000 || this.isDead) { this.scene.remove(bullet); return; }
            bullet.position.add(dir.clone().multiplyScalar(1.5));
            
            if (bullet.position.distanceTo(target.group.position) < 1.0) {
                target.takeDamage(20);
                this.scene.remove(bullet);
                return;
            }
            requestAnimationFrame(anim);
        };
        anim();
    }
}