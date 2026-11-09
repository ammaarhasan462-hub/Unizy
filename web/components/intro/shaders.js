// GLSL for the intro: shared helpers, procedural night city (ground), lit-window buildings,
// and the raymarched sky + volumetric cloud layer.

export const CLOUD_BOTTOM = 700;
export const CLOUD_TOP = 1150;

const COMMON = /* glsl */ `
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float h31(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y);
}
float riverZ(float x){ return sin(x*0.0011)*420.0 + sin(x*0.0027+1.3)*160.0 - 250.0; }

// emitted light of the city at ground position p (metres). fw = pixel footprint in metres (anti-aliasing)
vec3 city(vec2 p, float t, float fw){
  const float S = 55.0;
  vec2 g = p / S;
  float r = length(p);
  float fall = smoothstep(11000.0, 1500.0, r);
  float park = smoothstep(0.62, 0.7, vnoise(p*0.0011 + 7.0));
  float rd = abs(p.y - riverZ(p.x));
  float river = 1.0 - smoothstep(58.0, 66.0, rd);
  float plaza = (1.0 - smoothstep(80.0, 95.0, abs(p.x))) * (1.0 - smoothstep(150.0, 175.0, abs(p.y - 20.0)));

  float dv = abs(fract(g.x + 0.5) - 0.5) * S;
  float dh = abs(fract(g.y + 0.5) - 0.5) * S;
  float mv = step(mod(floor(g.x + 0.5), 6.0), 0.5);
  float mh = step(mod(floor(g.y + 0.5), 6.0), 0.5);
  float f2 = fw*fw;
  float sv = 1.6 + mv*2.4 + f2; float sh = 1.6 + mh*2.4 + f2;
  float lv = exp(-dv*dv/(2.0*sv)) * (0.45 + mv*1.1) * sqrt((1.6+mv*2.4)/sv);
  float lh = exp(-dh*dh/(2.0*sh)) * (0.45 + mh*1.1) * sqrt((1.6+mh*2.4)/sh);
  vec3 sod = vec3(1.0, 0.5, 0.17);
  vec3 col = sod * (lv + lh);

  // street lamps and traffic
  float lamp = pow(max(0.0, cos(p.y*0.22)), 24.0) * exp(-dv*dv/(1.2+f2)) + pow(max(0.0, cos(p.x*0.22)), 24.0) * exp(-dh*dh/(1.2+f2));
  col += vec3(1.1, 0.85, 0.6) * lamp * 0.7 * step(fw, 6.0);
  float dirV = h21(vec2(floor(g.x+0.5), 3.0)) > 0.5 ? 1.0 : -1.0;
  float dirH = h21(vec2(floor(g.y+0.5), 9.0)) > 0.5 ? 1.0 : -1.0;
  float carV = pow(max(0.0, sin(p.y*0.035 - t*(1.5+mv*2.5)*dirV + h21(vec2(floor(g.x+0.5),1.0))*30.0)), 70.0) * exp(-dv*dv/(2.0+f2)) * (0.6+mv*1.4);
  float carH = pow(max(0.0, sin(p.x*0.035 - t*(1.5+mh*2.5)*dirH + h21(vec2(floor(g.y+0.5),2.0))*30.0)), 70.0) * exp(-dh*dh/(2.0+f2)) * (0.6+mh*1.4);
  col += mix(vec3(1.6,1.35,1.1), vec3(1.4,0.15,0.08), step(0.0, dirV)) * carV * 1.4;
  col += mix(vec3(1.6,1.35,1.1), vec3(1.4,0.15,0.08), step(0.0, dirH)) * carH * 1.4;

  // scattered courtyard / rooftop lights inside blocks
  vec2 q = p / 9.0; vec2 qi = floor(q); vec2 qf = fract(q) - 0.5;
  float sp = step(0.94, h21(qi)) * exp(-dot(qf,qf)*30.0/(1.0+f2*0.05));
  col += vec3(1.0, 0.78, 0.5) * sp * 0.9;

  col *= fall * (1.0 - park*0.85) * (1.0 - river) * (1.0 - plaza);
  vec3 base = vec3(0.0035, 0.004, 0.0055);
  col += base;

  // river: dark water with a shimmer of reflected lights, lit embankments
  float shimmer = pow(h21(floor(p*vec2(0.09, 0.7)) + floor(t*2.0)), 22.0);
  vec3 water = vec3(0.004, 0.006, 0.010) + sod * 0.35 * shimmer * fall;
  col = mix(col, water, river);
  float bank = exp(-pow(rd - 62.0, 2.0)/(10.0+f2));
  col += vec3(1.0, 0.72, 0.42) * bank * 1.1 * fall;

  // paved plaza in front of the landmark, washed by floodlights
  float wash = exp(-pow(max(0.0, abs(p.x)-10.0)/45.0, 2.0)) * exp(-pow((p.y-30.0)/70.0, 2.0));
  col = mix(col, vec3(0.03, 0.024, 0.018) + vec3(0.22, 0.14, 0.07)*wash, plaza);
  return col;
}
`;

