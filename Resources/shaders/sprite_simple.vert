# File: Resources/shaders/sprite_simple.vert
# version 450

layout(location = 0) in vec2 inPosition;
layout(location = 1) in vec2 inTexCoord;
layout(location = 2) in vec4 inColor;

layout(location = 0) out vec2 fragTexCoord;
layout(location = 1) out vec4 fragColor;


layout(set = 1, binding = 0) uniform ScreenData {
    vec2 screenSize;
} screen;

void main() {

    vec2 normalizedPos = (inPosition / screen.screenSize) * 2.0 - 1.0;
    normalizedPos.y = -normalizedPos.y;

    gl_Position = vec4(normalizedPos, 0.0, 1.0);
    fragTexCoord = inTexCoord;
    fragColor = inColor;
}
