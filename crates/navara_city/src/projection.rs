const HK_A: f64 = 6_378_388.0;
const HK_F: f64 = 1.0 / 297.0;
const HK_E2: f64 = HK_F * (2.0 - HK_F);
const HK_EP2: f64 = HK_E2 / (1.0 - HK_E2);
const WGS84_A: f64 = 6_378_137.0;
const WGS84_F: f64 = 1.0 / 298.257_223_563;
const WGS84_E2: f64 = WGS84_F * (2.0 - WGS84_F);
const LAT0: f64 = 22.312_133_333_333_333_f64.to_radians();
const LON0: f64 = 114.178_555_555_555_56_f64.to_radians();
const FE: f64 = 836_694.05;
const FN: f64 = 819_069.80;
const LOCAL_E0: f64 = 835_625.0;
const LOCAL_N0: f64 = 816_500.0;
const ARC_SECOND: f64 = std::f64::consts::PI / (180.0 * 3600.0);
const DATUM_TRANSLATION: [f64; 3] = [-162.619, -276.959, -161.764];
const DATUM_ROTATION: [f64; 3] = [
    0.067753 * ARC_SECOND,
    -2.243648 * ARC_SECOND,
    -1.158828 * ARC_SECOND,
];
const DATUM_SCALE: f64 = 1.0 - 1.094246e-6;
const HK_TO_WGS84: [f64; 9] = [
    DATUM_SCALE,
    -DATUM_ROTATION[2],
    DATUM_ROTATION[1],
    DATUM_ROTATION[2],
    DATUM_SCALE,
    -DATUM_ROTATION[0],
    -DATUM_ROTATION[1],
    DATUM_ROTATION[0],
    DATUM_SCALE,
];

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Geographic {
    pub longitude: f64,
    pub latitude: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RtcPoint {
    pub position: [f32; 3],
    pub ecef: [f64; 3],
    pub geographic: Geographic,
}

fn apply_matrix(m: &[f64; 9], p: [f64; 3]) -> [f64; 3] {
    [
        m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
        m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
        m[6] * p[0] + m[7] * p[1] + m[8] * p[2],
    ]
}

fn inverse_matrix(m: &[f64; 9]) -> [f64; 9] {
    let determinant = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6])
        + m[2] * (m[3] * m[7] - m[4] * m[6]);
    [
        (m[4] * m[8] - m[5] * m[7]) / determinant,
        (m[2] * m[7] - m[1] * m[8]) / determinant,
        (m[1] * m[5] - m[2] * m[4]) / determinant,
        (m[5] * m[6] - m[3] * m[8]) / determinant,
        (m[0] * m[8] - m[2] * m[6]) / determinant,
        (m[2] * m[3] - m[0] * m[5]) / determinant,
        (m[3] * m[7] - m[4] * m[6]) / determinant,
        (m[1] * m[6] - m[0] * m[7]) / determinant,
        (m[0] * m[4] - m[1] * m[3]) / determinant,
    ]
}

fn hk_to_wgs84(point: [f64; 3]) -> [f64; 3] {
    let p = apply_matrix(&HK_TO_WGS84, point);
    [
        p[0] + DATUM_TRANSLATION[0],
        p[1] + DATUM_TRANSLATION[1],
        p[2] + DATUM_TRANSLATION[2],
    ]
}

fn wgs84_to_hk(point: [f64; 3]) -> [f64; 3] {
    let inverse = inverse_matrix(&HK_TO_WGS84);
    apply_matrix(
        &inverse,
        [
            point[0] - DATUM_TRANSLATION[0],
            point[1] - DATUM_TRANSLATION[1],
            point[2] - DATUM_TRANSLATION[2],
        ],
    )
}

fn geodetic_to_ecef(g: Geographic, height: f64, a: f64, e2: f64) -> [f64; 3] {
    let sin = g.latitude.sin();
    let cos = g.latitude.cos();
    let n = a / (1.0 - e2 * sin * sin).sqrt();
    [
        (n + height) * cos * g.longitude.cos(),
        (n + height) * cos * g.longitude.sin(),
        (n * (1.0 - e2) + height) * sin,
    ]
}

fn ecef_to_geodetic(point: [f64; 3], a: f64, e2: f64) -> Geographic {
    let longitude = point[1].atan2(point[0]);
    let p = point[0].hypot(point[1]);
    let mut latitude = point[2].atan2(p * (1.0 - e2));
    for _ in 0..8 {
        let sin = latitude.sin();
        let n = a / (1.0 - e2 * sin * sin).sqrt();
        latitude = (point[2] + e2 * n * sin).atan2(p);
    }
    Geographic {
        longitude,
        latitude,
    }
}

