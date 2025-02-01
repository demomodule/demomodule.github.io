// ─────────────────────────────────────────────
// Global Constants and Variables
// ─────────────────────────────────────────────
const TARGET_CONC_MAX = 400;
const sliderMin = 0;
const sliderMax = TARGET_CONC_MAX;
const yMin = 0;
const yMax = 9;

let scene = 'achGraph';
let currentSceneIndex = 0;
const scenes = ['achGraph', 'inhibitor', 'partialAgonists', 'spareReceptors'];

let lastBallCountChangeTime = 0;
let totalAttachmentsSinceLastChange = 0;
let pointCounter = 0;
let conc = 0;
let concentration = 1;
let inhibitorConcentration = 0;
let graphPlotted = false;
let lastConc = 0;
let horizontalShift = 0;
let inhibitorButtonClicked = false;
let maxObservedAvgFreq = 1;
let frameCounter = 0;
let startTime = 0;

let pointList = [];
let attachmentTimes = [];
let attachmentCount = 0;

// UI Elements and Buttons
let slider, inhibitorSlider;
let pointButton, graphButton, continueButton, inhibitorButton;
let nextButton, prevButton, sceneText;

// Canvas/graphics variables
let w = 640;
let h = 500;
let unit = 20;
let muscleStrip, sarcolemma, receptor, gpcr, vessel;
let AchBackgroundX = 0;
let fade = 0;

// Ball simulation variables
let particles = [];
let radius = 5;
let diameter = radius * 2;
let separator = 1;
let ballColor = "white";
let follow = false;

// Ghost point used in achGraph
let ghostPoint = { x: 0, y: 0, alpha: 100 };

// ─────────────────────────────────────────────
// p5.js Preload and Setup
// ─────────────────────────────────────────────
function preload() {
  muscleStrip = loadImage('musclestrip.png');
  sarcolemma = loadImage('sarcolemma.png');
  receptor = loadImage('receptor.png');
  gpcr = loadImage('gpcr.png');
  vessel = loadImage('vessel.png');
}

function setup() {
  createCanvas(1280, 720);
  startTime = millis();
  createNavigationButtons();
  createSceneText();
  createSliders();
  createActionButtons();
  hideUIElements();
  reset();
  initializeScene(scenes[currentSceneIndex]);

  // Also add event listeners for next/previous buttons using their IDs:
  document.getElementById('nextButton').addEventListener('click', nextScene);
  document.getElementById('prevButton').addEventListener('click', previousScene);
}

// ─────────────────────────────────────────────
// UI Creation Functions
// ─────────────────────────────────────────────
function createNavigationButtons() {
  prevButton = createButton('Previous');
  prevButton.id('prevButton');
  prevButton.mousePressed(handlePrevButtonClick);
  prevButton.class('button-base button-blue');
  prevButton.position(0, 20);

  nextButton = createButton('Next');
  nextButton.id('nextButton');
  nextButton.mousePressed(handleNextButtonClick);
  nextButton.class('button-base button-blue');
  nextButton.position(430, 20);
}

function createSceneText() {
  sceneText = createDiv('');
  sceneText.id('sceneText');
  sceneText.style('position', 'absolute');
  sceneText.style('top', '30px');
  sceneText.style('left', '275px');
  sceneText.style('font-size', '20px');
  sceneText.style('color', '#000');
  updateSceneText();
}

function createSliders() {
  // Main ligand slider (logarithmic scale)
  let sliderContainer = createDiv('');
  // Default value chosen to roughly represent sqrt(1*TARGET_CONC_MAX)
  slider = createCustomSlider(sliderContainer, 0, TARGET_CONC_MAX, TARGET_CONC_MAX / 2, 1);
  
  // Inhibitor slider (linear scale)
  let inhibitorSliderContainer = createDiv('');
  inhibitorSlider = createCustomSlider(inhibitorSliderContainer, 0, 150, 0, 1, true);
}

