import { Tree } from "@dgreenheck/ez-tree";
import type { CityTileData } from "@navaramap/worker";
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Matrix4,
  MeshBasicMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  type Material,
  type Texture,
} from "three";

import { PROP } from "../constants";
import type { CityUniforms } from "../materials/programs";

import { CityLampLight } from "./lamplight";
import { ecefToLocalPoint } from "./projection";
import {
  applyPoolColor,
  createLampHeadMaterial,
  createPropMetalMaterial,
  createSignalLensMaterial,
  createVendingMaterial,
  createVendingPanelMaterial,
  glowTexture,
  vendingBodyColor,
  vendingTexture,
} from "./prop-materials";
import {
  LAMP,
  POLE_LAMP,
  blobCrownGeometry,
  createFurnitureModels,
  merged,
  signalGeometry,
  signalLensGeometry,
  streetLightGeometry,
  tube,
  utilityPoleGeometry,
  vendingGeometry,
  vendingPanelGeometry,
} from "./prop-models";
import { PropPoolSet, type PropPoolShare } from "./prop-pool";
import { createParkedVehicleKit, type ParkedVehicleKit } from "./traffic";
import {
  applyCityNightFill,
  applySeasonToDistant,
  applySeasonToLeaf,
} from "./tree-season";

export type PropVisual = {
  group: Group;
  /** Ground light pools parented to the city lamp light map. */
  pools: Group;
  roosts: number[];
  treeCount: number;
  setNear: (near: boolean) => void;
  dispose: () => void;
};

type TreeDefinition = {
  preset: string;
  seed: number;
  height: number;
  tint: number;
  recolor?: boolean;
  blossom?: boolean;
};
type TreeModel = {
  definition: TreeDefinition;
  branches: BufferGeometry;
  leaves: BufferGeometry;
  distant: BufferGeometry;
  branchMaterial: MeshStandardMaterial;
  leafMaterial: MeshStandardMaterial;
  distantMaterial: MeshStandardMaterial;
};
type TreeInstance = {
  matrix: Matrix4;
  x: number;
  y: number;
  z: number;
  scale: number;
};

const TREES: TreeDefinition[] = [
  { preset: "Ash Medium", seed: 11, height: 9, tint: 0xb5c890 },
  { preset: "Oak Small", seed: 23, height: 8, tint: 0xc0d09a },
  { preset: "Oak Medium", seed: 5, height: 13, tint: 0x9fb87f },
  { preset: "Oak Large", seed: 42, height: 17, tint: 0x8fae78 },
  {
    preset: "Aspen Medium",
    seed: 7,
    height: 13,
    tint: 0xa9c24f,
    recolor: true,
  },
  {
    preset: "Ash Small",
    seed: 31,
    height: 7,
    tint: 0xf4b6cf,
    recolor: true,
    blossom: true,
  },
];

function geometryBounds(geometry: BufferGeometry): Box3 {
  geometry.computeBoundingBox();
  if (!geometry.boundingBox) throw new Error("Prop geometry has no bounds");
  return geometry.boundingBox.clone();
}

function distantTreeGeometry(
  definition: TreeDefinition,
  leafBounds: Box3,
): BufferGeometry {
  const crown = blobCrownGeometry();
  const bounds = geometryBounds(crown);
  const sourceCenter = bounds.getCenter(new Vector3());
  const targetCenter = leafBounds.getCenter(new Vector3());
  const sourceSize = bounds.getSize(new Vector3());
  const targetSize = leafBounds.getSize(new Vector3());
  const position = crown.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    position.setXYZ(
      i,
      targetCenter.x +
        ((position.getX(i) - sourceCenter.x) / sourceSize.x) * targetSize.x,
      leafBounds.min.y +
        ((position.getY(i) - bounds.min.y) / sourceSize.y) * targetSize.y,
      targetCenter.z +
        ((position.getZ(i) - sourceCenter.z) / sourceSize.z) * targetSize.z,
    );
  }
  crown.computeVertexNormals();
  crown.computeBoundingSphere();
  const trunk = tube(
    definition.height * 0.025,
    definition.height * 0.018,
    leafBounds.min.y + targetSize.y * 0.22,
    targetCenter.x,
    0,
    targetCenter.z,
    [0.25, 0.2, 0.16],
    5,
  );
  return merged([crown, trunk]);
}

