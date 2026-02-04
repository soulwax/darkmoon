# File: Resources/shaders/fade.frag
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


    float fadeAmount = clamp(pc.time, 0.0, 1.0);

    outColor = vec4(texColor.rgb * (1.0 - fadeAmount), texColor.a);
}
