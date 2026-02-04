# File: Resources/shaders/psychedelic.frag
# version 450

layout(location = 0) in vec2 fragTexCoord;
layout(location = 0) out vec4 outColor;

layout(set = 0, binding = 0) uniform sampler2D screenTexture;

layout(push_constant) uniform PushConstants {
    vec2 screenSize;
    float time;
} pc;

void main() {
    vec2 uv = fragTexCoord;
    vec2 center = vec2(0.5, 0.5);


    vec2 dir = uv - center;
    float dist = length(dir);
    float angle = atan(dir.y, dir.x);


    float wave1 = sin(dist * 10.0 - pc.time * 2.0) * 0.02;
    float wave2 = cos(angle * 5.0 + pc.time * 1.5) * 0.015;
    float wave3 = sin(pc.time * 3.0 + dist * 15.0) * 0.01;

    vec2 distortedUV = uv + dir * (wave1 + wave2 + wave3);


    float colorPhase1 = pc.time * 0.5;
    float colorPhase2 = pc.time * 0.7;
    float colorPhase3 = pc.time * 0.9;

    vec3 colorShift = vec3(
        sin(colorPhase1 + dist * 5.0) * 0.5 + 0.5,
        sin(colorPhase2 + dist * 7.0) * 0.5 + 0.5,
        sin(colorPhase3 + dist * 9.0) * 0.5 + 0.5
    );


    vec4 screenColor = texture(screenTexture, distortedUV);


    screenColor.rgb = mix(screenColor.rgb, colorShift, 0.3);


    float pulse = sin(pc.time * 2.0) * 0.1 + 0.9;
    screenColor.rgb *= pulse;


    float chromaOffset = dist * 0.01;
    vec2 chromaUV1 = distortedUV + vec2(chromaOffset, 0.0);
    vec2 chromaUV2 = distortedUV - vec2(chromaOffset, 0.0);

    float r = texture(screenTexture, chromaUV1).r;
    float g = screenColor.g;
    float b = texture(screenTexture, chromaUV2).b;

    screenColor.rgb = mix(screenColor.rgb, vec3(r, g, b), 0.4);


    float rings = sin(dist * 20.0 - pc.time * 3.0) * 0.5 + 0.5;
    vec3 ringColor = vec3(
        sin(rings * 3.14159 + colorPhase1),
        sin(rings * 3.14159 + colorPhase2),
        sin(rings * 3.14159 + colorPhase3)
    ) * 0.3;
    screenColor.rgb += ringColor;


    float vignette = 1.0 - smoothstep(0.3, 1.0, dist);
    screenColor.rgb *= vignette;
    screenColor.rgb += (1.0 - vignette) * colorShift * 0.2;

    outColor = screenColor;
}
