import * as THREE from '../node_modules/three/build/three.module.js';
import Stats from '../node_modules/three/examples/jsm/libs/stats.module.js';
import { GUI } from '../node_modules/three/examples/jsm/libs/dat.gui.module.js';

/** The fundamental set up and animation structures for 3D Visualization */
export default class World {

    constructor() {
        this._setupWorld();

        // gui 
        //this.gui = new GUI();
        this.params = { FoV: 60, DepthScalar: 0.2 };
        //this.gui.add(this.params, 'FoV').min(30).max(100).name('Webcam FoV');
        //this.gui.add(this.params, 'DepthScalar').min(0.05).max(0.5).name('DepthScalar');

        // instanced spheres
        this.sphereGeometry = new THREE.SphereGeometry(1.0, 12, 12);
        this.solidMat = new THREE.MeshStandardMaterial();
        this.landmarks = new THREE.InstancedMesh(this.sphereGeometry, this.solidMat, 468);
        this.landmarks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); // will be updated every frame
        this.landmarks.setColorAt( 0, this.color.setHex( 0xffffff * Math.random() ) );
        this.landmarks.instanceColor.setUsage( THREE.DynamicDrawUsage ); // will be updated every frame
        this.landmarks.receiveShadow = true;
        this.landmarks.castShadow = true;
        this.scene.add(this.landmarks);

        this.videoElement = document.getElementsByClassName('input_video')[0];

        this.rPanel = this.stats.addPanel(new Stats.Panel('Face Hue', '#ff8', '#221'));
        this.rPanel.dom.style.cssText = 'width:320px;height:192px';
        this.stats.showPanel(3);
        
        this.avgR = 200.0;
        this.hsv = {};
        this.filtered = 0.0;