function createActionButtons() {
  pointButton = createButton('Plot Point');
  pointButton.id('plotPointButton');
  pointButton.mousePressed(handlePointButtonClick);
  pointButton.class('button-base button-red');

  graphButton = createButton('Plot Graph');
  graphButton.id('plotGraphButton');
  graphButton.mousePressed(handleGraphButtonClick);
  graphButton.class('button-base button-blue');

  continueButton = createButton('Continue');
  continueButton.id('continueButton');
  continueButton.mousePressed(handleContinueButtonClick);
  continueButton.class('button-base button-green');

  inhibitorButton = createButton('Plot Inhibitor');
  inhibitorButton.id('plotInhibitorButton');
  inhibitorButton.mousePressed(handleInhibitorButtonClick);
  inhibitorButton.class('button-base button-orange');
}

// ─────────────────────────────────────────────
// Custom Slider Creation (with Log Scale for main slider)
// ─────────────────────────────────────────────
function createCustomSlider(container, min, max, value, step, isInhibitor = false) {
  let sliderContainer = createDiv('');
  sliderContainer.class(isInhibitor ? 'inhibitor-slider-container' : 'slider-container');

  let sliderElement = createSlider(min, max, value, step);
  sliderElement.class(isInhibitor ? 'inhibitor-slider' : 'slider');
  sliderElement.parent(sliderContainer);

  let valueDisplay = createDiv('0');
  valueDisplay.class('slider-value');
  valueDisplay.parent(sliderContainer);

  sliderElement.input(() => {
    if (isInhibitor) {
      inhibitorConcentration = sliderElement.value();
      valueDisplay.html(`${Math.round(inhibitorConcentration)}`);
      updateInhibitorCount(Math.floor(inhibitorConcentration));
      horizontalShift = map(inhibitorConcentration, 0, 150, -4, 4);
      inhibitorButtonClicked = true;
      detachAllLigands();
      resetLigandProperties();
    } else {
      // Logarithmic mapping for the main ligand slider
      let fraction = map(sliderElement.value(), 0, TARGET_CONC_MAX, 0, 1);
      let logMin = 0; // log10(1) = 0
      let logMax = Math.log10(TARGET_CONC_MAX);
      let logValue = logMin + fraction * (logMax - logMin);
      concentration = Math.pow(10, logValue);
      valueDisplay.html(`${Math.round(concentration)}`);
      detachAllLigands();
      resetLigandProperties();
      updateBallCount(sliderElement.value());
    }
  });

  sliderContainer.parent(container);
  return sliderElement;
}

// ─────────────────────────────────────────────
// UI Visibility Helpers
// ─────────────────────────────────────────────
function hideUIElements() {
  slider.hide();
  pointButton.hide();
  graphButton.hide();
  continueButton.hide();
  inhibitorSlider.hide();
}

function showUIElements() {
  slider.show();
  pointButton.show();
}

// ─────────────────────────────────────────────
// Scene Initialization and Navigation
// ─────────────────────────────────────────────
function initializeScene(sceneName) {
  // Reset simulation variables for a new scene
  particles = [];
  pointList = [];
  pointCounter = 0;
  frameCounter = 0;
  attachmentTimes = [];
  attachmentCount = 0;
  horizontalShift = 0;
  inhibitorButtonClicked = false;
  hideUIElements();

  switch (sceneName) {
    case 'achGraph':
      slider.show();
      pointButton.show();
      graphButton.show();
      continueButton.show();
      inhibitorSlider.hide();
      inhibitorButton.hide();
      break;
    case 'inhibitor':
      slider.show();
      inhibitorSlider.show();
      pointButton.hide();
      graphButton.hide();
      continueButton.hide();
      break;
    // Additional scenes can be initialized here as needed
    default:
      break;
  }
  scene = sceneName;
}

function nextScene() {
  currentSceneIndex = (currentSceneIndex + 1) % scenes.length;
  initializeScene(scenes[currentSceneIndex]);
  updateSceneText();
}

function previousScene() {
  currentSceneIndex = (currentSceneIndex - 1 + scenes.length) % scenes.length;
  initializeScene(scenes[currentSceneIndex]);
  updateSceneText();
}

