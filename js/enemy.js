import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Enemy {
    constructor(scene, world, position, audio, type = 'infantry') {
        this.scene = scene;
        this.world = world;
        this.type = type;
        this.health = 50;
        this.speed = 5;
        this.isDead = false;
        this.state = 'patrol'; 
        this.fireTimer = Math.random() * 2;
        this.fireRate = 2;
        this.detectionDist = 120;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.initPhysics(position);
        this.initVisuals();
    }

    initPhysics(position) {
        this.body = new CANNON.Body({
            mass: 80, shape: new CANNON.Box(new CANNON.Vec3(0.4, 0.9, 0.4)),
            position: new CANNON.Vec3(position.x, position.y, position.z),
            fixedRotation: true, linearDamping: 0.5
        });
        this.world.addBody(this.body);
        this.body.mesh = this.group;
        this.body.onHit = (damage) => this.takeDamage(damage);
    }

    initVisuals() {
        const grey = new THREE.MeshStandardMaterial({ color: 0x4a4e4d });
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), grey);
        torso.castShadow = true; torso.receiveShadow = true; torso.position.y = 0.4;
        this.group.add(torso);
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.isDead) {
            this.isDead = true;
            this.group.rotation.x = Math.PI / 2.5;
            this.body.mass = 0; this.body.type = CANNON.Body.STATIC;
            setTimeout(() => this.scene.remove(this.group), 10000);
        }
    }

    update(delta, playerPos, player) {
        if (this.isDead) return;
        const pPos = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
        const currentPos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
        const dist = currentPos.distanceTo(pPos);

        if (dist < this.detectionDist) {
            this.group.lookAt(pPos.x, this.group.position.y, pPos.z);
            const moveDir = new THREE.Vector3().subVectors(pPos, currentPos).normalize();
            if (dist > 25) {
                this.body.velocity.x = moveDir.x * this.speed;
                this.body.velocity.z = moveDir.z * this.speed;
            } else { this.body.velocity.set(0, 0, 0); }
            this.fireTimer += delta;
            if (this.fireTimer >= this.fireRate) { this.shoot(pPos, player); this.fireTimer = 0; }
        } else { this.body.velocity.set(0, 0, 0); }
    }

    shoot(targetPos, player) {
        const startPos = this.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        const tPos = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);
        const target = tPos.clone().add(new THREE.Vector3((Math.random()-0.5)*15, (Math.random()-0.5)*5, (Math.random()-0.5)*15));
        const dir = new THREE.Vector3().subVectors(target, startPos).normalize();
        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({color: 0xff0000}));
        bullet.position.copy(startPos); this.scene.add(bullet);
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