class Catalog {
	private container: HTMLElement;
	private pbocontainer: HTMLElement;

	private initialized: boolean = false;
	private pboinitialized: boolean = false;

	public items: CatalogItem[];
	public pboitems: CatalogItem[];

	constructor() {
		this.container = document.getElementById("catalog");
		this.createCatalogItems();
		document.getElementById("catalog").addEventListener("toggle", (event: MouseEvent) => this.onToggleCatalog(event));

		this.pbocontainer = document.getElementById("pbocatalog");
		this.createPBOCatalogItems();
		document.getElementById("pbocatalog").addEventListener("toggle", (event: MouseEvent) => this.onTogglePBOCatalog(event));
	}

	private onToggleCatalog(event: MouseEvent) {
		if ((event.target as HTMLDetailsElement).open && !this.initialized) {
			this.createCatalogUI();
		}
	}

	private onTogglePBOCatalog(event: MouseEvent) {
		if ((event.target as HTMLDetailsElement).open && !this.pboinitialized) {
			this.createPBOCatalogUI();
		}
	}

	private createCatalogUI() {
		var oldRenderingContext = gl;
		var canvas = document.createElement("canvas");
		canvas.style.height = "64px";
		canvas.style.width = "64px";
		this.container.appendChild(canvas);

		var camera = new Camera(canvas, 2);
		camera.clearColor = new Vector3(0.859, 0.859, 0.859);
		var partRenderer = new MeshRenderer();
		partRenderer.color = new Vector3(0.67, 0.7, 0.71);
		var partNormalDepthRenderer = new NormalDepthRenderer();
		camera.renderers.push(partRenderer);
		camera.renderers.push(partNormalDepthRenderer);
		camera.renderers.push(new ContourPostEffect());
		var measurements = new Measurements();
		
		for (var item of this.items) {
			var catalogLink: HTMLAnchorElement = document.createElement("a");
			catalogLink.className = "catalogItem";
			catalogLink.href = "?part=" + item.string;
			catalogLink.title = item.name;
			this.container.appendChild(catalogLink);
			var itemCanvas = document.createElement("canvas");
			catalogLink.appendChild(itemCanvas);
			itemCanvas.style.height = "64px";
			itemCanvas.style.width = "64px";
			var mesh = new PartMeshGenerator(item.part, measurements).getMesh();
			partRenderer.setMesh(mesh);
			partNormalDepthRenderer.setMesh(mesh);
			camera.size = (item.part.getSize() + 2) * 0.41;
			camera.transform = Matrix4.getTranslation(item.part.getCenter().times(-0.5))
				.times(Matrix4.getRotation(new Vector3(0, 45, -30))
				.times(Matrix4.getTranslation(new Vector3(-0.1, 0, 0))));
			camera.render();
			var context = itemCanvas.getContext("2d");
			context.canvas.width = gl.canvas.width;
			context.canvas.height = gl.canvas.height;
			context.drawImage(canvas, 0, 0);

			let itemCopy = item;
			catalogLink.addEventListener("click", (event: MouseEvent) => this.onSelectPart(itemCopy, event));
		}
		gl = oldRenderingContext;
		this.initialized = true;
		this.container.removeChild(canvas);
	}

