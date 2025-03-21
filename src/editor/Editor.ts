enum MouseMode {
	None,
	Manipulate,
	Translate,
	Rotate
}

class Editor {
	camera: Camera;
	partRenderer: MeshRenderer;
	partNormalDepthRenderer: NormalDepthRenderer;
	contourEffect: ContourPostEffect;
	wireframeRenderer: WireframeRenderer;
	part: Part;
	canvas: HTMLCanvasElement;

	translation: Vector3 = new Vector3(0, 0, 0);
	center: Vector3;
	rotationX: number = 45;
	rotationY: number = -20;
	zoom: number = 5;
	zoomStep = 0.9;

	mouseMode = MouseMode.None;
	lastMousePosition: [number, number];

	handles: Handles;

	editorState: EditorState;

	style: RenderStyle = RenderStyle.Contour;

	measurements: Measurements = new Measurements();
	previousMousePostion: [number, number];

	constructor() {
		var url = new URL(document.URL);
		if (url.searchParams.has("part")) {
			this.part = Part.fromString(url.searchParams.get("part"));
			if (url.searchParams.has("name")) {
				this.setName(url.searchParams.get("name"));
			}
		} else {
			this.part = Part.fromString(catalog.items[Math.floor(Math.random() * catalog.items.length)].string);
		}

		this.displayMeasurements();
		
		this.editorState = new EditorState();

		this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
		this.canvas.tabIndex = 0;
		this.camera = new Camera(this.canvas);
		
		this.partRenderer = new MeshRenderer();
		this.partRenderer.color = new Vector3(0.67, 0.7, 0.71);
		this.camera.renderers.push(this.partRenderer);

		this.wireframeRenderer = new WireframeRenderer();
		this.wireframeRenderer.enabled = false;
		this.camera.renderers.push(this.wireframeRenderer);

		this.partNormalDepthRenderer = new NormalDepthRenderer();
		this.camera.renderers.push(this.partNormalDepthRenderer);

		this.contourEffect = new ContourPostEffect();
		this.camera.renderers.push(this.contourEffect);

		this.handles = new Handles(this.camera);
		this.camera.renderers.push(this.handles);

		this.center = Vector3.zero();
		this.updateMesh(true);
		this.camera.size = this.zoom;
		this.camera.render();

		this.canvas.addEventListener("mousedown", (event: MouseEvent) => this.onMouseDown(event));
		this.canvas.addEventListener("mouseup", (event: MouseEvent) => this.onMouseUp(event));
		this.canvas.addEventListener("mousemove", (event: MouseEvent) => this.onMouseMove(event));
		this.canvas.addEventListener("contextmenu", (event: Event) => event.preventDefault());
		this.canvas.addEventListener("wheel", (event: WheelEvent) => this.onScroll(event));
		window.addEventListener("keydown", (event: KeyboardEvent) => this.onKeydown(event));
		document.getElementById("clear").addEventListener("click", (event: MouseEvent) => this.clear());
		document.getElementById("share").addEventListener("click", (event: MouseEvent) => this.share());
		document.getElementById("save-stl").addEventListener("click", (event: MouseEvent) => this.saveSTL());
		document.getElementById("save-studio").addEventListener("click", (event: MouseEvent) => this.saveStudioPart());
		document.getElementById("remove").addEventListener("click", (event: MouseEvent) => this.remove());
		document.getElementById("style").addEventListener("change", (event: MouseEvent) => this.setRenderStyle(parseInt((event.srcElement as HTMLSelectElement).value)));
        window.addEventListener("resize", (e: Event) => this.camera.onResize());
		document.getElementById("applymeasurements").addEventListener("click", (event: MouseEvent) => this.applyMeasurements());
		document.getElementById("resetmeasurements").addEventListener("click", (event: MouseEvent) => this.resetMeasurements());

		this.initializeEditor("type", (typeName: string) => this.setType(typeName));
		this.initializeEditor("orientation", (orientationName: string) => this.setOrientation(orientationName));
		this.initializeEditor("size", (sizeName: string) => this.setSize(sizeName));
		this.initializeEditor("rounded", (roundedName: string) => this.setRounded(roundedName));

		document.getElementById("blockeditor").addEventListener("toggle", (event: MouseEvent) => this.onNodeEditorClick(event));

		this.getNameTextbox().addEventListener("change", (event: Event) => this.onPartNameChange(event));
		this.getNameTextbox().addEventListener("keyup", (event: Event) => this.onPartNameChange(event));
	}

