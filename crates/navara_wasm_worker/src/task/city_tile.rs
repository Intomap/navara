use navara_city::{
    buffers::MeshBuffers,
    meshing::{HeightGrid, build_tile},
    projection::RtcCenter,
};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct ReturnedCityMesh {
    mesh: MeshBuffers,
}

macro_rules! mesh_f32_getter {
    ($name:ident, $field:ident) => {
        #[wasm_bindgen]
        impl ReturnedCityMesh {
            #[wasm_bindgen(js_name = $name)]
            #[allow(non_snake_case)]
            pub fn $name(&mut self) -> Vec<f32> {
                std::mem::take(&mut self.mesh.$field)
            }
        }
    };
}

mesh_f32_getter!(removePosition, position);
mesh_f32_getter!(removeLocal, local);
mesh_f32_getter!(removeNormal, normal);
mesh_f32_getter!(removeColor, color);
mesh_f32_getter!(removeLayer, layer);
mesh_f32_getter!(removeLight, light);
mesh_f32_getter!(removeFacade, facade);
mesh_f32_getter!(removeBuilding, building);
mesh_f32_getter!(removePhoto, photo);
mesh_f32_getter!(removeUv, uv);

#[wasm_bindgen]
impl ReturnedCityMesh {
    #[wasm_bindgen(js_name = removeIndex)]
    pub fn remove_index(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.mesh.index)
    }
}

#[wasm_bindgen]
pub struct ReturnedCityTile {
    result: navara_city::buffers::CityTileBuffers,
}

macro_rules! city_mesh_getter {
    ($name:ident, $field:ident) => {
        #[wasm_bindgen]
        impl ReturnedCityTile {
            #[wasm_bindgen(js_name = $name)]
            #[allow(non_snake_case)]
            pub fn $name(&mut self) -> ReturnedCityMesh {
                ReturnedCityMesh {
                    mesh: std::mem::take(&mut self.result.$field),
                }
            }
        }
    };
}

city_mesh_getter!(removeTerrain, terrain);
city_mesh_getter!(removeGround, ground);
city_mesh_getter!(removePaint, paint);
city_mesh_getter!(removeDecals, decals);
city_mesh_getter!(removeBuildings, buildings);
city_mesh_getter!(removeBuildingsLod1, buildings_lod1);
city_mesh_getter!(removePhoto, photo);
city_mesh_getter!(removePrefab, prefab);
city_mesh_getter!(removePrefabLod1, prefab_lod1);
city_mesh_getter!(removeWalls, walls);

#[wasm_bindgen]
impl ReturnedCityTile {
    #[wasm_bindgen(js_name = removeRtc)]
    pub fn remove_rtc(&mut self) -> Vec<f64> {
        self.result.rtc.to_vec()
    }

    #[wasm_bindgen(js_name = removePropMatrices)]
    pub fn remove_prop_matrices(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.result.prop_matrices)
    }

    #[wasm_bindgen(js_name = removePropMetadata)]
    pub fn remove_prop_metadata(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.result.prop_metadata)
    }

    #[wasm_bindgen(js_name = removeWires)]
    pub fn remove_wires(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.result.wires)
    }

    #[wasm_bindgen(js_name = removeTreeCount)]
    pub fn remove_tree_count(&mut self) -> u32 {
        self.result.tree_count
    }

    #[wasm_bindgen(js_name = signsJson)]
    pub fn signs_json(&self) -> String {
        serde_json::to_string(&self.result.signs).unwrap()
    }
}

#[allow(clippy::too_many_arguments)]
#[wasm_bindgen(js_name = constructCityTile)]
pub fn construct_city_tile(
    tile_bytes: &[u8],
    prefab_bytes: Option<Vec<u8>>,
    terrain_bytes: &[u8],
    x0: f32,
    z0: f32,
    step: f32,
    width: u32,
    height: u32,
    decks_json: Option<String>,
) -> Result<ReturnedCityTile, JsError> {
    let data = parse_terrain(terrain_bytes, width, height)?;
    let grid = terrain_grid(&data, x0, z0, step, width, height);
    let decks = match decks_json.as_deref() {
        None | Some("") => Vec::new(),
        Some(json) => {
            navara_city::meshing::decks::parse_decks(json).map_err(|error| JsError::new(&error))?
        }
    };
    let result = build_tile(tile_bytes, prefab_bytes.as_deref(), grid, &decks)
        .map_err(|error| JsError::new(&error.to_string()))?;
    Ok(ReturnedCityTile { result })
}

/// Parses the terrain height field shared by the tile and structure builders.
fn terrain_grid<'a>(
    data: &'a [f32],
    x0: f32,
    z0: f32,
    step: f32,
    width: u32,
    height: u32,
) -> HeightGrid<'a> {
    HeightGrid {
        x0,
        z0,
        step,
        width: width as usize,
        height: height as usize,
        data,
    }
}

fn parse_terrain(
    terrain_bytes: &[u8],
    width: u32,
    height: u32,
) -> Result<Vec<f32>, JsError> {
    let data = terrain_bytes
        .as_chunks::<4>()
        .0
        .iter()
        .map(|bytes| f32::from_le_bytes(*bytes))
        .collect::<Vec<_>>();
    if data.len() != width as usize * height as usize {
        return Err(JsError::new("terrain dimensions do not match its data"));
    }
    Ok(data)
}

/// Builds the city-wide dynamic structure mesh (footbridges, platforms,
/// canopies) once in the worker. The mesh is projected against the city-level
/// RTC frame at local origin, matching the `CityRtcFrame` used on the main
/// thread, so it joins the same coordinate space as the per-tile meshes.
#[allow(clippy::too_many_arguments)]
#[wasm_bindgen(js_name = constructStructures)]
pub fn construct_structures(
    structures_json: String,
    terrain_bytes: &[u8],
    x0: f32,
    z0: f32,
    step: f32,
    width: u32,
    height: u32,
) -> Result<ReturnedCityMesh, JsError> {
    let data = parse_terrain(terrain_bytes, width, height)?;
    let grid = terrain_grid(&data, x0, z0, step, width, height);
    let center = RtcCenter::new([0.0, 0.0, 0.0]);
    let mesh = navara_city::structures::build_structures_mesh(&structures_json, grid, &center)
        .map_err(|error| JsError::new(&error))?;
    Ok(ReturnedCityMesh { mesh })
}

/// Builds the city-wide flyover (elevated road) mesh once in the worker, in
/// the same city-level RTC frame as `constructStructures`.
#[allow(clippy::too_many_arguments)]
#[wasm_bindgen(js_name = constructFlyovers)]
pub fn construct_flyovers(
    roads_json: String,
    terrain_bytes: &[u8],
    x0: f32,
    z0: f32,
    step: f32,
    width: u32,
    height: u32,
) -> Result<ReturnedCityMesh, JsError> {
    let data = parse_terrain(terrain_bytes, width, height)?;
    let grid = terrain_grid(&data, x0, z0, step, width, height);
    let center = RtcCenter::new([0.0, 0.0, 0.0]);
    let mesh = navara_city::structures::build_flyovers_mesh(&roads_json, grid, &center)
        .map_err(|error| JsError::new(&error))?;
    Ok(ReturnedCityMesh { mesh })
}
