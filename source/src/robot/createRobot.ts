import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { RobotProfile } from './functions';
import { defaultAppearance } from './appearance';
import type { RobotAppearance } from './appearance';
import { CharacterAnimation } from './characterAnimation';
import type { PointerAttention } from './pointerAttention';
import { createEyeLens } from './expressiveEyes';

export function createRobot(scene: Scene) {
  function material(name: string, hex: string, emissive = false) {
    const result = new StandardMaterial(name, scene);
    result.diffuseColor = Color3.FromHexString(hex);
    result.specularColor = new Color3(0.15, 0.15, 0.15);
    if (emissive) result.emissiveColor = result.diffuseColor.scale(0.65);
    return result;
  }

  const shell = material('body-shell', '#6ed5bc');
  const dark = material('dark-joints', '#173e45');
  const eyes = material('warm-light', '#ffe6a5', true);
  const robot = new TransformNode('artbot', scene);
  const characterRig = new TransformNode('character-rig', scene);
  characterRig.parent = robot;
  const upperBody = new TransformNode('upper-body', scene);
  upperBody.parent = characterRig;
  upperBody.position.y = 1.05;
  let appearance = defaultAppearance();
  let visionEnabled = true;
  let attention: PointerAttention = { x: 0, y: 0, amount: 0 };

  function box(name: string, size: [number, number, number], position: [number, number, number], surface = shell) {
    const mesh = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
    mesh.position = new Vector3(...position);
    mesh.material = surface;
    mesh.parent = upperBody;
    return mesh;
  }

  let body = box('body', [1.5, 1.5, 0.85], [0, 0.85, 0]);
  const headRig = new TransformNode('head-rig', scene);
  headRig.parent = upperBody;
  headRig.position.y = 2.25;
  function headPart<T extends ReturnType<typeof box>>(mesh: T): T {
    mesh.parent = headRig;
    mesh.position.y -= 2.25;
    return mesh;
  }
  let head = box('head', [1.7, 1, 1], [0, 2.25, 0]);
  headPart(head);
  headPart(box('face', [1.15, 0.62, 0.08], [0, 2.25, -0.53], dark));
  const eyeRigs = [-1, 1].map(side => {
    const lens = createEyeLens(side < 0 ? 'left-eye' : 'right-eye', scene);
    const eye = lens.mesh;
    eye.parent = headRig; eye.position.set(side * .3, .06, -.625); eye.material = eyes;
    const rim = createEyeLens(`eye-rim-${side}`, scene);
    rim.mesh.parent = eye; rim.mesh.position.z = .008;
    rim.mesh.scaling.set(1.15, 1.15, 1); rim.mesh.material = dark;
    const pupil = MeshBuilder.CreateSphere(`pupil-${side}`, { diameter: .135, segments: 16 }, scene);
    pupil.scaling.set(1, 1.08, .12); pupil.position.z = -.016; pupil.material = dark;
    pupil.parent = eye;
    const glint = MeshBuilder.CreateSphere(`eye-glint-${side}`, { diameter: .037, segments: 8 }, scene);
    glint.parent = pupil; glint.position.set(-.027, .027, -.075); glint.material = eyes;
    return { side, eye, lens, rim, pupil };
  });
  const brows = [-1, 1].map(side => headPart(box(`brow-${side}`, [.26, .035, .025], [side * .3, 2.56, -.59], eyes)));
  const mouth = headPart(box('mouth', [.18, .025, .025], [0, 2.08, -.59], eyes));
  const mouthCorners = [-1, 1].map(side => headPart(box(`mouth-corner-${side}`, [.025, .065, .025], [side * .1, 2.1, -.59], eyes)));
  const gasp = MeshBuilder.CreateSphere('gasp-mouth', { diameter: .17, segments: 12 }, scene);
  gasp.parent = headRig; gasp.position.set(0, -.17, -.59); gasp.scaling.z = .15; gasp.material = eyes;
  gasp.setEnabled(false);
  const accents = [-1, 0, 1].map((side, i) => {
    const points = Array.from({ length: 9 }, (_, j) => {
      const angle = j * Math.PI / 4;
      const radius = j % 2 ? .04 : .14;
      return new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    });
    const star = MeshBuilder.CreateLines(`expression-star-${i}`, { points }, scene);
    star.parent = headRig; star.position.set(side * 1.2, side ? .45 : .8, -.65);
    star.color = Color3.FromHexString('#ffe6a5'); star.isPickable = false; star.setEnabled(false);
    return star;
  });
  box('chest-light', [0.4, 0.25, 0.08], [0, 0.85, -0.47], eyes);
  box('neck', [0.4, 0.3, 0.4], [0, 1.65, 0], dark);
  const shoulders = [-1, 1].map(side => {
    const pivot = new TransformNode(`shoulder-${side}`, scene);
    pivot.parent = upperBody; pivot.position.set(side * 1.05, 1.45, 0);
    const arm = box(`arm-${side}`, [.35, 1.1, .4], [0, -.55, 0]);
    arm.parent = pivot;
    return pivot;
  });
  const antennaRig = new TransformNode('antenna-rig', scene);
  antennaRig.parent = headRig; antennaRig.position.y = .495;
  const antenna = headPart(box('antenna', [0.08, 0.35, 0.08], [0, 2.92, 0], dark));
  antenna.parent = antennaRig; antenna.position.y = .175;
  const tip = MeshBuilder.CreateSphere('antenna-tip', { diameter: 0.22, segments: 12 }, scene);
  tip.position.y = 3.16;
  tip.parent = upperBody;
  tip.material = eyes;
  headPart(tip);
  tip.parent = antennaRig; tip.position.y = .415;

  const chassis = box('wheel-chassis', [1.5, 0.28, 1.25], [0, 0.9, 0], dark);
  chassis.parent = robot;
  const tyres = material('rubber-tyres', '#263b42');
  const hubs = material('wheel-hubs', '#b4cac3');
  const wheelParts: ReturnType<typeof box>[] = [];
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    const wheel = MeshBuilder.CreateCylinder(`wheel-${side}-${end}`, { diameter: 0.7, height: 0.3, tessellation: 32 }, scene);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.8, 0.6, end * 0.45);
    wheel.parent = robot;
    wheel.material = tyres;
    const hub = MeshBuilder.CreateCylinder(`hub-${side}-${end}`, { diameter: 0.3, height: 0.04, tessellation: 24 }, scene);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(side * 0.97, 0.6, end * 0.45);
    hub.parent = robot;
    hub.material = hubs;
    wheelParts.push(wheel, hub);
    // Contrasting spokes make the rotation readable on otherwise uniform cylinders.
    for (const spoke of [0, 1]) {
      const mesh = MeshBuilder.CreateBox(`wheel-spoke-${side}-${end}-${spoke}`, { width: spoke ? 0.035 : 0.25, height: 0.012, depth: spoke ? 0.25 : 0.035 }, scene);
      mesh.parent = hub;
      mesh.position.y = -side * 0.026;
      mesh.material = tyres;
    }
  }

  function setProfile(profile: RobotProfile) {
    visionEnabled = profile.enabledFunctions.includes('vision');
    const abilities = profile.effectiveAbilities;
    // Keep the profile on the robot, ready for navigation and journey data consumers.
    robot.metadata = { ...robot.metadata, abilities: { ...profile.abilities }, effectiveAbilities: { ...abilities }, enabledFunctions: [...profile.enabledFunctions] };
    for (const eye of ['left-eye', 'right-eye']) scene.getMeshByName(eye)!.material = profile.enabledFunctions.includes('vision') ? eyes : dark;
    tip.material = profile.enabledFunctions.includes('hearing') ? eyes : dark;
    scene.getMeshByName('chest-light')!.material = profile.enabledFunctions.includes('memory') ? eyes : dark;
    for (const side of [-1, 1]) {
      const arm = scene.getMeshByName(`arm-${side}`)!;
      arm.scaling.y = 0.7 + abilities.reach / 100 * 0.6;
      arm.position.y = -.55 * arm.scaling.y;
      shoulders[side < 0 ? 0 : 1]!.position.x = side * (0.95 + abilities.reach / 100 * 0.4);
      const track = 0.75 + abilities.balance / 100 * 0.25;
      for (const end of [-1, 1]) {
        scene.getMeshByName(`wheel-${side}-${end}`)!.position.x = side * track;
        scene.getMeshByName(`hub-${side}-${end}`)!.position.x = side * (track + 0.17);
      }
    }

  }

  function setAppearance(value: RobotAppearance) {
    appearance = value;
    shell.diffuseColor = Color3.FromHexString(value.colour.hex);
    function createShell(name: string, width: number, height: number, depth: number, y: number) {
      const mesh = value.shape === 'rounded'
        ? MeshBuilder.CreateSphere(name, { diameterX: width, diameterY: height, diameterZ: depth, segments: 24 }, scene)
        : value.shape === 'cylinder'
          ? MeshBuilder.CreateCylinder(name, { diameter: width, height, tessellation: 32 }, scene)
          : MeshBuilder.CreateBox(name, { width, height, depth }, scene);
      if (value.shape === 'cylinder') mesh.scaling.z = depth / width;
      mesh.position.y = y;
      mesh.parent = upperBody;
      mesh.material = shell;
      if (name === 'head') headPart(mesh);
      return mesh;
    }
    body.dispose();
    head.dispose();
    body = createShell('body', 1.5, 1.5, 0.85, 0.85);
    head = createShell('head', 1.7, 1, 1, 2.25);
    upperBody.scaling.set(value.width, value.height, value.depth);
    robot.metadata = { ...robot.metadata, appearance: { ...value, colour: { ...value.colour } }, locomotion: 'wheels' };

  }

  setAppearance(appearance);
  let travelPhase = 0;
  let speaking = false, speechPhase = 0;
  const characterAnimation = new CharacterAnimation();
  function animateTravel(distance: number, seconds: number, reducedMotion = false, paused = false, turnAngle = 0) {
    if (!Number.isFinite(distance) || !Number.isFinite(seconds) || distance < 0 || seconds <= 0) return;
    if (paused) return;
    const moving = distance > 1e-8;
    travelPhase = (travelPhase + distance * Math.PI * 2 / 1.5) % (Math.PI * 2);
    const wheelTurn = distance / (0.35 * Math.max(0.01, Math.abs(robot.scaling.x)));
    for (const [index, part] of wheelParts.entries()) {
      // Opposite sides roll in opposite directions during a pivot.
      const pivotTurn = turnAngle * wheelParts[index - index % 2]!.position.x / .35;
      part.rotation.x = (part.rotation.x - wheelTurn - pivotTurn) % (Math.PI * 2);
    }
    const blend = 1 - Math.exp(-seconds * 14);
    const bob = moving && !reducedMotion ? Math.sin(travelPhase) * 0.075 : 0;
    const tilt = moving && !reducedMotion ? Math.cos(travelPhase) * 0.025 : 0;
    const pose = characterAnimation.tick(seconds, moving, reducedMotion);
    if (speaking && !reducedMotion) {
      speechPhase += seconds;
      pose.mouthOpen = .1 + Math.abs(Math.sin(speechPhase * 13) * Math.cos(speechPhase * 3)) * .85;
      pose.headTilt += Math.sin(speechPhase * 3) * .045;
      pose.brow += Math.sin(speechPhase * 2) * .08;
    }
    const notice = visionEnabled ? attention.amount : 0;
    if (!reducedMotion) {
      pose.headYaw = pose.headYaw * (1 - notice * .65) - attention.x * notice * .4;
      pose.headTilt -= attention.y * notice * .22;
    }
    pose.eyeWidth *= 1 + notice * .12;
    // Compensate squash on the other axes, preserving the authored body proportions.
    const width = 1 / Math.sqrt(pose.stretch);
    characterRig.scaling.set(width, pose.stretch, width);
    characterRig.position.y = pose.lift;
    characterRig.rotation.set(pose.lean, pose.twist, 0);
    headRig.position.y += (2.25 + bob + pose.headLift - headRig.position.y) * blend;
    headRig.rotation.x += (tilt + pose.headTilt - headRig.rotation.x) * blend;
    headRig.rotation.y += (pose.headYaw - headRig.rotation.y) * blend;
    headRig.scaling.set(1 / Math.sqrt(pose.headStretch), pose.headStretch, 1 / Math.sqrt(pose.headStretch));
    shoulders.forEach((shoulder, i) => {
      const side = i ? 1 : -1;
      const swing = moving && !reducedMotion ? Math.sin(travelPhase + i * Math.PI) * .12 : 0;
      shoulder.rotation.z += (side * (pose.arms + pose.armWave * side) - shoulder.rotation.z) * blend;
      shoulder.rotation.x += (swing - shoulder.rotation.x) * blend;
    });
    antennaRig.rotation.z += (pose.antenna - antennaRig.rotation.z) * blend;
    eyeRigs.forEach(({ side, eye, lens, rim, pupil }) => {
      const asymmetry = pose.eyeAsymmetry + notice * .08;
      const lid = pose.eyeLid, curve = pose.eyeCurve;
      // Mirrored lid slopes raise the inner corners when worried, like binocular eyes.
      const slant = -side * lid * .8;
      lens.reshape(lid, curve, slant); rim.reshape(lid, curve, slant);
      eye.scaling.set(pose.eyeWidth * (1 + side * asymmetry * .2), Math.max(.04, pose.eyeHeight * (1 + side * asymmetry)), 1);
      eye.rotation.z = side * pose.eyeTilt;
      eye.position.y = .06 + side * asymmetry * .045;
      pupil.position.x = attention.x * notice * .045;
      pupil.position.y = -lid * .025 + curve * .045 - attention.y * notice * .035;
      pupil.setEnabled(visionEnabled && curve < .5 && pose.eyeHeight > .15);
    });
    brows.forEach((brow, i) => {
      brow.rotation.z = (i ? 1 : -1) * pose.brow;
      brow.position.y = .31 + Math.max(0, pose.eyeHeight - 1) * .14;
    });
    mouthCorners.forEach(corner => { corner.position.y = -.17 + pose.smile * .032; corner.scaling.y = Math.abs(pose.smile); });
    const open = pose.mouthOpen > .15;
    mouth.setEnabled(!open); mouthCorners.forEach(corner => corner.setEnabled(!open));
    gasp.setEnabled(open); gasp.scaling.y = 1 + pose.mouthOpen;
    accents.forEach((star, i) => {
      star.setEnabled(pose.accent > .12);
      star.alpha = pose.accent;
      star.scaling.setAll(.6 + pose.accent * .7);
      star.rotation.z = pose.accent * (i % 2 ? -.6 : .6);
    });
  }
  return { robot, setProfile, setAppearance, animateTravel, characterAnimation, setSpeaking(value: boolean) { speaking = value; }, setAttention(value: PointerAttention) { attention = { ...value }; } };
}