	private createPBOCatalogUI() {
		var oldRenderingContext = gl;
		var canvas = document.createElement("canvas");
		canvas.style.height = "64px";
		canvas.style.width = "64px";
		this.pbocontainer.appendChild(canvas);

		var camera = new Camera(canvas, 2);
		camera.clearColor = new Vector3(0.859, 0.859, 0.859);
		var partRenderer = new MeshRenderer();
		partRenderer.color = new Vector3(0.67, 0.7, 0.71);
		var partNormalDepthRenderer = new NormalDepthRenderer();
		camera.renderers.push(partRenderer);
		camera.renderers.push(partNormalDepthRenderer);
		camera.renderers.push(new ContourPostEffect());
		var measurements = new Measurements();
		
		for (var item of this.pboitems) {
			var catalogLink: HTMLAnchorElement = document.createElement("a");
			catalogLink.className = "catalogItem";
			catalogLink.href = "?part=" + item.string;
			catalogLink.title = item.name;
			this.pbocontainer.appendChild(catalogLink);
			var itemCanvas = document.createElement("canvas");
			catalogLink.appendChild(itemCanvas);
			itemCanvas.style.height = "64px";
			itemCanvas.style.width = "64px";
			var mesh = new PartMeshGenerator(item.part, measurements).getMesh();
			partRenderer.setMesh(mesh);
			partNormalDepthRenderer.setMesh(mesh);
			camera.size = (item.part.getSize() + 2) * 0.41;
			camera.transform = Matrix4.getTranslation(item.part.getCenter().times(-0.5))
				.times(Matrix4.getRotation(new Vector3(0, 45, -30))
				.times(Matrix4.getTranslation(new Vector3(-0.1, 0, 0))));
			camera.render();
			var context = itemCanvas.getContext("2d");
			context.canvas.width = gl.canvas.width;
			context.canvas.height = gl.canvas.height;
			context.drawImage(canvas, 0, 0);

			let itemCopy = item;
			catalogLink.addEventListener("click", (event: MouseEvent) => this.onSelectPart(itemCopy, event));
		}
		gl = oldRenderingContext;
		this.pboinitialized = true;
		this.pbocontainer.removeChild(canvas);
	}

