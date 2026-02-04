# File: Resources/shaders/outline.frag
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


    vec2 texelSize = 1.0 / textureSize(texSampler, 0);
    float outlineWidth = 2.0;


    float alpha = texColor.a;
    float maxAlpha = alpha;


    for (float x = -outlineWidth; x <= outlineWidth; x += outlineWidth) {
        for (float y = -outlineWidth; y <= outlineWidth; y += outlineWidth) {
            if (x == 0.0 && y == 0.0) continue;
            vec2 offset = vec2(x, y) * texelSize;
            float sampleAlpha = texture(texSampler, fragTexCoord + offset).a;
            maxAlpha = max(maxAlpha, sampleAlpha);
        }
    }


    bool isOutline = (alpha < 0.1) && (maxAlpha > 0.1);


    vec3 outlineColor = vec3(1.0, 1.0, 0.3);
    float pulse = 0.7 + 0.3 * sin(pc.time * 4.0);

    if (isOutline) {
        outColor = vec4(outlineColor * pulse, 1.0);
    } else {
        outColor = texColor;
    }
}
