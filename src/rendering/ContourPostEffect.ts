class ContourPostEffect implements Renderer {

	shader: Shader;
    positions: WebGLBuffer;    
    
    constructor() {
        this.shader = new Shader(gl, COUNTOUR_VERTEX, CONTOUR_FRAGMENT);

		this.shader.setAttribute(gl, "vertexPosition");
		this.shader.setUniform(gl, "buffer");
		this.shader.setUniform(gl, "resolution");
		
		this.positions = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positions);
		var positions: number[] = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    }

    public render(camera: Camera) {
		gl.bindTexture(gl.TEXTURE_2D, camera.renderTexture);      
		gl.copyTexImage2D(gl.TEXTURE_2D, 0,	gl.RGBA, 0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positions);
        gl.vertexAttribPointer(this.shader.attributes["vertexPosition"], 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shader.attributes["vertexPosition"]);
      
        gl.useProgram(this.shader.program);
		
		gl.depthFunc(gl.ALWAYS);
		gl.depthMask(false);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, camera.renderTexture);
		gl.uniform1i(this.shader.attributes["depthBuffer"], 0);
		gl.uniform2f(this.shader.attributes["resolution"], gl.drawingBufferWidth, gl.drawingBufferHeight);
		
        gl.drawArrays(gl.TRIANGLES, 0, 6);
		gl.depthFunc(gl.LEQUAL);
		gl.depthMask(true);
    }
}