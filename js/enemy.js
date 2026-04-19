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
        this.detectionDist = 150;
        
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

        // Torso
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), grey);
        torso.position.y = 0.4;
        torso.castShadow = true; torso.receiveShadow = true;
        this.group.add(torso);

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), faceMat);
        head.position.y = 0.9;
        this.group.add(head);

        // Stahlhelm (German Helmet)
        const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.15, 8), darkGrey);
        helmet.position.y = 1.05;
        helmet.castShadow = true;
        this.group.add(helmet);

        // Backpack
        const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.15), darkGrey);
        pack.position.set(0, 0.4, -0.2);
        this.group.add(pack);
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.isDead) {
            this.isDead = true;
            this.group.rotation.x = Math.PI / 2.2;
            this.body.mass = 0; this.body.type = CANNON.Body.STATIC;
            setTimeout(() => this.scene.remove(this.group), 15000);
        }
    }

    update(delta, playerPos, player) {
        if (this.isDead) return;
        const pPos = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
        const currentPos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
        
        // --- CLAMP TO GROUND ---
        if (window.game && window.game.getTerrainHeight) {
            const groundY = window.game.getTerrainHeight(this.body.position.x, this.body.position.z);
            if (this.body.position.y < groundY + 1.0) {
                this.body.position.y = groundY + 1.0;
                this.body.velocity.y = 0;
            }
        }

        const dist = currentPos.distanceTo(pPos);

        if (dist < this.detectionDist) {
            this.group.lookAt(pPos.x, this.group.position.y, pPos.z);
            const moveDir = new THREE.Vector3().subVectors(pPos, currentPos).normalize();
            if (dist > 30) {
                this.body.velocity.x = moveDir.x * this.speed;
                this.body.velocity.z = moveDir.z * this.speed;
            } else { this.body.velocity.set(0, 0, 0); }
            
            this.fireTimer += delta;
            if (this.fireTimer >= this.fireRate) { this.shoot(pPos, player); this.fireTimer = 0; }
        } else { this.body.velocity.set(0, 0, 0); }
    }

    shoot(targetPos, player) {
        const startPos = this.group.position.clone().add(new THREE.Vector3(0, 1.0, 0));
        const tPos = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);
        const target = tPos.clone().add(new THREE.Vector3((Math.random()-0.5)*12, (Math.random()-0.5)*4, (Math.random()-0.5)*12));
        const dir = new THREE.Vector3().subVectors(target, startPos).normalize();
        
        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({color: 0xff3300}));
        bullet.position.copy(startPos); this.scene.add(bullet);
        const startTime = Date.now();
        const anim = () => {
            if (Date.now() - startTime > 2000 || this.isDead) { this.scene.remove(bullet); return; }
            bullet.position.add(dir.clone().multiplyScalar(2.0));
            const distToPlayer = bullet.position.distanceTo(player.camera.position);
            if (distToPlayer < 1.5) { player.takeDamage(12); this.scene.remove(bullet); return; }
            if (distToPlayer < 5.0) { player.suppress(0.15); }
            requestAnimationFrame(anim);
        };
        anim();
    }
}