import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Clock,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Plane,
  Raycaster,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import ThreeMeshUI, { Block, Text } from 'three-mesh-ui';
import FontJSON from 'three-mesh-ui/examples/assets/Roboto-msdf.json';
import FontImage from 'three-mesh-ui/examples/assets/Roboto-msdf.png';

export class XRInterface extends Block {
  titlePanel;
  title;
  instructionsPanel;
  instructions;
  buttonPanel;
  backButton;
  nextButton;
  emphButton;
  interactive;
  xrPointer;

  constructor() {
    super({
      fontFamily: FontJSON,
      fontTexture: FontImage,
      backgroundOpacity: 0,
    });
    this.position.set(0, 1.2, -1.8);
    this.rotation.x = 0;
    this.interactive = true;
    this.isexplicit = false;
    this.createdplane = false;
    this.selectionPlaneWidth = 0.5;
    this.selectionPlaneHeight = 0.5;
    this.selectedPoint = new Vector3(0, 0, 0);
    // Pointer beam from controller
    this.xrPointer = new Group();
    this.xrPointer.beam = this.#xrPointer({});
    this.xrPointer.add(this.xrPointer.beam);
    this.xrPointer.dot = this.#xrPointerDot();
    this.xrPointer.add(this.xrPointer.dot);
    // this.xrPointer.selector = this.#xrSelector({});
    // this.xrPointer.add(this.xrPointer.selector);
    this.xrPointer.dotsel = this.#xrPointerDotSel();
    this.xrPointer.add(this.xrPointer.dotsel);
    this.xrPointer.raycaster = new Raycaster();

    // Header
    this.titlePanel = new Block({
      height: 0.15,
      width: 1.2,
      fontSize: 0.07,
      justifyContent: 'center',
    });
    this.title = new Text({
      content: 'Instructions',
    });
    this.titlePanel.add(this.title);
    this.add(this.titlePanel);

    // Progress bar
    this.progress = new Block({
      margin: 0.01,
      height: 0.02,
      width: 0.6,
      justifyContent: 'start',
      alignItems: 'start',
    });
    this.progressInner = new Block({
      height: 0.02,
      width: 0.001,
      backgroundColor: new Color('green'),
    });
    this.progress.add(this.progressInner);
    this.add(this.progress);

    // Instructions text
    this.instructionsPanel = new Block({
      padding: 0.04,
      // give the text more vertical space so it doesn't spill into the button row
      height: 0.8,
      width: 2.5,
      textAlign: 'left',
      // slightly smaller font to reduce overflow for long instructions
      fontSize: 0.045,
      // keep a small margin but don't waste vertical space
      margin: 0.03,
    });
    this.instructions = new Text({ content: '' });
    this.instructionsPanel.add(this.instructions);

    // Buttons
    this.buttonPanel0 = new Block({
      padding: 0.05,
      width: 0.5,
      height: 0.2,
      contentDirection: 'row',
    });
    this.buttonPanel = new Block({
      padding: 0.05,
      width: 1.2,
      height: 0.25,
      contentDirection: 'row',
    });
    this.buttonPanel2 = new Block({
      padding: 0.05,
      width: 2,
      height: 0.25,
      contentDirection: 'row',
    });
    this.emphButton = new XRButton({
      content:
        'ALERT, this is not just a break.\n Read instructions and press this button to continue',
      width: 1.75,
      isalert: true,
    });

    this.nextButton = new XRButton({
      content: 'Next',
      width: 0.7,
      isalert: false,
    });
    this.backButton = new XRButton({
      content: 'Back',
      width: 0.3,
      isalert: false,
    });
    this.readButton = new XRButton({
      content: 'Read Aloud',
      width: 0.4,
      isalert: false,
    });
    // Standard handlers (could these be provided in the XRButton constructors?)
    this.nextButton.states['selected'].onSet = function () {
      this.clickedNext = true;
      this.xrPointer.parent.userData.isSelecting = false;
    }.bind(this);
    this.backButton.states['selected'].onSet = function () {
      this.clickedBack = true;
      this.xrPointer.parent.userData.isSelecting = false;
    }.bind(this);
    this.readButton.states['selected'].onSet = function () {
      this.clickedRead = true;
      this.xrPointer.parent.userData.isSelecting = false;
    }.bind(this);
    this.emphButton.states['selected'].onSet = function () {
      this.clickedEmph = true;
      this.xrPointer.parent.userData.isSelecting = false;
    }.bind(this);
    this.backButton.setState('disabled');
    this.buttons = [
      this.readButton,
      this.backButton,
      this.nextButton,
      this.emphButton,
      this.titlePanel,
      this.progress,
      this.instructionsPanel,
      this.buttonPanel0,
      this.buttonPanel,
      this.buttonPanel2,
      // this,
    ];
    this.add(this.buttonPanel0);
    this.add(this.instructionsPanel);
    this.buttonPanel.add(this.backButton, this.nextButton);
    this.buttonPanel2.add(this.emphButton);
    this.buttonPanel0.add(this.readButton);

    this.add(this.buttonPanel);
    this.add(this.buttonPanel2);
  }

