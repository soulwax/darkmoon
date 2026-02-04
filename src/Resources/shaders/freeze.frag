# File: Resources/shaders/freeze.frag
# version 450

layout(location = 0) in vec2 fragTexCoord;
layout(location = 0) out vec4 outColor;

layout(set = 0, binding = 0) uniform sampler2D texSampler;

layout(push_constant) uniform PushConstants {
    vec2 screenSize;
    float time;
} pc;


float icePattern(vec2 uv) {
    float pattern = sin(uv.x * 20.0 + pc.time) * sin(uv.y * 20.0 - pc.time);
    return pattern * 0.5 + 0.5;
}

void main() {
    vec4 texColor = texture(texSampler, fragTexCoord);


    vec3 iceTint = vec3(0.6, 0.8, 1.2);


    float shimmer = icePattern(fragTexCoord) * 0.3;
    float sparkle = sin(pc.time * 5.0) * 0.1;


    float gray = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
    vec3 frozenColor = mix(vec3(gray), texColor.rgb, 0.5) * iceTint;


    frozenColor += vec3(shimmer + sparkle);

    outColor = vec4(frozenColor, texColor.a);
}