function buildTree(
  definition: TreeDefinition,
  uniforms: CityUniforms,
): TreeModel {
  const tree = new Tree();
  tree.loadPreset(definition.preset);
  const options = tree.options;
  options.seed = definition.seed;
  options.leaves.count = Math.max(4, Math.round(options.leaves.count * 0.55));
  options.leaves.size *= 1.45;
  for (const key of [0, 1, 2, 3] as const) {
    const sections = options.branch.sections[key];
    const segments = options.branch.segments[key];
    if (Number.isFinite(sections))
      options.branch.sections[key] = Math.max(3, Math.round(sections * 0.5));
    if (Number.isFinite(segments))
      options.branch.segments[key] = Math.max(3, Math.round(segments * 0.6));
  }
  tree.generate();
  const size = new Box3().setFromObject(tree).getSize(new Vector3());
  const scale = definition.height / size.y;
  const branches = tree.branchesMesh.geometry.clone();
  const leaves = tree.leavesMesh.geometry.clone();
  branches.scale(scale, scale, scale);
  leaves.scale(scale, scale, scale);
  branches.computeBoundingSphere();
  leaves.computeBoundingSphere();
  const branchSource = tree.branchesMesh.material;
  const leafSource = tree.leavesMesh.material;
  if (
    Array.isArray(branchSource) ||
    Array.isArray(leafSource) ||
    !(branchSource instanceof MeshPhongMaterial) ||
    !(leafSource instanceof MeshPhongMaterial)
  )
    throw new Error("ez-tree must provide mapped branch and leaf materials");
  const branchMaterial = new MeshStandardMaterial({
    map: branchSource.map,
    roughness: 0.95,
  });
  applyCityNightFill(branchMaterial, uniforms, 0.14);
  const leafMat = new MeshStandardMaterial({
    map: leafSource.map,
    color: definition.tint,
    alphaTest: 0.18,
    roughness: 0.85,
    side: DoubleSide,
  });
  applySeasonToLeaf(leafMat, definition, uniforms);
  const distantMat = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
  });
  applySeasonToDistant(distantMat, uniforms);
  const leafBounds = geometryBounds(leaves);
  const distant = distantTreeGeometry(definition, leafBounds);
  tree.branchesMesh.geometry.dispose();
  tree.leavesMesh.geometry.dispose();
  branchSource.dispose();
  leafSource.dispose();
  return {
    definition,
    branches,
    leaves,
    distant,
    branchMaterial,
    leafMaterial: leafMat,
    distantMaterial: distantMat,
  };
}

export class PropLibrary {
  private trees: TreeModel[];
  private metal = createPropMetalMaterial();
  private vendingMaterial = createVendingMaterial();
  private panelTexture = vendingTexture();
  private panelMaterial: MeshBasicMaterial;
  private streetLampMaterial: MeshBasicMaterial;
  private parkLampMaterial: MeshBasicMaterial;
  private lensMaterial!: ShaderMaterial;
  private utilityPoles: BufferGeometry[];
  private streetLight = streetLightGeometry();
  private signal = signalGeometry();
  private signalLenses = [0, 1, 2].map(signalLensGeometry);
  private vending = vendingGeometry();
  private vendingPanel = vendingPanelGeometry();
  private streetHead = new BoxGeometry(0.34, 0.05, 0.95).translate(
    0,
    LAMP.y + 0.13,
    LAMP.z,
  );
  private poleHead = new BoxGeometry(0.42, 0.05, 0.26).translate(
    POLE_LAMP.x,
    POLE_LAMP.y + 0.1,
    0,
  );
  private furniture = createFurnitureModels();
  private parked!: ParkedVehicleKit;
  private poolTexture = glowTexture();
  private poolGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private streetPool!: MeshBasicMaterial;
  private coolPool!: MeshBasicMaterial;
  private parkPool!: MeshBasicMaterial;
  private ownedGeometries = new Set<BufferGeometry>();
  private ownedMaterials = new Set<Material>();
  private ownedTextures = new Set<Texture>();
  private poolSet = new PropPoolSet();