  /**
   * Edit the appearance of the UI menu in VR
   * @param {object} p
   * @param {string|boolean} p.title Title of the UI display; set false to hide instructions panel
   * @param {string|boolean} p.instructions Longer text describing what to do; set false to hide instructions panel
   * @param {boolean} p.interactive Set true to allow interaction with UI via XRPointer, false to disallow
   * @param {boolean} p.buttons Set false to hide buttons panel
   * @param {boolean} p.buttons2 Set false to hide buttons2 panel
   * @param {string} p.nextButtonState 'disabled', 'idle', 'hover', 'selected', or other; see `XRButton.setupState()`
   * @param {string} p.backButtonState see `nextButtonState`
   * @param {string} p.nextButtonText Text to display on the next button
   * @param {string} p.backButtonText Text to display on the back button
   * @param {string} p.emphButtonState 'disabled', 'idle', 'hover', 'selected', or other; see `XRButton.setupState()`
   * @param {string} p.emphButtonText Text to display on the next button
   *
   */
  edit({
    title,
    instructions,
    interactive,
    buttons,
    buttons2,
    backButtonState,
    nextButtonState,
    backButtonText,
    nextButtonText,
    emphButtonState,
    emphButtonText,
    readButtonState,
    readButtonText,
  }) {
    if (title) {
      this.titlePanel.visible = true;
      this.title.set({ content: title });
    } else if (title === false) {
      this.titlePanel.visible = false;
    }

    if (instructions) {
      this.instructionsPanel.visible = true;
      this.instructions.set({
        content: instructions,
      });
    } else if (instructions === false) {
      this.instructionsPanel.visible = false;
    }

    if (!(typeof interactive === 'undefined')) {
      this.setInteractive(interactive);
    }

    if (buttons === false) {
      this.titlePanel.visible = false;
      this.buttonPanel.visible = false;
      this.buttonPanel0.visible = false;
      this.buttonPanel2.visible = false;
      this.progress.visible = false;
      this.backButton.setState('disabled');
      this.nextButton.setState('disabled');
      this.readButton.setState('disabled');
      // this.backButton.visible = false;
      // this.nextButton.visible = false;
      // this.readButton.visible = false;
    } else {
      // this.backButton.visible = true;
      // this.nextButton.visible = true;
      // this.readButton.visible = true;
      if (backButtonState) {
        this.buttonPanel.visible = true;
        this.backButton.setState(backButtonState);
      }
      if (nextButtonState) {
        this.buttonPanel.visible = true;
        this.nextButton.setState(nextButtonState);
      }
      if (backButtonText) {
        this.buttonPanel.visible = true;
        this.backButton.text.set({ content: backButtonText });
      }
      if (nextButtonText) {
        this.buttonPanel.visible = true;
        this.nextButton.text.set({ content: nextButtonText });
      }
      if (readButtonState) {
        this.buttonPanel.visible = true;
        this.readButton.setState(readButtonState);
      }
      if (readButtonText) {
        this.buttonPanel.visible = true;
        this.readButton.text.set({ content: readButtonText });
      }
    }

    if (buttons2 === false) {
      this.buttonPanel2.visible = false;
      this.emphButton.setState('disabled');
    } else {
      if (emphButtonState) {
        this.buttonPanel2.visible = true;
        this.emphButton.setState(emphButtonState);
      }
      if (emphButtonText) {
        this.buttonPanel2.visible = true;
        this.emphButton.text.set({ content: emphButtonText });
      }
    }
  }

