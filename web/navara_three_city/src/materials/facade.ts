import { DataTexture, MeshStandardMaterial, type Texture } from "three";

import type { CityTextureSet } from "../runtime/textures";

import type { CityUniforms } from "./programs";

const NOISE = `
float cityHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float cityNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cityHash(i), cityHash(i + vec2(1.0, 0.0)), f.x),
    mix(cityHash(i + vec2(0.0, 1.0)), cityHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float cityBox(float x, float a, float b, float w) {
  return smoothstep(a - w, a + w, x) - smoothstep(b - w, b + w, x);
}
vec3 cityHue(float h) {
  return clamp(abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
}
`;

const FRAGMENT = `
{
  gN = cityLocalNormal(vCityNormal);
  gT = abs(gN.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : normalize(cross(vec3(0.0, 1.0, 0.0), gN));
  gB = cross(gN, gT);
  float seed = vFacade.w, height = vBldg.x, kind = vBldg.z, cellW = vBldg.w;
  float layer = floor(vBldg.y / 8.0 + 0.01), cat = vBldg.y - layer * 8.0;
  float u = vFacade.x, v = vFacade.y, floorH = vFacade.z;
  vec2 st = vec2(dot(vCityLocal, gT), dot(vCityLocal, gB));
  vec3 tuv = vec3(st / uWallScale[int(layer)], layer);
  vec3 wall = diffuseColor.rgb * mix(vec3(1.0), texture(uWallAlb, tuv).rgb * 2.0, uWallDetail[int(layer)]);
  wall *= 0.9 + 0.2 * cityNoise(st * 0.11 + seed * 50.0);
  gNm = normalize(vec3((texture(uWallNor, tuv).xy * 2.0 - 1.0) * 0.7, texture(uWallNor, tuv).z * 2.0 - 1.0));
  gRough = 0.82; gMetal = 0.0; gEmissive = vec3(0.0); gGlint = vec3(0.0);
  if (layer > 3.5 && layer < 4.5) { gRough = 0.5; gMetal = 0.35; }
  if (kind < 0.5 || (kind > 1.5 && kind < 2.5)) {
    float streak = cityNoise(vec2(st.x * 2.2, st.y * 0.13 + seed * 40.0));
    float grime = smoothstep(0.55, 0.95, streak) * 0.1 + (1.0 - smoothstep(0.0, 1.6, v)) * 0.1
      + smoothstep(height - 2.5, height, v) * streak * 0.14;
    wall *= 1.0 - grime;
  }
  diffuseColor.rgb = wall;
  if (kind < 0.5 && cellW > 0.5) {
    float fyAll = v / floorH, row = floor(fyAll), col = floor(u);
    float sid = floor(seed * 4096.0 + 0.5);
    vec2 room = vec2(col + mod(sid, 61.0) * 17.0, row + mod(sid, 53.0) * 13.0);
    float fx = fract(u), fy = fract(fyAll);
    // Clamp the filter width so the window pattern never fully dissolves at
    // distance: beyond ~one cell per pixel, plain fwidth lets cityBox fade to 0
    // and the facade goes blank. Capping w keeps windows visible far away at
    // the cost of slight aliasing, which is preferable to losing them.
    float wx = clamp(fwidth(u), 1e-4, 0.4), wy = clamp(fwidth(fyAll), 1e-4, 0.4);
    float far = 0.0; // windows stay detailed at every distance (sub-pixel fade disabled)
    vec4 r = vec4(0.14, 0.86, 0.3, 0.82);
    if (cat < 0.5) r = vec4(0.26, 0.74, 0.36, 0.78);
    else if (cat > 3.5 && cat < 4.5) r = vec4(0.16, 0.84, 0.3, 0.8);
    else if (cat > 4.5) r = vec4(0.0, 1.0, 0.26, 1.0);
    bool shop = row < 0.5 && cat > 1.5 && cat < 3.5;
    if (shop) r = vec4(0.05, 0.95, 0.03, 0.8);
    float valid = step(0.0, v) * step(v, height - 0.9);
    if (cat < 2.5 && !shop) valid *= step(0.2, cityHash(room + 41.0));
    float inWin = cityBox(fx, r.x, r.y, wx) * cityBox(fy, r.z, r.w, wy) * valid;
    vec2 wmin = vec2(r.x * cellW, r.z * floorH), wmax = vec2(r.y * cellW, r.w * floorH);
    vec2 pm = vec2(fx * cellW, fy * floorH);
    float edge = min(min(pm.x - wmin.x, wmax.x - pm.x), min(pm.y - wmin.y, wmax.y - pm.y));
    float fw = cat > 4.5 ? 0.045 : 0.065, ew = max(fwidth(edge), 1e-4);
    float frame = 1.0 - smoothstep(fw - ew, fw + ew, edge);
    float panes = max(1.0, floor((wmax.x - wmin.x) / 1.25 + 0.5));
    float mx = fract((pm.x - wmin.x) / (wmax.x - wmin.x) * panes);
    float mw = 0.03 * panes / (wmax.x - wmin.x);
    frame = max(frame, panes > 1.5 ? 1.0 - cityBox(mx, mw, 1.0 - mw, max(fwidth(mx), 1e-4)) : 0.0);
    frame *= 1.0 - far;
    float pane = inWin * (1.0 - frame);
    vec3 rawV = normalize(vCityWorld - cameraPosition);
    vec3 V = vec3(dot(rawV, uCityEast), dot(rawV, uCityUp), -dot(rawV, uCityNorth));
    vec3 rd = vec3(dot(V, gT) / cellW, dot(V, gB) / floorH, dot(V, gN) / 4.5) + vec3(1e-5, 1e-5, 0.0);
    vec3 ro = vec3(fx, fy, 0.0);
    vec2 tA = (step(0.0, rd.xy) - ro.xy) / rd.xy;
    float tz = -1.0 / min(rd.z, -1e-4), tHit = min(min(tA.x, tA.y), tz);
    vec3 hp = ro + rd * tHit;
    float rh = cityHash(room);
    vec3 interior = mix(vec3(0.74, 0.69, 0.6), vec3(0.6, 0.63, 0.68), rh);
    float shade = 0.62;
    if (tHit == tz) shade = 0.5 + 0.28 * step(0.42, hp.y);
    else if (tHit == tA.y) shade = rd.y > 0.0 ? 1.0 : 0.38;
    interior *= shade * mix(1.0, 0.5, clamp(-hp.z, 0.0, 1.0));
    float blind = step(0.5, cityHash(room + 7.7)) * cityHash(room + 3.1);
    float wyLocal = (fy - r.z) / (r.w - r.z);
    if (!shop && wyLocal > 1.0 - blind * 0.85) interior = mix(vec3(0.8, 0.78, 0.72), vec3(0.68, 0.7, 0.74), rh) * 0.75;
    interior = mix(interior, vec3(0.42, 0.42, 0.4), far);
    float onRate = shop ? 0.75 : cat > 2.5 ? 0.32 : 0.22;
    float b1 = fract(seed * 11.7), b2 = fract(seed * 17.3), b3 = fract(seed * 23.9);
    onRate *= mix(0.35, 1.9, b1);
    if (!shop && cat > 2.5 && b2 > 0.4) onRate = mix(0.05, 0.9, step(0.5, cityHash(vec2(row * 3.0 + mod(sid, 37.0), mod(sid, 53.0)))));
    float tall = smoothstep(70.0, 110.0, height);
    if (!shop) onRate = mix(onRate, 0.02 + 0.8 * step(0.9, cityHash(vec2(row * 5.0 + mod(sid, 41.0), mod(sid, 59.0)))), tall);
    onRate = clamp(onRate, 0.0, 0.95);
    float on = step(1.0 - onRate, cityHash(room + 23.0));
    float fickle = step(1.0 - uWindowLife.x, cityHash(room + 31.0));
    float period = 90.0 + 240.0 * cityHash(room + 37.0);
    float clock = uWindowLife.y / period + cityHash(room + 41.0) * 64.0;
    float slot = floor(clock);
    vec2 was = vec2(mod(slot - 1.0, 61.0) * 7.13, mod(slot - 1.0, 47.0) * 3.71);
    vec2 now = vec2(mod(slot, 61.0) * 7.13, mod(slot, 47.0) * 3.71);
    float lit = mix(step(1.0 - onRate, cityHash(room + 43.0 + was)), step(1.0 - onRate, cityHash(room + 43.0 + now)), smoothstep(0.0, 4.0 / period, fract(clock)));
    on = mix(on, lit, fickle);
    float tint = cityHash(room + 61.0), office = step(2.5, cat);
    vec3 warm = mix(vec3(1.0, 0.6, 0.3), vec3(1.0, 0.82, 0.6), cityHash(room + 67.0));
    vec3 cool = mix(vec3(1.0, 0.95, 0.86), mix(vec3(0.78, 0.9, 1.0), vec3(0.42, 0.66, 1.0), uNightBlue), cityHash(room + 71.0));
    float coolShare = mix(0.25, mix(0.12, 0.95, step(0.35, b2)), office) + 0.45 * uNightBlue;
    vec3 lamp = mix(warm, cool, step(1.0 - coolShare, mix(tint, 0.5 * b3 + 0.5 * tint, office)));
    lamp = mix(lamp, vec3(0.3, 0.55, 1.0), step(0.93 - 0.22 * uNightBlue, tint) * mix(1.0 - office, 1.0, uNightBlue));
    float glow = mix(0.3, 1.35, cityHash(room + 1.3)) * mix(0.65, 1.25, b3);
    vec3 glassTint = cat > 4.5 ? mix(vec3(0.2, 0.3, 0.38), vec3(0.3, 0.33, 0.34), fract(seed * 5.7)) : vec3(0.1, 0.11, 0.12);
    vec3 frameCol = fract(seed * 3.3) < 0.5 ? vec3(0.16, 0.17, 0.18) : vec3(0.62, 0.63, 0.63);
    diffuseColor.rgb = mix(diffuseColor.rgb, frameCol, inWin * frame);
    diffuseColor.rgb = mix(diffuseColor.rgb, glassTint, pane);
    gRough = mix(gRough, 0.45, inWin * frame); gRough = mix(gRough, 0.05, pane); gMetal = mix(gMetal, 0.92, pane);
    gNm = mix(gNm, normalize(vec3((cityHash(room + 5.1) - 0.5) * 0.008, (cityHash(room + 9.4) - 0.5) * 0.008, 1.0)), inWin);
    float daylight = (1.0 - uNight) * (shop ? 0.3 : cat > 4.5 ? 0.06 : 0.12);
    vec2 inPane = vec2((fx - r.x) / (r.y - r.x), (fy - r.z) / (r.w - r.z));
    vec2 lampAt = vec2(0.25 + 0.5 * cityHash(room + 12.1), 0.55 + 0.35 * cityHash(room + 14.9));
    float fall = mix(1.0, 0.32 + 0.95 * exp(-3.2 * dot(inPane - lampAt, inPane - lampAt)), uSoft);
    float curtain = step(0.52, cityHash(room + 16.3)) * uSoft * (shop ? 0.0 : 1.0);
    vec3 cloth = mix(vec3(0.95, 0.82, 0.62), vec3(0.85, 0.86, 0.84), cityHash(room + 18.7)) * 0.42;
    vec3 soft = mix(lamp, mix(vec3(1.0, 0.8, 0.58), lamp, 0.45), uSoft);
    vec3 room3 = mix(interior * fall, cloth * (0.75 + 0.35 * fall), curtain);
    float power = uNight * on * glow * mix(1.25, 0.78, uSoft) * uRoomLight;
    gEmissive = pane * (interior * daylight + room3 * soft * power);
    vec3 sunLocal = vec3(dot(uCitySunDirection, uCityEast), dot(uCitySunDirection, uCityUp), -dot(uCitySunDirection, uCityNorth));
    float sunAltitude = max(dot(uCitySunDirection, uCityUp), 0.0);
    vec3 sunGlint = vec3(1.0, 0.92, 0.78) * sunAltitude * 1.4;
    vec3 wobble = vec3(cityNoise(st * 0.8 + seed * 9.0) - 0.5, cityNoise(st * 0.8 + 31.0 + seed * 9.0) - 0.5, 0.0) * 0.035;
    vec3 paneN = normalize(gT * (gNm.x + wobble.x) + gB * (gNm.y + wobble.y) + gN * gNm.z);
    float sunMirror = max(dot(reflect(V, paneN), sunLocal), 0.0);
    gGlint = pane * sunGlint * (pow(sunMirror, 1400.0) * 14.0 + pow(sunMirror, 90.0) * 0.35 + pow(sunMirror, 7.0) * 0.1) * step(0.0, dot(gN, sunLocal));
    gGlint += pane * uCityGlass * sunGlint * 0.035 * max(dot(paneN, sunLocal), 0.0) * (0.6 + 0.8 * cityHash(room + 15.7));
    float graze = pow(1.0 - max(dot(-V, gN), 0.0), 3.0);
    gEmissive += pane * uCityGlass * (1.0 - uNight) * vec3(0.45, 0.6, 0.82) * (0.015 + 0.22 * graze) * (0.7 + 0.6 * cityHash(room + 19.3));
    float spill = uSoft * (1.0 - far) * valid * power * 0.16;
    gEmissive += soft * spill * (inWin * frame * 0.6 + (1.0 - inWin) * exp(min(edge, 0.0) * 4.5) * step(-0.9, edge));
    float pickA = fract(seed * 31.7), hue = fract(seed * 47.3);
    float accent = tall * step(0.7 - 0.45 * uNightBlue, pickA) * uNight;
    vec3 accentCol = hue < 0.42 ? vec3(0.12, 0.38, 1.0) : hue < 0.76 ? vec3(1.0, 0.72, 0.16) : hue < 0.89 ? vec3(0.1, 0.85, 1.0) : vec3(0.75, 0.3, 1.0);
    gEmissive = mix(gEmissive, accentCol * dot(gEmissive, vec3(0.9)), accent * 0.8);
    if (tall > 0.0 && uNight > 0.01 && uNightCityGlass > 0.0) {
      vec3 cityN = normalize(gT * gNm.x + gB * gNm.y + gN * gNm.z);
      vec3 reflected = reflect(V, cityN);
      float fresnel = 0.1 + 0.9 * pow(1.0 - max(dot(-V, cityN), 0.0), 4.0);
      vec3 city = vec3(0.0);
      vec3 p = V + gN * 0.1;
      p.xz /= max(0.2, -p.y);
      float reach = max(-p.z * 80.0, 0.0);
      for (int i = 0; i < 8; i++) {
        p += reflected * 32.0;
        vec2 cell = floor(p.xz / 26.0);
        vec2 at = vec2(cityHash(cell + 3.1), cityHash(cell + 7.7));
        float d = length(fract(p.xz / 26.0) - at) * 26.0;
        float kind = cityHash(cell + 13.0);
        float spot = exp(-d * d / (3.0 + reach * 0.03)) * step(0.3, kind);
        vec3 tintC = kind > 0.8 - 0.3 * uNightBlue ? mix(vec3(0.8, 0.9, 1.0), vec3(0.4, 0.65, 1.0), uNightBlue) : kind > 0.42 && kind < 0.5 ? vec3(1.0, 0.25, 0.2) : vec3(1.0, 0.72, 0.42);
        city = tintC * spot * 5.0 / (1.0 + reach * reach / 4.0e5);
        city += vec3(1.0, 0.75, 0.5) * 0.035 * smoothstep(0.0, 900.0, reach);
      }
      gEmissive += city * fresnel * pane * tall * uNight * uNightCityGlass * (1.0 - on * 0.9);
    }
    diffuseColor.rgb *= 1.0 - 0.35 * inWin * (1.0 - smoothstep(0.0, 0.18, wmax.y - pm.y)) * (1.0 - far);
    if (shop) {
      float sign = cityBox(fy, 0.84, 0.985, wy) * cityBox(fx, 0.03, 0.97, wx) * valid * step(0.25, cityHash(room + 57.0));
      vec3 sc = mix(cityHue(cityHash(room + 71.0)), vec3(0.95), 0.35 * step(0.6, cityHash(room + 83.0)));
      diffuseColor.rgb = mix(diffuseColor.rgb, sc * 0.75, sign);
      gEmissive += sign * sc * uNight * 1.6; gRough = mix(gRough, 0.4, sign);
    }
  }
}
`;