  constructor(
    uniforms: CityUniforms,
    private lampLight: CityLampLight,
  ) {
    this.lensMaterial = createSignalLensMaterial(uniforms);
    this.parked = createParkedVehicleKit(uniforms);
    this.trees = TREES.map((definition) => buildTree(definition, uniforms));
    this.utilityPoles = [utilityPoleGeometry(false), utilityPoleGeometry(true)];
    this.panelMaterial = createVendingPanelMaterial(
      uniforms,
      this.panelTexture,
    );
    this.streetLampMaterial = createLampHeadMaterial(uniforms, false);
    this.parkLampMaterial = createLampHeadMaterial(uniforms, true);
    this.streetPool = this.lampLight.createMaterial(this.poolTexture);
    applyPoolColor(this.streetPool, uniforms, [1.9, 1.5, 0.95], false);
    this.coolPool = this.lampLight.createMaterial(this.poolTexture);
    applyPoolColor(this.coolPool, uniforms, [1.15, 1.25, 1.4], false);
    this.parkPool = this.lampLight.createMaterial(this.poolTexture);
    applyPoolColor(this.parkPool, uniforms, [1.7, 1.5, 1.05], true);
    for (const tree of this.trees) {
      this.ownedGeometries
        .add(tree.branches)
        .add(tree.leaves)
        .add(tree.distant);
      this.ownedMaterials
        .add(tree.branchMaterial)
        .add(tree.leafMaterial)
        .add(tree.distantMaterial);
      if (tree.branchMaterial.map)
        this.ownedTextures.add(tree.branchMaterial.map);
      if (tree.leafMaterial.map) this.ownedTextures.add(tree.leafMaterial.map);
    }
    [
      this.metal,
      this.vendingMaterial,
      this.panelMaterial,
      this.streetLampMaterial,
      this.parkLampMaterial,
      this.lensMaterial,
      this.parked.material,
    ].forEach((material) => this.ownedMaterials.add(material));
    [
      this.streetLight,
      this.signal,
      ...this.signalLenses,
      this.vending,
      this.vendingPanel,
      this.streetHead,
      this.poleHead,
      this.poolGeometry,
      ...this.utilityPoles,
      ...this.parked.models,
    ].forEach((geometry) => this.ownedGeometries.add(geometry));
    for (const variants of this.furniture.values())
      variants.forEach((geometry) => this.ownedGeometries.add(geometry));
    this.ownedTextures.add(this.panelTexture);
    this.ownedTextures.add(this.poolTexture);
  }

  applyShadowMaterials(apply: (material: Material) => void): void {
    this.ownedMaterials.forEach((material) => {
      if (material instanceof MeshStandardMaterial) apply(material);
    });
  }

  /** Lets the view opt the signal lenses (custom ShaderMaterial) into MRT. */
  applyMrtSetup(setup: (material: ShaderMaterial) => void): void {
    setup(this.lensMaterial);
  }

  private treeInstances(data: CityTileData, rows: number[]): TreeInstance[] {
    const instances: TreeInstance[] = [];
    for (const row of rows) {
      const matrix = new Matrix4().fromArray(data.propMatrices, row * 16);
      const elements = matrix.elements;
      const local = ecefToLocalPoint(
        data.rtc[0] + elements[12],
        data.rtc[1] + elements[13],
        data.rtc[2] + elements[14],
      );
      instances.push({
        matrix,
        x: local.x,
        y: local.y,
        z: local.z,
        scale: Math.hypot(elements[4], elements[5], elements[6]),
      });
    }
    return instances;
  }

  attach(group: Group): void {
    group.add(this.poolSet.group);
    this.lampLight.add(this.poolSet.pools);
  }

  get mirrorGroup(): Group {
    return this.poolSet.group;
  }

  update(): void {
    this.poolSet.sync();
  }