fn meridian(lat: f64) -> f64 {
    HK_A * ((1.0 - HK_E2 / 4.0 - 3.0 * HK_E2.powi(2) / 64.0 - 5.0 * HK_E2.powi(3) / 256.0) * lat
        - (3.0 * HK_E2 / 8.0 + 3.0 * HK_E2.powi(2) / 32.0 + 45.0 * HK_E2.powi(3) / 1024.0)
            * (2.0 * lat).sin()
        + (15.0 * HK_E2.powi(2) / 256.0 + 45.0 * HK_E2.powi(3) / 1024.0) * (4.0 * lat).sin()
        - 35.0 * HK_E2.powi(3) / 3072.0 * (6.0 * lat).sin())
}

fn hk_geographic_to_grid(g: Geographic) -> [f64; 2] {
    let lat = g.latitude;
    let lon_delta = g.longitude - LON0;
    let sin = lat.sin();
    let cos = lat.cos();
    let n = HK_A / (1.0 - HK_E2 * sin * sin).sqrt();
    let t = lat.tan().powi(2);
    let c = HK_EP2 * cos * cos;
    let a = cos * lon_delta;
    let m = meridian(lat) - meridian(LAT0);
    let easting = FE
        + n * (a
            + (1.0 - t + c) * a.powi(3) / 6.0
            + (5.0 - 18.0 * t + t * t + 72.0 * c - 58.0 * HK_EP2) * a.powi(5) / 120.0);
    let northing = FN
        + m
        + n * lat.tan()
            * (a * a / 2.0
                + (5.0 - t + 9.0 * c + 4.0 * c * c) * a.powi(4) / 24.0
                + (61.0 - 58.0 * t + t * t + 600.0 * c - 330.0 * HK_EP2) * a.powi(6) / 720.0);
    [easting - LOCAL_E0, LOCAL_N0 - northing]
}

fn grid_to_hk_geographic(x: f64, z: f64) -> Geographic {
    let m = meridian(LAT0) + LOCAL_N0 - z - FN;
    let mu =
        m / (HK_A * (1.0 - HK_E2 / 4.0 - 3.0 * HK_E2.powi(2) / 64.0 - 5.0 * HK_E2.powi(3) / 256.0));
    let e1 = (1.0 - (1.0 - HK_E2).sqrt()) / (1.0 + (1.0 - HK_E2).sqrt());
    let j1 = 3.0 * e1 / 2.0 - 27.0 * e1.powi(3) / 32.0;
    let j2 = 21.0 * e1.powi(2) / 16.0 - 55.0 * e1.powi(4) / 32.0;
    let j3 = 151.0 * e1.powi(3) / 96.0;
    let j4 = 1097.0 * e1.powi(4) / 512.0;
    let fp = mu
        + j1 * (2.0 * mu).sin()
        + j2 * (4.0 * mu).sin()
        + j3 * (6.0 * mu).sin()
        + j4 * (8.0 * mu).sin();
    let sin = fp.sin();
    let cos = fp.cos();
    let c1 = HK_EP2 * cos * cos;
    let t1 = fp.tan().powi(2);
    let n1 = HK_A / (1.0 - HK_E2 * sin * sin).sqrt();
    let r1 = HK_A * (1.0 - HK_E2) / (1.0 - HK_E2 * sin * sin).powf(1.5);
    let d = (LOCAL_E0 + x - FE) / n1;
    let latitude = fp
        - n1 * fp.tan() / r1
            * (d * d / 2.0
                - (5.0 + 3.0 * t1 + 10.0 * c1 - 4.0 * c1 * c1 - 9.0 * HK_EP2) * d.powi(4) / 24.0
                + (61.0 + 90.0 * t1 + 298.0 * c1 + 45.0 * t1 * t1
                    - 252.0 * HK_EP2
                    - 3.0 * c1 * c1)
                    * d.powi(6)
                    / 720.0);
    let longitude = LON0
        + (d - (1.0 + 2.0 * t1 + c1) * d.powi(3) / 6.0
            + (5.0 - 2.0 * c1 + 28.0 * t1 - 3.0 * c1 * c1 + 8.0 * HK_EP2 + 24.0 * t1 * t1)
                * d.powi(5)
                / 120.0)
            / cos;
    Geographic {
        longitude,
        latitude,
    }
}

pub fn geographic_to_grid(g: Geographic) -> [f64; 2] {
    let wgs84 = geodetic_to_ecef(g, 0.0, WGS84_A, WGS84_E2);
    let hk = ecef_to_geodetic(wgs84_to_hk(wgs84), HK_A, HK_E2);
    hk_geographic_to_grid(hk)
}

