// GATE-A SPIKE: delete after Gate A (BUILD-PLAN GA-2)
// One shader, two jobs, premultiplied-alpha blending:
//   mode 0: a trace ribbon (UV.y = -1..1 across the ribbon): soft Gaussian falloff plus a thin hot core, ADDED to the buffer (alpha 0).
//   mode 1: the persistence fade (a full-rect quad): multiplies the buffer by (1 - fade), so old traces decay.
shader_type canvas_item;
render_mode blend_premul_alpha;

uniform int mode = 0;
uniform float fade : hint_range(0.0, 1.0) = 0.1;
uniform float gain = 0.35;

void fragment() {
	if (mode == 1) {
		COLOR = vec4(0.0, 0.0, 0.0, fade);
	} else {
		float d = UV.y * UV.y;
		float glow = exp(-d * 4.5) * 0.55;       // wide soft halo
		float core = exp(-d * 38.0);             // thin bright core
		float edge = 1.0 - smoothstep(0.85, 1.0, abs(UV.y));
		float i = (glow + core) * edge * gain;
		COLOR = vec4(COLOR.rgb * i, 0.0);
	}
}