	private onNodeEditorClick(event: MouseEvent) {
		this.handles.visible = (event.srcElement as HTMLDetailsElement).open;
		this.camera.render();
	}

	private saveSTL() {
		STLExporter.saveSTLFile(this.part, this.measurements, this.getName());
	}

	private saveStudioPart() {
		StudioPartExporter.savePartFile(this.part, this.measurements, this.getName());
	}

	private initializeEditor(elementId: string, onchange: (value: string) => void) {
		var element = document.getElementById(elementId);
		for (var i = 0; i < element.children.length; i++) {
			var child = element.children[i];
			if (child.tagName.toLowerCase() == "label") {				
				child.addEventListener("click", (event: Event) => onchange(((event.target as HTMLElement).previousElementSibling as HTMLInputElement).value));
			}
		}
	}

	private clear() {
		this.part.blocks.clear();
		this.updateMesh();
	}

	private share() {
		var name = this.getName();
		var url = "?part=" + this.part.toString();
		if (name.length != 0) {
			url += '&name=' + encodeURIComponent(name);
		}
		window.history.pushState({}, document.title, url);
	}

	private remove() {
		this.part.clearBlock(this.handles.getSelectedBlock(), this.editorState.orientation);
		if (this.editorState.fullSize) {
			this.part.clearBlock(this.handles.getSelectedBlock().plus(FORWARD[this.editorState.orientation]), this.editorState.orientation);
		}
		this.updateMesh();
	}

	private setType(typeName: string) {
		this.editorState.type = BLOCK_TYPE[typeName];
		this.updateBlock();
	}

	private setOrientation(orientatioName: string) {
		this.editorState.orientation = ORIENTATION[orientatioName];
		this.handles.setMode(this.editorState.fullSize, this.editorState.orientation);
		this.updateBlock();
	}

	private setSize(sizeName: string) {
		this.editorState.fullSize = sizeName == "full";
		this.handles.setMode(this.editorState.fullSize, this.editorState.orientation);
		this.camera.render();
	}

	private setRounded(roundedName: string) {
		this.editorState.rounded = roundedName == "true";
		this.updateBlock();
	}

	private setRenderStyle(style: RenderStyle) {
		this.style = style;
		this.partNormalDepthRenderer.enabled = style == RenderStyle.Contour;
		this.contourEffect.enabled = style == RenderStyle.Contour;
		this.partRenderer.enabled = style != RenderStyle.Wireframe;
		this.wireframeRenderer.enabled = style == RenderStyle.SolidWireframe || style == RenderStyle.Wireframe;
		this.updateMesh();
	}

	private updateBlock() {
		this.part.placeBlockForced(this.handles.getSelectedBlock(), new Block(this.editorState.orientation, this.editorState.type, this.editorState.rounded));
		if (this.editorState.fullSize) {
			this.part.placeBlockForced(this.handles.getSelectedBlock().plus(FORWARD[this.editorState.orientation]),
				new Block(this.editorState.orientation, this.editorState.type, this.editorState.rounded));
		}
		this.updateMesh();
	}

	public updateMesh(center = false) {
		let mesh = new PartMeshGenerator(this.part, this.measurements).getMesh();
		if (this.partRenderer.enabled) {
			this.partRenderer.setMesh(mesh);
		}
		if (this.partNormalDepthRenderer.enabled) {
			this.partNormalDepthRenderer.setMesh(mesh);
		}
		if (this.wireframeRenderer.enabled) {
			this.wireframeRenderer.setMesh(mesh);
		}

		var newCenter = this.part.getCenter().times(-0.5);
		if (center) {
			this.translation = Vector3.zero();
		} else {
			this.translation = this.translation.plus(this.getRotation().transformDirection(this.center.minus(newCenter)));
		}
		this.center = newCenter;
		this.updateTransform();
		this.handles.updateTransforms();
		this.camera.render();
	}

	private getRotation(): Matrix4 {
		return Matrix4.getRotation(new Vector3(0, this.rotationX, this.rotationY));
	}

	private updateTransform() {
		this.camera.transform = 
			Matrix4.getTranslation(this.center)
			.times(this.getRotation())
			.times(Matrix4.getTranslation(this.translation.plus(new Vector3(0, 0, -15))));
	}

