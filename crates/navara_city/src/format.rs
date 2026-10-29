use std::{error::Error, fmt};

const MAGIC: u32 = 0x3159_4b54;
const VERSION: u16 = 7;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CityError {
    UnexpectedEof,
    InvalidMagic,
    UnsupportedVersion(u16),
    InvalidUtf8,
    TrailingData,
}

impl fmt::Display for CityError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnexpectedEof => write!(f, "unexpected end of city data"),
            Self::InvalidMagic => write!(f, "not a TKY1 tile"),
            Self::UnsupportedVersion(v) => write!(f, "unsupported TKY1 version {v}"),
            Self::InvalidUtf8 => write!(f, "invalid UTF-8 in city sign"),
            Self::TrailingData => write!(f, "unexpected trailing city data"),
        }
    }
}

impl Error for CityError {}
pub type Result<T> = std::result::Result<T, CityError>;

#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Point2 {
    pub x: f32,
    pub z: f32,
}

pub type Polygon = Vec<Vec<Point2>>;

#[derive(Debug, Clone, Default, PartialEq)]
pub struct Surface {
    pub roof: bool,
    pub rings: Vec<Vec<[f32; 3]>>,
    pub uv: Option<Vec<Vec<[f32; 2]>>>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct Building {
    pub usage: u16,
    pub storeys: u8,
    pub flags: u8,
    pub base: f32,
    pub height: f32,
    pub measured_height: f32,
    pub hint: u32,
    pub polygons: Vec<Polygon>,
    pub surfaces: Vec<Surface>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct Area {
    pub kind: u8,
    pub code: u16,
    pub polygons: Vec<Polygon>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Prop {
    pub kind: u8,
    pub variant: u8,
    pub rotation: f32,
    pub x: f32,
    pub z: f32,
    pub scale: f32,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct Sign {
    pub style: u8,
    pub color: u8,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub nx: f32,
    pub nz: f32,
    pub width: f32,
    pub height: f32,
    pub text: String,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct Tile {
    pub tx: i32,
    pub tz: i32,
    pub buildings: Vec<Building>,
    pub areas: Vec<Area>,
    pub props: Vec<Prop>,
    pub wires: Vec<[f32; 4]>,
    pub walls: Vec<[f32; 5]>,
    pub signs: Vec<Sign>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct Prefab {
    pub positions: Vec<f32>,
    pub colors: Vec<u8>,
}

struct Reader<'a> {
    bytes: &'a [u8],
    offset: usize,
}

impl<'a> Reader<'a> {
    fn new(bytes: &'a [u8]) -> Self {
        Self { bytes, offset: 0 }
    }

    fn take(&mut self, count: usize) -> Result<&'a [u8]> {
        let end = self
            .offset
            .checked_add(count)
            .ok_or(CityError::UnexpectedEof)?;
        let slice = self
            .bytes
            .get(self.offset..end)
            .ok_or(CityError::UnexpectedEof)?;
        self.offset = end;
        Ok(slice)
    }

    fn u8(&mut self) -> Result<u8> {
        Ok(self.take(1)?[0])
    }

    fn u16(&mut self) -> Result<u16> {
        Ok(u16::from_le_bytes(self.take(2)?.try_into().unwrap()))
    }

    fn u32(&mut self) -> Result<u32> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }

    fn i32(&mut self) -> Result<i32> {
        Ok(i32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }

    fn f32(&mut self) -> Result<f32> {
        Ok(f32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }

    fn polygons(&mut self) -> Result<Vec<Polygon>> {
        let mut polygons = Vec::with_capacity(self.u16()? as usize);
        for _ in 0..polygons.capacity() {
            let mut rings = Vec::with_capacity(self.u16()? as usize);
            for _ in 0..rings.capacity() {
                let mut ring = Vec::with_capacity(self.u32()? as usize);
                for _ in 0..ring.capacity() {
                    ring.push(Point2 {
                        x: self.f32()?,
                        z: self.f32()?,
                    });
                }
                rings.push(ring);
            }
            polygons.push(rings);
        }
        Ok(polygons)
    }

    fn finish(self) -> Result<()> {
        if self.offset == self.bytes.len() {
            Ok(())
        } else {
            Err(CityError::TrailingData)
        }
    }
}

pub fn decode_tile(bytes: &[u8]) -> Result<Tile> {
    let mut r = Reader::new(bytes);
    if r.u32()? != MAGIC {
        return Err(CityError::InvalidMagic);
    }
    let version = r.u16()?;
    r.u16()?;
    if version != VERSION {
        return Err(CityError::UnsupportedVersion(version));
    }
    let mut tile = Tile {
        tx: r.i32()?,
        tz: r.i32()?,
        ..Tile::default()
    };
    let counts = [r.u32()?, r.u32()?, r.u32()?, r.u32()?, r.u32()?, r.u32()?];
    for _ in 0..counts[0] {
        let mut b = Building {
            usage: r.u16()?,
            storeys: r.u8()?,
            flags: r.u8()?,
            base: r.f32()?,
            height: r.f32()?,
            measured_height: r.f32()?,
            hint: r.u32()?,
            ..Building::default()
        };
        b.polygons = r.polygons()?;
        for _ in 0..r.u16()? {
            let bits = r.u8()?;
            let ring_count = r.u8()?;
            let mut surface = Surface {
                roof: bits & 1 != 0,
                ..Surface::default()
            };
            if bits & 2 != 0 {
                surface.uv = Some(Vec::with_capacity(ring_count as usize));
            }
            for _ in 0..ring_count {
                let point_count = r.u16()? as usize;
                let mut ring = Vec::with_capacity(point_count);
                for _ in 0..point_count {
                    ring.push([r.f32()?, r.f32()?, r.f32()?]);
                }
                surface.rings.push(ring);
                if let Some(uv) = &mut surface.uv {
                    let mut ring_uv = Vec::with_capacity(point_count);
                    for _ in 0..point_count {
                        ring_uv.push([r.u16()? as f32 / 65535.0, r.u16()? as f32 / 65535.0]);
                    }
                    uv.push(ring_uv);
                }
            }
            b.surfaces.push(surface);
        }
        tile.buildings.push(b);
    }
    for _ in 0..counts[1] {
        let kind = r.u8()?;
        r.u8()?;
        let code = r.u16()?;
        tile.areas.push(Area {
            kind,
            code,
            polygons: r.polygons()?,
        });
    }
    for _ in 0..counts[2] {
        tile.props.push(Prop {
            kind: r.u8()?,
            variant: r.u8()?,
            rotation: r.u16()? as f32 / 65535.0 * std::f32::consts::TAU,
            x: r.f32()?,
            z: r.f32()?,
            scale: r.f32()?,
        });
    }
    for _ in 0..counts[3] {
        tile.wires.push([r.f32()?, r.f32()?, r.f32()?, r.f32()?]);
    }
    for _ in 0..counts[4] {
        tile.walls
            .push([r.f32()?, r.f32()?, r.f32()?, r.f32()?, r.f32()?]);
    }
    for _ in 0..counts[5] {
        let mut sign = Sign {
            style: r.u8()?,
            color: r.u8()?,
            ..Sign::default()
        };
        r.u16()?;
        sign.x = r.f32()?;
        sign.y = r.f32()?;
        sign.z = r.f32()?;
        sign.nx = r.f32()?;
        sign.nz = r.f32()?;
        sign.width = r.f32()?;
        sign.height = r.f32()?;
        let text_length = r.u16()? as usize;
        let text = r.take(text_length)?;
        sign.text = std::str::from_utf8(text)
            .map_err(|_| CityError::InvalidUtf8)?
            .to_owned();
        tile.signs.push(sign);
    }
    r.finish()?;
    Ok(tile)
}

pub fn decode_prefab(bytes: &[u8]) -> Result<Prefab> {
    let mut r = Reader::new(bytes);
    let count = r.u32()? as usize;
    let byte_count = count.checked_mul(12).ok_or(CityError::UnexpectedEof)?;
    let mut positions = Vec::with_capacity(count * 3);
    for _ in 0..byte_count / 4 {
        positions.push(r.f32()?);
    }
    let colors = r
        .take(count.checked_mul(3).ok_or(CityError::UnexpectedEof)?)?
        .to_vec();
    r.finish()?;
    Ok(Prefab { positions, colors })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_and_truncated_data() {
        assert_eq!(decode_tile(&[0; 4]), Err(CityError::InvalidMagic));
        assert_eq!(
            decode_tile(&MAGIC.to_le_bytes()),
            Err(CityError::UnexpectedEof)
        );
        assert_eq!(
            decode_prefab(&1_u32.to_le_bytes()),
            Err(CityError::UnexpectedEof)
        );
    }

    #[test]
    fn decodes_empty_v7_tile() {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&MAGIC.to_le_bytes());
        bytes.extend_from_slice(&VERSION.to_le_bytes());
        bytes.extend_from_slice(&0_u16.to_le_bytes());
        bytes.extend_from_slice(&(-2_i32).to_le_bytes());
        bytes.extend_from_slice(&3_i32.to_le_bytes());
        for _ in 0..6 {
            bytes.extend_from_slice(&0_u32.to_le_bytes());
        }
        let tile = decode_tile(&bytes).unwrap();
        assert_eq!((tile.tx, tile.tz), (-2, 3));
        assert!(tile.buildings.is_empty());
    }
}