	private createCatalogItems() {		
		this.items = [
			new CatalogItem(3713, "Bushing", "0z22z2"),
			new CatalogItem(32123, "Half Bushing", "0z2"),
			new CatalogItem(43093, "Axle to Pin Connector", "0z32z37z410z4"),
			new CatalogItem(6682, "Pin with Ball", "7z50z32z3"),
			new CatalogItem(2736, "Axle with Ball", "0z42z47z5"),
			new CatalogItem(6553, "Axle 1.5 with Perpendicular Axle Connector", "1ex210z07z42z40z433x2"),
			new CatalogItem(18651, "Axle 2m with Pin", "1ez432z47z410z40z32z3"),
			new CatalogItem(2853, "Crankshaft", "8z411z40z2"),
			new CatalogItem(32054, "Long Pin with Bushing Attached", "0z32z37z310z31ez232z2"),
			new CatalogItem(32138, "Double Pin With Perpendicular Axle Hole", "11y21by29z312z34fz372z30z32z31ez332z3"),
			new CatalogItem(40147, "Beam 1 x 2 with Axle Hole and Pin Hole", "7y10y2dy11y2"),
			new CatalogItem(43857, "Beam 2", "0y17y11y1dy1"),
			new CatalogItem(17141, "Beam 3", "0y17y11ey11y1dy12dy1"),
			new CatalogItem(32316, "Beam 5", "9cy14dy11ey17y10y1c9y169y12dy1dy11y1"),
			new CatalogItem(16615, "Beam 7", "1bay1113y19cy14dy11ey17y10y1215y1155y1c9y169y12dy1dy11y1"),
			new CatalogItem(41677, "Beam 2 x 0.5 with Axle Holes", "0y27y2"),
			new CatalogItem(6632, "Beam 3 x 0.5 with Axle Hole each end", "7y11ey20y2"),
			new CatalogItem(32449, "Beam 4 x 0.5 with Axle Hole each end", "7y11ey14dy20y2"),
			new CatalogItem(11478, "Beam 5 x 0.5 with Axle Holes each end", "7y11ey14dy19cy20y2"),
			new CatalogItem(32017, "Beam 5 x 0.5", "1ey14dy19cy17y10y1"),
			new CatalogItem(3704, "Axle 2", "0z42z47z410z4"),
			new CatalogItem(4519, "Axle 3", "7z410z41ez432z40z42z4"),
			new CatalogItem(2825, "Beam 1 x 4 x 0.5 with Boss", "7y11ey14dy20y21y2"),
			new CatalogItem(33299, "Half Beam 3 with Knob and Pin", "2dy342y04y217y2ay21ey3"),
			new CatalogItem(60484, "Beam 3 x 3 T-Shaped", "17x13bx11ex17x10x12ax15bx133x111x13x1"),
			new CatalogItem(6538, "Angle Connector", "7z210z20y11y1"),
			new CatalogItem(59443, "Axle Connector", "0z22z27z210z2"),
			new CatalogItem(15555, "Pin Joiner", "0z12z17z110z1"),
			new CatalogItem(36536, "Cross Block ", "9y2fy20z12z1"),
			new CatalogItem(42003, "Cross Block 1 x 3", "0z12z19z112z122y231y2"),
			new CatalogItem(32184, "Cross Block 1 x 3 with Two Axle holes", "0y21y29z112z122y231y2"),
			new CatalogItem(41678, "Cross Block 2 x 2 Split", "4z1bz10x219z12bz113x2"),
			new CatalogItem(32291, "Cross Block With Two Pinholes", "4z1bz13x219z12bz19x2"),
			new CatalogItem(32034, "Angle Connector #2", "0z22z27y11ez232z2dy1"),
			new CatalogItem(32039, "Through Axle Connector with Bushing", "0y21y29x213x2"),
			new CatalogItem(32014, "Angle Connector #6", "9y120z234z2fy10x23x2"),
			new CatalogItem(32126, "Toggle Joint Connector", "7z210z20x1"),
			new CatalogItem(44809, "Cross Block Bent 90 Degrees with Three Pinholes", "17z129z17x10y11y111x1"),
			new CatalogItem(55615, "Cross Block beam Bent 90 Degrees with 4 Pins", "17y142x18dz3c1z34x126y182z1b4z1e6x1181z31e3z31ey30y32dy31y364x1cx112ex1"),
			new CatalogItem(48989, "Cross Block Beam 3 with Four Pins", "0y31ey31y32dy34x117y142x126y114y382y323y3afy3cx164x1"),
			new CatalogItem(63869, "Cross Block 3 x 2", "1ex17x10x117z229z233x111x13x1"),
			new CatalogItem(92907, "Cross Block 2 x 2 x 2 Bent 90 Split", "2az143z166x035x213x217x07x20x2"),
			new CatalogItem(32557, "Cross Block 2 x 3 with Four Pinholes", "9z112z119x13dx10z12z1cx125x1"),
			new CatalogItem(10197, "Beam 1m with 2 Axles 90°", "7x10z42z417y426y411x1"),
			new CatalogItem(22961, "Beam 1 with Axle", "0z42z47x111x1"),
			new CatalogItem(15100, "Hole With pin", "0z32z37x111x1"),
			new CatalogItem(98989, "Cross Block 2 x 4", "7x10x117z1bz13bz124z17bz255z211x13x1"),
			new CatalogItem(27940, "Beam 1 Hole with 2 Axles 180", "7x11ez432z40z42z411x1"),
			new CatalogItem(87082, "Long Pin with Center Hole", "0z32z37x11ez332z311x1"),
			new CatalogItem(11272, "Cross Block 2 x 3", "7x211x233x23x220x24fx29x235x2"),
			new CatalogItem(32140, "Beam 2 x 4 Bent 90 Degrees, 2 and 4 holes", "a2y153y1cfy16fy151y16dy120y12fy17y2dy2"),
			new CatalogItem(32526, "Beam Bent 90 Degrees, 3 and 5 Holes", "1ey12dy14fy16by1a0y1cdy1119y115by11c2y111by1a4y121dy115dy1d1y1"),
			new CatalogItem(32056, "Beam 3 x 3 x 0.5 Bent 90", "0y27y11ey24fy1a0y2"),
			new CatalogItem(64179, "Beam Frame 5 x 7", "3bcz1466z122z136z1525z15f6z153z176z16dey1527x13c0y12a1x11c2y111bx1a4y17c5y1459y121dy1d1y15f9x1329x1169x129bz1322z19z112z11bay10y17x11ey14dx19cy1113x1215y11y12dy1c9y111x171x1161x1"),
			new CatalogItem(14720, "Beam I Frame", "115y19ex14fx120x19y1157y1fy1d5x173x135x11bey122y1219y131y19cy10y1c9y11y1"),
			new CatalogItem(53533, "Half Beam 3 with Fork", "11y13z38z31by135x073x1d5x17x01ex14dx1"),
			new CatalogItem(4261, "Steering Arm with Two Half Pins", "31z14bz162y322y319y04y2"),
			new CatalogItem(6572, "Half Beam Fork with Ball Joint", "7z010x232x170x23z58z320z050x29fx1116x2"),
			new CatalogItem(15460, "Hole with 3 Ball Joints", "0z52z57x11ez532z517y526y511x1")
		];
	}

