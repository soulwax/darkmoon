# File: Resources/shaders/vignette.frag
# version 450

layout(location = 0) in vec2 fragTexCoord;
layout(location = 0) out vec4 outColor;

layout(set = 0, binding = 0) uniform sampler2D texSampler;

layout(push_constant) uniform PushConstants {
    vec2 screenSize;
    float time;
} pc;

void main() {
    vec4 texColor = texture(texSampler, fragTexCoord);


    vec2 centerOffset = fragTexCoord - vec2(0.5);
    float dist = length(centerOffset);


    float vignetteStrength = 0.6;
    float vignetteRadius = 0.8;
    float vignette = smoothstep(vignetteRadius, vignetteRadius - 0.4, dist);


    vec3 darkColor = vec3(0.0);
    vec3 finalColor = mix(darkColor, texColor.rgb, vignette * (1.0 - vignetteStrength) + vignetteStrength);

    outColor = vec4(finalColor, texColor.a);
}
