// Reine Matrix-Komposition (Position, Rotation als Quaternion, Skalierung) für InstancedMesh-
// Transformationen – ohne geteiltes/mutierbares Objekt (Object3D „dummy“). Jeder Aufruf schreibt
// alle 16 Elemente vollständig neu, sodass aufeinanderfolgende Aufrufe (z. B. erst ein rotierter
// Zylinder, danach ein achsenparalleler Balken ohne Rotation) sich nicht gegenseitig beeinflussen
// können – Fix für: eine im dummy „übrig gebliebene“ Zylinder-Rotation hat andere InstancedMesh-
// Sorten (Profilstäbe, Verschlüsse, Kugelecken) im nächsten update() verzerrt.
// Formel identisch zu THREE.Matrix4.prototype.compose (spaltenweises Elemente-Array).
export function composeMatrix(px, py, pz, qx, qy, qz, qw, sx, sy, sz, out = new Array(16)) {
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;

  out[0] = (1 - (yy + zz)) * sx; out[1] = (xy + wz) * sx; out[2] = (xz - wy) * sx; out[3] = 0;
  out[4] = (xy - wz) * sy; out[5] = (1 - (xx + zz)) * sy; out[6] = (yz + wx) * sy; out[7] = 0;
  out[8] = (xz + wy) * sz; out[9] = (yz - wx) * sz; out[10] = (1 - (xx + yy)) * sz; out[11] = 0;
  out[12] = px; out[13] = py; out[14] = pz; out[15] = 1;
  return out;
}

export const IDENTITY_QUAT = [0, 0, 0, 1]; // qx, qy, qz, qw – keine Rotation
