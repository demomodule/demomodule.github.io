const sliderMin = 0; // Slider's min value
const sliderMax = 2; // Slider's max value
const yMin = 0;      // Minimum y value
const yMax = 20;     // Maximum y value
let scene = 'achGraph';
let lastBallCountChangeTime = 0;
let totalAttachmentsSinceLastChange = 0;

let muscleStrip, sarcolemma, receptor;
let w = 640;
let h = 500; 
let unit = 20;
let slider;
let inhibitorSlider;
let ligand = '';
let AchBackgroundX = 0;
let fade = 0;
let pointCounter = 0;
let conc = 0;
let pointList = [];  // Stores plotted points with x and y properties
let pointButton;
let graphButton;
let continueButton;
let attachmentTimes = []; // Array to store attachment times
let attachmentCount = 0; // Variable to track attachments
let graphPlotted = false;
let lastConc = 0;
let gpcr;
let vessel;
let horizontalShift = 0;
let inhibitorButtonClicked = false;
let maxObservedAvgFreq = 1; // Initialize with 1 or adjust based on simulation
let frameCounter = 0;
let startTime = 0;



// Ball simulation variables
let particles = [];
let radius = 5;
let diameter = radius * 2;
let separator = 1;
let color = "white";
let follow = false;

function preload() {
  muscleStrip = loadImage('musclestrip.png');
  sarcolemma = loadImage('sarcolemma.png');
  receptor = loadImage('receptor.png');
  gpcr = loadImage('gpcr.png');
  vessel = loadImage('vessel.png');
}

function detachAllLigands() {
  for (let i = 0; i < particles.length; i++) {
    if (particles[i].isAttached) {
      particles[i].detachFromRectangle();
    }
  }
  attachmentCount = 0;
}

function resetLigandProperties() {
  for (let i = 0; i < attachedLigands.length; i++) {
    attachedLigands[i] = null;
  }
  
  for (let particle of particles) {
    particle.attachedRectIndex = -1;
    particle.gracePeriod = 0;
  }
}



function handlePointButtonClick() {
  detachAllLigands();
  resetLigandProperties();
  let currentTime = millis();
  let elapsedTime = (currentTime - lastBallCountChangeTime) / 1000; // In seconds
  let averageAttachmentFrequency = totalAttachmentsSinceLastChange / elapsedTime;


  if (scene === 'achGraph') {
    detachAllLigands();
    
    if (pointCounter < 50) {
      let mappedValue = slider.value();
      let xValue = slider.value(); 
      // Calculate average attachment frequency over the last 10 seconds
      let timeWindow = 10000; // 10 seconds
      let recentAttachments = attachmentTimes.filter(time => currentTime - time <= timeWindow);
      let attachmentCountInWindow = recentAttachments.length;
      let averageAttachmentFrequency = attachmentCountInWindow / (timeWindow / 1000);

      // Update max observed average frequency
      if (averageAttachmentFrequency > maxObservedAvgFreq) {
        maxObservedAvgFreq = averageAttachmentFrequency;
      }

      // Scale the average frequency
      let scaledAverage = scaleAverageFrequency(averageAttachmentFrequency);

      // Store the point
      pointList.push({ x: xValue, y: scaledAverage });
      pointCounter += 1;

    }

  }
}



function handleGraphButtonClick() {
  graphPlotted = true;
}

function handleContinueButtonClick() {
  lastConc = particles.length;
  scene = 'inhibitor';
}

function handleInhibitorButtonClick() {
  if (scene === 'inhibitor') {
    // Map the inhibitor slider value to the original range
    let mappedInhibitorValue = mapInhibitorSliderValue(inhibitorSlider.value());

    // Calculate the target inhibitor count
    let targetInhibitorCount = Math.floor(map(mappedInhibitorValue, -12, 12, 0, 150));

    attachmentCount = 0;

    updateInhibitorCount(targetInhibitorCount);

    detachAllLigands();

    // Calculate horizontalShift
    horizontalShift = map(mappedInhibitorValue, -12, 12, -4, 4);

    inhibitorButtonClicked = true;
  }
}

function createCustomSlider(container, min, max, value, step, isInhibitor = false) {
  let sliderContainer = createDiv('');
  sliderContainer.class(isInhibitor ? 'inhibitor-slider-container' : 'slider-container');
  
  let slider = createSlider(min, max, value, step);
  slider.class(isInhibitor ? 'inhibitor-slider' : 'slider');
  slider.parent(sliderContainer);
  
  let valueDisplay = createDiv('0');
  valueDisplay.class('slider-value');
  valueDisplay.parent(sliderContainer);
  
  slider.input(() => {
    // Calculate ligand concentration
    let concentration = Math.pow(10, slider.value());
    valueDisplay.html(`1e${slider.value().toFixed(2)}`);
    if (!isInhibitor) {
      detachAllLigands();
      resetLigandProperties();
      let concentration = Math.pow(10, slider.value()); // Compute concentration
      updateBallCount(concentration); // Pass the actual concentration
  }  
  });

  sliderContainer.parent(container);
  
  return slider;
}