export const QUAD_VS = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const CLOUD_FS = /* glsl */ `
precision highp float;
precision highp sampler3D;
uniform sampler3D uNoise;
uniform vec3 uCam;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform float uTime;
uniform vec3 uSun;
uniform float uBelow;
uniform float uSteps;
uniform vec3 uFog;
varying vec2 vUv;
const float BOT = ${CLOUD_BOTTOM.toFixed(1)};
const float TOP = ${CLOUD_TOP.toFixed(1)};
${COMMON}

vec3 horizonCol(vec3 rd){
  float sd = max(dot(normalize(vec3(rd.x, 0.0, rd.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0);
  return uFog + vec3(0.10, 0.045, 0.018) * pow(sd, 5.0);
}

vec3 sky(vec3 rd){
  float h = clamp(rd.y, 0.0, 1.0);
  vec3 zen = vec3(0.0035, 0.0065, 0.016);
  vec3 c = mix(horizonCol(rd), zen, pow(h, 0.42));
  float sd = max(dot(rd, uSun), 0.0);
  float band = exp(-abs(rd.y - 0.015) * 10.0);
  c += vec3(0.62, 0.25, 0.085) * pow(sd, 5.0) * band;
  c += vec3(0.95, 0.55, 0.28) * pow(sd, 60.0) * 0.55;
  c += vec3(2.4, 1.6, 1.0) * pow(sd, 2200.0) * 2.0;
  if (rd.y > 0.0) {
    vec3 sp = floor(rd * 700.0);
    float s = h31(sp);
    c += vec3(0.55, 0.6, 0.8) * step(0.9988, s) * smoothstep(0.02, 0.3, rd.y) * (1.0 - pow(sd, 3.0)) * 0.9;
  }
  return c;
}

float dens(vec3 p, bool cheap){
  float h = (p.y - BOT) / (TOP - BOT);
  if (h < 0.0 || h > 1.0) return 0.0;
  vec3 q = p * 0.00062 + vec3(uTime * 0.0012, 0.0, uTime * 0.0007);
  float n = texture(uNoise, q).r;
  float shape = smoothstep(0.0, 0.16, h) * smoothstep(1.0, 0.42, h);
  float lowf = texture(uNoise, q * 0.31 + 0.37).r;
  float cov = 0.5 + 0.22 * smoothstep(0.35, 0.7, lowf);
  float b = clamp((n * shape - (1.0 - cov)) / cov, 0.0, 1.0);
  if (cheap || b <= 0.0) return b;
  float d = texture(uNoise, q * 5.1 + vec3(0.0, uTime * 0.003, 0.0)).g;
  return clamp(b - (1.0 - d) * 0.35 * (1.0 - b), 0.0, 1.0);
}

float hg(float c, float g){ float g2 = g*g; return (1.0 - g2) / (4.0*3.14159*pow(1.0 + g2 - 2.0*g*c, 1.5)); }

void main(){
  vec2 ndc = vUv * 2.0 - 1.0;
  vec4 v = uInvProj * vec4(ndc, 1.0, 1.0); v /= v.w;
  vec3 rd = normalize((uCamWorld * vec4(v.xyz, 0.0)).xyz);
  vec3 ro = uCam;

  // background: sky, or the city through the gaps when looking down from above the clouds
  vec3 bg;
  if (rd.y < 0.0) {
    if (uBelow > 0.5) bg = horizonCol(rd);
    else {
      float tg = -ro.y / rd.y;
      vec3 gp = ro + rd * tg;
      bg = city(gp.xz, uTime, tg * 0.0035);
      bg = mix(horizonCol(rd), bg, exp(-tg * 0.00017));
    }
  } else bg = sky(rd);

  // march the cloud slab
  float t0 = (BOT - ro.y) / rd.y, t1 = (TOP - ro.y) / rd.y;
  float tn = min(t0, t1), tf = max(t0, t1);
  if (abs(rd.y) < 1e-4) { tn = (ro.y > BOT && ro.y < TOP) ? 0.0 : 1e9; tf = 1e9; }
  tn = max(tn, 0.0); tf = min(tf, 14000.0);
  vec3 acc = vec3(0.0); float T = 1.0;
  if (tf > tn) {
    float N = uSteps;
    float st = clamp((tf - tn) / N, 6.0, 160.0);
    float jit = h21(gl_FragCoord.xy + fract(uTime) * 61.0);
    float t = tn + st * jit;
    float cth = dot(rd, uSun);
    float ph = mix(hg(cth, 0.62), hg(cth, -0.2), 0.35) * 4.0 * 3.14159;
    vec3 sunc = vec3(1.0, 0.52, 0.25) * 1.35;
    for (int i = 0; i < 72; i++) {
      if (float(i) >= N || t > tf || T < 0.012) break;
      vec3 p = ro + rd * t;
      float d = dens(p, false);
      if (d > 0.002) {
        float ld = 0.0;
        for (int j = 0; j < 5; j++) ld += dens(p + uSun * (22.0 * (float(j) + 0.5)) + vec3(0.0, 9.0*float(j), 0.0), true) * 22.0;
        float beer = exp(-ld * 0.03);
        float powder = 1.0 - exp(-ld * 0.06);
        float hf = (p.y - BOT) / (TOP - BOT);
        vec3 amb = mix(vec3(0.010, 0.013, 0.022), vec3(0.042, 0.05, 0.072), hf);
        amb += vec3(0.05, 0.026, 0.010) * (1.0 - hf) * (1.0 - hf);
        vec3 L = amb + sunc * beer * mix(1.0, powder * 1.6, 0.55) * ph * 0.55;
        float a = 1.0 - exp(-d * 0.028 * st);
        // aerial perspective on distant cloud tops
        L = mix(L, horizonCol(rd), 1.0 - exp(-t * 0.00011));
        acc += T * L * a;
        T *= 1.0 - a;
      }
      t += st * (d > 0.002 ? 1.0 : 1.6);
    }
  }
  gl_FragColor = vec4(acc + T * bg, 1.0);
}
`;