  updateProgressBar(numerator, denominator) {
    this.progressInner.width = (this.progress.width * numerator) / denominator;
  }

  updateUI() {
    this.updateButtons();
    ThreeMeshUI.update();
  }

  startExplicit() {
    this.isexplicit = true;
    this.selectionPlane.visible = true;
    // const selectionPlane = this.getObjectByName('selectionPlane');

    // if (selectionPlane) {
    //   selectionPlane.visible = true;
    // }
  }

  stopExplicit() {
    this.isexplicit = false;
    this.selectionPlane.visible = false;
    // const selectionPlane = this.getObjectByName('selectionPlane');

    // if (selectionPlane) {
    //   selectionPlane.visible = false;
    // }
  }

  /**
   * Create a countdown on the Next button.
   * UI is not interactive during the countdown.
   * Call at the transition into the relevant state (not in state.once) to ensure proper function.
   * @param {int} duration Seconds
   * @param {function} onCountdownComplete Callback function when countdown ends
   */
  countdown(duration = 30, onCountdownComplete = () => {}) {
    if (!this.countdownClock) {
      this.countdownClock = new Clock();
    }
    if (this.countdownClock.running) {
      this.countdownClock.stop();
    }
    if (!this.countdownClock.running) {
      this.setInteractive(false);
      this.countdownClock.start();
      (function count(UI) {
        let rem = duration - Math.round(UI.countdownClock.getElapsedTime());
        if (rem > 0) {
          setTimeout(count, 1000, UI);
          UI.nextButton.text.set({ content: `Listen to instructions!` });
          UI.emphButton.text.set({ content: `Read instructions! ${rem}` });
        } else {
          UI.nextButton.text.set({ content: 'Next' });
          UI.emphButton.text.set({
            content:
              'ALERT, this is not just a break.\n Read instructions and press this button to continue',
          });
          UI.countdownClock.stop();
          UI.setInteractive();
          onCountdownComplete();
        }
      })(this);
    } else {
      console.warn(
        'A UI countdown is already in progress. Setting another has no effect.'
      );
    }
  }

  setInteractive(interactive = true) {
    this.interactive = interactive;
    this.clickedNext = this.clickedBack = this.clickedEmph = false; // reset in case this was triggered by a button click
    this.xrPointer.visible = this.interactive;
  }

  createSelectionPlane(distance, color, opacity, length, height) {
    this.selectionPlaneWidth = length;
    this.selectionPlaneHeight = height;
    const planeGeometry = new PlaneGeometry(length, height); // Adjust size as needed
    const planeMaterial = new MeshBasicMaterial({
      color: color, // Example color, make transparent or adjust as needed
      side: DoubleSide,
      transparent: true,
      opacity: opacity, // Adjust for visibility
    });
    this.selectionPlane = new Mesh(planeGeometry, planeMaterial);

    // const local_pos = this.worldToLocal(new Vector3(0, 0, -1 * distance));
    // this.selectionPlane.position.set(local_pos.x, local_pos.y, local_pos.z);

    this.selectionPlane.position.set(0, 0, -1 * distance);
    // this.selectionPlane.position =  // Adjust position as needed
    // this.selectionPlane.rotation.x = -Math.PI / 2; // Rotate to face up if needed

    // Ensure the plane is interactive
    this.selectionPlane.userData.isInteractive = true;
    this.selectionPlane.visible = false;
    this.selectionPlane.name = 'selectionPlane';
    // this.add(this.selectionPlane); // Add the plane to the XRInterface

    const geometry = this.selectionPlane.geometry;
    const positionAttribute = geometry.attributes.position;

    // Get local coordinates of three coplanar points (corners of the plane)
    const pointA = new Vector3().fromBufferAttribute(positionAttribute, 0); // First corner
    const pointB = new Vector3().fromBufferAttribute(positionAttribute, 1); // Second corner
    const pointC = new Vector3().fromBufferAttribute(positionAttribute, 2); // Third corner

    // Transform these points to world space
    this.selectionPlane.localToWorld(pointA);
    this.selectionPlane.localToWorld(pointB);
    this.selectionPlane.localToWorld(pointC);

    // Now use these points to define the plane
    this.mathPlane = new Plane();
    this.mathPlane.setFromCoplanarPoints(pointA, pointB, pointC);
    this.createdplane = true;
    // const planeNormal = new Vector3(0, 0, 1); // Local normal pointing up for a horizontal plane
    // this.selectionPlane.updateMatrixWorld(); // Ensure the world matrix is up to date
    // planeNormal.applyQuaternion(this.selectionPlane.quaternion);
    // const worldPosition = new Vector3();
    // this.selectionPlane.getWorldPosition(worldPosition); // Get world position of the plane

    // this.mathPlane = new Plane();
    // this.mathPlane.setFromNormalAndCoplanarPoint(planeNormal, worldPosition);
    // this.mathPlane = new Plane();
    // this.mathPlane.setFromCoplanarPoints(
    //   new Vector3(0, 0, -1 * distance),
    //   new Vector3(0, 1, -1 * distance),
    //   new Vector3(1, 0, -1 * distance)
    // );
  }

