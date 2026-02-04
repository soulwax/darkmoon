# File: Resources/shaders/pixelate.frag
# version 450

layout(location = 0) in vec2 fragTexCoord;
layout(location = 0) out vec4 outColor;

layout(set = 0, binding = 0) uniform sampler2D screenTexture;

layout(push_constant) uniform PushConstants {
    vec2 screenSize;
    float time;
} pc;

void main() {

    float pixelSize = 8.0;


    vec2 pixelScale = vec2(pixelSize / pc.screenSize.x, pixelSize / pc.screenSize.y);
    vec2 pixelatedUV = floor(fragTexCoord / pixelScale) * pixelScale;


    pixelatedUV += pixelScale * 0.5;


    pixelatedUV = clamp(pixelatedUV, vec2(0.0), vec2(1.0));


    vec4 color = texture(screenTexture, pixelatedUV);


    float dither = fract(sin(dot(pixelatedUV, vec2(12.9898, 78.233))) * 43758.5453);
    color.rgb += (dither - 0.5) * 0.02;

    outColor = color;
}
