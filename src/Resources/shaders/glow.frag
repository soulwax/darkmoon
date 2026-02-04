# File: Resources/shaders/glow.frag
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


    float pulse = 0.7 + 0.3 * sin(pc.time * 3.0);


    float brightness = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
    vec3 glowColor = vec3(0.5, 0.8, 1.0);


    vec3 finalColor = texColor.rgb + glowColor * brightness * pulse * 0.5;

    outColor = vec4(finalColor, texColor.a);
}
