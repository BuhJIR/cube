/**
 * Cube Hero Module for Dream Light Engine
 * Box2D-WASM 7.0.0 (Emscripten) compatible implementation
 *
 * Requires: Box2D-WASM via window.ModulePhysics (containing b2Vec2, b2BodyDef, etc.)
 */

(function(global) {
  'use strict';

  // Get b2 module reference (deferred, called when needed)
  function getB2() {
    return global.ModulePhysics || global;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BOX2D WORLD HELPER METHODS (Emscripten WASM API)
  // ═══════════════════════════════════════════════════════════════════════

  function extendWorld(worldInstance) {
    // Skip if already extended
    if (worldInstance._cubeExtended) return;
    worldInstance._cubeExtended = true;

    /**
     * Add a body with fixture to the world
     */
    worldInstance.add = function(obj) {
      var b2 = getB2();
      obj = obj || {};

      // Create BodyDef using WASM set_* API
      var bd = new b2.b2BodyDef();
      var type = obj.type || 'dynamic';

      switch (type) {
        case 'dynamic': bd.set_type(b2.b2_dynamicBody); break;
        case 'static': bd.set_type(b2.b2_staticBody); break;
        case 'kinematic': bd.set_type(b2.b2_kinematicBody || 1); break;
        default: bd.set_type(b2.b2_dynamicBody);
      }

      var pos = new b2.b2Vec2(obj.x || 0, obj.y || 0);
      bd.set_position(pos);
      bd.set_angle(obj.angle || 0);
      bd.set_allowSleep(obj.allowSleep !== undefined ? obj.allowSleep : true);
      bd.set_awake(obj.awake !== undefined ? obj.awake : true);
      bd.set_bullet(obj.bullet || false);
      bd.set_fixedRotation(obj.fixedRotation || false);

      if (obj.angularDamping !== undefined) bd.set_angularDamping(obj.angularDamping);
      if (obj.linearDamping !== undefined) bd.set_linearDamping(obj.linearDamping);

      // Create body
      var body = this.CreateBody(bd);

      // Create fixture
      var fd = new b2.b2FixtureDef();
      fd.set_density(obj.density || 0);
      fd.set_friction(obj.friction || 0.2);
      fd.set_restitution(obj.restitution || 0.1);
      fd.set_isSensor(obj.isSensor || false);

      if (obj.groupIndex !== undefined) {
        var filter = fd.get_filter();
        filter.set_groupIndex(obj.groupIndex);
        fd.set_filter(filter);
      }

      // Create shape
      var shape = this.createShapeCube(obj);
      fd.set_shape(shape);

      body.CreateFixture(fd);

      // Cleanup WASM memory
      if (b2.destroy) {
        b2.destroy(pos);
        b2.destroy(shape);
      }

      return body;
    };

    /**
     * Create shape for cube
     */
    worldInstance.createShapeCube = function(obj) {
      var b2 = getB2();
      var shapeName = obj.shape || 'box';
      var shape;

      switch (shapeName) {
        case 'polygon':
          shape = new b2.b2PolygonShape();
          var len = obj.vertices.length;
          var dx = obj.mx || 0;
          var dy = obj.my || 0;
          var vecs = [];
          for (var i = 0; i < len; i += 2) {
            vecs.push(new b2.b2Vec2(obj.vertices[i] + dx, obj.vertices[i + 1] + dy));
          }
          shape.Set(vecs, vecs.length);
          // Cleanup
          if (b2.destroy) {
            for (var j = 0; j < vecs.length; j++) {
              b2.destroy(vecs[j]);
            }
          }
          break;

        case 'box':
          shape = new b2.b2PolygonShape();
          shape.SetAsBox((obj.w || 1) * 0.5, (obj.h || 1) * 0.5);
          break;

        case 'circle':
          shape = new b2.b2CircleShape();
          shape.set_m_radius(obj.radius || 1);
          break;

        default:
          shape = new b2.b2PolygonShape();
          shape.SetAsBox(0.5, 0.5);
      }

      return shape;
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CUBE CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════

  var CUBE = {
    size: 0.5,           // Half-size of cube
    density: 2.0,
    friction: 0.8,
    restitution: 0.1,
    moveForce: 25,
    jumpImpulse: 12,
    rotateSpeed: 8,
    maxSpeed: 15
  };

  // ═══════════════════════════════════════════════════════════════════════
  // CUBE CLASS
  // ═══════════════════════════════════════════════════════════════════════

  function Cube(world, mirror) {
    this.world = world;
    this.mirror = mirror ? -1 : 1;
    this.body = null;
    this.spawnX = 0;
    this.spawnY = 0;
    this.isDead = false;
    this.isDestroy = true;
    this.position = { x: 0, y: 0 };
    this.startPos = { x: 0, y: 0 };

    // Extend world with helper methods
    extendWorld(this.world);
  }

  Cube.prototype = {
    constructor: Cube,

    /**
     * Spawn cube at position
     */
    spawn: function(x, y) {
      this.startPos = { x: x, y: y };
      this.spawnX = x;
      this.spawnY = y;
      this.init();
    },

    init: function() {
      var pos = this.startPos;

      // Create cube body using world.add helper
      this.body = this.world.add({
        shape: 'box',
        x: pos.x,
        y: pos.y,
        w: CUBE.size * 2,
        h: CUBE.size * 2,
        density: CUBE.density,
        friction: CUBE.friction,
        restitution: CUBE.restitution,
        angularDamping: 0.5,
        linearDamping: 0.1,
        allowSleep: false
      });

      this.isDead = false;
      this.isDestroy = false;
    },

    /**
     * Update cube physics based on input
     */
    update: function(input) {
      var b2 = getB2();
      if (this.isDead || this.isDestroy || !this.body) return;

      var vel = this.body.GetLinearVelocity();
      var vx = vel.get_x();

      // Move left/right
      if (input.left && !input.shift) {
        if (vx > -CUBE.maxSpeed) {
          var forceL = new b2.b2Vec2(-CUBE.moveForce, 0);
          this.body.ApplyForceToCenter(forceL, true);
          if (b2.destroy) b2.destroy(forceL);
        }
      }
      if (input.right && !input.shift) {
        if (vx < CUBE.maxSpeed) {
          var forceR = new b2.b2Vec2(CUBE.moveForce, 0);
          this.body.ApplyForceToCenter(forceR, true);
          if (b2.destroy) b2.destroy(forceR);
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
        var vy = vel.get_y();
        if (Math.abs(vy) < 0.5) {
          var impulse = new b2.b2Vec2(0, CUBE.jumpImpulse);
          this.body.ApplyLinearImpulseToCenter(impulse, true);
          if (b2.destroy) b2.destroy(impulse);
        }
      }

      // Update position
      this.position = this.getPosition();
    },

    /**
     * Get cube position
     */
    getPosition: function() {
      if (!this.body) return { x: this.spawnX, y: this.spawnY };
      var pos = this.body.GetPosition();
      return { x: pos.get_x(), y: pos.get_y() };
    },

    /**
     * Get cube angle
     */
    getAngle: function() {
      if (!this.body) return 0;
      return this.body.GetAngle();
    },

    /**
     * Teleport cube to position
     */
    teleport: function(x, y) {
      var b2 = getB2();
      if (!this.body) return;
      var pos = new b2.b2Vec2(x, y);
      this.body.SetTransform(pos, this.body.GetAngle());
      var zero = new b2.b2Vec2(0, 0);
      this.body.SetLinearVelocity(zero);
      this.body.SetAngularVelocity(0);
      if (b2.destroy) {
        b2.destroy(pos);
        b2.destroy(zero);
      }
    },

    /**
     * Flip direction (no-op for cube, for API compatibility)
     */
    flip: function() {
      this.mirror *= -1;
    },

    /**
     * Eject (no-op for cube, for API compatibility)
     */
    eject: function() {
      var b2 = getB2();
      // Cube has no rider to eject, just add some upward force
      if (this.body && !this.isDead) {
        var impulse = new b2.b2Vec2(0, CUBE.jumpImpulse * 2);
        this.body.ApplyLinearImpulseToCenter(impulse, true);
        if (b2.destroy) b2.destroy(impulse);
      }
    },

    /**
     * Kill cube
     */
    kill: function() {
      this.isDead = true;
    },

    /**
     * Destroy cube
     */
    destroy: function() {
      if (this.body && this.world) {
        try {
          this.world.DestroyBody(this.body);
        } catch (e) {}
      }
      this.body = null;
      this.isDead = true;
      this.isDestroy = true;
    },

    /**
     * Get body for rendering
     */
    getBody: function() {
      return this.body;
    }
  };

  // Export
  global.Cube = Cube;
  global.CUBE_CONFIG = CUBE;

})(typeof window !== 'undefined' ? window : this);