function handleNextButtonClick() {
  nextScene();
}

function handlePrevButtonClick() {
  previousScene();
}

function updateSceneText() {
  sceneText.html(`${scene}`);
}

// ─────────────────────────────────────────────
// Button and Slider Event Handlers
// ─────────────────────────────────────────────
function handlePointButtonClick() {
  detachAllLigands();
  resetLigandProperties();
  let currentTime = millis();
  let elapsedSeconds = (currentTime - lastBallCountChangeTime) / 1000;
  let averageAttachments = elapsedSeconds > 0 ? attachmentTimes.length / elapsedSeconds : 0;

  if (scene === 'achGraph' && pointCounter < 5) {
    // Lock in the ghost point
    ghostPoint.x = constrain(slider.value(), sliderMin, sliderMax);
    ghostPoint.y = constrain(averageAttachments, yMin, yMax);
    pointList.push({ x: ghostPoint.x, y: ghostPoint.y, alpha: 255 });
    pointCounter++;
  }
}

function handleGraphButtonClick() {
  if (pointList.length < 5) {
    alert("Please plot at least 5 points before plotting the sigmoid.");
    return;
  }
  graphPlotted = true;
  redrawGraph();
}

function handleContinueButtonClick() {
  lastConc = particles.length;
  scene = 'inhibitor';
}

function handleInhibitorButtonClick() {
  if (scene === 'inhibitor') {
    let mappedInhibitorValue = mapInhibitorSliderValue(inhibitorSlider.value());
    let targetInhibitorCount = Math.floor(map(mappedInhibitorValue, -12, 12, 0, 150));
    attachmentCount = 0;
    updateInhibitorCount(targetInhibitorCount);
    detachAllLigands();
    horizontalShift = map(mappedInhibitorValue, -12, 12, -4, 4);
    inhibitorButtonClicked = true;
  }
}

// ─────────────────────────────────────────────
// Ball Simulation Functions
// ─────────────────────────────────────────────
function updateBallCount(sliderValue) {
  let newCount = Math.floor(concentration);
  let currentCount = particles.length;
  if (newCount !== currentCount) {
    lastBallCountChangeTime = millis();
    attachmentTimes = [];
    totalAttachmentsSinceLastChange = 0;
    if (newCount > currentCount) {
      let countToAdd = newCount - currentCount;
      let possiblePlaces = placeBalls()[0];
      let startIndex = currentCount;
      for (let i = 0; i < countToAdd; i++) {
        let position = possiblePlaces[(startIndex + i) % possiblePlaces.length];
        let velocity = p5.Vector.random2D();
        velocity.setMag(random(1, 2));
        particles.push(new Ball(
          position,
          velocity,
          radius,
          startIndex + i,
          particles,
          ballColor,
          follow
        ));
      }
    } else if (newCount < currentCount) {
      particles.splice(newCount, currentCount - newCount);
    }
  }
}

function reset(count = 1) {
  let possiblePlaces = placeBalls()[0];
  particles = [];
  for (let i = 0; i < count; i++) {
    let position = possiblePlaces[i % possiblePlaces.length];
    let velocity = p5.Vector.random2D();
    velocity.setMag(random(1, 2));
    particles[i] = new Ball(
      position,
      velocity,
      radius,
      i,
      particles,
      ballColor,
      follow
    );
  }
}

function placeBalls() {
  let positions = [];
  let place = createVector(640 + radius, 300 + radius);
  let gridDim = createVector(0, 0);

  while (place.x <= 1280 - radius && place.y <= 605 - radius) {
    positions.push(place.copy());
    place.x += diameter + separator;
    gridDim.x++;
    if (place.x > 1280 - radius) {
      place.x = 640 + radius;
      place.y += diameter + separator;
      gridDim.y++;
    }
  }
  gridDim.x = gridDim.x / gridDim.y;
  return [positions, gridDim];
}