  updatemathPlane() {
    const wp = new Vector3();
    this.selectionPlane.getWorldPosition(wp); // Get world position of the plane
    // Get local coordinates of three coplanar points (corners of the plane)
    const pointA = new Vector3(0 + wp.x, 0 + wp.y, 0 + wp.z);
    const pointB = new Vector3(1 + wp.x, 0 + wp.y, 0 + wp.z);
    const pointC = new Vector3(0 + wp.x, 1 + wp.y, 0 + wp.z);

    // const planeNormal = new Vector3(0, 0, 1); // Local normal pointing up for a horizontal plane
    // this.selectionPlane.updateMatrixWorld(); // Ensure the world matrix is up to date
    // planeNormal.applyQuaternion(this.selectionPlane.quaternion);
    // const worldPosition = new Vector3();

    // // this.mathPlane = new Plane();
    // // this.mathPlane.setFromNormalAndCoplanarPoint(planeNormal, worldPosition);

    // console.log('here4');
    // console.log(worldPosition);
    // console.log(planeNormal);
    // console.log(pointA);
    // console.log(pointB);
    // console.log(pointC);

    this.mathPlane.setFromCoplanarPoints(pointA, pointB, pointC);
  }

  updateselectionPlane(distance) {
    this.selectionPlane.position.set(0, 0, -1 * distance);
  }

  updateButtons() {
    let controllerRay = this.xrPointer.parent;
    if (!controllerRay || !this.interactive) {
      return;
    }
    // Reset any button clicks
    this.clickedNext = this.clickedBack = this.clickedEmph = false;
    // Find closest intersecting object
    let intersect;

    //if (renderer.xr.isPresenting) {
    this.#updateTargetRay(this.xrPointer.raycaster, controllerRay);
    intersect = this.#getClosestIntersection(
      this.buttons,
      this.xrPointer.raycaster
    );
    let intersect1;
    // intersect1 = this.xrPointer.raycaster.intersectObject(
    //   this.selectionPlane,
    //   true
    // )[0];
    // intersect1 = this.#getClosestIntersection(
    //   [this.selectionPlane],
    //   this.xrPointer.raycaster
    // );

