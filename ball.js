let attachedLigands = [null, null, null, null];
let detachmentTime = 5;
let graceDuration = 70;  // Grace period after detachment in frames
let animationDuration = 10;  // Duration of the animation in frames

// New hitboxes for small red rectangles
let rectangles = [
  { x: 925, y: 580, w: 10, h: 20 },  // Rectangle 1
  { x: 755, y: 585, w: 10, h: 20 },  // Rectangle 2
  { x: 1095, y: 555, w: 10, h: 20 },  // Rectangle 3
  { x: 1225, y: 555, w: 10, h: 20 }   // Rectangle 4
];

// Constrain ball bouncing inside rect(640, 300, 1280, 305)
let boundingBox = {
  x: 640,
  y: 300,
  w: 640,
  h: 305
};

function Ball(pos, vel, radius, identity, others, color, follow, isInhibitor = false) {
  this.coeficient = 1;
  this.position = pos;
  this.velocity = vel;
  this.id = identity;
  this.others = others;
  this.r = radius;
  this.color = isInhibitor ? "green" : color;
  this.mass = this.r * 5;
  this.follow = follow;
  this.history = [];
  this.attachedTime = 0;
  this.gracePeriod = 0;
  this.animating = false;
  this.animationProgress = 0;
  this.startPosition = null;
  this.targetPosition = null;
  this.storedVelocity = null;
  this.attachedRectIndex = -1;

  this.velocity.mult(5);

  this.isInhibitor = isInhibitor
}

Ball.prototype.update = function () {
  if (this.animating) {
    this.updateAnimation();
  } else {
    this.updateNormal();
  }

  let v = createVector(this.position.x, this.position.y);
  this.history.push(v);

  if (frameRate() < 30) {
    this.history.splice(0, 10);
  }
};

Ball.prototype.updateAnimation = function () {
  this.animationProgress += 1 / animationDuration;
  if (this.animationProgress >= 1) {
    this.position = this.targetPosition.copy();
    this.animating = false;
    this.animationProgress = 0;
    this.attachedTime = 0;
  } else {
    let t = easeInOutQuad(this.animationProgress);
    this.position = p5.Vector.lerp(this.startPosition, this.targetPosition, t);
  }
};

Ball.prototype.updateNormal = function () {
  this.velocity.add(this.acceleration);
  this.position.add(this.velocity);

  if (this.gracePeriod > 0) {
    this.gracePeriod--;
  }

  // Check for collisions with rectangles
  this.checkRectangleCollisions();

  // Handle bounding box collisions
  this.handleBoundingBoxCollisions();
};

Ball.prototype.checkRectangleCollisions = function () {
  for (let i = 0; i < rectangles.length; i++) {
    let rect = rectangles[i];

    if (this.attachedRectIndex === i) {
      // If this ball is attached to the current rectangle, handle detachment
      this.handleAttachment(i);
    } else if (this.isCollidingWithRectangle(rect)) {
      if (attachedLigands[i] === null && this.attachedRectIndex === -1 && this.gracePeriod === 0) {
        // Attach to the rectangle if it's free and this ball is not attached elsewhere
        this.attachToRectangle(i);
      } else {
        // Bounce off the rectangle
        this.bounceOffRectangle(rect);
      }
    }
  }
};

Ball.prototype.isCollidingWithRectangle = function (rect) {
  return (
    this.position.x + this.r > rect.x &&
    this.position.x - this.r < rect.x + rect.w &&
    this.position.y + this.r > rect.y &&
    this.position.y - this.r < rect.y + rect.h
  );
};

