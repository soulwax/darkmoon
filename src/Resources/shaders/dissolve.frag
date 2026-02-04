# File: Resources/shaders/dissolve.frag
# version 450

layout(location = 0) in vec2 fragTexCoord;
layout(location = 0) out vec4 outColor;

layout(set = 0, binding = 0) uniform sampler2D texSampler;

layout(push_constant) uniform PushConstants {
    vec2 screenSize;
    float time;
} pc;


float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
    vec4 texColor = texture(texSampler, fragTexCoord);


    float noise = hash(fragTexCoord * 100.0);


    float dissolveAmount = pc.time;


    float edgeWidth = 0.1;
    float edge = smoothstep(dissolveAmount - edgeWidth, dissolveAmount, noise);
    float edgeGlow = edge * (1.0 - smoothstep(dissolveAmount, dissolveAmount + edgeWidth, noise));


    if (noise < dissolveAmount) {
        discard;
    }


    vec3 glowColor = vec3(1.0, 0.6, 0.2);
    vec3 finalColor = mix(texColor.rgb, glowColor, edgeGlow * 2.0);

    outColor = vec4(finalColor, texColor.a);
}