pub fn grid_to_geographic(x: f64, z: f64) -> Geographic {
    local_to_ecef([x, 0.0, z]).1
}

pub fn geographic_to_ecef(g: Geographic, height: f64) -> [f64; 3] {
    geodetic_to_ecef(g, height, WGS84_A, WGS84_E2)
}

pub fn local_to_ecef(point: [f64; 3]) -> ([f64; 3], Geographic) {
    let hk = grid_to_hk_geographic(point[0], point[2]);
    let ecef = hk_to_wgs84(geodetic_to_ecef(hk, point[1], HK_A, HK_E2));
    let geographic = ecef_to_geodetic(ecef, WGS84_A, WGS84_E2);
    (ecef, geographic)
}

pub fn local_normal_to_ecef(normal: [f64; 3], geographic: Geographic) -> [f32; 3] {
    let (slon, clon) = geographic.longitude.sin_cos();
    let (slat, clat) = geographic.latitude.sin_cos();
    let east = [-slon, clon, 0.0];
    let north = [-slat * clon, -slat * slon, clat];
    let up = [clat * clon, clat * slon, slat];
    let mut result = [0.0; 3];
    for i in 0..3 {
        result[i] = east[i] * normal[0] + up[i] * normal[1] - north[i] * normal[2];
    }
    let length = result.iter().map(|v| v * v).sum::<f64>().sqrt();
    [
        result[0] as f32 / length as f32,
        result[1] as f32 / length as f32,
        result[2] as f32 / length as f32,
    ]
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RtcCenter {
    pub local: [f64; 3],
    pub ecef: [f64; 3],
}

impl RtcCenter {
    pub fn for_tile(tx: i32, tz: i32) -> Self {
        Self::new([(tx as f64 + 0.5) * 256.0, 0.0, (tz as f64 + 0.5) * 256.0])
    }

    pub fn new(local: [f64; 3]) -> Self {
        let (ecef, _) = local_to_ecef(local);
        Self { local, ecef }
    }

    pub fn project(&self, point: [f64; 3]) -> RtcPoint {
        let (ecef, geographic) = local_to_ecef(point);
        RtcPoint {
            position: [
                (ecef[0] - self.ecef[0]) as f32,
                (ecef[1] - self.ecef[1]) as f32,
                (ecef[2] - self.ecef[2]) as f32,
            ],
            ecef,
            geographic,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_abs_diff_eq;

    #[test]
    fn matches_epsg_2326_projection_origin() {
        let origin = Geographic {
            longitude: LON0,
            latitude: LAT0,
        };
        let local = hk_geographic_to_grid(origin);
        assert_abs_diff_eq!(local[0], FE - LOCAL_E0, epsilon = 1e-6);
        assert_abs_diff_eq!(local[1], LOCAL_N0 - FN, epsilon = 1e-6);
        let round_trip = grid_to_hk_geographic(local[0], local[1]);
        assert_abs_diff_eq!(round_trip.longitude, LON0, epsilon = 1e-10);
        assert_abs_diff_eq!(round_trip.latitude, LAT0, epsilon = 1e-10);
    }

    #[test]
    fn matches_proj_wgs84_reference_points() {
        let references: [(f64, f64, f64, f64); 4] = [
            (0.0, 0.0, 114.170634833928, 22.287395489807),
            (-1125.0, 1500.0, 114.159719754538, 22.273848750751),
            (1875.0, -1500.0, 114.188830536607, 22.300941097728),
            (844.05, -1069.8, 114.178825428010, 22.297056557854),
        ];
        for (x, z, longitude, latitude) in references {
            let geographic = grid_to_geographic(x, z);
            let error_metres = ((geographic.longitude.to_degrees() - longitude)
                * 111_320.0
                * latitude.to_radians().cos())
            .hypot((geographic.latitude.to_degrees() - latitude) * 111_320.0);
            assert!(error_metres < 0.05, "PROJ error: {error_metres} m");
        }
    }

    #[test]
    fn grid_round_trip_preserves_city_scale_points() {
        for point in [
            [-1875.0, -1500.0],
            [1875.0, 1500.0],
            [128.0, -256.0],
            [0.0, 0.0],
        ] {
            let projected = geographic_to_grid(grid_to_geographic(point[0], point[1]));
            assert_abs_diff_eq!(projected[0], point[0], epsilon = 1e-3);
            assert_abs_diff_eq!(projected[1], point[1], epsilon = 1e-3);
        }
    }
}