export const GROUND_VS = /* glsl */ `
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;

export const GROUND_FS = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uFog;
uniform float uFogDensity;
varying vec3 vW;
${COMMON}
void main(){
  float fw = length(fwidth(vW.xz));
  vec3 col = city(vW.xz, uTime, fw);
  float d = length(vW - uCamPos);
  col = mix(uFog, col, exp(-d * uFogDensity));
  gl_FragColor = vec4(col, 1.0);
}
`;

export const BUILDING_VS = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
varying float vId;
void main(){
  mat4 m = modelMatrix * instanceMatrix;
  vec4 w = m * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(m) * normal);
  vId = float(gl_InstanceID);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const BUILDING_FS = /* glsl */ `
precision highp float;
uniform vec3 uCamPos;
uniform vec3 uFog;
uniform float uFogDensity;
uniform float uTime;
varying vec3 vW;
varying vec3 vN;
varying float vId;
${COMMON}
void main(){
  vec3 n = normalize(vN);
  vec3 col;
  if (abs(n.y) < 0.5) {
    bool sx = abs(n.x) > 0.5;
    float u = sx ? vW.z : vW.x;
    float side = sx ? (n.x > 0.0 ? 1.0 : 2.0) : (n.z > 0.0 ? 3.0 : 4.0);
    vec2 g = vec2(u / 3.3, vW.y / 3.7);
    vec2 cell = floor(g); vec2 f = fract(g);
    float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.2, f.y) * step(f.y, 0.8);
    float hs = h31(vec3(cell, vId * 1.37 + side * 17.0));
    float floorLit = step(0.35, h31(vec3(cell.y, vId, side)));
    float lit = step(0.6, hs) * floorLit * step(1.2, vW.y);
    vec3 warm = mix(vec3(1.0, 0.58, 0.26), vec3(0.95, 0.86, 0.72), h31(vec3(cell.yx, vId + 3.0)));
    vec3 facade = vec3(0.006, 0.0075, 0.011);
    vec3 pat = facade + win * (lit * warm * (1.4 + 2.4 * h31(vec3(cell, vId + 9.0))) + (1.0 - lit) * vec3(0.01, 0.014, 0.022));
    vec3 avg = facade + warm * 0.16 * 0.95;
    float aa = clamp(1.0 - max(fwidth(g.x), fwidth(g.y)) * 1.6, 0.0, 1.0);
    col = mix(avg, pat, aa);
    col += vec3(0.07, 0.04, 0.018) * exp(-vW.y * 0.05);
  } else {
    col = vec3(0.005, 0.006, 0.008);
    float red = step(0.86, h31(vec3(vId, 1.0, 2.0))) * pow(0.5 + 0.5 * sin(uTime * 2.2 + vId), 8.0);
    col += vec3(2.5, 0.12, 0.08) * red * exp(-dot(fract(vW.xz / 6.0) - 0.5, fract(vW.xz / 6.0) - 0.5) * 60.0);
  }
  float d = length(vW - uCamPos);
  col = mix(uFog, col, exp(-d * uFogDensity));
  gl_FragColor = vec4(col, 1.0);
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
  gl_PointSize = uSize * (0.5 + aSeed) / -mv.z;
  vA = 0.35 + 0.65 * aSeed;
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
  gl_FragColor = vec4(vec3(1.0, 0.78, 0.5) * 1.6, a * vA * uOpacity);
}
`;