    // if (Math.abs(this.selectedPoint.x) > this.selectionPlaneWidth) {
    //   console.log('here2');
    //   console.log(Math.abs(this.selectedPoint.x));
    //   intersect1 = false;
    // }
    // if (Math.abs(this.selectedPoint.y) > this.selectionPlaneHeight) {
    //   console.log('here3');
    //   console.log(Math.abs(this.selectedPoint.y));
    //   intersect1 = false;
    // }
    if (intersect && this.isexplicit == false) {
      //
      // Position the little white dot at the end of the controller pointing ray
      this.#updatePointerDot(
        this.xrPointer.dot,
        controllerRay,
        intersect.point
      );
    } else {
      this.xrPointer.dot.visible = false;
    }
    if (this.createdplane == true) {
      intersect1 = this.xrPointer.raycaster.ray.intersectPlane(
        this.mathPlane,
        this.selectedPoint
      );
      if (intersect1 && this.isexplicit) {
        this.#updatePointerDot(
          this.xrPointer.dotsel,
          controllerRay,
          this.selectedPoint
        );

        // if (controllerRay.userData.isSelecting) {
        //   this.stopExplicit();
        // }
      } else {
        this.xrPointer.dotsel.visible = false;
      }
    }
    //}
    // Update targeted button state (if any)
    // setState internally calls component.set with the options you defined in component.setupState
    if (
      intersect &&
      intersect.object.isUI &&
      intersect.object.currentState !== 'disabled'
    ) {
      if (
        controllerRay.userData.isSelecting &&
        'selected' in intersect.object.states
      ) {
        intersect.object.setState('selected');
      } else if ('hovered' in intersect.object.states) {
        intersect.object.setState('hovered');
      }
    }
    // Update non-targeted buttons state
    this.buttons.forEach((obj) => {
      if (
        (!intersect || obj !== intersect.object) &&
        obj.isUI &&
        obj.currentState !== 'disabled' &&
        'idle' in obj.states
      ) {
        obj.setState('idle');
      }
    });
  }

  #updateTargetRay(raycaster, controller) {
    if (raycaster.dummyMatrix === undefined) {
      raycaster.dummyMatrix = new Matrix4();
    }
    raycaster.dummyMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(raycaster.dummyMatrix);
  }

  #updatePointerDot(dot, controllerRay, location) {
    const loc1 = new Vector3();
    loc1.copy(location);
    // console.log('here3');
    // console.log(location);
    const localVec = controllerRay.worldToLocal(loc1);
    dot.position.copy(localVec);
    dot.position.copy(loc1);
    dot.visible = true;
  }

  #getClosestIntersection(objsToTest, raycaster) {
    return objsToTest.reduce((closestIntersection, obj) => {
      const intersection = raycaster.intersectObject(obj, true);

      if (!intersection[0]) return closestIntersection;

      if (
        !closestIntersection ||
        intersection[0].distance < closestIntersection.distance
      ) {
        intersection[0].object = obj;

        return intersection[0];
      }

      return closestIntersection;
    }, null);
  }

  // XR POINTER MESH STUFF

  #xrPointerSimple({ length = 0.5 }) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0, 0, 0, -length], 3)
    );
    geometry.setAttribute(
      'color',
      new Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3)
    );
    const material = new LineBasicMaterial({
      vertexColors: true,
      blending: AdditiveBlending,
    });
    return new Line(geometry, material);
  }

  #xrPointer({ gradientSteps = 64 }) {
    // https://github.com/felixmariotto/three-mesh-ui/blob/master/examples/utils/VRControl.js
    const material = new MeshBasicMaterial({
      color: 0x00ff00,
      alphaMap: new CanvasTexture(
        generateRayTexture({ gradientSteps: gradientSteps })
      ),
      transparent: true,
    });
    const geometry = new BoxGeometry(0.004, 0.004, 0.35);
    geometry.translate(0, 0, -0.15);

    const uvAttribute = geometry.attributes.uv;
    for (let i = 0; i < uvAttribute.count; i++) {
      let u = uvAttribute.getX(i);
      let v = uvAttribute.getY(i);
      [u, v] = (() => {
        switch (i) {
          case 0:
            return [1, 1];
          case 1:
            return [0, 0];
          case 2:
            return [1, 1];
          case 3:
            return [0, 0];
          case 4:
            return [0, 0];
          case 5:
            return [1, 1];
          case 6:
            return [0, 0];
          case 7:
            return [1, 1];
          case 8:
            return [0, 0];
          case 9:
            return [0, 0];
          case 10:
            return [1, 1];
          case 11:
            return [1, 1];
          case 12:
            return [1, 1];
          case 13:
            return [1, 1];
          case 14:
            return [0, 0];
          case 15:
            return [0, 0];
          default:
            return [0, 0];
        }
      })();
      uvAttribute.setXY(i, u, v);
    }

    const linesHelper = new Mesh(geometry, material);
    linesHelper.renderOrder = Infinity;
    return linesHelper;

    function generateRayTexture({ gradientSteps = 64 }) {
      const canvas = document.createElement('canvas');
      canvas.width = gradientSteps;
      canvas.height = gradientSteps;

      const ctx = canvas.getContext('2d');

      const gradient = ctx.createLinearGradient(0, 0, gradientSteps, 0);
      gradient.addColorStop(0, 'black');
      gradient.addColorStop(1, 'white');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, gradientSteps, gradientSteps);

      return canvas;
    }
  }

  #xrPointerDot() {
    const spriteMaterial = new SpriteMaterial({
      map: new CanvasTexture(generatePointerTexture()),
      sizeAttenuation: false,
      depthTest: false,
    });

    const pointer = new Sprite(spriteMaterial);

    pointer.scale.set(0.015, 0.015, 1);
    pointer.renderOrder = Infinity;
    return pointer;

    function generatePointerTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;

      const ctx = canvas.getContext('2d');

      ctx.beginPath();
      ctx.arc(32, 32, 29, 0, 2 * Math.PI);
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = 'white';
      ctx.fill();

      return canvas;
    }
  }

  // #xrSelector({ gradientSteps = 64 }) {
  //   // https://github.com/felixmariotto/three-mesh-ui/blob/master/examples/utils/VRControl.js
  //   const material = new MeshBasicMaterial({
  //     color: 0xff0000,
  //     alphaMap: new CanvasTexture(
  //       generateRayTexture({ gradientSteps: gradientSteps })
  //     ),
  //     transparent: true,
  //   });
  //   const geometry = new BoxGeometry(0.004, 0.004, 0.35);
  //   geometry.translate(0, 0, -0.15);

  //   const uvAttribute = geometry.attributes.uv;
  //   for (let i = 0; i < uvAttribute.count; i++) {
  //     let u = uvAttribute.getX(i);
  //     let v = uvAttribute.getY(i);
  //     [u, v] = (() => {
  //       switch (i) {
  //         case 0:
  //           return [1, 1];
  //         case 1:
  //           return [0, 0];
  //         case 2:
  //           return [1, 1];
  //         case 3:
  //           return [0, 0];
  //         case 4:
  //           return [0, 0];
  //         case 5:
  //           return [1, 1];
  //         case 6:
  //           return [0, 0];
  //         case 7:
  //           return [1, 1];
  //         case 8:
  //           return [0, 0];
  //         case 9:
  //           return [0, 0];
  //         case 10:
  //           return [1, 1];
  //         case 11:
  //           return [1, 1];
  //         case 12:
  //           return [1, 1];
  //         case 13:
  //           return [1, 1];
  //         case 14:
  //           return [0, 0];
  //         case 15:
  //           return [0, 0];
  //         default:
  //           return [0, 0];
  //       }
  //     })();
  //     uvAttribute.setXY(i, u, v);
  //   }

  //   const linesHelper = new Mesh(geometry, material);
  //   linesHelper.renderOrder = Infinity;
  //   return linesHelper;

  //   function generateRayTexture({ gradientSteps = 64 }) {
  //     const canvas = document.createElement('canvas');
  //     canvas.width = gradientSteps;
  //     canvas.height = gradientSteps;

  //     const ctx = canvas.getContext('2d');

  //     const gradient = ctx.createLinearGradient(0, 0, gradientSteps, 0);
  //     gradient.addColorStop(0, 'black');
  //     gradient.addColorStop(1, 'white');

  //     ctx.fillStyle = gradient;
  //     ctx.fillRect(0, 0, gradientSteps, gradientSteps);

  //     return canvas;
  //   }
  // }
  #xrPointerDotSel() {
    const spriteMaterial = new SpriteMaterial({
      map: new CanvasTexture(this.generatePointerTexture()),
      sizeAttenuation: false,
      depthTest: false,
    });

    const pointer = new Sprite(spriteMaterial);

    pointer.scale.set(0.015, 0.015, 1);
    pointer.renderOrder = Infinity;
    return pointer;
  }
  updateDotSelColor(newColor) {
    // Generate a new texture with the specified color
    const newTexture = new CanvasTexture(this.generatePointerTexture(newColor));
    // Update the sprite material's map with the new texture
    this.xrPointer.dotsel.material.map = newTexture;
    // Important: Dispose of the old texture if necessary and update the material
    this.xrPointer.dotsel.material.map.needsUpdate = true;
  }
  generatePointerTexture(color = 'red') {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;

    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(32, 32, 29, 0, 2 * Math.PI);
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = color; // Use the color parameter
    ctx.fill();

    return canvas;
  }
}
// https://github.com/felixmariotto/three-mesh-ui/blob/master/examples/interactive_button.js
// TODO: extends ThreeMeshUI.Block
/**
 * The XRButton class provides interactive buttons that change appearance based on predefined states.
 * States are `disabled`, `idle`, `selected`, or `hovered`.
 * The `selected` state is a special state that invokes the `onSelected` callback function provided in the constructor.
 */
