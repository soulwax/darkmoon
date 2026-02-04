# File: Resources/shaders/ghost.vert
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


    normalizedPos.x += sin(pc.time * 3.0 + normalizedPos.y * 10.0) * 0.01;

    gl_Position = vec4(normalizedPos, 0.0, 1.0);
    fragTexCoord = inTexCoord;
}
