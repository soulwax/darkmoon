# File: Resources/shaders/heat_distortion.frag
# version 450

layout(location = 0) in vec2 fragTexCoord;
layout(location = 0) out vec4 outColor;

layout(set = 0, binding = 0) uniform sampler2D texSampler;

layout(push_constant) uniform PushConstants {
    vec2 screenSize;
    float time;
} pc;

void main() {

    float distortionStrength = 0.015;


    float wave1 = sin(fragTexCoord.y * 15.0 - pc.time * 3.0) * distortionStrength;
    float wave2 = sin(fragTexCoord.y * 25.0 + pc.time * 4.0) * distortionStrength * 0.5;


    vec2 distortedUV = fragTexCoord;
    distortedUV.x += wave1 + wave2;

    vec4 texColor = texture(texSampler, distortedUV);


    vec3 heatTint = vec3(1.1, 0.95, 0.85);
    vec3 finalColor = texColor.rgb * heatTint;

    outColor = vec4(finalColor, texColor.a);
}