function updateBallCount(concentration) {
  // Map concentration (0 to 12) to particle count (10 to 100)
  let newCount = map(concentration, 0, 12, 10, 100);
  newCount = Math.floor(newCount);
  let currentCount = particles.length;
  if (newCount !== currentCount) {
    // Reset the timer and attachment count when the number of balls changes
    lastBallCountChangeTime = millis();
    totalAttachmentsSinceLastChange = 0;
  }
  
  if (newCount > currentCount) {
    // Add more balls
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
        color,
        follow
      ));
    }
  } else if (newCount < currentCount) {
    // Remove balls
    particles.splice(newCount, currentCount - newCount);
  }
}


function setup() {
  createCanvas(1280, 720);
  startTime = millis();

  // Create custom CSS slider
  let sliderContainer = createDiv('');
  slider = createCustomSlider(sliderContainer, 0, 2, 0, 0.1);

  
  let inhibitorSliderContainer = createDiv('');
  inhibitorSlider = createCustomSlider(inhibitorSliderContainer, 3, 100, 3, 1, true);
  
  // Create Plot Point button
  pointButton = createButton('Plot Point');
  pointButton.id('plotPointButton');
  pointButton.mousePressed(handlePointButtonClick);
  pointButton.class('button-base button-red');
  
  // Create Plot Graph button
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

  hideUIElements();
  
  // Initialize balls
  reset();
}

function draw() {
  let currentTime = millis();
let elapsedTime = (currentTime - startTime) / 1000; // In seconds
let totalAttachments = attachmentTimes.length;
let averageAttachments = totalAttachments / elapsedTime;

  if (scene === 'achGraph') {
    showUIElements();
  } else {
    hideUIElements();
  }

  if (scene == 'choose ligand') {
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
    strokeWeight(3);
    textSize(10);
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

  } else if (scene == 'achStart') {
    fill(72, 61, 139);
    if (AchBackgroundX > -1280) {
      AchBackgroundX -= 12;
      rect(1280, 0, AchBackgroundX, 720);
    } else if (fade < 255) {
      strokeWeight(0);
      fill(220, 220, 220, fade);
      rect(390, 260, 500, 200);
      fill(0, 0, 0, fade);
      stroke(0);
      textSize(75);
      text('Start', 560, 385);
      fade += 1;
    }

  } else if (scene == 'achGraph') {
    background(173, 216, 230);
    stroke(255, 0, 0);
    strokeWeight(3);
    line(640, 0, 640, 720);

    fill(255);
    noStroke();
    rect(0, 0, 640, 720);

    // Draw grid lines
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

    // Calculate the average attachments per 3 seconds
    let currentTime = millis();
    // Remove timestamps older than 3 seconds
    attachmentTimes = attachmentTimes.filter(time => currentTime - time <= 3000);
    let averageAttachments = attachmentTimes.length;

    // Set text alignment to center
    textAlign(CENTER);

    // Display current number of balls, slider value, and average attachments
    textSize(20);
    let ballCount = Math.floor(slider.value());
    
    text(`Ligand Concentration: 1e${slider.value().toFixed(2)}`, 320, 650);
    text(`Average Attachments per second: ${averageAttachments}`, 320, 680);


    // Reset text alignment if needed elsewhere
    textAlign(LEFT);

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

    // Draw and update balls
    for (let i = 0; i < particles.length; i++) {
      let a = particles[i];
      a.bounceOthers();
      a.update();
      a.display();
    }

    // Plot the points from pointList
    if (pointCounter > 0) {
      fill(255, 0, 0);
      for (let point of pointList) {
        let xCoord = map(point.x, sliderMin, sliderMax, 80, w - 80);
        let yCoord = map(point.y, yMin, yMax, h - 80, 80);
        ellipse(xCoord, yCoord, 10, 10);
      }
    }
    
    frameCounter++;

    // Check if 50 frames have passed
   
    

    if (pointCounter >= 5) {
      graphButton.show();
      if (graphPlotted == true) {
        graphButton.hide();
        displayFunction(f, 'ligand');
        continueButton.show();
      }
    }

  } else if (scene == 'inhibitor') {
    hideUIElements();
    inhibitorButton.show();
    inhibitorSlider.show();

    background(173, 216, 230);
    stroke(255, 0, 0);
    strokeWeight(3);
    line(640, 0, 640, 720);

    fill(255);
    noStroke();
    rect(0, 0, 640, 720);

    // Draw grid lines
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

    // Calculate the average attachments per 3 seconds
    let currentTime = millis();
    // Remove timestamps older than 3 seconds
    attachmentTimes = attachmentTimes.filter(time => currentTime - time <= 3000);
    let averageAttachments = attachmentTimes.length;

    // Set text alignment to center
    textAlign(CENTER);

    // Display ligand and inhibitor concentrations, and average attachments
    textSize(20);
    let ligandCount = particles.filter(p => !p.isInhibitor).length;
    let inhibitorCount = particles.filter(p => p.isInhibitor).length;
    text(`Ligand Concentration: ${ligandCount}`, 320, 650);
    text(`Average Attachments per second: ${averageAttachments.toFixed(2)}`, 320, 680);


    // Reset text alignment if needed elsewhere
    textAlign(LEFT);

    image(vessel, 660, -0, 600, 400);

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

    // Display functions
    stroke(101, 100, 250);
    displayFunction(f, 'ligand');

    if (inhibitorButtonClicked) {
      displayFunction(u, 'inhibitor');
    }

    strokeWeight(2);

    // Draw and update all balls (ligands and inhibitors)
    for (let i = 0; i < particles.length; i++) {
      let a = particles[i];
      a.bounceOthers();
      a.update();
      a.display();
    }
  }
}

