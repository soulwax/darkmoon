# File: Resources/shaders/day_night.frag
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


    float timeOfDay = mod(pc.time * 0.1, 1.0);


    vec3 nightColor = vec3(0.2, 0.3, 0.6);
    vec3 dawnColor = vec3(1.0, 0.7, 0.5);
    vec3 dayColor = vec3(1.0, 1.0, 0.95);
    vec3 duskColor = vec3(0.9, 0.5, 0.4);

    vec3 lightColor;
    float brightness;

    if (timeOfDay < 0.25) {

        float t = timeOfDay * 4.0;
        lightColor = mix(nightColor, dawnColor, t);
        brightness = mix(0.3, 0.8, t);
    } else if (timeOfDay < 0.5) {

        float t = (timeOfDay - 0.25) * 4.0;
        lightColor = mix(dawnColor, dayColor, t);
        brightness = mix(0.8, 1.0, t);
    } else if (timeOfDay < 0.75) {

        float t = (timeOfDay - 0.5) * 4.0;
        lightColor = mix(dayColor, duskColor, t);
        brightness = mix(1.0, 0.7, t);
    } else {

        float t = (timeOfDay - 0.75) * 4.0;
        lightColor = mix(duskColor, nightColor, t);
        brightness = mix(0.7, 0.3, t);
    }


    vec3 finalColor = texColor.rgb * lightColor * brightness;

    outColor = vec4(finalColor, texColor.a);
}
