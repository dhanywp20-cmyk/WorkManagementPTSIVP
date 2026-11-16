import type * as T from 'three';

const SINAR_UDARA_V = `attribute vec4 warnaSinar;
varying vec4 vWarna;
varying vec3 vNormal;
varying vec3 vLihat;
void main() {
  vWarna = warnaSinar;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vLihat = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const SINAR_UDARA_F = `varying vec4 vWarna;
varying vec3 vNormal;
varying vec3 vLihat;
void main() {
  float hadap = abs(dot(normalize(vNormal), normalize(vLihat)));
  gl_FragColor = vec4(vWarna.rgb, vWarna.a * hadap * hadap);
}`;
export const CAHAYA_UDARA = { lensa: 0.12, layar: 0.01, warna: [1, 0.96, 0.88] as const };
export function bahanSinarUdara(THREE: typeof T) {
  return new THREE.ShaderMaterial({
    vertexShader: SINAR_UDARA_V, fragmentShader: SINAR_UDARA_F,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
  });
}
