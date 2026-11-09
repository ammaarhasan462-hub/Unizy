// GLSL for the intro: raymarched volumetric clouds over a physically based sunrise sky, with a high cirrus
// layer and London visible through the gaps; plus the floating dust in the library.
import { SKY_GLSL } from './atmo';

export const CLOUD_BOTTOM = 700;
export const CLOUD_TOP = 1200;
export const MAP_HALF = 1500; // the detailed ground map covers +-1500 m around UCL

export const QUAD_VS = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const CLOUD_FS = /* glsl */ `
precision highp float;
precision highp sampler3D;
uniform sampler3D uNoise;
uniform sampler2D uSkyLut;
uniform sampler2D uMap;
uniform vec3 uCam;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uSunCol;
uniform float uBelow;
uniform float uSteps;
uniform float uHaze;
varying vec2 vUv;
const float BOT = ${CLOUD_BOTTOM.toFixed(1)};
const float TOP = ${CLOUD_TOP.toFixed(1)};
const float MH = ${MAP_HALF.toFixed(1)};
${SKY_GLSL}
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float riverX(float z){ return -2150.0 + sin(z*0.00062)*260.0 + sin(z*0.0017 + 1.1)*120.0; }

vec3 hazeCol(vec3 rd){ return skyL(uSkyLut, normalize(vec3(rd.x, 0.02, rd.z))) + uSunCol * 0.02 * pow(max(dot(normalize(vec3(rd.x,0.0,rd.z)), uSun), 0.0), 10.0); }

// daylight London seen from above the clouds
vec3 groundCol(vec2 p, vec3 rd, float t){
  vec3 alb;
  if (abs(p.x) < MH && abs(p.y) < MH) alb = texture(uMap, vec2(p.x / (2.0*MH) + 0.5, 0.5 - p.y / (2.0*MH))).rgb;
  else {
    float n = vnoise(p*0.004) * 0.6 + vnoise(p*0.02) * 0.4;
    float green = smoothstep(0.62, 0.75, vnoise(p*0.0012 + 3.0));
    alb = mix(vec3(0.20, 0.18, 0.16), vec3(0.28, 0.26, 0.23), n);
    alb = mix(alb, vec3(0.13, 0.18, 0.08), green);
    vec2 g = abs(fract(p / vec2(95.0, 130.0)) - 0.5);
    alb = mix(vec3(0.09), alb, smoothstep(0.0, 0.06, min(g.x, g.y)));
  }
  float rv = abs(p.x - riverX(p.y));
  float water = 1.0 - smoothstep(110.0, 130.0, rv);
  vec3 lit = alb * (uSunCol * 0.3 + skyL(uSkyLut, vec3(0.0, 1.0, 0.0)) * 1.4);
  vec3 refl = skyL(uSkyLut, reflect(rd, vec3(0.0, 1.0, 0.0))) * 0.35 + uSunCol * 2.0 * pow(max(dot(reflect(rd, vec3(0,1,0)), uSun), 0.0), 220.0);
  lit = mix(lit, vec3(0.012, 0.02, 0.026) + refl, water);
  return lit;
}

float dens(vec3 p, bool cheap){
  float h = (p.y - BOT) / (TOP - BOT);
  if (h < 0.0 || h > 1.0) return 0.0;
  vec3 q = p * 0.00058 + vec3(uTime * 0.0011, 0.0, uTime * 0.0006);
  float n = texture(uNoise, q).r;
  float shape = smoothstep(0.0, 0.14, h) * smoothstep(1.0, 0.4, h);
  float lowf = texture(uNoise, q * 0.29 + 0.37).r;
  float cov = 0.46 + 0.24 * smoothstep(0.32, 0.72, lowf);
  float b = clamp((n * shape - (1.0 - cov)) / cov, 0.0, 1.0);
  if (cheap || b <= 0.0) return b;
  float d = texture(uNoise, q * 5.3 + vec3(0.0, uTime * 0.003, 0.0)).g;
  float d2 = texture(uNoise, q * 13.0).g;
  return clamp(b - (1.0 - d) * 0.34 * (1.0 - b) - (1.0 - d2) * 0.08 * (1.0 - b), 0.0, 1.0);
}

float hg(float c, float g){ float g2 = g*g; return (1.0 - g2) / (4.0*3.14159*pow(1.0 + g2 - 2.0*g*c, 1.5)); }

void main(){
  vec2 ndc = vUv * 2.0 - 1.0;
  vec4 v = uInvProj * vec4(ndc, 1.0, 1.0); v /= v.w;
  vec3 rd = normalize((uCamWorld * vec4(v.xyz, 0.0)).xyz);
  vec3 ro = uCam;
  float cth = dot(rd, uSun);

  // background
  vec3 bg;
  if (rd.y < 0.0) {
    if (uBelow > 0.5) bg = hazeCol(rd);
    else {
      float tg = -ro.y / rd.y;
      vec3 gp = ro + rd * tg;
      bg = mix(hazeCol(rd), groundCol(gp.xz, rd, tg), exp(-tg * uHaze * 0.55));
    }
  } else {
    bg = skyL(uSkyLut, rd);
    // sun disc with limb darkening and a soft corona
    float sd = acos(clamp(cth, -1.0, 1.0));
    float disc = smoothstep(0.0062, 0.0050, sd);
    bg += uSunCol * 40.0 * disc * (0.6 + 0.4 * sqrt(max(0.0, 1.0 - sd / 0.0062)));
    bg += uSunCol * (0.22 * exp(-sd * 60.0) + 0.035 * exp(-sd * 10.0));
    // high cirrus streaks catching the sunrise
    float tc = (7200.0 - ro.y) / rd.y;
    if (tc > 0.0) {
      vec3 cp = ro + rd * tc;
      float c = texture(uNoise, vec3(cp.x * 0.000045 + uTime * 0.0004, 0.37, cp.z * 0.00011)).r;
      c *= texture(uNoise, vec3(cp.x * 0.00012, 0.71, cp.z * 0.0003 + uTime * 0.0002)).g;
      float cd = smoothstep(0.28, 0.62, c) * 0.55 * smoothstep(0.0, 0.08, rd.y);
      vec3 cc = uSunCol * (0.7 + 3.0 * hg(cth, 0.55)) + skyL(uSkyLut, vec3(0.0, 1.0, 0.0)) * 0.9;
      bg = mix(bg, cc, cd);
    }
  }

  // clouds
  float t0 = (BOT - ro.y) / rd.y, t1 = (TOP - ro.y) / rd.y;
  float tn = min(t0, t1), tf = max(t0, t1);
  if (abs(rd.y) < 1e-4) { tn = (ro.y > BOT && ro.y < TOP) ? 0.0 : 1e9; tf = 1e9; }
  tn = max(tn, 0.0); tf = min(tf, 30000.0);
  vec3 acc = vec3(0.0); float T = 1.0;
  if (tf > tn) {
    float N = uSteps;
    float st = clamp((tf - tn) / N, 6.0, 180.0);
    float t = tn + st * ign(gl_FragCoord.xy + float(int(uTime * 30.0) % 8) * 5.588);
    vec3 skyUp = skyL(uSkyLut, vec3(0.0, 1.0, 0.0));
    vec3 skyH = hazeCol(rd);
    vec3 hz = skyH;
    for (int i = 0; i < 80; i++) {
      if (float(i) >= N || t > tf || T < 0.01) break;
      vec3 p = ro + rd * t;
      float d = dens(p, false);
      if (d > 0.002) {
        float ld = 0.0;
        for (int j = 0; j < 6; j++) ld += dens(p + uSun * (26.0 * (float(j) + 0.5)) + vec3(0.0, 7.0 * float(j), 0.0), true) * 26.0;
        float hf = (p.y - BOT) / (TOP - BOT);
        // multiple-scattering approximation (three octaves)
        vec3 S = vec3(0.0);
        float a = 1.0, b = 1.0, c = 1.0;
        for (int k = 0; k < 3; k++) {
          float ph = mix(hg(cth, 0.72 * c), hg(cth, -0.2 * c), 0.25);
          S += b * exp(-ld * 0.032 * a) * ph;
          a *= 0.45; b *= 0.55; c *= 0.5;
        }
        float powder = 1.0 - exp(-d * 0.06 * st * 2.0);
        vec3 amb = mix(skyH * 0.55, skyUp * 1.15, hf) * (0.55 + 0.45 * hf);
        vec3 L = amb + uSunCol * S * 4.5 * mix(0.55, 1.0, powder);
        float aT = 1.0 - exp(-d * 0.034 * st);
        L = mix(L, hz, 1.0 - exp(-t * uHaze * 0.5));
        acc += T * L * aT;
        T *= 1.0 - aT;
      }
      t += st * (d > 0.002 ? 1.0 : 1.7);
    }
  }
  gl_FragColor = vec4(acc + T * bg, 1.0);
}
`;

export const DUST_VS = /* glsl */ `
uniform float uTime;
uniform float uSize;
attribute float aSeed;
varying float vA;
void main(){
  vec3 p = position;
  p.y += mod(uTime * (0.04 + aSeed * 0.05) + aSeed * 10.0, 10.0) - 5.0;
  p.x += sin(uTime * 0.3 + aSeed * 20.0) * 0.25;
  p.z += cos(uTime * 0.25 + aSeed * 13.0) * 0.25;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (0.4 + aSeed) / -mv.z;
  vA = (0.25 + 0.75 * aSeed);
  gl_Position = projectionMatrix * mv;
}
`;

export const DUST_FS = /* glsl */ `
precision highp float;
uniform float uOpacity;
varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(c));
  gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * 1.4, a * vA * uOpacity * 0.6);
}
`;