	private createPBOCatalogItems() {		
		this.pboitems = [
			// General
			new CatalogItem(1, "Pin 2L", "0y01y04y3ay314y323y3"),
			new CatalogItem(2, "Axle pin 2L", "0y01y04y4ay414y423y4"),
			// Rewinder
			new CatalogItem(10, "Rewinder Front Right Side", "113Y2155Y21bcY0217Y029dY0315Y03beY0457Y0a4X211bX01c2X02a1X03c0X0527Y06deX08edX0b5cX0e33X0117aX01539X01978X21e3fX02396X02985Z02cb8Z03014Z0339aZ0374bZ03b28Z03f32Z0436aZ047d1Z04c68Z05130Z0562aZ05b57Z060b8Z0664eY0721dX25e5Y06be5Y02fc5Y136f8Y03edbY05af4Y071b2Y03322Y03aaaY042e6Y06022z065b5z077b6Y036a9Y03e88Y0471fY07df2z0849cz0dbX2169X022bX0329X046bX07dbX0a19X0cbbX0fc9X0134bX01749X01bcbX220d9X0267bX07859X26e0X06650X0721fX07ecez2857cz23aacY142e8Y24be0Y13e8aY14721Y25078Y1714dy08b83Y0926dY07ddX06c1dX0785bX08f1X07221X07ed0Y08c67X08545Y07df6Z084a0Z09a04Y0a167Y08b1az09239z0a1dX0785dX0938dX0b62Y27ed2X08c69x09af0X0ca7Y28b87y0a97dY19271z199cez1b15dY1a0faY08581X0938fx0a291X0e3bY08c6bX09af2X0aa71X0fb5Y09a08y0b9f6Y0a16bY0c257Y0a90cz0b125z09391X0a293X0b291X01184Y29af4X0aa73X0baf2z2c394z21337Y2a981y0cb77z0d49cz0a295X0b293X06eaX28f9X0b68X0e3fX01186X01545X01984X01e4bX023a2X02991X03020Y03757X03f3eX247ddX0513cX05b63X0665aX07229X07ed8Z08586Z08c6fX09af6Z0a296Z0aa75Z0b294Z0baf4X0cc7bX2337dY0a9faY0cbf8z0d51fz0b1daz0ba37z0de08z0e7b8z07e7X2a25X0cc7X0fd5X01357X01755X01bd7X020e5X02687X02cc5X03b35X04377X24c75X05637X060c5X06c27X07865X09395X0c397X0d5a5X23759Y08c71Y03b0bY0935bY03f42Y09afay1434dY0a25dy147e3Y04c4bY05144y1560dy1"),
			new CatalogItem(11, "Rewinder Front Left Side", "1a3Y21feY21bcX0280X0225X0306X029dZ0324Z039dY0436Y03beZ0468Z0502Y05c0Y0a4X211bY01c2Y02a1Y03c0Y0527Y06deY08edY0b5cY0e33Y0117aY01539Y01978x21e3fY02396Y02985Z02cb8Z03014Z0339aZ0374bZ03b28Z03f32Z0436aZ047d1Z04c68Z05130Z0562aZ05b57Y0664eY0721dX215dY021dY0319Y0459Y05e5Y07c5Y0a01Y0ca1Y0fadY0132dY01729Y020b5Y02655Y06085Y06be5Y06b7Y079eY0dbX21bcbx27859X23016Y1374dy23f34Y16650X0721fX07eceZ2857cZ23373Y13affy2433fY18c4Y09d8Y06c1dX0785bX07221X07ed0Z0857eZ08c67Z0938cZ0b31Y0c76Y0785dX07ed2X08c69Z0938eZ09af0Z0a290Z0e06Y2f80Y28581X08c6bX09af2Z0a292Z0aa71Z0b290Z0114bY012feY09391X09af4X0aa73Z0b292Z0baf2Z2c394Z21508Y216f8Y2a295X06eaX28f9y0b68y0e3fy01186y01545y01984y01e4by023a2y02991y03020y03757y03f3ex247ddy0513cY05b63Z060c4Z0665aZ06c26Z07229Z07864Z07ed8Z08586Z08c6fZ09394Z09af6Z0a296Z0aa75Y0baf4Y0cc7bX2a0dy0cady0fb9y01339y01735y01bb5y020c1y02661y02c9dy0337dy03b09y04c45y05605Y0b255Y0c355Y01945Y01b76Y07e7X24377x2d5a5X23759Y08c71Y03b0bY0935bY03f42Y09afay1434dY0a25dy147e3Y04c4bY05144y1560dy1"),
			new CatalogItem(12, "Rewinder Rear Right Side", "0y07X21eY04dY09cY0113Y21bay0299Y03b8Y051fY06d6y01y02dY069Y0c9Y0155Y2215y0311Y0451Y05ddY07bdy011X29X08e7Y09fbY013X022Y1b58Y231Y1c9dY253y1e31Z0fc6Z06fy1a4y1117aZ0134aZ0d1y111dy11c4y02a3y03c2Y0529x06e0x08efx0b5ex0e35x0117cY0153bY015fy121fy031by045bY0132fY0172bY05fbx07ddx0a1bx0cbdx0fcbx01c6y13c4y2197cZ01bceZ0221y145dy22a7y152dy01e45Z020deZ031fy15eby03c8y16e6y2239eZ02682Z0461y17cdy2531y16e8y08f7Y0b66Y0e3dx01184x01543x01982x01e49x023a0Y0298fY05efy17cfy0a0bY0cabY0265fY02c9bY0fd3x01355x01753x01bd5x020e3x06eay13020Z233a6Z27d1y18fby13759Y0a0fy13b0bY0b6cy13f42Z2437aZ2cb1y1e45y147e3Y0fbfy14c4bY0118eY05144Y01341Y0560dY0154fY0198ey01e55Y023acY0299bx0302ax03761x03f48x047e7x05146Y05b6dY0173fY01bbfy020cbY0266bY0560fY0609bY02ccfx033b1x03b3fx04381x04c7fx01990Y06666Y01bc1Y06bfdY01e59Y07237Y020cfY0783bY023b2Y07ee8Y02671Y0855dY029a3Y08c81Y02cafY0936bY03034Y19b0aY23391Y1a26dY2376dY0aa8bY03b1fY0b26bY03f56y047f5x05154x05b7bx06672x07241X27ef0x08c87x09b0ex0aa8dx0bb0cy04361y0c36dy04c8dx0564fx060ddx06c3fx0787dX2859fx093adx0a2afx0b2adx0"),
			new CatalogItem(13, "Rewinder Rear Left Side", "0y07X21eY04dY09cY0113Y21bay0299Y03b8Y051fY06d6y01y02dY069Y0c9Y0155Y2215y0311Y0451Y05ddY07bdy011X29Y08e7Y0fY09fbY022Y1b58Y231Y1c9dY253y1e31Z0fc6Z06fy1a4Y1117aZ0134aZ0d1Y111dY11c4Z022cZ02a3y03c2Y0529Z05faZ06e0Z07dcZ08efZ0a1aZ0b5eZ0cbcZ0e35Z0fcaZ0117cY0153bY015fY131by045bY0132fY0172bY01c6Y1197cZ01bceZ0221Y12a7Y11e45Z020deZ031fY13c8Y1239eZ02682Z0461Y1531Y1298fY05efY12c9bY06eaY13020Z233a6Z27d1Y18fby13759Y0a0fy13b0bY0b6cy13f42Z2437aZ2cb1y1e45Y047e3Y0fbfY04c4bY0118eY0154dZ0175cZ0198cZ01bdeZ01e53Z020ecZ023aaZ0268eZ02999Z02cccZ03028Z033aeZ05144Y01341Y0560dY0154fY03761Z13b3eZ13f48Z04380Z047e7Z04c7eZ05146Z05640Z05b6dY0173fY0609bY01990Y03f4aZ24382Z26666Y01bc1Y06bfdY01e59Y047ebZ14c82Z1514aZ05644Z05b71Z060d2Z06668Z06c34Z07237Y020cfY0783bY023b2Y07ee8Y02671Y0855dY029a3Y08c81Y02cafY0936bY03034Y19b0aY23391Y1a26dY2376dY0aa8bY03b1fY0b26bY03f56y047f5x05154x05b7bx06672x07241X27ef0x08c87x09b0ex0aa8dx0bb0cy04361y0c36dy04c8dx0564fx060ddx06c3fx0787dX2859fx093adx0a2afx0b2adx0"),
			new CatalogItem(14, "Rewinder Motor Assembly", "7Z010Z04dY09cZ0113Y0299Z0320Z051fZ05f0Z08e5Z0a10Z069Y0155Y04Y217Y042Y08dY0100Z01a3X027eY0399Y04fcY06afY08baY0b25Y0df8Y2baY0f1Y0190Z0267Y0133Y02dfY0181Y0254Z0367Y01dcY0400Y0354Y04abY03edY0569Y0345Y1498Y063bY03deY1556Y0722Y081fX120aX093fX11bcY0217Y019Y0280Y039bY0113dY0256Y22ceY249aY2558Y251Z074Z0117Y029dY0523Z05f4Z08e9Z0a14Z0e2fZ0fc4Z0159Y0315Y046Y291Y0104Y01a7Y039dY0500Y06b3Y08beY0b29Y0dfcY0113fY014faY2202Y026bY02e3Y036bY0404Y063fY1726Y11c0Y03beY02a1Y0527z05f8z03c2Y06e0X08c4X0b04Y1c49Y17ddX09eeX052bY08f1z0a1cz06e4Y0b62Y08f5z0a20z0e3bY0b66X0e3dx01184y01543y01337y01733y0e0aX0111aY112cdY1cc5X0fd3x0f9eX08f9Z2a24Z2b68Y0e3fy01984X01e4bY023a2Y02991Y03020Y03757Z23b34Z2cadY0fb9y020c1Y02661Y02c9dY0337dY01e08X02318Y125d7Y11bd7X020a0X01e4dX020e7X023a6Y22665Y2"),
			new CatalogItem(15, "Rewinder Wheel Drive Assembly", "1eY11x0dY02dY169Z094Z0c9x017Y042Y1aY0142Y014Z024Z0190Z01f4Z038Z155Z1254Z12d5Z16x010ax04fX08fY073X0a0Y2cdY2104Y2146Y2"),
			new CatalogItem(16, "Rewinder 12L Brace", "0Z22Z29X013X022X037X053X077X0a4X0dbX011dX016bX01c6X022fX02a7X032fX03c8X0473X0531X0603X06eaX07e7X08fbZ2a26Z2"),
			new CatalogItem(17, "Rewinder 13L Brace", "9Z012Z022Z036Z053Z076Z0a4Z0daZ011dZ016aZ01c6Z022eZ02a7Z032eZ03c8Z0472Z0531Z0602Z06eaZ07e6Z08fbZ0a26Z0b6cZ2ccaZ20Z22Z2"),
			new CatalogItem(18, "Rewinder 11L Inside Brace", "0X23X29X013X022X037X053X077X0a4X0dbX011dX016bX01c6X022fX02a7X032fX03c8X0473X0531X0603X06eaX27e7X2")
		];
	}

	private onSelectPart(item: CatalogItem, event: MouseEvent) {
		editor.part = Part.fromString(item.string);
		editor.updateMesh(true);
		window.history.pushState({}, document.title, "?part=" + item.string);
		event.preventDefault();
	}
}