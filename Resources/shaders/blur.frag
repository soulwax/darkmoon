# File: Resources/shaders/blur.frag
# version 450

layout(location = 0) in vec2 fragTexCoord;
layout(location = 0) out vec4 outColor;

layout(set = 0, binding = 0) uniform sampler2D texSampler;

layout(push_constant) uniform PushConstants {
    vec2 screenSize;
    float time;
} pc;

void main() {

    vec2 texelSize = 1.0 / textureSize(texSampler, 0);


    float blurAmount = 2.0;

    vec4 color = vec4(0.0);
    float total = 0.0;


    for (float x = -blurAmount; x <= blurAmount; x += blurAmount) {
        for (float y = -blurAmount; y <= blurAmount; y += blurAmount) {
            vec2 offset = vec2(x, y) * texelSize;
            color += texture(texSampler, fragTexCoord + offset);
            total += 1.0;
        }
    }

    outColor = color / total;
}
