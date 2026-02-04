# File: Resources/shaders/bloom.frag
# version 450

layout(location = 0) in vec2 fragTexCoord;
layout(location = 0) out vec4 outColor;

layout(set = 0, binding = 0) uniform sampler2D screenTexture;

layout(push_constant) uniform PushConstants {
    vec2 screenSize;
    float time;
} pc;

void main() {
    vec2 uv = fragTexCoord;
    vec2 texelSize = 1.0 / pc.screenSize;


    vec4 originalColor = texture(screenTexture, uv);


    float brightness = dot(originalColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float bloomThreshold = 0.7;
    vec3 bloomColor = originalColor.rgb * smoothstep(bloomThreshold, bloomThreshold + 0.2, brightness);


    vec3 blur = vec3(0.0);
    float blurRadius = 2.0;

    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 offset = vec2(float(x), float(y)) * texelSize * blurRadius;
            vec4 sampleColor = texture(screenTexture, uv + offset);
            float sampleBrightness = dot(sampleColor.rgb, vec3(0.2126, 0.7152, 0.0722));
            if (sampleBrightness > bloomThreshold) {
                blur += sampleColor.rgb;
            }
        }
    }
    blur /= 9.0;


    float bloomIntensity = 0.5;
    vec3 finalColor = originalColor.rgb + blur * bloomIntensity;


    finalColor = finalColor / (finalColor + vec3(1.0));

    outColor = vec4(finalColor, originalColor.a);
}