function addInhibitorBalls(count) {
  let possiblePlaces = placeBalls()[0];
  let startIndex = particles.length;
  for (let i = 0; i < count; i++) {
    let position = possiblePlaces[(startIndex + i) % possiblePlaces.length];
    let velocity = p5.Vector.random2D();
    velocity.setMag(random(1, 2));
    particles.push(new Ball(
      position,
      velocity,
      radius,
      startIndex + i,
      particles,
      "red",  // Red color for inhibitors
      false,
      true   // isInhibitor flag
    ));
  }
}

function updateInhibitorCount(targetCount) {
  let currentInhibitorCount = particles.filter(p => p.isInhibitor).length;
  if (targetCount > currentInhibitorCount) {
    addInhibitorBalls(targetCount - currentInhibitorCount);
  } else if (targetCount < currentInhibitorCount) {
    removeInhibitorBalls(currentInhibitorCount - targetCount);
  }
}

function removeInhibitorBalls(count) {
  let removedCount = 0;
  for (let i = particles.length - 1; i >= 0 && removedCount < count; i--) {
    if (particles[i].isInhibitor) {
      particles.splice(i, 1);
      removedCount++;
    }
  }
}

// Mapping helper for inhibitor slider
function mapInhibitorSliderValue(value) {
  return map(value, 3, 100, -12, 12);
}

// Dummy implementations for detach/reset ligand functions
// (These are preserved as in your original code.)
function detachAllLigands() {
  for (let i = 0; i < particles.length; i++) {
    if (particles[i].isAttached) {
      particles[i].detachFromRectangle();
    }
  }
  attachmentCount = 0;
}

function resetLigandProperties() {
  // Note: attachedLigands is referenced in the original code.
  for (let i = 0; i < attachedLigands?.length; i++) {
    attachedLigands[i] = null;
  }
  for (let particle of particles) {
    particle.attachedRectIndex = -1;
    particle.gracePeriod = 0;
  }
}

// ─────────────────────────────────────────────
// Graph and Drawing Helper Functions
// ─────────────────────────────────────────────
function displayFunction(fn, type) {
  // Determine stroke color based on function type.
  stroke(type === 'ligand' ? color(101, 100, 250) : color(250, 0, 0));
  strokeWeight(3);
  let output = [];
  for (let x = -12; x <= 12; x += 0.01) {
    let y = fn(x);
    if (y <= h / (1 * unit) && y >= -h / (1.9 * unit)) {
      output.push([x, y]);
    }
  }
  for (let i = 1; i < output.length - 1; i++) {
    let x1 = w / 2 + unit * output[i][0];
    let y1 = 420 - unit * output[i][1];
    let x2 = w / 2 + unit * output[i + 1][0];
    let y2 = 420 - unit * output[i + 1][1];
    line(x1, y1, x2, y2);
  }
}

function redrawGraph() {
  background(173, 216, 230);
  drawGridAndAxes();
  // Redraw locked-in points
  fill(255, 0, 0);
  for (let point of pointList) {
    let xCoord = map(point.x, sliderMin, sliderMax, 80, w - 80);
    let yCoord = map(point.y, yMin, yMax, h - 80, 80);
    ellipse(xCoord, yCoord, 10, 10);
  }
  drawBalls();
}

function drawGridAndAxes() {
  stroke(255, 0, 0);
  strokeWeight(3);
  line(640, 0, 640, 720);
  fill(255);
  noStroke();
  rect(0, 0, 640, 720);
  
  stroke(180);
  strokeWeight(1);
  for (let i = 4; i <= h / (unit + 3); i++) {
    line(80, 20 * i, w - 80, 20 * i);
  }
  for (let i = 4; i <= w / (unit + 2.5); i++) {
    line(20 * i, 80, 20 * i, h - 80);
  }
  
  strokeWeight(2);
  stroke(0);
  line(80, h - 80, w - 80, h - 80);
  line(80, 80, 80, h - 80);
}

function drawBalls() {
  for (let a of particles) {
    a.bounceOthers();
    a.update();
    a.display();
  }
}

// ─────────────────────────────────────────────
// Mathematical Functions for the Graph
// ─────────────────────────────────────────────
function f(x) {
  if (x > -12) {
    return 10 * (10 ** (0.25 * (x + 4)) ** 3) / (1 + (10 ** (0.25 * (x + 4)) ** 3));
  }
}

