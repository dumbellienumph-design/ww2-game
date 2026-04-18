import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VFX } from './vfx.js';

export class Grenade {
    constructor(scene, world, position, velocity, audio) {
        this.scene = scene;
        this.world = world;
        this.audio = audio;
        
        this.isExploded = false;
        this.fuse = 4.5; // Historical 4.5 second fuse

        this.initPhysics(position, velocity);
        this.initVisuals();
    }

    initPhysics(pos, vel) {
        // Model stick grenade as a thin cylinder for physics
        this.body = new CANNON.Body({
            mass: 0.6, // 600g
            shape: new CANNON.Cylinder(0.05, 0.05, 0.4, 8),
            position: new CANNON.Vec3(pos.x, pos.y, pos.z),
            velocity: new CANNON.Vec3(vel.x, vel.y, vel.z),
            angularVelocity: new CANNON.Vec3(Math.random() * 10, Math.random() * 10, 0),
            linearDamping: 0.1,
            angularDamping: 0.1
        });
        this.world.addBody(this.body);
    }

    initVisuals() {
        this.group = new THREE.Group();
        this.scene.add(this.group);

        const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x4d2a15 }); // Wood
        const handle = new THREE.Mesh(handleGeo, handleMat);
        this.group.add(handle);

        const headGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.12);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x2d351e }); // Olive Drab
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.2;
        this.group.add(head);

        const capGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.02);
        const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({color:0x111111}));
        cap.position.y = -0.15;
        this.group.add(cap);

        this.body.mesh = this.group;
    }

    update(delta) {
        if (this.isExploded) return;

        this.fuse -= delta;
        if (this.fuse <= 0) {
            this.explode();
        }

        // Sync mesh to physics
        if(this.body) {
            this.group.position.copy(this.body.position);
            this.group.quaternion.copy(this.body.quaternion);
        }
    }

    explode() {
        this.isExploded = true;
        const pos = this.group.position.clone();
        
        // Large concussive blast
        VFX.createExplosion(this.scene, this.world, pos, 8, 120, this.audio);
        
        // Cleanup
        this.scene.remove(this.group);
        this.world.removeBody(this.body);
    }
}