  build(data: CityTileData): PropVisual {
    const group = new Group();
    group.name = "props";
    const pools = new Group();
    pools.name = "prop-lamp-pools";
    const shares: PropPoolShare[] = [];
    const near: PropPoolShare[] = [];
    const far: PropPoolShare[] = [];
    const roosts: number[] = [];
    const rtc = new Matrix4().makeTranslation(
      data.rtc[0],
      data.rtc[1],
      data.rtc[2],
    );
    const matrix = (row: number) =>
      rtc
        .clone()
        .multiply(new Matrix4().fromArray(data.propMatrices, row * 16));
    const add = (
      key: string,
      geometry: BufferGeometry,
      material: Material,
      row: number,
      shadow = true,
      color?: Color,
      attributes?: Record<string, number[]>,
      local?: Matrix4,
      lamp = false,
    ): PropPoolShare => {
      const instanceMatrix = matrix(row);
      if (local) instanceMatrix.multiply(local);
      const share = this.poolSet.add(
        key,
        {
          geometry,
          material,
          shadow,
          attributes: attributes?.aLens
            ? { aLens: 2 }
            : attributes?.aTreeSeed
              ? { aTreeSeed: 1 }
              : undefined,
        },
        { matrix: instanceMatrix, color, attributes },
        lamp,
      );
      shares.push(share);
      return share;
    };
    const poolLocal = (position: [number, number, number], scale: number) => {
      const result = new Matrix4().makeScale(scale, scale, scale);
      result.setPosition(...position);
      return result;
    };
    for (let row = 0; row < data.propMetadata.length / 4; row += 1) {
      const kind = data.propMetadata[row * 4];
      const variant = data.propMetadata[row * 4 + 1] ?? 0;
      if (kind === PROP.TREE) {
        const model = variant % this.trees.length;
        const tree = this.trees[model];
        const instance = this.treeInstances(data, [row])[0];
        const elements = new Matrix4().fromArray(
          data.propMatrices,
          row * 16,
        ).elements;
        const seed =
          Math.abs(
            Math.sin(elements[12] * 4 * 12.9898 + elements[14] * 4 * 78.233) *
              43758.5453,
          ) % 1;
        const attributes = { aTreeSeed: [seed] };
        near.push(
          add(
            `tree-${model}-branches`,
            tree.branches,
            tree.branchMaterial,
            row,
            true,
            undefined,
            attributes,
          ),
          add(
            `tree-${model}-leaves`,
            tree.leaves,
            tree.leafMaterial,
            row,
            true,
            undefined,
            attributes,
          ),
        );
        far.push(
          add(
            `tree-${model}-far`,
            tree.distant,
            tree.distantMaterial,
            row,
            true,
            undefined,
            attributes,
          ),
        );
        roosts.push(
          instance.x,
          instance.y + tree.definition.height * instance.scale * 0.72,
          instance.z,
        );
      } else if (kind === PROP.POLE) {
        add(
          `pole-${variant % 2}`,
          this.utilityPoles[variant % 2],
          this.metal,
          row,
        );
        add("pole-head", this.poleHead, this.parkLampMaterial, row, false);
        add(
          "pole-pool",
          this.poolGeometry,
          this.coolPool,
          row,
          false,
          undefined,
          undefined,
          poolLocal(
            [POLE_LAMP.x + 0.6, 0.2, 0],
            (2 * 2.6 * POLE_LAMP.y) /
              Math.max(data.propMetadata[row * 4 + 3] ?? 1, 1e-3),
          ),
          true,
        );
      } else if (kind === PROP.LIGHT) {
        add("street-light", this.streetLight, this.metal, row);
        const scale = data.propMetadata[row * 4 + 3] ?? 1;
        const park = scale < 1;
        add(
          park ? "park-head" : "street-head",
          this.streetHead,
          park ? this.parkLampMaterial : this.streetLampMaterial,
          row,
          false,
        );
        // The light pool's size is independent of the lamp's own scale: a park
        // lamp is a half-size mast, not a half-size glow. Dividing out the prop
        // scale stops park pools being shrunk a second time (mirrors Tokyo).
        add(
          park ? "park-pool" : "street-pool",
          this.poolGeometry,
          park ? this.parkPool : this.streetPool,
          row,
          false,
          undefined,
          undefined,
          poolLocal(
            [0, 0.34, LAMP.z + 1],
            ((park ? 1.4 : 2) * 2.6 * LAMP.y) / Math.max(scale, 1e-3),
          ),
          true,
        );
      } else if (kind === PROP.VENDING) {
        add(
          "vending",
          this.vending,
          this.vendingMaterial,
          row,
          true,
          vendingBodyColor(variant),
        );
        add("vending-panel", this.vendingPanel, this.panelMaterial, row, false);
      } else if (kind === PROP.SIGNAL) {
        add("signal", this.signal, this.metal, row);
        const phase =
          Math.round((data.propMetadata[row * 4 + 2] ?? 0) / (Math.PI / 2)) % 2;
        for (let lens = 0; lens < 3; lens += 1) {
          add(
            `signal-lens-${lens}`,
            this.signalLenses[lens],
            this.lensMaterial,
            row,
            false,
            undefined,
            { aLens: [lens, phase] },
          );
        }
      } else if (kind === PROP.PARKED) {
        add(
          `parked-${variant % this.parked.models.length}`,
          this.parked.models[variant % this.parked.models.length],
          this.parked.material,
          row,
          true,
          new Color(
            this.parked.colors[(variant >> 2) % this.parked.colors.length],
          ),
        );
      } else if (kind !== PROP.DECAL) {
        const variants = this.furniture.get(kind);
        if (variants)
          add(
            `furniture-${kind}-${variant}`,
            variants[variant % variants.length],
            this.metal,
            row,
          );
      }
    }
    near.forEach((share) => this.poolSet.setActive(share, false));
    return {
      group,
      pools,
      roosts,
      treeCount: data.treeCount,
      setNear: (value) => {
        near.forEach((share) => this.poolSet.setActive(share, value));
        far.forEach((share) => this.poolSet.setActive(share, !value));
      },
      dispose: () => shares.forEach((share) => this.poolSet.remove(share)),
    };
  }

  dispose(): void {
    this.poolSet.dispose();
    this.ownedGeometries.forEach((geometry) => geometry.dispose());
    this.ownedMaterials.forEach((material) => material.dispose());
    this.ownedTextures.forEach((texture) => texture.dispose());
    this.ownedGeometries.clear();
    this.ownedMaterials.clear();
    this.ownedTextures.clear();
  }
}
