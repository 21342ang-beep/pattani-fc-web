import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const zones = {
  A: [-40.7, 9.85, -67.9], B: [39, 9.85, -68.3], C: [66, 11.2, -59.6],
  D: [95.7, 7.15, 0.3], E: [66.1, 11.2, 59.6], F: [-0.8, 7.15, 67.8],
  G: [-65.9, 10.75, 60], I: [-97.5, 8.5, -10.4], J: [-67.3, 11.2, -59],
  AWAY: [-88.8, 8.95, 41.5], "VIP-A": [-20.3, 8.05, -66.9], "VIP-B": [18.6, 8.05, -66.9],
};

const STAND_SLOPE_DEG = 31;

function quaternionFromBasis(xAxis, yAxis, zAxis) {
  const m00 = xAxis[0], m01 = yAxis[0], m02 = zAxis[0];
  const m10 = xAxis[1], m11 = yAxis[1], m12 = zAxis[1];
  const m20 = xAxis[2], m21 = yAxis[2], m22 = zAxis[2];
  const trace = m00 + m11 + m22;
  let x; let y; let z; let w;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  return [x, y, z, w];
}

const matchLabels = [
  ["A", "A", "150.-", "dark"], ["B", "B", "150.-", "dark"],
  ["C", "C", "120.-", "dark"], ["D", "D", "100.-", "light"],
  ["E", "E", "120.-", "dark"], ["F", "F", "150.-", "dark"],
  ["G", "G", "120.-", "dark"], ["I", "I", "100.-", "light"],
  ["J", "J", "120.-", "dark"], ["AWAY", "AWAY", "200.-", "light"],
  ["VIP-A", "VIP A", "SEASON", "light"], ["VIP-B", "VIP B", "SEASON", "light"],
];

const seasonLabels = [
  ["A", "PREMIUM A", "2,000", "dark"], ["B", "PREMIUM B", "2,000", "dark"],
  ["F", "PREMIUM F", "2,000", "dark"], ["C", "GOLD C", "1,500", "dark"],
  ["E", "GOLD E", "1,500", "dark"], ["G", "GOLD G", "1,500", "dark"],
  ["J", "GOLD J", "1,500", "dark"], ["VIP-A", "VIP A", "2,500", "light"],
  ["VIP-B", "VIP B", "2,500", "light"],
];

