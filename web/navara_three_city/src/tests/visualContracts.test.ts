import type { CityMeshData, CityTileData } from "@navaramap/worker";
import {
  DataArrayTexture,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Vector4,
} from "three";
import { describe, expect, it, vi } from "vitest";

import mirrorSource from "../effects/CityWaterMirrorEffectDesc.ts?raw";
import { createCityMaterials } from "../materials";
import groundSource from "../materials/ground.ts?raw";
import { createCityUniforms } from "../materials/programs";
import { createCityBackdrop } from "../runtime/backdrop";
import { CityLampLight } from "../runtime/lamplight";
import { updateDetailState } from "../runtime/lod";
import { PropLibrary } from "../runtime/props";
import { CityRtcFrame } from "../runtime/rtc";
import type { CityTextureSet } from "../runtime/textures";

function textureSet(layers: number): CityTextureSet {
  const albedo = new DataArrayTexture(new Uint8Array(4 * layers), 1, 1, layers);
  const normal = new DataArrayTexture(new Uint8Array(4 * layers), 1, 1, layers);
  return {
    albedo,
    normal,
    scales: Array.from({ length: layers }, () => 1),
    details: Array.from({ length: layers }, () => 0.5),
    dispose: () => {
      albedo.dispose();
      normal.dispose();
    },
  };
}

function emptyMesh(): CityMeshData {
  return {
    position: new Float32Array(),
    local: new Float32Array(),
    normal: new Float32Array(),
    color: new Float32Array(),
    layer: new Float32Array(),
    light: new Float32Array(),
    facade: new Float32Array(),
    building: new Float32Array(),
    photo: new Float32Array(),
    uv: new Float32Array(),
    index: new Uint32Array(),
  };
}