const NO_PHOTO = new DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);

const PHOTO_MAIN = /* glsl */ `
{
  vec3 photo = texture2D(uPhoto, vPhoto).rgb;
  float k = uPhotoOn * uPhotoMix * step(0.0, vPhoto.x)
    * smoothstep(uPhotoRange.x, uPhotoRange.y, distance(cameraPosition, vCityWorld));
  diffuseColor.rgb = mix(diffuseColor.rgb, photo * 1.12, k);
  gRough = mix(gRough, 0.85, k);
  gMetal *= 1.0 - k;
}
`;

export function createFacadeMaterial(
  uniforms: CityUniforms,
  textures: CityTextureSet,
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
  });
  NO_PHOTO.needsUpdate = true;
  const userData = material.userData as {
    photo?: { value: Texture };
    photoOn?: { value: number };
  };
  userData.photo = { value: NO_PHOTO };
  userData.photoOn = { value: 0 };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, {
      uPhoto: userData.photo,
      uPhotoOn: userData.photoOn,
      uWallAlb: { value: textures.albedo },
      uWallNor: { value: textures.normal },
      uWallScale: { value: textures.scales },
      uWallDetail: { value: textures.details },
    });
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec3 aLocal; attribute vec4 aFacade; attribute vec4 aBldg; attribute vec2 aPhoto;
varying vec3 vCityLocal; varying vec3 vCityWorld; varying vec3 vCityNormal;
varying vec4 vFacade; varying vec4 vBldg; varying vec2 vPhoto;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vCityLocal = aLocal; vCityWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vCityNormal = normal; vFacade = aFacade; vBldg = aBldg; vPhoto = aPhoto;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uNight; uniform float uTime; uniform float uCityGlass;
uniform float uNightCityGlass;
uniform float uRoomLight; uniform float uSoft; uniform float uNightBlue;
uniform sampler2D uPhoto; uniform float uPhotoOn; uniform vec2 uPhotoRange; uniform float uPhotoMix;
uniform vec2 uWindowLife;
uniform vec3 uCityEast; uniform vec3 uCityNorth; uniform vec3 uCityUp;
uniform vec3 uCitySunDirection;
uniform sampler2DArray uWallAlb; uniform sampler2DArray uWallNor;
uniform float uWallScale[6]; uniform float uWallDetail[6];
varying vec3 vCityLocal; varying vec3 vCityWorld; varying vec3 vCityNormal;
varying vec4 vFacade; varying vec4 vBldg; varying vec2 vPhoto;
float gRough; float gMetal; vec3 gEmissive; vec3 gGlint; vec3 gT; vec3 gB; vec3 gN; vec3 gNm;
vec3 cityLocalNormal(vec3 n) { return normalize(vec3(dot(n, uCityEast), dot(n, uCityUp), -dot(n, uCityNorth))); }
${NOISE}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>\n${FRAGMENT}\n${PHOTO_MAIN}`,
      )
      .replace(
        "#include <lights_fragment_begin>",
        "#include <lights_fragment_begin>\nreflectedLight.directSpecular += gGlint;",
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = gRough;",
      )
      .replace(
        "#include <metalnessmap_fragment>",
        "#include <metalnessmap_fragment>\nmetalnessFactor = gMetal;",
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
vec3 cityN = normalize(gT * gNm.x + gB * gNm.y + gN * gNm.z);
vec3 cityWorldN = uCityEast * cityN.x + uCityUp * cityN.y - uCityNorth * cityN.z;
normal = normalize((viewMatrix * vec4(cityWorldN, 0.0)).xyz);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
totalEmissiveRadiance += gEmissive;`,
      );
  };
  material.customProgramCacheKey = () => "navara-city-facade-v9";
  return material;
}