export class XRButton extends Block {
  constructor({
    content = null,
    onSelected = () => {},
    width = 0.4,
    height = 0.15,
    justifyContent = 'center',
    offset = 0.05,
    margin = 0.02,
    borderRadius = 0.075,
    isalert = false,
  }) {
    // Generic parameters for both buttons
    const buttonOptions = {
      width: width,
      height: height,
      justifyContent: justifyContent,
      offset: offset,
      margin: margin,
      borderRadius: borderRadius,
      isalert: isalert,
    };
    super(buttonOptions);

    this.isButton = true;

    // Add text to buttons
    this.text = new Text({ content: content });
    this.add(this.text);

    // Options for component.setupState().
    // It must contain a 'state' parameter, which you will refer to with component.setState( 'name-of-state' ).
    let disabledStateAttributes = {};
    let hoveredStateAttributes = {};
    let idleStateAttributes = {};
    let selectedAttributes = {};
    if (isalert == false) {
      disabledStateAttributes = {
        state: 'disabled',
        attributes: {
          offset: 0.02,
          backgroundColor: new Color(0x999999),
          backgroundOpacity: 0.1,
          fontColor: new Color(0x555555),
        },
      };
      hoveredStateAttributes = {
        state: 'hovered',
        attributes: {
          offset: 0.035,
          backgroundColor: new Color(0x999999),
          backgroundOpacity: 1,
          fontColor: new Color(0xffffff),
        },
      };
      idleStateAttributes = {
        state: 'idle',
        attributes: {
          offset: 0.035,
          backgroundColor: new Color(0x666666),
          backgroundOpacity: 0.3,
          fontColor: new Color(0xffffff),
        },
      };
      selectedAttributes = {
        offset: 0.02,
        backgroundColor: new Color(0x777777),
        fontColor: new Color(0x222222),
      };
    } else {
      disabledStateAttributes = {
        state: 'disabled',
        attributes: {
          offset: 0.02,
          backgroundColor: new Color(0x990000),
          backgroundOpacity: 0.1,
          fontColor: new Color(0x555555),
        },
      };
      hoveredStateAttributes = {
        state: 'hovered',
        attributes: {
          offset: 0.035,
          backgroundColor: new Color(0x990000),
          backgroundOpacity: 1,
          fontColor: new Color(0xffffff),
        },
      };
      idleStateAttributes = {
        state: 'idle',
        attributes: {
          offset: 0.035,
          backgroundColor: new Color(0x660000),
          backgroundOpacity: 0.3,
          fontColor: new Color(0xffffff),
        },
      };
      selectedAttributes = {
        offset: 0.02,
        backgroundColor: new Color(0x770000),
        fontColor: new Color(0x222222),
      };
    }
    // setup states (adds them to a list this.states)
    this.setupState({
      state: 'selected',
      attributes: selectedAttributes,
      onSet: onSelected,
    });
    this.setupState(hoveredStateAttributes);
    this.setupState(idleStateAttributes);
    this.setupState(disabledStateAttributes);
  }
}

/**
 * The XRVisor class provides a three-mesh-ui interface for display gaze-locked "visor" text at a distance of 45 cm.
 */
export class XRVisor extends ThreeMeshUI.Block {
  constructor(distance = 0.45) {
    super({
      width: 0.01,
      height: 0.01,
      backgroundOpacity: 0,
      fontFamily: FontJSON,
      fontTexture: FontImage,
      fontSize: 0.07,
    });
    this.position.set(0, 0, distance);
    this.text = new ThreeMeshUI.Text({
      content: '',
    });
    this.add(this.text);
  }
}