        // Construct the Face Tracking Pipeline
        this.setupFaceTracking();

    }

    async setupFaceTracking() {
        this.faceMesh = new FaceMesh({locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.1/${file}`; //../node_modules/@mediapipe/face_mesh/
        }});
        this.faceMesh.onResults(this.onResults.bind(this));
        
        // Instantiate a camera. We'll feed each frame we receive into the solution.
        this.webcamera = new Camera(this.videoElement, {
          onFrame: async () => {
            await this.faceMesh.send({ image: this.videoElement });
          }, width: 1280, height: 720
        });
        this.webcamera.start();

        this.webcamera.camera = new THREE.PerspectiveCamera( 60, this.webcamera.g.width / this.webcamera.g.height, 0.1, 1 );
        this.webcamera.camera.position.set(0.0, 0.1, 0.2);
        this.scene.add(this.webcamera.camera);
        this.webcamera.camera.getWorldPosition();
        this.webcamera.camera.updateProjectionMatrix();
        //this.helper = new THREE.CameraHelper( this.webcamera.camera );
        //this.scene.add( this.helper );

        this.receivedFirstFrame = false;

        // Just do this once to initialize camera
        this.renderer.render(this.scene, this.webcamera.camera);
    }

    onResults(results) {
        if (!results.multiFaceLandmarks) { return; }
        this.getAverageRGB(results);

        this.webcamera.camera.fov = this.params.FoV;
        this.webcamera.camera.updateProjectionMatrix();
        this.webcamera.camera.near = 0.1;
        //this.helper.update();

        // Find the Average
        this.vec2.set(0, 0, 0);
        let pos = results.multiFaceLandmarks[0];
        for (let i = 0; i < pos.length; i++){
            this.transformPoint(pos[i], this.vec);
            this.vec2.add(this.vec);
        }
        this.vec2.divideScalar(pos.length);

        // Find the Sum Distance from the Average (Scale)
        let scale = 0;
        for (let i = 0; i < pos.length; i++){
            this.transformPoint(pos[i], this.vec);
            scale += this.vec3.copy(this.vec2).sub(this.vec).length();
        }

        // Divide position by scale to get 3D position
        for (let i = 0; i < pos.length; i++){
            this.transformPoint(pos[i], this.vec);
            this.vec.sub(this.webcamera.camera.position).multiplyScalar(5.0/scale).add(this.webcamera.camera.position);
            this.landmarks.setMatrixAt(i, this.mat.compose(this.vec, this.quat, this.vec6.set(0.0005, 0.0005, 0.0005)));
            this.landmarks.setColorAt(i, this.color.setRGB(1.0, 1.0 - (this.filtered / ( this.range * 2.0 )), 0.0));
        }

        this.landmarks.count = pos.length;
        this.landmarks.instanceMatrix.needsUpdate = true;
        this.landmarks.instanceColor.needsUpdate = true;

        //this.webcamera.camera.near = 0.001;
        this.webcamera.camera.updateProjectionMatrix();
    }

    /** Transform from camera UV space (?) to sort of local 3D space? */
    transformPoint(point, vectorToFill) {
        vectorToFill.set((point.x * 2.0) - 1.0, (point.y * -2.0) + 1.0, -1.0).unproject(this.webcamera.camera);
        //vectorToFill.z -= (point.z * this.params.DepthScalar); // Depth is incorrect... ah well.
    }

    /** Update the camera and render the scene */
    update() {
        // Render the scene
        if (this.webcamera) {
            this.renderer.render(this.scene, this.camera);//this.webcamera.camera);//
        }

        this.stats.update();
    }

    /** **INTERNAL**: Set up a basic world */
    _setupWorld() {
        // Record browser metadata for power saving features...
        this.safari = /(Safari)/g.test( navigator.userAgent ) && ! /(Chrome)/g.test( navigator.userAgent );
        this.mobile = /(Android|iPad|iPhone|iPod|Oculus)/g.test(navigator.userAgent) || this.safari;

        // app container div
        this.container = document.getElementById('appbody');
        document.body.appendChild(this.container);
        
        // camera and world
        this.scene = new THREE.Scene();

        this.cameraWorldPosition = new THREE.Vector3(1,1,1);
        this.cameraWorldScale    = new THREE.Vector3(1,1,1);
        this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.0001, 1000 );
        this.camera.position.set( 0.0, 0.1, 0.2 );
        this.camera.layers.enableAll();
        this.cameraParent = new THREE.Group();
        this.cameraParent.add(this.camera);
        this.scene.add(this.cameraParent);
        this.camera.getWorldPosition(this.cameraWorldPosition);

        // light
        this.light = new THREE.HemisphereLight( 0xffffff, 0x444444, 0.5 );
        this.light.position.set( 0, 0.2, 0 );
        this.scene.add( this.light );
        this.lightParent = new THREE.Group();
        this.lightTarget = new THREE.Group();
        this.lightParent.frustumCulled = false;
        this.lightParent.add(this.lightTarget);
        this.light = new THREE.DirectionalLight( 0xffffff );
        this.light.position.set( 0, 20, 10);
        this.light.castShadow = !this.mobile;
        this.light.frustumCulled = false;
        this.light.shadow.frustumCulled = false;
        this.light.shadow.camera.frustumCulled = false;
        this.light.shadow.camera.top    =   1;
        this.light.shadow.camera.bottom = - 1;
        this.light.shadow.camera.left   = - 1;
        this.light.shadow.camera.right  =   1;
        //this.light.shadow.autoUpdate = false;
        this.light.target = this.lightTarget;
        this.lightParent.add(this.light);
        this.scene.add( this.lightParent );
        //this.scene.add( new THREE.CameraHelper( this.light.shadow.camera ) );

        // renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);
        this.renderer.setAnimationLoop(this.update.bind(this));
        //this.renderer.setClearColor( 0x000000, 0 ); // the default
        window.addEventListener('resize', this._onWindowResize.bind(this), false);
        window.addEventListener('orientationchange', this._onWindowResize.bind(this), false);
        this._onWindowResize();

        // raycaster
        this.raycaster = new THREE.Raycaster();
        this.raycaster.layers.set(0);

        // stats
        this.stats = new Stats();
        this.stats.dom.style.transform = "scale(0.7);";
        this.container.appendChild(this.stats.dom);

        // Temp variables to reduce allocations
        this.mat  = new THREE.Matrix4();
        this.vec = new THREE.Vector3();
        this.vec2 = new THREE.Vector3();
        this.vec3 = new THREE.Vector3();
        this.vec4 = new THREE.Vector3();
        this.vec5 = new THREE.Vector3();
        this.vec6 = new THREE.Vector3();
        this.zVec = new THREE.Vector3(0, 0, 1);
        this.quat = new THREE.Quaternion().identity();
        this.color = new THREE.Color();
    }

    /** **INTERNAL**: This function recalculates the viewport based on the new window size. */
    _onWindowResize() {
        let videoRect = document.getElementsByClassName('input_video')[0].getBoundingClientRect();

        let width = videoRect.width, height = videoRect.height;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        if (this.webcamera) {
            this.webcamera.camera.aspect = width / height;
            this.webcamera.camera.updateProjectionMatrix();
        }
        this.renderer.setSize(width, height);
    }

    getAverageRGB(results) {
        if (!results.multiFaceLandmarks) { return; }
        if (!this.receivedFirstFrame) { this._onWindowResize(); this.receivedFirstFrame = true; }
        let pos = results.multiFaceLandmarks[0];

        // Get Bounding Box of Face

        let boundingBox = new THREE.Box2();
        let point = new THREE.Vector2();
        for (let i = 0; i < pos.length; i++){
            point.set(pos[i].x * this.webcamera.g.width, pos[i].y * this.webcamera.g.height);
            if (i == 0) {
                boundingBox.setFromPoints([point]);
            } else {
                boundingBox.expandByPoint(point);
            }
        }

        let imgEl = this.videoElement;
        
        var blockSize = 5, // only visit every 5 pixels
            defaultRGB = {r:0,g:0,b:0}, // for non-supporting envs
            data,
            i = -4,
            length,
            rgb = {r:0,g:0,b:0},
            count = 0;

        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.context = this.canvas.getContext && this.canvas.getContext('2d');
        }
        if (!this.context) { return defaultRGB;}

        this.canvas.height = imgEl.naturalHeight || imgEl.offsetHeight || imgEl.height;
        this.canvas.width = imgEl.naturalWidth || imgEl.offsetWidth || imgEl.width;

        // Get the image data from the video element
        this.context.drawImage(imgEl, 0, 0);
        try {
            data = this.context.getImageData(boundingBox.min.x, boundingBox.min.y,
                boundingBox.max.x - boundingBox.min.x, boundingBox.max.y - boundingBox.min.y);
        } catch(e) {
            /* security error, img on diff domain */
            return defaultRGB;
        }

        // Take the Average
        length = data.data.length;
        while ( (i += blockSize * 4) < length ) {
            ++count;
            rgb.r += data.data[i];
            rgb.g += data.data[i+1];
            rgb.b += data.data[i+2];
        }
        rgb.r = rgb.r / count;
        rgb.g = rgb.g / count;
        rgb.b = rgb.b / count;
    
        // Divide the Red by the Green Channel and Filter/Scale the crap out of it
        let rawVal = rgb.r / rgb.g;
        this.range = 0.001;
        this.avgR += (rawVal - this.avgR) * 0.002;       // 0.2% Lerp to center it
        if (this.avgR > rawVal + this.range) { this.avgR = rawVal + this.range; } // Bound the center
        if (this.avgR < rawVal - this.range) { this.avgR = rawVal - this.range; } // Bound the center
        let curVal = rawVal - this.avgR + this.range;    // Center the raw data about 0.001
        this.filtered += (curVal - this.filtered) * 0.2; // 20% lerp to smooth out noise
        this.rPanel.update(this.filtered * 10000.0, this.range * 20000.0); // Display
    }

}

new World();