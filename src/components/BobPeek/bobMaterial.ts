import * as THREE from "three";

export type HeadYawDeformation = {
  angle: { value: number };
  collarY: number;
  chinY: number;
  pivotX: number;
  pivotZ: number;
  shirtStrap?: boolean;
};

export type CartoonizeOptions = {
  headYaw?: HeadYawDeformation;
  rimStrength?: number;
};

/** Match the approved strumming render's texture flattening, light ramp and grade. */
export function cartoonize(
  material: THREE.MeshStandardMaterial,
  maxAnisotropy: number,
  { headYaw, rimStrength = 0.5 }: CartoonizeOptions = {},
) {
  const m = material.clone();
  for (const texture of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap]) {
    if (texture) texture.anisotropy = maxAnisotropy;
  }
  m.normalScale.multiplyScalar(0.7);
  m.onBeforeCompile = (shader) => {
    if (headYaw) {
      shader.uniforms.bobHeadYaw = headYaw.angle;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>
uniform float bobHeadYaw;
varying vec3 bobModelPosition;`)
        .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
float bobNormalYaw = bobHeadYaw * smoothstep(${headYaw.collarY.toFixed(4)}, ${headYaw.chinY.toFixed(4)}, position.y);
mat2 bobNormalTurn = mat2(cos(bobNormalYaw), -sin(bobNormalYaw), sin(bobNormalYaw), cos(bobNormalYaw));
objectNormal.xz = bobNormalTurn * objectNormal.xz;`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>
float bobVertexYaw = bobHeadYaw * smoothstep(${headYaw.collarY.toFixed(4)}, ${headYaw.chinY.toFixed(4)}, position.y);
mat2 bobVertexTurn = mat2(cos(bobVertexYaw), -sin(bobVertexYaw), sin(bobVertexYaw), cos(bobVertexYaw));
transformed.xz = bobVertexTurn * (transformed.xz - vec2(${headYaw.pivotX.toFixed(4)}, ${headYaw.pivotZ.toFixed(4)})) + vec2(${headYaw.pivotX.toFixed(4)}, ${headYaw.pivotZ.toFixed(4)});
bobModelPosition = transformed;`);
    }
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
${headYaw ? "varying vec3 bobModelPosition;" : ""}`)
      .replace("#include <map_fragment>", `#ifdef USE_MAP
  vec4 bobMap = texture2D(map, vMapUv, 1.6);
  ${headYaw?.shirtStrap ? `float bobStrap = smoothstep(0.08, 0.14, bobModelPosition.y) * (1. - smoothstep(0.38, 0.43, bobModelPosition.y)) * smoothstep(-0.18, 0.08, bobModelPosition.x);
  float bobDarkNeutral = (1. - smoothstep(0.35, 0.68, max(max(bobMap.r, bobMap.g), bobMap.b))) * (1. - smoothstep(0.12, 0.35, max(max(bobMap.r, bobMap.g), bobMap.b) - min(min(bobMap.r, bobMap.g), bobMap.b)));
  bobMap.rgb = mix(bobMap.rgb, vec3(0.78), bobStrap * bobDarkNeutral);` : ""}
  diffuseColor *= bobMap;
#endif`)
      .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
{
  vec3 alb = max(diffuseColor.rgb, vec3(1e-3));
  float shade = dot(reflectedLight.directDiffuse / alb, vec3(0.3333)) * 3.14159;
  float s = shade * 3.;
  float banded = (floor(s) + smoothstep(0.35, 0.65, fract(s))) / 3.;
  reflectedLight.directDiffuse *= mix(1., banded / max(shade, 1e-3), 0.75);
  reflectedLight.directSpecular *= 0.6;
  reflectedLight.indirectSpecular *= 0.6;
}`)
      .replace("#include <dithering_fragment>", `#include <dithering_fragment>
vec3 graded = mix(vec3(dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722))), gl_FragColor.rgb, 1.3);
gl_FragColor.rgb = clamp((graded - 0.5) * 1.1 + 0.5, 0., 1.);`)
      .replace("#include <opaque_fragment>", `float fres = pow(1. - clamp(dot(normal, normalize(vViewPosition)), 0., 1.), 2.5);
outgoingLight += vec3(1., 0.96, 0.9) * fres * ${rimStrength.toFixed(3)};
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `bob-cartoon-${headYaw ? "weighted-head-yaw-v1" : "static"}-rim-${rimStrength}`;
  return m;
}