function u(x) {
  if (x > (-60 - horizontalShift)) {
    return f(x - horizontalShift - 4);
  }
  return 0;
}

// ─────────────────────────────────────────────
// p5.js Draw Loop
// ─────────────────────────────────────────────
function draw() {
  if (scene === 'achGraph') {
    showUIElements();
  } else {
    hideUIElements();
  }
  
  if (scene === 'choose ligand') {
    drawChooseLigandScene();
  } else if (scene === 'achStart') {
    drawAchStartScene();
  } else if (scene === 'achGraph') {
    // ─────────────────────────────────────────
    // Do NOT change any functionality of "achGraph"
    // ─────────────────────────────────────────
    background(173, 216, 230);
    stroke(255, 0, 0);
    strokeWeight(3);
    line(640, 0, 640, 720);

    fill(255);
    noStroke();
    rect(0, 0, 640, 720);

    stroke(180);
    strokeWeight(1);
    for (let i = 4; i <= h / (unit + 3); i++) {
      line(80, 20 * i, w - 80, 20 * i);
    }
    for (let i = 4; i <= w / (unit + 2.5); i++) {
      line(20 * i, 80, 20 * i, h - 80);
    }

    strokeWeight(2);
    stroke(0);
    line(80, h - 80, w - 80, h - 80);
    line(80, 80, 80, h - 80);

    noStroke();
    textSize(25);
    fill(180, 180, 180);

    let currentTime = millis();
    let elapsedSeconds = (currentTime - lastBallCountChangeTime) / 1000;
    let averageAttachments = elapsedSeconds > 0 ? attachmentTimes.length / elapsedSeconds : 0;

    textSize(20);
    textAlign(CENTER);
    text(`Ligand Concentration: ${Math.round(concentration)}`, 320, 650);
    text(`Average Attachments per second: ${averageAttachments.toFixed(2)}`, 320, 680);

    image(vessel, 660, 10, 600, 400);

    noFill();
    stroke(255, 255, 102);
    rect(945, 80, 30, 30);
    line(945, 110, 640, 300);
    line(975, 110, 1280, 300);
    line(640, 300, 1280, 300);

    image(sarcolemma, 640, 300, 640, 640);
    image(gpcr, 630, 560, 200, 200);
    image(gpcr, 800, 555, 200, 200);
    image(gpcr, 970, 530, 200, 200);
    image(gpcr, 1100, 530, 200, 200);

    fill(255, 0, 0);
    rect(925, 580, 10, 20);
    rect(755, 585, 10, 20);
    rect(1095, 555, 10, 20);
    rect(1225, 555, 10, 20);

    stroke(0);
    noFill();

    for (let a of particles) {
      a.bounceOthers();
      a.update();
      a.display();
    }

    if (pointCounter < 5) {
      ghostPoint.x = constrain(slider.value(), sliderMin, sliderMax);
      ghostPoint.y = constrain(averageAttachments, yMin, yMax);
      let ghostXCoord = map(ghostPoint.x, sliderMin, sliderMax, 80, w - 80);
      let ghostYCoord = map(ghostPoint.y, yMin, yMax, h - 80, 80);
      fill(255, 0, 0, ghostPoint.alpha);
      noStroke();
      ellipse(ghostXCoord, ghostYCoord, 10, 10);
    }
    if (pointCounter > 0) {
      for (let point of pointList) {
        let xCoord = map(point.x, sliderMin, sliderMax, 80, w - 80);
        let yCoord = map(point.y, yMin, yMax, h - 80, 80);
        fill(255, 0, 0, point.alpha);
        ellipse(xCoord, yCoord, 10, 10);
      }
    }
    
    frameCounter++;
    if (pointCounter >= 5) {
      graphButton.show();
      if (graphPlotted === true) {
        graphButton.hide();
        displayFunction(f, 'ligand');
        continueButton.show();
      }
    }
    // ─────────────────────────────────────────
    
  } else if (scene === 'inhibitor') {
    hideUIElements();
    inhibitorButton.show();
    inhibitorSlider.show();
    slider.show();

    background(173, 216, 230);
    stroke(255, 0, 0);
    strokeWeight(3);
    line(640, 0, 640, 720);

    fill(255);
    noStroke();
    rect(0, 0, 640, 720);

    stroke(180);
    strokeWeight(1);
    for (let i = 4; i <= h / (unit + 3); i++) {
      line(80, 20 * i, w - 80, 20 * i);
    }
    for (let i = 4; i <= w / (unit + 2.5); i++) {
      line(20 * i, 80, 20 * i, h - 80);
    }

    strokeWeight(2);
    stroke(0);
    line(80, h - 80, w - 80, h - 80);
    line(80, 80, 80, h - 80);

    noStroke();
    textSize(25);
    fill(180, 180, 180);

    image(vessel, 660, 0, 600, 400);

    noFill();
    stroke(255, 255, 102);
    rect(945, 80, 30, 30);
    line(945, 110, 640, 300);
    line(975, 110, 1280, 300);
    line(640, 300, 1280, 300);

    image(sarcolemma, 640, 300, 640, 640);
    image(gpcr, 630, 560, 200, 200);
    image(gpcr, 800, 555, 200, 200);
    image(gpcr, 970, 530, 200, 200);
    image(gpcr, 1100, 530, 200, 200);

    fill(255, 0, 0);
    rect(925, 580, 10, 20);
    rect(755, 585, 10, 20);
    rect(1095, 555, 10, 20);
    rect(1225, 555, 10, 20);

    stroke(0);
    noFill();

    stroke(101, 100, 250);
    displayFunction(f, 'ligand');

    if (inhibitorButtonClicked) {
      displayFunction(u, 'inhibitor');
    }
    strokeWeight(2);
    for (let a of particles) {
      a.bounceOthers();
      a.update();
      a.display();
    }
  }
}

