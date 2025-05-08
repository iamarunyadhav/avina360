let scene, camera, renderer, mesh;

init();

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.z = 2;

  const params = new URLSearchParams(window.location.search);
  const imgUrl = params.get('img');
  const axis = params.get('axis') || 'x';
  const bg = params.get('bg') || 'black';
  const duration = parseInt(params.get('duration')) || 5;

  const frames = duration * 30; // e.g., 5 sec * 30fps
  window.rotationAxis = axis;
  window.totalFrames = frames;

  // ✅ Configure renderer with/without transparency
  renderer = new THREE.WebGLRenderer({
    preserveDrawingBuffer: true,
    alpha: bg === 'transparent'
  });

  renderer.setSize(800, 800);
  if (bg === 'black') {
    renderer.setClearColor(0x000000); // solid black background
  }

  document.body.appendChild(renderer.domElement);

  new THREE.TextureLoader().load(
    imgUrl,
    (texture) => {
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      });

      const geometry = new THREE.PlaneGeometry(1, 1);
      mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      document.getElementById('renderReady').innerText = 'ready';
    },
    undefined,
    (err) => {
      console.error('❌ Texture load failed:', err);
    }
  );
}

window.rotateFrame = (frame) => {
  if (!mesh) return;
  const angle = frame * (Math.PI * 2 / window.totalFrames);

  mesh.rotation.x = window.rotationAxis === 'x' ? angle : 0;
  mesh.rotation.y = window.rotationAxis === 'y' ? angle : 0;
  mesh.rotation.z = window.rotationAxis === 'z' ? angle : 0;

  renderer.render(scene, camera);
};
