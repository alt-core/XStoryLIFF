<script lang="ts">
  import { onMount } from "svelte";
  import type { NoiseLevel } from "../../lib/config.ts";

  interface Props {
    src: string;
    alt: string;
    noiseLevel: Exclude<NoiseLevel, "none">;
  }

  let { src, alt, noiseLevel }: Props = $props();

  /*
    資料のグリッチ演出（WebGL）。noise はときどき横に細い帯がずれ、heavyNoise は全体が崩れ続ける。
    キャンバスは幅100%で、高さは画像の縦横比に任せる（描画の大きさは読み込んだ時の幅で決める）。
    端末の画素比で描き（文字がぼやけない）、大きすぎる画像は扱える大きさへ縮め、SVGの画像も一度2Dキャンバスに描いてからテクスチャにする。
  */
  const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

  const fragmentShaderSource = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;
  uniform float u_time;
  uniform float u_glitchActive;
  uniform float u_glitchY;
  uniform float u_glitchOffset;
  uniform float u_intensity;
  uniform vec2 u_resolution;

  void main() {
    vec2 uv = v_texCoord;

    // 強い崩れ: 帯ごとに常にずらし続ける（元の位置には戻らない）
    float shouldInvert = 0.0;
    if (u_intensity > 1.0) {
      float baseHeight = 8.0 + 12.0 * fract(sin(u_glitchOffset * 12.9898) * 43758.5453);
      float blockHeight = baseHeight / u_resolution.y;
      float blockIndex = floor(uv.y / blockHeight);
      float offsetDir = mod(blockIndex, 2.0) == 0.0 ? 1.0 : -1.0;
      float offsetAmount = (mod(blockIndex, 7.0) - 3.0) * 0.02 + u_glitchOffset * 0.5;
      uv.x += offsetAmount * offsetDir;
      float yOffset = (mod(blockIndex, 3.0) - 1.0) * u_glitchOffset * 0.5;
      uv.y += yOffset;
      float rand = fract(sin(blockIndex * 78.233 + u_glitchOffset * 45.164) * 43758.5453);
      if (rand < 0.05) {
        shouldInvert = 1.0;
      }
    }

    // 弱い崩れ: ときどき細い帯を横にずらす
    if (u_glitchActive > 0.5 && u_intensity <= 1.0) {
      float lineCount = 2.0;
      float glitchHeight2 = 8.0 / u_resolution.y;
      float glitchHeight3 = 4.0 / u_resolution.y;
      float spacing = 0.1;

      for (float i = 0.0; i < 2.0; i += 1.0) {
        float yPos = fract(u_glitchY + i * spacing);
        float lineH = (mod(i, 2.0) == 0.0) ? glitchHeight2 : glitchHeight3;
        float offsetMult = (mod(i, 2.0) == 0.0) ? 1.0 : -0.7;

        if (abs(uv.y - yPos) < lineH * 0.5) {
          uv.x += u_glitchOffset * offsetMult * (1.0 + i * 0.02);
        }
      }
    }

    uv.x = fract(uv.x);
    vec4 color = texture2D(u_image, uv);
    if (shouldInvert > 0.5) {
      color.rgb = vec3(1.0) - color.rgb;
    }
    gl_FragColor = color;
  }
`;

  /** 多くの端末で扱えるテクスチャの大きさ */
  const MAX_TEXTURE_SIZE = 2048;

  let canvas = $state<HTMLCanvasElement>();
  // WebGL を使えない端末や、画像を描けない時は、崩さずに画像を出す（資料が何も見えなくならないように）
  let fallback = $state(false);

  function rasterize(image: HTMLImageElement) {
    const ratio = Math.min(1, MAX_TEXTURE_SIZE / Math.max(image.naturalWidth, image.naturalHeight));
    const source = document.createElement("canvas");
    source.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    source.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    source.getContext("2d")?.drawImage(image, 0, 0, source.width, source.height);
    return source;
  }

  function buffer(gl: WebGLRenderingContext, program: WebGLProgram, name: string, values: number[]) {
    const created = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, created);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  }

  onMount(() => {
    if (!canvas) return;
    const element = canvas;
    const gl = element.getContext("webgl", { preserveDrawingBuffer: true });
    if (!gl) {
      console.error("WebGL を使えないため、資料のグリッチを表示できません");
      fallback = true;
      return;
    }

    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    buffer(gl, program, "a_position", [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    buffer(gl, program, "a_texCoord", [0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]);

    const uniforms = {
      time: gl.getUniformLocation(program, "u_time"),
      glitchActive: gl.getUniformLocation(program, "u_glitchActive"),
      glitchY: gl.getUniformLocation(program, "u_glitchY"),
      glitchOffset: gl.getUniformLocation(program, "u_glitchOffset"),
      intensity: gl.getUniformLocation(program, "u_intensity"),
      resolution: gl.getUniformLocation(program, "u_resolution")
    };
    const state = { active: false, y: 0, offset: 0, endTime: 0, nextGlitchTime: 0 };
    let frame = 0;
    let disposed = false;

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onerror = () => {
      console.error(`資料の画像を読み込めませんでした: ${src}`);
      fallback = true;
    };
    image.onload = () => {
      if (disposed) return;
      // 見た目の大きさ（CSSピクセル）で崩れ方を計算し、描画は端末の画素比で行う
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = element.clientWidth;
      const height = width * (image.naturalHeight / image.naturalWidth);
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      gl.viewport(0, 0, element.width, element.height);

      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, rasterize(image));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      state.nextGlitchTime = Date.now();

      const render = () => {
        const now = Date.now();
        const intensity = noiseLevel === "heavyNoise" ? 10.0 : 1.0;

        if (noiseLevel === "heavyNoise") {
          // 強い崩れ: 短い間隔で崩れ方を変え続ける
          if (now > state.nextGlitchTime) {
            state.active = true;
            state.y = Math.random();
            state.offset = (Math.random() - 0.5) * 0.4;
            state.endTime = now + 2000 + Math.random() * 1000;
            state.nextGlitchTime = now + 30 + Math.random() * 50;
          }
        } else if (now > state.nextGlitchTime) {
          // 弱い崩れ: ときどき崩す
          state.active = true;
          state.y = Math.random();
          state.offset = (Math.random() - 0.5) * 0.15;
          state.endTime = now + 720 + Math.random() * 360;
          state.nextGlitchTime = now + 150 + Math.random() * 450;
        }

        // 崩れる時間が過ぎたら戻す
        if (state.active && now > state.endTime) state.active = false;

        gl.uniform1f(uniforms.time, now / 1000);
        gl.uniform1f(uniforms.glitchActive, state.active ? 1.0 : 0.0);
        gl.uniform1f(uniforms.glitchY, state.y);
        gl.uniform1f(uniforms.glitchOffset, state.offset);
        gl.uniform1f(uniforms.intensity, intensity);
        gl.uniform2f(uniforms.resolution, width, height);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        frame = requestAnimationFrame(render);
      };
      render();
    };
    image.src = src;

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
    };
  });
</script>

{#if fallback}
  <img class="glitch" {src} {alt} style:opacity={noiseLevel === "heavyNoise" ? 0.15 : 1} />
{:else}
  <div role="img" aria-label={alt}>
    <canvas bind:this={canvas} class="glitch" aria-hidden="true" style:opacity={noiseLevel === "heavyNoise" ? 0.15 : 1}></canvas>
  </div>
{/if}

<style>
  .glitch {
    display: block;
    width: 100%;
  }
</style>
