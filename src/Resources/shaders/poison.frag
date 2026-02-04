# File: Resources/shaders/poison.frag
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


    vec3 poisonColor = vec3(0.4, 1.0, 0.3);


    float pulse = 0.6 + 0.4 * sin(pc.time * 3.0);


    vec3 finalColor = mix(texColor.rgb, poisonColor, 0.3 * pulse);


    float bubble = sin(fragTexCoord.x * 30.0 + pc.time * 2.0) *
                   cos(fragTexCoord.y * 30.0 - pc.time * 2.0);
    bubble = smoothstep(0.8, 1.0, bubble) * 0.2;

    finalColor += poisonColor * bubble;

    outColor = vec4(finalColor, texColor.a);
}