Ball.prototype.bounceOffRectangle = function (rect) {
  let closestX = Math.max(rect.x, Math.min(this.position.x, rect.x + rect.w));
  let closestY = Math.max(rect.y, Math.min(this.position.y, rect.y + rect.h));
  
  let distanceX = this.position.x - closestX;
  let distanceY = this.position.y - closestY;
  
  let distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
  
  if (distance < this.r) {
    let overlap = this.r - distance;
    let angle = Math.atan2(distanceY, distanceX);
    
    this.position.x += overlap * Math.cos(angle);
    this.position.y += overlap * Math.sin(angle);
    
    let normal = createVector(Math.cos(angle), Math.sin(angle));
    let dot = this.velocity.dot(normal);
    
    if (dot < 0) {
      this.velocity.sub(normal.mult(2 * dot));
    }
  }
};

Ball.prototype.attachToRectangle = function (rectIndex) {
  this.storedVelocity = this.velocity.copy();
  let rect = rectangles[rectIndex];
  this.startAnimation(createVector(rect.x + rect.w / 2, rect.y + rect.h / 2));
  attachedLigands[rectIndex] = this;
  this.attachedRectIndex = rectIndex;


  if (!this.isInhibitor) {
    attachmentTimes.push(millis());  // Record attachment time
  }
};

Ball.prototype.handleAttachment = function (rectIndex) {
  this.attachedTime++;

  if (this.attachedTime > detachmentTime) {
    this.detachFromRectangle(rectIndex);
  }
};

Ball.prototype.detachFromRectangle = function (rectIndex) {
  this.velocity = this.storedVelocity;
  attachedLigands[rectIndex] = null;
  this.attachedRectIndex = -1;
  this.gracePeriod = graceDuration;
};

Ball.prototype.handleBoundingBoxCollisions = function () {
  if (this.position.x > boundingBox.x + boundingBox.w - this.r) {
    this.position.x = boundingBox.x + boundingBox.w - this.r;
    this.velocity.x *= -1 * this.coeficient;
  } else if (this.position.x < boundingBox.x + this.r) {
    this.position.x = boundingBox.x + this.r;
    this.velocity.x *= -1 * this.coeficient;
  }
  
  if (this.position.y > boundingBox.y + boundingBox.h - this.r) {
    this.position.y = boundingBox.y + boundingBox.h - this.r;
    this.velocity.y *= -1 * this.coeficient;
  } else if (this.position.y < boundingBox.y + this.r) {
    this.position.y = boundingBox.y + this.r;
    this.velocity.y *= -1 * this.coeficient;
  }
};

Ball.prototype.startAnimation = function (targetPos) {
  this.animating = true;
  this.animationProgress = 0;
  this.startPosition = this.position.copy();
  this.targetPosition = targetPos;
  this.velocity.set(0, 0);
};

Ball.prototype.display = function () {
  stroke(0);
  fill(this.color);
  circle(this.position.x, this.position.y, this.r * 2);

  if (this.follow) {
    for (let i = 0; i < this.history.length; i++) {
      var pos = this.history[i];
      push();
      fill("magenta");
      noStroke();
      ellipse(pos.x, pos.y, 2, 2);
      pop();
    }
  }
};

Ball.prototype.bounceOthers = function () {
  if (this.animating || this.attachedRectIndex !== -1) return;

  for (let i = 0; i < this.others.length; i++) {
    if (this.others[i] === this || this.others[i].animating || this.others[i].attachedRectIndex !== -1) {
      continue;
    }
    let relative = p5.Vector.sub(this.others[i].position, this.position);
    let distance = relative.mag() - (this.r + this.others[i].r);

    if (distance < 0) {
      let movement = relative.copy().setMag(abs(distance / 2));
      this.position.sub(movement);
      this.others[i].position.add(movement);

      let thisToOtherNormal = relative.copy().normalize();
      let approachSpeed =
        this.velocity.dot(thisToOtherNormal) +
        -this.others[i].velocity.dot(thisToOtherNormal);
      let approachVector = thisToOtherNormal.copy().setMag(approachSpeed);
      this.velocity.sub(approachVector);
      this.others[i].velocity.add(approachVector);
    }
  }
};

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}