const align4 = (value) => (value + 3) & ~3;

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function labelPng(title, subtitle, tone) {
  void tone;
  const svg = `
    <svg width="512" height="256" viewBox="0 0 512 256" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(180 256 128)" text-anchor="middle"
         font-family="Arial, Helvetica, sans-serif" font-weight="900" fill="#050505">
        <!-- The label plane is rotated toward the pitch. Store the two lines
             in reverse texture order so they appear zone-above-price on the
             sloped stand after that 180-degree in-plane rotation. -->
        <text x="256" y="106" font-size="80">${escapeXml(subtitle)}</text>
        <text x="256" y="210" font-size="86">${escapeXml(title)}</text>
      </g>
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function makeGlb(labels, outputName) {
  const chunks = [];
  const bufferViews = [];
  let byteOffset = 0;
  const append = (data, extra = {}) => {
    const paddedStart = align4(byteOffset);
    if (paddedStart > byteOffset) chunks.push(Buffer.alloc(paddedStart - byteOffset));
    byteOffset = paddedStart;
    const index = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: data.length, ...extra });
    chunks.push(data);
    byteOffset += data.length;
    return index;
  };

  const positions = Buffer.alloc(4 * 3 * 4);
  [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5]].flat().forEach((v, i) => positions.writeFloatLE(v, i * 4));
  const normals = Buffer.alloc(4 * 3 * 4);
  [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0].forEach((v, i) => normals.writeFloatLE(v, i * 4));
  const uvs = Buffer.alloc(4 * 2 * 4);
  [0, 1, 1, 1, 1, 0, 0, 0].forEach((v, i) => uvs.writeFloatLE(v, i * 4));
  const indices = Buffer.alloc(6 * 2);
  [0, 2, 1, 0, 3, 2].forEach((v, i) => indices.writeUInt16LE(v, i * 2));

  const positionView = append(positions, { target: 34962 });
  const normalView = append(normals, { target: 34962 });
  const uvView = append(uvs, { target: 34962 });
  const indexView = append(indices, { target: 34963 });
  const accessors = [
    { bufferView: positionView, componentType: 5126, count: 4, type: "VEC3", min: [-0.5, 0, -0.5], max: [0.5, 0, 0.5] },
    { bufferView: normalView, componentType: 5126, count: 4, type: "VEC3" },
    { bufferView: uvView, componentType: 5126, count: 4, type: "VEC2" },
    { bufferView: indexView, componentType: 5123, count: 6, type: "SCALAR", min: [0], max: [3] },
  ];

  const images = [];
  const textures = [];
  const materials = [];
  const meshes = [];
  const nodes = [];
  for (const [code, title, subtitle, tone] of labels) {
    const png = await labelPng(title, subtitle, tone);
    const imageIndex = images.length;
    images.push({ bufferView: append(png), mimeType: "image/png", name: `Label_${code}` });
    textures.push({ sampler: 0, source: imageIndex });
    materials.push({
      name: `Label_${code}`,
      pbrMetallicRoughness: { baseColorTexture: { index: imageIndex }, metallicFactor: 0, roughnessFactor: 1 },
      alphaMode: "BLEND",
      doubleSided: true,
      extensions: { KHR_materials_unlit: {} },
    });
    meshes.push({
      name: `Label_${code}`,
      primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: imageIndex }],
    });
    const [x, y, z] = zones[code];
    const pitch = STAND_SLOPE_DEG * Math.PI / 180;
    const radius = Math.hypot(x, z);
    const radialX = x / radius;
    const radialZ = z / radius;
    // Local X follows the seat row. Local Z climbs outward with the stand.
    // Local Y is the surface normal, keeping the text plane flush to the seats.
    // Point the label toward the pitch so it reads upright from the standard
    // stadium camera. Negating both in-plane axes rotates the artwork 180°
    // without changing its stand slope or surface normal.
    const xAxis = [-radialZ, 0, radialX];
    const zAxis = [-Math.cos(pitch) * radialX, -Math.sin(pitch), -Math.cos(pitch) * radialZ];
    const yAxis = [
      zAxis[1] * xAxis[2] - zAxis[2] * xAxis[1],
      zAxis[2] * xAxis[0] - zAxis[0] * xAxis[2],
      zAxis[0] * xAxis[1] - zAxis[1] * xAxis[0],
    ];
    const rotation = quaternionFromBasis(xAxis, yAxis, zAxis);
    const width = code.startsWith("VIP") || code === "AWAY" ? 22 : 19;
    nodes.push({ name: `Label_${code}`, mesh: imageIndex, translation: [x, y, z], rotation, scale: [width, 1, 9.5] });
  }

  const binLength = align4(byteOffset);
  if (binLength > byteOffset) chunks.push(Buffer.alloc(binLength - byteOffset));
  const bin = Buffer.concat(chunks);
  const gltf = {
    asset: { version: "2.0", generator: "Pattani FC stadium label generator" },
    extensionsUsed: ["KHR_materials_unlit"],
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes, meshes, materials, textures,
    samplers: [{ magFilter: 9729, minFilter: 9729, wrapS: 33071, wrapT: 33071 }],
    images, accessors, bufferViews,
    buffers: [{ byteLength: bin.length }],
  };
  const json = Buffer.from(JSON.stringify(gltf));
  const jsonPadded = Buffer.alloc(align4(json.length), 0x20);
  json.copy(jsonPadded);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + bin.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  await fs.writeFile(path.join("public", "models", outputName), Buffer.concat([header, jsonHeader, jsonPadded, binHeader, bin]));
}

await makeGlb(matchLabels, "pattani-stadium-labels-match.glb");
await makeGlb(seasonLabels, "pattani-stadium-labels-season.glb");