// ─────────────────────────────────────────────
// Additional Scene Draw Functions
// ─────────────────────────────────────────────
function drawChooseLigandScene() {
  background(173, 216, 230);
  stroke(0);
  fill(222, 184, 135);
  rect(0, 550, 1200, 720);

  beginShape();
  vertex(1280, 450);
  vertex(1280, 720);
  vertex(1200, 720);
  vertex(1200, 550);
  endShape(CLOSE);

  fill(50, 50, 50);
  beginShape();
  vertex(0, 550);
  vertex(1200, 550);
  vertex(1280, 450);
  vertex(80, 450);
  endShape(CLOSE);

  fill(0);
  textSize(50);
  noStroke();
  text('Pick Ligand:', 500, 100);

  strokeWeight(3);
  fill(220, 220, 220);
  rect(30, 150, 300, 100);
  rect(490, 150, 300, 100);
  rect(950, 150, 300, 100);

  fill(0);
  textSize(45);
  noStroke();
  text('Acetylcholine', 48, 215);
  text('Epinephrine', 520, 215);
  text('FILLER12345', -200, -200);
  strokeWeight(3);
}

function drawAchStartScene() {
  fill(72, 61, 139);
  if (AchBackgroundX > -1280) {
    AchBackgroundX -= 12;
    rect(1280, 0, AchBackgroundX, 720);
  } else if (fade < 255) {
    noStroke();
    fill(220, 220, 220, fade);
    rect(390, 260, 500, 200);
    fill(0, 0, 0, fade);
    stroke(0);
    textSize(75);
    text('Start', 560, 385);
    fade += 1;
  }
}

// ─────────────────────────────────────────────
// p5.js Mouse Click Handler
// ─────────────────────────────────────────────
function mouseClicked() {
  if (scene === 'choose ligand') {
    if (mouseX > 30 && mouseX < 330 && mouseY > 150 && mouseY < 250) {
      scene = 'achStart';
    }
  } else if (scene === 'achStart') {
    if (mouseX > 390 && mouseX < (390 + 500) && mouseY > 260 && mouseY < (260 + 200)) {
      scene = 'achGraph';
    }
  }
}