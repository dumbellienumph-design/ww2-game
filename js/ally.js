import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Ally {
    constructor(scene, world, position) {
        this.scene = scene;
        this.world = world;
        
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.initPhysics(position);
        this.initVisuals();
    }

    initPhysics(position) {
        this.body = new CANNON.Body({
            mass: 80,
            shape: new CANNON.Box(new CANNON.Vec3(0.4, 0.9, 0.4)),
            position: new CANNON.Vec3(position.x, position.y, position.z),
            fixedRotation: true
        });
        this.world.addBody(this.body);
        this.body.mesh = this.group;
    }

    initVisuals() {
        const uniformMat = new THREE.MeshStandardMaterial({ color: 0x556b2f }); // Olive Drab
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac });
        const helmetMat = new THREE.MeshStandardMaterial({ color: 0x483d8b }); // Darker helmet

        // Body
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), uniformMat);
        torso.position.y = 0.4;
        this.group.add(torso);

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), skinMat);
        head.position.y = 0.95;
        this.group.add(head);

        // Helmet
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8, 0, Math.PI*2, 0, Math.PI/2), helmetMat);
        helmet.position.y = 1.0;
        this.group.add(helmet);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
        const lLeg = new THREE.Mesh(legGeo, uniformMat);
        lLeg.position.set(-0.15, -0.35, 0);
        this.group.add(lLeg);
        const rLeg = lLeg.clone();
        rLeg.position.x = 0.15;
        this.group.add(rLeg);

        // Simple Rifle
        const gun = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.8), new THREE.MeshStandardMaterial({color: 0x222222}));
        gun.position.set(0.3, 0.4, -0.3);
        this.group.add(gun);
    }

    update() {
        // Stay mostly static as requested, just keep feet on ground
    }
}