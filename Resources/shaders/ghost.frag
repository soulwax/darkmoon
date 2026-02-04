# File: Resources/shaders/ghost.frag
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


    float ghostAlpha = 0.4 + 0.1 * sin(pc.time * 2.0);
    vec3 ghostTint = vec3(0.8, 0.9, 1.2);

    outColor = vec4(texColor.rgb * ghostTint, texColor.a * ghostAlpha);
}