	private onMouseDown(event: MouseEvent) {
		this.canvas.focus();
		const {ctrlKey, shiftKey} = event;
		if (event.button === 0 && !ctrlKey && !shiftKey) {
			if (this.handles.onMouseDown(event)) {
				this.mouseMode = MouseMode.Manipulate;
			}
		} else if (event.button === 1 || shiftKey) {
			this.mouseMode = MouseMode.Translate;
			this.previousMousePostion = [event.clientX, event.clientY];
		} else if (event.button === 2 || ctrlKey) {
			this.mouseMode = MouseMode.Rotate;
		}
		event.preventDefault();
	}

	private onMouseUp(event: MouseEvent) {
		this.mouseMode = MouseMode.None;
		this.handles.onMouseUp();
		event.preventDefault();
	}

	private onMouseMove(event: MouseEvent) {
		switch (this.mouseMode) {
			case MouseMode.None:
			case MouseMode.Manipulate:
				this.handles.onMouseMove(event);
				break;
			case MouseMode.Translate:
				this.translation = this.translation.plus(new Vector3(event.clientX - this.previousMousePostion[0], -(event.clientY - this.previousMousePostion[1]), 0).times(this.camera.size / this.canvas.clientHeight));
				this.previousMousePostion = [event.clientX, event.clientY];
				this.updateTransform();
				this.camera.render();
				break;
			case MouseMode.Rotate:
				this.rotationX -= event.movementX * 0.6;
				this.rotationY = clamp(-90, 90, this.rotationY - event.movementY * 0.6);
				
				this.updateTransform();
				this.camera.render();
				break;
		}
	}

	private onScroll(event: WheelEvent) {
		this.zoom *= event.deltaY < 0 ? this.zoomStep : 1 / this.zoomStep;
		this.camera.size = this.zoom;
		this.camera.render();
	}

	private onKeydown(event: KeyboardEvent) {
		const keyActions: { [key: string]: () => void } = {
			'1': () => this.setType('pinhole'),
			'2': () => this.setType('axlehole'),
			'3': () => this.setType('pin'),
			'4': () => this.setType('axle'),
			'5': () => this.setType('solid'),
			'6': () => this.setType('balljoint'),
			'y': () => this.setOrientation('y'),
			'z': () => this.setOrientation('z'),
			'x': () => this.setOrientation('x'),
			'PageUp': () => this.handles.move(new Vector3(0, 1, 0)),
			'PageDown': () => this.handles.move(new Vector3(0, -1, 0)),
			'ArrowLeft': () => this.handles.move(new Vector3(0, 0, 1)),
			'ArrowRight': () => this.handles.move(new Vector3(0, 0, -1)),
			'ArrowUp': () => this.handles.move(new Vector3(-1, 0, 0)),
			'ArrowDown': () => this.handles.move(new Vector3(1, 0, 0)),
			'Backspace': () => this.remove(),
			'Delete': () => this.remove(),
		};

		if (event.key in keyActions && document.activeElement == this.canvas) {
			keyActions[event.key]();
		}
	}
	private displayMeasurements() {
		for (var namedMeasurement of NAMED_MEASUREMENTS) {
			namedMeasurement.applyToDom(this.measurements);
		}
	}

	public applyMeasurements() {
		for (var namedMeasurement of NAMED_MEASUREMENTS) {
			namedMeasurement.readFromDOM(this.measurements);
		}
		this.measurements.enforceConstraints();
		this.displayMeasurements();
		this.updateMesh();
	}

	private resetMeasurements() {
		this.measurements = new Measurements();
		this.displayMeasurements();
		this.updateMesh();
	}

	public getNameTextbox(): HTMLInputElement {
		return document.getElementById('partName') as HTMLInputElement;
	}

	public getName(): string {
		var name = this.getNameTextbox().value.trim();
		if (name.length == 0) {
			name = 'Part';
		}
		return name;
	}

	private onPartNameChange(event: Event) {
		var name = this.getNameTextbox().value.trim();
		if (name.length == 0) {
			document.title = 'Part Designer';
		} else {
			document.title = name + ' ⋅ Part Designer';
		}
	}

	public setName(name: string) {
		document.title = name + ' ⋅ Part Designer';
		this.getNameTextbox().value = name;
	}
}