function updateBallCount(count) {
  reset(count);
}

function displayFunction(f, type) {
  if (type == 'ligand') {
    stroke(101, 100, 250);
    strokeWeight(3); 
    let output = [];
    for (let x = -12; x <= 12; x += 0.01) {
      let y = f(x);
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
  } else {
    stroke(250, 0, 0);
    strokeWeight(3); 
    let output = [];
    for (let x = -12; x <= 12; x += 0.01) {
      let y = f(x);
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
}

function f(x) {
  if (x > -12) {
    return (10 * (10 ** (0.25 * (x + 4))) ** 3 / (1 + (10 ** (0.25 * (x + 4))) ** 3));    
  }
}

function u(x) {
  if (x > (-60 - horizontalShift)) {
    return f(x - horizontalShift - 4);
  }
  return 0;
}

function reset(count = 3) {
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
      color,
      follow
    );
  }
}

function placeBalls() {
  let positions = [];
  let place = new p5.Vector(640 + radius, 300 + radius);
  let widthheight = new p5.Vector(0, 0);

  while (place.x <= 1280 - radius && place.y <= 605 - radius) {
    let position = new p5.Vector(place.x, place.y);
    positions.push(position);
    place.x += diameter + separator;

    widthheight.x += 1;

    if (place.x > 1280 - radius) {
      place.x = 640 + radius;
      place.y += diameter + separator;
      widthheight.y += 1;
    }
  }
  
  widthheight.x = widthheight.x / widthheight.y;
  return [positions, widthheight];
}

function mouseClicked() {
  if (scene == 'choose ligand') {
    if (mouseX > 30 && mouseX < 330 && mouseY > 150 && mouseY < 250) {
      scene = 'achStart';
    }
  } else if (scene == 'achStart') {
    if (mouseX > 390 && mouseX < (390 + 500) && mouseY > 260 && mouseY < (260 + 200)) {
      scene = 'achGraph';
    }
  }
}

function hideUIElements() {
  slider.hide();
  pointButton.hide();
  graphButton.hide();
  continueButton.hide();
  inhibitorSlider.hide();
  inhibitorButton.hide();
}

function showUIElements() {
  slider.show();
  pointButton.show();
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
      "green",  // Use green color for inhibitors
      follow,
      true  // isInhibitor flag
    ));
  }
}

function updateInhibitorCount(targetCount) {
  let currentInhibitorCount = particles.filter(p => p.isInhibitor).length;
  
  if (targetCount > currentInhibitorCount) {
    // Add more inhibitor balls
    addInhibitorBalls(targetCount - currentInhibitorCount);
  } else if (targetCount < currentInhibitorCount) {
    // Remove excess inhibitor balls
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



// Mapping function for inhibitor slider values
function mapInhibitorSliderValue(value) {
  return map(value, 3, 100, -12, 12);
}

function scaleAverageFrequency(avgFreq) {
  let scalingFactor = 10 / maxObservedAvgFreq;
  return avgFreq * scalingFactor;
}
