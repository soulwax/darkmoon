# File: Resources/shaders/palette_swap.frag
# version 450

layout(location = 0) in vec2 fragTexCoord;
layout(location = 0) out vec4 outColor;

layout(set = 0, binding = 0) uniform sampler2D texSampler;

layout(push_constant) uniform PushConstants {
    vec2 screenSize;
    float time;
} pc;


vec3 originalPalette[4] = vec3[](
    vec3(0.2, 0.1, 0.05),
    vec3(0.6, 0.3, 0.15),
    vec3(0.9, 0.6, 0.3),
    vec3(1.0, 0.9, 0.7)
);

vec3 swapPalette1[4] = vec3[](
    vec3(0.1, 0.1, 0.3),
    vec3(0.2, 0.3, 0.7),
    vec3(0.4, 0.6, 1.0),
    vec3(0.8, 0.9, 1.0)
);

vec3 swapPalette2[4] = vec3[](
    vec3(0.2, 0.0, 0.1),
    vec3(0.6, 0.1, 0.2),
    vec3(0.9, 0.3, 0.4),
    vec3(1.0, 0.7, 0.8)
);


int findClosestColor(vec3 color, vec3 palette[4]) {
    int closest = 0;
    float minDist = distance(color, palette[0]);

    for (int i = 1; i < 4; i++) {
        float dist = distance(color, palette[i]);
        if (dist < minDist) {
            minDist = dist;
            closest = i;
        }
    }

    return closest;
}

void main() {
    vec4 texColor = texture(texSampler, fragTexCoord);


    int paletteIndex = int(mod(pc.time, 3.0));

    vec3 finalColor = texColor.rgb;

    if (paletteIndex > 0) {

        int colorIndex = findClosestColor(texColor.rgb, originalPalette);


        if (paletteIndex == 1) {
            finalColor = swapPalette1[colorIndex];
        } else if (paletteIndex == 2) {
            finalColor = swapPalette2[colorIndex];
        }
    }

    outColor = vec4(finalColor, texColor.a);
}
