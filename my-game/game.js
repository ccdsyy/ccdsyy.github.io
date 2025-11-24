// --- 全局变量 ---
let camera, scene, renderer;
let world;
let playerBody;
const blocks = [];
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let isPointerLocked = false;
let controlMode = null;

const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
const grassMaterial = new THREE.MeshLambertMaterial({ color: 0x3a5f3a });
const stoneMaterial = new THREE.MeshLambertMaterial({ color: 0x999999 });
const groundMaterial = new CANNON.Material('ground');
const playerMaterial = new CANNON.Material();
playerMaterial.friction = 0.0;
playerMaterial.restitution = 0.0;

// --- 游戏启动流程 ---
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('keyboard-mouse-btn').addEventListener('click', () => {
        controlMode = 'keyboard';
        startGame();
    });
    document.getElementById('touchscreen-btn').addEventListener('click', () => {
        controlMode = 'touch';
        startGame();
    });
});

function startGame() {
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    if (controlMode === 'keyboard') {
        document.getElementById('crosshair').style.display = 'none';
        document.getElementById('action-buttons').style.display = 'none';
        document.getElementById('joystick-container').style.display = 'none';
        document.getElementById('jump-button').style.display = 'none';
    } else {
        document.getElementById('crosshair').style.display = 'flex';
        document.getElementById('action-buttons').style.display = 'flex';
        document.getElementById('joystick-container').style.display = 'flex';
        document.getElementById('jump-button').style.display = 'flex';
    }
    init();
}

// --- 方块操作函数 ---
function performBlockAction(action) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const intersects = raycaster.intersectObjects(blocks.map(b => b.mesh));
    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        const blockData = blocks.find(b => b.mesh === intersectedObject);
        
        if (action === 'dig' && blockData.mesh.userData.canBeRemoved) {
            removeBlock(blockData);
        } else if (action === 'place') {
            const face = intersects[0].face;
            const pos = intersectedObject.position;
            const placePos = pos.clone().add(face.normal);
            if (!playerBody.position.equals(placePos)) {
                addBlock(Math.round(placePos.x), Math.round(placePos.y), Math.round(placePos.z), stoneMaterial);
            }
        }
    }
}

// --- 初始化及设置函数 ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 0, 100);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-container').appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);
    world.broadphase = new CANNON.NaiveBroadphase();

    setupPlayer();
    generateTerrain();
    createWalls();
    setupControls();
    setupJoystick();
    createNPCs();
    animate();
}

function setupPlayer() {
    const playerShape = new CANNON.Box(new CANNON.Vec3(0.4, 0.9, 0.4));
    playerBody = new CANNON.Body({ mass: 10, material: playerMaterial });
    playerBody.addShape(playerShape);
    playerBody.position.set(0, 2, 0);
    world.add(playerBody);
}

function generateTerrain() {
    const worldSize = 20;
    for (let x = -worldSize; x <= worldSize; x++) {
        for (let z = -worldSize; z <= worldSize; z++) {
            addBlock(x, 0, z, grassMaterial, false);
        }
    }
}

function createWalls() {
    const wallMaterial = new CANNON.Material();
    const wallThickness = 1;
    const wallHeight = 10;
    const worldSize = 20;
    const shapes = [
        new CANNON.Box(new CANNON.Vec3(worldSize + wallThickness, wallHeight / 2, wallThickness / 2)),
        new CANNON.Box(new CANNON.Vec3(worldSize + wallThickness, wallHeight / 2, wallThickness / 2)),
        new CANNON.Box(new CANNON.Vec3(wallThickness / 2, wallHeight / 2, worldSize + wallThickness)),
        new CANNON.Box(new CANNON.Vec3(wallThickness / 2, wallHeight / 2, worldSize + wallThickness)),
    ];
    const positions = [
        new CANNON.Vec3(0, wallHeight / 2, worldSize + wallThickness / 2),
        new CANNON.Vec3(0, wallHeight / 2, -(worldSize + wallThickness / 2)),
        new CANNON.Vec3(worldSize + wallThickness / 2, wallHeight / 2, 0),
        new CANNON.Vec3(-(worldSize + wallThickness / 2), wallHeight / 2, 0),
    ];
    shapes.forEach((shape, index) => {
        const wall = new CANNON.Body({ mass: 0, material: wallMaterial });
        wall.addShape(shape);
        wall.position.copy(positions[index]);
        world.add(wall);
    });
}

function addBlock(x, y, z, material, canBeRemoved = true) {
    const block = new THREE.Mesh(blockGeometry, material);
    block.position.set(x, y, z);
    block.castShadow = true;
    block.receiveShadow = true;
    block.userData.canBeRemoved = canBeRemoved;
    scene.add(block);
    const blockShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
    const blockBody = new CANNON.Body({ mass: 0, material: groundMaterial });
    blockBody.addShape(blockShape);
    blockBody.position.set(x, y, z);
    world.add(blockBody);
    blocks.push({ mesh: block, body: blockBody });
}

function removeBlock(blockToRemove) {
    scene.remove(blockToRemove.mesh);
    world.removeBody(blockToRemove.body);
    const index = blocks.indexOf(blockToRemove);
    if (index > -1) {
        blocks.splice(index, 1);
    }
}

