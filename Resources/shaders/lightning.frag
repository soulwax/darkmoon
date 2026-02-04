# File: Resources/shaders/lightning.frag
# version 450

layout(location = 0) in vec2 fragTexCoord;
layout(location = 0) out vec4 outColor;

layout(set = 0, binding = 0) uniform sampler2D texSampler;

layout(push_constant) uniform PushConstants {
    vec2 screenSize;
    float time;
} pc;


float random(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec4 texColor = texture(texSampler, fragTexCoord);


    vec3 lightningColor = vec3(0.5, 0.7, 1.0);


    float flicker = random(vec2(floor(pc.time * 20.0)));
    float intensity = step(0.7, flicker);


    float arc = sin(fragTexCoord.x * 50.0 + pc.time * 10.0) *
                cos(fragTexCoord.y * 50.0 - pc.time * 15.0);
    arc = smoothstep(0.9, 1.0, arc);


    vec3 finalColor = texColor.rgb + lightningColor * (arc * intensity * 0.8);


    finalColor = mix(finalColor, finalColor * lightningColor * 1.3, 0.3);

    outColor = vec4(finalColor, texColor.a);
}
