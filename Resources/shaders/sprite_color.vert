# File: Resources/shaders/sprite_color.vert
# version 450

layout(location = 0) in vec2 inPosition;
layout(location = 1) in vec2 inTexCoord;
layout(location = 2) in vec4 inColor;

layout(location = 0) out vec4 fragColor;

void main() {

    vec2 screenSize = vec2(1280.0, 720.0);


    vec2 normalizedPos = (inPosition / screenSize) * 2.0 - 1.0;
    normalizedPos.y = -normalizedPos.y;

    gl_Position = vec4(normalizedPos, 0.0, 1.0);
    fragColor = inColor;
}
