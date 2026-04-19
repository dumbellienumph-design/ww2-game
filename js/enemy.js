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
        const darkGrey = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const faceMat = new THREE.MeshStandardMaterial({ color: 0xdbac98 });

        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), grey);
        torso.position.y = 0.4;
        torso.castShadow = true; torso.receiveShadow = true;
        this.group.add(torso);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), faceMat);
        head.position.y = 0.9;
        this.group.add(head);

        const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.15, 8), darkGrey);
        helmet.position.y = 1.05;
        helmet.castShadow = true;
        this.group.add(helmet);
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.isDead) {
            this.isDead = true;
            this.group.rotation.x = Math.PI / 2.2;
            this.body.mass = 0; this.body.type = CANNON.Body.STATIC;
        }
    }

    update(delta, playerPos, player) {
        if (this.isDead) return;

        // --- HOLISTIC REALISM: GROUND CLAMPING ---
        // Every frame, unit probes the unified terrain engine
        if (window.game && window.game.terrain && window.game.terrain.getHeight) {
            const groundY = window.game.terrain.getHeight(this.body.position.x, this.body.position.z);
            // Units stick to terrain Y + offset (0.9 for torso center)
            this.body.position.y = THREE.MathUtils.lerp(this.body.position.y, groundY + 0.9, 0.2);
            this.body.velocity.y = 0; 
        }

        const dist = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z).distanceTo(playerPos);

        if (dist < 150) {
            this.group.lookAt(playerPos.x, this.group.position.y, playerPos.z);
            const moveDir = new THREE.Vector3().subVectors(playerPos, this.group.position).normalize();
            if (dist > 30) {
                this.body.velocity.x = moveDir.x * this.speed;
                this.body.velocity.z = moveDir.z * this.speed;
            } else { this.body.velocity.set(0, 0, 0); }
        } else { this.body.velocity.set(0, 0, 0); }
    }
}