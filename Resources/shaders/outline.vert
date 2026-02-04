# File: Resources/shaders/outline.vert
# version 450

layout(location = 0) in vec2 inPosition;
layout(location = 1) in vec2 inTexCoord;

layout(location = 0) out vec2 fragTexCoord;

layout(push_constant) uniform PushConstants {
    vec2 screenSize;
    float time;
} pc;

void main() {
    vec2 normalizedPos = (inPosition / pc.screenSize) * 2.0 - 1.0;
    normalizedPos.y = -normalizedPos.y;

    gl_Position = vec4(normalizedPos, 0.0, 1.0);
    fragTexCoord = inTexCoord;
}
