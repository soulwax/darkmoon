# File: Resources/shaders/shield.frag
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


    vec3 shieldColor = vec3(0.3, 0.7, 1.0);


    vec2 center = fragTexCoord - vec2(0.5);
    float angle = atan(center.y, center.x);
    float dist = length(center);


    float hexPattern = abs(sin(angle * 6.0 + pc.time * 2.0)) * 0.5 + 0.5;


    float edge = smoothstep(0.4, 0.45, dist) * (1.0 - smoothstep(0.45, 0.5, dist));
    float pulse = 0.7 + 0.3 * sin(pc.time * 4.0);


    float shimmer = sin(fragTexCoord.x * 20.0 + pc.time * 3.0) *
                    cos(fragTexCoord.y * 20.0 - pc.time * 2.0);
    shimmer = shimmer * 0.5 + 0.5;


    vec3 shieldEffect = shieldColor * (edge * pulse + hexPattern * shimmer * 0.3);


    vec3 finalColor = texColor.rgb + shieldEffect * 0.6;

    outColor = vec4(finalColor, texColor.a);
}
