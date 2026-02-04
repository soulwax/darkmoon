# File: Resources/shaders/grayscale.frag
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


    float gray = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));


    float amount = clamp(pc.time, 0.0, 1.0);
    vec3 finalColor = mix(texColor.rgb, vec3(gray), amount);

    outColor = vec4(finalColor, texColor.a);
}
