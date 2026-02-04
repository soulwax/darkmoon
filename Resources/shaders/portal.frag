# File: Resources/shaders/portal.frag
# version 450

layout(location = 0) in vec2 fragTexCoord;
layout(location = 0) out vec4 outColor;

layout(set = 0, binding = 0) uniform sampler2D texSampler;

layout(push_constant) uniform PushConstants {
    vec2 screenSize;
    float time;
} pc;

void main() {
    vec2 center = fragTexCoord - vec2(0.5);
    float dist = length(center);
    float angle = atan(center.y, center.x);


    float spiral = angle + dist * 10.0 - pc.time * 2.0;
    vec2 distortedUV = fragTexCoord;
    distortedUV.x += sin(spiral) * dist * 0.3;
    distortedUV.y += cos(spiral) * dist * 0.3;

    vec4 texColor = texture(texSampler, distortedUV);


    vec3 innerColor = vec3(0.8, 0.3, 1.0);
    vec3 outerColor = vec3(0.3, 0.8, 1.0);
    vec3 portalColor = mix(innerColor, outerColor, dist * 2.0);


    float rings = sin(dist * 20.0 - pc.time * 5.0);
    rings = smoothstep(0.7, 1.0, rings);


    float vortex = 1.0 - smoothstep(0.0, 0.5, dist);


    vec3 finalColor = texColor.rgb * (1.0 - vortex * 0.7);
    finalColor += portalColor * (rings * 0.5 + vortex * 0.3);


    float particles = sin(spiral * 3.0) * sin(pc.time * 10.0 + dist * 30.0);
    particles = smoothstep(0.95, 1.0, particles);
    finalColor += portalColor * particles * 0.5;

    outColor = vec4(finalColor, texColor.a);
}
