/**
 * Cube Hero Module for Dream Light Engine
 * Simple cube character for simulation mode
 *
 * Required global functions (from index.html):
 * - createDynamicBody(world, x, y, options)
 * - addBoxFixture(body, halfWidth, halfHeight, options)
 * - getVec2(x, y)
 * - Physics (global Box2D-WASM reference)
 */

(function(global) {
  'use strict';

  // Cube configuration
  const CUBE = {
    size: 0.5,           // Half-size of cube
    density: 2.0,
    friction: 0.8,
    restitution: 0.1,
    moveForce: 25,
    jumpImpulse: 12,
    rotateSpeed: 8,
    maxSpeed: 15
  };

  /**
   * Cube class - Simple hero cube
   */
  class Cube {
    constructor() {
      this.body = null;
      this.world = null;
      this.spawnX = 0;
      this.spawnY = 0;
      this.alive = true;
      this.grounded = false;
    }

    /**
     * Spawn cube at position
     */
    spawn(world, x, y) {
      this.world = world;
      this.spawnX = x;
      this.spawnY = y;
      this.alive = true;

      // Create body
      this.body = createDynamicBody(world, x, y, {
        angularDamping: 0.5,
        linearDamping: 0.1
      });

      // Add box fixture
      addBoxFixture(this.body, CUBE.size, CUBE.size, {
        density: CUBE.density,
        friction: CUBE.friction,
        restitution: CUBE.restitution
      });
    }

    /**
     * Update cube physics based on input
     */
    update(input) {
      if (!this.alive || !this.body) return;

      const vel = this.body.GetLinearVelocity();
      const vx = vel.get_x();

      // Move left/right
      if (input.left && !input.shift) {
        if (vx > -CUBE.maxSpeed) {
          const force = new Physics.b2Vec2(-CUBE.moveForce, 0);
          this.body.ApplyForceToCenter(force, true);
        }
      }
      if (input.right && !input.shift) {
        if (vx < CUBE.maxSpeed) {
          const force = new Physics.b2Vec2(CUBE.moveForce, 0);
          this.body.ApplyForceToCenter(force, true);
        }
      }

      // Rotate (with shift held)
      if (input.left && input.shift) {
        this.body.ApplyTorque(CUBE.rotateSpeed, true);
      }
      if (input.right && input.shift) {
        this.body.ApplyTorque(-CUBE.rotateSpeed, true);
      }

      // Jump
      if (input.up || input.space) {
        // Simple ground check - apply jump if mostly stationary vertically
        const vy = vel.get_y();
        if (Math.abs(vy) < 0.5) {
          const impulse = new Physics.b2Vec2(0, CUBE.jumpImpulse);
          this.body.ApplyLinearImpulseToCenter(impulse, true);
        }
      }
    }

    /**
     * Get cube position
     */
    getPosition() {
      if (!this.body) return { x: this.spawnX, y: this.spawnY };
      const pos = this.body.GetPosition();
      return { x: pos.get_x(), y: pos.get_y() };
    }

    /**
     * Get cube angle
     */
    getAngle() {
      if (!this.body) return 0;
      return this.body.GetAngle();
    }

    /**
     * Teleport cube to position
     */
    teleport(x, y) {
      if (!this.body) return;
      const pos = new Physics.b2Vec2(x, y);
      this.body.SetTransform(pos, this.body.GetAngle());
      this.body.SetLinearVelocity(new Physics.b2Vec2(0, 0));
      this.body.SetAngularVelocity(0);
    }

    /**
     * Destroy cube
     */
    destroy() {
      if (this.body && this.world) {
        try {
          this.world.DestroyBody(this.body);
        } catch (e) {}
      }
      this.body = null;
      this.alive = false;
    }

    /**
     * Get body for rendering
     */
    getBody() {
      return this.body;
    }
  }

  // Export
  global.Cube = Cube;
  global.CUBE_CONFIG = CUBE;

})(typeof window !== 'undefined' ? window : this);
