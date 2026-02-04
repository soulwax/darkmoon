# File: Resources/shaders/water.frag
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


    float waveSpeed1 = 1.0;
    float waveSpeed2 = 0.7;
    float waveSpeed3 = 1.3;

    float waveFrequency1 = 8.0;
    float waveFrequency2 = 12.0;
    float waveFrequency3 = 6.0;

    float waveAmplitude1 = 0.01;
    float waveAmplitude2 = 0.008;
    float waveAmplitude3 = 0.012;


    float wave1 = sin(uv.y * waveFrequency1 + pc.time * waveSpeed1) * waveAmplitude1;


    float wave2 = cos(uv.x * waveFrequency2 + pc.time * waveSpeed2) * waveAmplitude2;


    float wave3 = sin((uv.x + uv.y) * waveFrequency3 + pc.time * waveSpeed3) * waveAmplitude3;


    vec2 distortion = vec2(wave1 + wave3, wave2 + wave3);


    vec2 center = vec2(0.5, 0.5);
    vec2 dir = uv - center;
    float dist = length(dir);


    float rippleSpeed = 2.0;
    float rippleFrequency = 15.0;
    float rippleDecay = 1.0 / (1.0 + dist * 5.0);
    float ripple = sin(dist * rippleFrequency - pc.time * rippleSpeed) * rippleDecay * 0.005;

    vec2 rippleDistortion = normalize(dir) * ripple;
    distortion += rippleDistortion;


    vec2 distortedUV = uv + distortion;


    distortedUV = clamp(distortedUV, vec2(0.001), vec2(0.999));


    vec4 color = texture(screenTexture, distortedUV);


    vec3 waterTint = vec3(0.9, 1.0, 1.05);
    color.rgb *= mix(vec3(1.0), waterTint, 0.15);


    float brightnessVariation = sin(dist * 10.0 + pc.time * 1.5) * 0.05 + 1.0;
    color.rgb *= brightnessVariation;

    outColor = color;
}
