# File: Resources/shaders/damage_flash.frag
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


    float flashIntensity = max(0.0, 1.0 - (pc.time / 0.3));


    vec3 flashColor = mix(texColor.rgb, vec3(1.0, 0.2, 0.2), flashIntensity * 0.7);

    outColor = vec4(flashColor, texColor.a);
}