describe("city visual contracts", () => {
  it("builds the manifest sea as one RTC water disc and disposes it", () => {
    const wall = textureSet(6),
      ground = textureSet(4);
    const materials = createCityMaterials({
      wall,
      ground,
      dispose: () => {},
    });
    const rtc = new CityRtcFrame();
    expect(createCityBackdrop(rtc, materials, ground, false)).toBeUndefined();
    const backdrop = createCityBackdrop(rtc, materials, ground, true);
    if (!backdrop) throw new Error("sea backdrop missing");
    const mesh = backdrop.group.children[0];
    expect(mesh.name).toBe("city-sea-surface");
    if (!(mesh instanceof Mesh)) throw new Error("sea mesh missing");
    const geometry = mesh.geometry;
    expect(geometry.attributes.position.count).toBeGreaterThan(100);
    expect(geometry.attributes.aLayer.count).toBe(
      geometry.attributes.position.count,
    );
    const before = backdrop.water.sphere.center.clone();
    backdrop.update({ x: 800, z: -400 });
    expect(backdrop.water.sphere.center.distanceTo(before)).toBeGreaterThan(1);
    expect(() => backdrop.dispose()).not.toThrow();
    expect(backdrop.group.children.length).toBe(0);
    materials.dispose();
  });

  it("keeps tree and sign hysteresis independent", () => {
    expect(updateDetailState(false, 599, 600, 1.25)).toBe(true);
    expect(updateDetailState(true, 700, 600, 1.25)).toBe(true);
    expect(updateDetailState(true, 750, 600, 1.25)).toBe(false);
    expect(updateDetailState(false, 229, 230, 1.3)).toBe(true);
    expect(updateDetailState(true, 298, 230, 1.3)).toBe(true);
    expect(updateDetailState(true, 299, 230, 1.3)).toBe(false);
  });

  it("shares night and time uniforms across material paths", () => {
    const wall = textureSet(6),
      ground = textureSet(4);
    const materials = createCityMaterials({
      wall,
      ground,
      dispose: () => {
        wall.dispose();
        ground.dispose();
      },
    });
    materials.setNight(0.75);
    materials.setSeason(2);
    materials.setTime(12.5);
    materials.setWater({ amplitude: -1, speed: 0, roughness: 2 });
    materials.setNightLights({
      streetLights: 0,
      parkLights: 2,
      windowLight: 2.5,
      windowSoftness: 0.35,
      windowSpareRate: 0.3,
      nightCityGlass: 1.5,
      blueLights: 0.8,
    });
    materials.setOrtho(false);
    expect(materials.uniforms.uNight.value).toBe(0.75);
    expect(materials.uniforms.uTime.value).toBe(12.5);
    expect(materials.uniforms.uOrthoOn.value).toBe(0);
    expect(materials.uniforms.uWaterAmplitude.value).toBe(0);
    expect(materials.uniforms.uWaterSpeed.value).toBe(0);
    expect(materials.uniforms.uWaterRoughness.value).toBe(1);
    expect(materials.uniforms.uSeason.value).toBe(2);
    expect(materials.uniforms.uTreeGlow.value.r).toBeGreaterThan(0);
    expect(materials.uniforms.uCityGlass.value).toBe(2);
    expect(materials.uniforms.uStreetLights.value).toBe(0);
    expect(materials.uniforms.uParkLights.value).toBe(2);
    expect(materials.uniforms.uRoomLight.value).toBe(2.5);
    expect(materials.uniforms.uSoft.value).toBe(0.35);
    expect(materials.uniforms.uWindowLife.value.x).toBe(0.3);
    expect(materials.uniforms.uNightCityGlass.value).toBe(1.5);
    expect(materials.uniforms.uNightBlue.value).toBe(0.8);
    materials.uniforms.uCitySunDirection.value.set(1, 2, 3).normalize();
    expect(materials.uniforms.uCitySunDirection.value.y).toBeCloseTo(
      2 / Math.sqrt(14),
    );
    materials.setOrtho(
      true,
      materials.uniforms.uOrtho.value ?? undefined,
      new Vector4(1, 2, 3, 4),
    );
    expect(materials.uniforms.uOrthoRect.value.toArray()).toEqual([1, 2, 3, 4]);
    const disposeBlank = vi.spyOn(materials.uniforms.uBlank.value, "dispose");
    materials.dispose();
    expect(disposeBlank).toHaveBeenCalledOnce();
    wall.dispose();
    ground.dispose();
  });

  it("selects prefab and paint materials from the manifest contract", () => {
    const wall = textureSet(6),
      ground = textureSet(4);
    const textures = {
      wall,
      ground,
      dispose: () => {
        wall.dispose();
        ground.dispose();
      },
    };
    const models = createCityMaterials(textures);
    expect(models.prefab.side).toBe(DoubleSide);
    expect(models.prefab.roughness).toBeCloseTo(0.85);
    expect(models.prefab.metalness).toBeCloseTo(0.05);
    expect(models.paint.polygonOffset).toBe(true);
    expect(models.paint.polygonOffsetFactor).toBe(-3);
    expect(models.paint.polygonOffsetUnits).toBe(-8);
    expect(models.decals.transparent).toBe(true);
    expect(models.decals.depthWrite).toBe(false);
    expect(models.decals.polygonOffsetFactor).toBe(-4);
    expect(models.decals.polygonOffsetUnits).toBe(-10);
    expect(models.decals.map).toBeDefined();
    expect(models.wire.color.getHex()).toBe(0x14161a);
    expect(models.terrain.vertexColors).toBe(false);
    expect(models.terrain.color.toArray()).toEqual([0.2, 0.2, 0.185]);
    models.dispose();

    const shells = createCityMaterials(textures, { shells: true });
    expect(shells.prefab.customProgramCacheKey?.()).toBe(
      "navara-city-shell-v2",
    );
    shells.dispose();
    textures.dispose();
  });

  it("uses the same tree instance for near branches, leaves and far LOD", () => {
    const identity = new Float32Array(16);
    identity.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const data: CityTileData = {
      rtc: new Float64Array(3),
      terrain: emptyMesh(),
      ground: emptyMesh(),
      paint: emptyMesh(),
      decals: emptyMesh(),
      buildings: emptyMesh(),
      buildingsLod1: emptyMesh(),
      prefab: emptyMesh(),
      prefabLod1: emptyMesh(),
      photo: emptyMesh(),
      walls: emptyMesh(),
      wires: new Float32Array(),
      propMatrices: identity,
      propMetadata: new Float32Array([0, 2, 0, 1]),
      treeCount: 1,
      signs: [],
    };
    const uniforms = createCityUniforms();
    const lamps = new CityLampLight(new CityRtcFrame(), uniforms);
    const library = new PropLibrary(uniforms, lamps);
    const root = new Group();
    library.attach(root);
    const visual = library.build(data);
    library.update();
    const meshes: InstancedMesh[] = [];
    root.traverse((child) => {
      if (child instanceof InstancedMesh) meshes.push(child);
    });
    expect(meshes).toHaveLength(3);
    expect(visual.treeCount).toBe(1);
    expect(visual.roosts).toHaveLength(3);
    expect(meshes.every((mesh) => mesh.castShadow)).toBe(true);
    expect(meshes.filter((mesh) => mesh.count > 0)).toHaveLength(1);
    visual.setNear(true);
    library.update();
    expect(meshes.filter((mesh) => mesh.count > 0)).toHaveLength(2);
    const shared = new Matrix4();
    const other = new Matrix4();
    meshes[0].getMatrixAt(0, shared);
    meshes[1].getMatrixAt(0, other);
    expect(other.elements).toEqual(shared.elements);
    meshes[2].getMatrixAt(0, other);
    expect(other.elements).toEqual(shared.elements);
    visual.setNear(false);
    library.update();
    expect(meshes.filter((mesh) => mesh.count > 0)).toHaveLength(1);
    const colors = meshes[2].geometry.getAttribute("color");
    const crownMax = [0, 0, 0];
    for (let index = 0; index < colors.count; index += 1) {
      const rgb = [colors.getX(index), colors.getY(index), colors.getZ(index)];
      if (rgb[1] <= rgb[0]) continue;
      for (let channel = 0; channel < 3; channel += 1)
        crownMax[channel] = Math.max(crownMax[channel], rgb[channel]);
    }
    expect(crownMax[0]).toBeCloseTo(0.066);
    expect(crownMax[1]).toBeCloseTo(0.108);
    expect(crownMax[2]).toBeCloseTo(0.031);
    library.dispose();
    lamps.dispose();
  });

  it("keeps mirror clipping and logarithmic water depth corrections", () => {
    expect(mirrorSource).toContain("projection[14] = this.clip.w");
    expect(mirrorSource).not.toContain("projection[14] = this.clip.z");
    expect(mirrorSource).not.toContain("1600");
    expect(mirrorSource).toContain("this.cullObjectLeaves(object)");
    expect(mirrorSource).toContain("this.objectVisibility.forEach");
    expect(groundSource).toContain("vFragDepth = max(1.0, vFragDepth - 0.03)");
    expect(groundSource).toContain("max(0.3, attenuation)");
  });
});
