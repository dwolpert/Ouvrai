import {
  Mesh,
  Quaternion,
  Raycaster,
  Vector3,
  MeshBasicMaterial,
  BoxGeometry,
} from 'three';

export class Collider extends Mesh {
  // Warning: don't use public instance fields for (geometry, material)
  // because they are defined *after* super() returns
  constructor(
    geometry = new BoxGeometry(1, 1, 1),
    material = new MeshBasicMaterial({ wireframe: true, color: 'green' })
  ) {
    super(geometry, material);
    this._v = new Vector3();
    this._q = new Quaternion();
    this._rc = new Raycaster();
    this.name = 'collider';
    this.visible = false;

    this.addEventListener('added', () => {
      this.geometry = this.geometry || this.parent.geometry;
      if (this.parent.collider && this.parent.collider.isObject3D) {
        this.parent.remove(this.parent.collider);
        console.warn('You are overwriting an existing collider object...');
      }
      this.parent.collider = this;
    });
  }

  test(object) {
    if (!this.parent) {
      console.warn('Collider has no parent object.');
      return;
    }
    // collision detection
    for (let vi = 0; vi < this.geometry.attributes.position.count; vi++) {
      this._v.fromBufferAttribute(this.geometry.attributes.position, vi); // get vertex position on collider
      this._v.applyMatrix4(this.parent.matrix); // apply collider's local transform
      this._v.sub(this.parent.position); // remove position component of local transform -> direction vector
      this.parent.getWorldQuaternion(this._q); // get world space rotation of collider
      this._v.applyQuaternion(this._q); // rotate direction vector so it is in world space
      this.parent.getWorldPosition(this._rc.ray.origin); // set origin of raycaster
      this._rc.ray.direction = this._v.clone().normalize(); // set direction of raycaster
      let results = this._rc.intersectObject(object, false); // check for intersection
      // collision occurred if there is an intersection that is closer than the vertex
      if (results.length > 0 && results[0].distance < this._v.length()) {
        return true;
      }
    }
    return false;
  }

  test_dir(object, collisionDirection) {
    if (!this.parent) {
      console.warn('Collider has no parent object.');
      return;
    }

    // if (!(collisionDirection instanceof Vector3)) {
    //   console.error(
    //     'Invalid collisionDirection. Please provide a THREE.Vector3.'
    //   );
    //   return;
    // }

    // collision detection
    for (let vi = 0; vi < this.geometry.attributes.position.count; vi++) {
      this._v.fromBufferAttribute(this.geometry.attributes.position, vi); // get vertex position on collider

      // Transform the vertex position to world space
      this._v.applyMatrix4(this.parent.matrix);

      // Remove the position component of the local transform -> direction vector
      this._v.sub(this.parent.position);

      // Get world space rotation of collider
      this.parent.getWorldQuaternion(this._q);

      // Rotate the direction vector so it is in world space
      this._v.applyQuaternion(this._q);

      // Set up the ray with the specified collision direction
      this.parent.getWorldPosition(this._rc.ray.origin); // set origin of raycaster

      this._rc.ray.direction.copy(collisionDirection).normalize(); // set direction of raycaster
      //
      // this._rc.ray.direction = this._v.clone().normalize(); // set direction of raycaster

      // Check for intersection
      let results = this._rc.intersectObject(object, false);

      // Collision occurred if there is an intersection and the distance is <= 0
      if (results.length > 0 && results[0].distance < this._v.length()) {
        // if (results.length > 0 && results[0].distance <= 0) {
        return true;
      }
    }

    // No collision detected along the specified axis
    return false;
  }
}
