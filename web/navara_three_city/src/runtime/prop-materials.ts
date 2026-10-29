import {
  CanvasTexture,
  Color,
  DataTexture,
  LinearFilter,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  ShaderMaterial,
  type Texture,
} from "three";

import type { CityUniforms } from "../materials/programs";

export function vendingTexture(): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas2D is required for city props");
  context.fillStyle = "#f4f4f0";
  context.fillRect(0, 0, 128, 256);
  context.fillStyle = "#dfe6ea";
  context.fillRect(8, 10, 112, 150);
  const drinks = [
    "#c8102e",
    "#f2a900",
    "#1d6fb8",
    "#2e8b57",
    "#111",
    "#e85d04",
    "#fff",
    "#7b2d8b",
    "#6b3e26",
  ];
  for (let row = 0; row < 3; row += 1)
    for (let column = 0; column < 9; column += 1) {
      context.fillStyle = drinks[(column * 7 + row * 4) % drinks.length];
      context.fillRect(12 + column * 12, 16 + row * 50, 8, 30);
      context.fillStyle = "#333";
      context.fillRect(12 + column * 12, 48 + row * 50, 8, 4);
      context.fillStyle = column % 3 ? "#2a6cff" : "#e03131";
      context.fillRect(13 + column * 12, 53 + row * 50, 6, 3);
    }
  context.fillStyle = "#c9c9c4";
  context.fillRect(8, 168, 112, 30);
  context.fillStyle = "#222";
  context.fillRect(84, 174, 28, 18);
  context.fillRect(20, 212, 88, 26);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createPropMetalMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.7,
    metalness: 0.1,
  });
}

export function createVendingMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    roughness: 0.5,
    metalness: 0.2,
  });
}

export function createVendingPanelMaterial(
  uniforms: CityUniforms,
  texture: Texture,
): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ map: texture });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = uniforms.uNight;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uNight;")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
diffuseColor.rgb *= 0.85 + 1.1 * uNight;`,
      );
  };
  material.customProgramCacheKey = () => "navara-city-vending-panel-v1";
  return material;
}

export function createLampHeadMaterial(
  uniforms: CityUniforms,
  park: boolean,
): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ color: 0xfff2d8 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = uniforms.uNight;
    shader.uniforms.uStrength = park
      ? uniforms.uParkLights
      : uniforms.uStreetLights;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uNight;\nuniform float uStrength;",
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.rgb *= 0.35 + 4.5 * uNight * uStrength;",
      );
  };
  material.customProgramCacheKey = () =>
    `navara-city-lamp-head-v4-${park ? "park" : "street"}`;
  return material;
}

export function createSignalLensMaterial(
  uniforms: CityUniforms,
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: uniforms.uTime },
    vertexShader: /* glsl */ `
      attribute vec2 aLens;
      varying vec2 vLens;
      varying vec2 vUv;
      varying vec3 vLensView;
      void main() {
        vLens = aLens;
        vUv = uv;
        vec4 viewPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vLensView = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vLens;
      varying vec2 vUv;
      varying vec3 vLensView;
      void main() {
        vec3 fdx = dFdx(vLensView), fdy = dFdy(vLensView);
        vec3 normal = normalize(cross(fdx, fdy));
        if (normal.z < 0.0) normal = -normal;
        float t = mod(uTime + vLens.y * 32.0, 64.0);
        float state = t < 27.0 ? 0.0 : t < 30.0 ? 1.0 : 2.0;
        float on = 1.0 - step(0.5, abs(state - vLens.x));
        vec3 c = vLens.x < 0.5 ? vec3(0.0, 1.0, 0.62) : vLens.x < 1.5 ? vec3(1.0, 0.7, 0.0) : vec3(1.0, 0.08, 0.05);
        float d = length(vUv - 0.5) * 2.0;
        if (d > 1.0) discard;
        gl_FragColor = vec4(c * mix(0.06, 2.6, on) * (1.0 - 0.35 * d), 1.0);
      }`,
  });
}

const POOL_REACH = 2.6;

export function glowTexture(): Texture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const edge = (1 + POOL_REACH ** 2) ** -1.5;
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      const distance =
        Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const value =
        distance >= 1
          ? 0
          : Math.max(
              0,
              ((1 + (POOL_REACH * distance) ** 2) ** -1.5 - edge) / (1 - edge),
            );
      data.set(
        [value * 255, value * 255, value * 255, 255],
        (y * size + x) * 4,
      );
    }
  const texture = new DataTexture(data, size, size);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function applyPoolColor(
  material: MeshBasicMaterial,
  uniforms: CityUniforms,
  tint: [number, number, number],
  park: boolean,
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = uniforms.uNight;
    shader.uniforms.uStrength = park
      ? uniforms.uParkLights
      : uniforms.uStreetLights;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uNight;\nuniform float uStrength;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
diffuseColor.rgb *= vec3(${tint[0]}, ${tint[1]}, ${tint[2]}) * uNight * uStrength;`,
      );
  };
  material.customProgramCacheKey = () =>
    `navara-city-lamp-pool-v1-${park ? "park" : tint.join("-")}`;
}

export function vendingBodyColor(variant: number): Color {
  const bodies = [
    [0.92, 0.92, 0.9],
    [0.75, 0.1, 0.12],
    [0.12, 0.3, 0.62],
    [0.9, 0.86, 0.72],
  ];
  const [r, g, b] = bodies[variant % bodies.length];
  return new Color().setRGB(r, g, b, SRGBColorSpace);
}