function setupControls() {
    const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    let touchStartX = 0, touchStartY = 0;

    if (controlMode === 'keyboard') {
        document.addEventListener('keydown', (event) => {
            switch (event.code) {
                case 'KeyW': moveForward = true; break;
                case 'KeyS': moveBackward = true; break;
                case 'KeyA': moveLeft = true; break;
                case 'KeyD': moveRight = true; break;
                case 'Space':
                    if (Math.abs(playerBody.velocity.y) < 0.1) {
                        playerBody.velocity.y = 8;
                    }
                    break;
            }
        });
        document.addEventListener('keyup', (event) => {
            switch (event.code) {
                case 'KeyW': moveForward = false; break;
                case 'KeyS': moveBackward = false; break;
                case 'KeyA': moveLeft = false; break;
                case 'KeyD': moveRight = false; break;
            }
        });
        renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
        document.addEventListener('pointerlockchange', () => { isPointerLocked = document.pointerLockElement === renderer.domElement; });
        document.addEventListener('mousemove', (event) => {
            if (!isPointerLocked) return;
            cameraEuler.y -= event.movementX * 0.002;
            cameraEuler.x -= event.movementY * 0.002;
            cameraEuler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraEuler.x));
            camera.quaternion.setFromEuler(cameraEuler);
        });
        document.addEventListener('mousedown', (event) => {
            if (!isPointerLocked) return;
            if (event.button === 0) performBlockAction('dig');
            if (event.button === 2) performBlockAction('place');
        });
        renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());

    } else if (controlMode === 'touch') {
        renderer.domElement.addEventListener('touchstart', (event) => {
            if (event.touches.length === 1) {
                touchStartX = event.touches[0].clientX;
                touchStartY = event.touches[0].clientY;
            }
        });
        renderer.domElement.addEventListener('touchmove', (event) => {
            if (event.touches.length === 1) {
                event.preventDefault();
                const deltaX = event.touches[0].clientX - touchStartX;
                const deltaY = event.touches[0].clientY - touchStartY;
                cameraEuler.y -= deltaX * 0.005;
                cameraEuler.x -= deltaY * 0.005;
                cameraEuler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraEuler.x));
                camera.quaternion.setFromEuler(cameraEuler);
                touchStartX = event.touches[0].clientX;
                touchStartY = event.touches[0].clientY;
            }
        });
        document.getElementById('jump-button').addEventListener('touchstart', (event) => { event.preventDefault(); if (Math.abs(playerBody.velocity.y) < 0.1) { playerBody.velocity.y = 8; } });
        document.getElementById('dig-btn').addEventListener('touchstart', (event) => { event.preventDefault(); performBlockAction('dig'); });
        document.getElementById('place-btn').addEventListener('touchstart', (event) => { event.preventDefault(); performBlockAction('place'); });
    }
}

function setupJoystick() {
    if (controlMode !== 'touch') return;
    const joystick = nipplejs.create({
        zone: document.getElementById('joystick-container'), mode: 'static', position: { left: '50%', top: '50%' }, color: 'rgba(255, 255, 255, 0.5)'
    });
    joystick.on('move', (evt, data) => {
        const forward = data.vector.y;
        const sideways = data.vector.x;
        moveForward = forward > 0.5;
        moveBackward = forward < -0.5;
        moveRight = sideways > 0.5;
        moveLeft = sideways < -0.5;
    });
    joystick.on('end', () => { moveForward = false; moveBackward = false; moveLeft = false; moveRight = false; });
}

function createNPCs() {
    const npcMaterial = new THREE.MeshLambertMaterial({ color: 0x0077ff });
    const npcShape = new CANNON.Box(new CANNON.Vec3(0.4, 0.9, 0.4));
    const npcBodyMaterial = new CANNON.Material();
    const npcPositions = [{ x: 5, z: 5 }, { x: -8, z: 3 }, { x: 10, z: -10 }];
    npcPositions.forEach(pos => {
        const npcMesh = new THREE.Mesh(blockGeometry, npcMaterial);
        npcMesh.position.set(pos.x, 1, pos.z);
        npcMesh.castShadow = true;
        scene.add(npcMesh);
        const npcBody = new CANNON.Body({ mass: 0, material: npcBodyMaterial });
        npcBody.addShape(npcShape);
        npcBody.position.set(pos.x, 1, pos.z);
        world.add(npcBody);
    });
}

function animate() {
    requestAnimationFrame(animate);
    const speed = 5;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const forwardVector = new THREE.Vector3(direction.x, 0, direction.z).normalize();
    const rightVector = new THREE.Vector3(forwardVector.z, 0, -forwardVector.x);
    const newVelX = (moveForward ? forwardVector.x * speed : 0) + (moveBackward ? -forwardVector.x * speed : 0) + (moveRight ? rightVector.x * speed : 0) + (moveLeft ? -rightVector.x * speed : 0);
    const newVelZ = (moveForward ? forwardVector.z * speed : 0) + (moveBackward ? -forwardVector.z * speed : 0) + (moveRight ? rightVector.z * speed : 0) + (moveLeft ? -rightVector.z * speed : 0);
    playerBody.velocity.x = newVelX;
    playerBody.velocity.z = newVelZ;
    world.step(1 / 60);
    camera.position.copy(playerBody.position);
    camera.position.y += 0.8;
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
