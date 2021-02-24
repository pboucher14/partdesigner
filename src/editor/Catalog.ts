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
		if ((event.srcElement as HTMLDetailsElement).open && !this.initialized) {
			this.createCatalogUI();
		}
	}

	private onTogglePBOCatalog(event: MouseEvent) {
		if ((event.srcElement as HTMLDetailsElement).open && !this.pboinitialized) {
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
			new CatalogItem(1, "Front Right Side", "113Y1155Y11bcy1217y129dY0315Y03beY0457Y0a4X211bX01c2X02a1X03c0X0527Y06deX08edX0b5cX0e33X0117aX01539X01978X21e3fX02396X02985Z02cb8Z03014Z0339aZ0374bZ03b28Z03f32Z0436aZ047d1Z04c68Z05130Z0562aZ05b57Z060b8Z0664eY0721dX25e5Y06be5Y02fc5Y136f8Y03edbY05af4Y071b2Y03322Y03aaaY042e6Y06022z065b5z077b6Y036a9Y03e88Y0471fY07df2z0849cz0dbX2169X022bX0329X046bX07dbX0a19X0cbbX0fc9X0134bX01749X01bcbX220d9X0267bX07859X26e0X06650X0721fX07ecez2857cz23aacY142e8Y24be0Y13e8aY14721Y25078Y1714dy08b83Y0926dY07ddX06c1dX0785bX08f1X07221X07ed0Y08c67X08545Y07df6Z084a0Z09a04Y0a167Y08b1az09239z0a1dX0785dX0938dX0b62Y27ed2X08c69x09af0X0ca7Y28b87y0a97dY19271z199cez1b15dY1a0faY08581X0938fx0a291X0e3bY08c6bX09af2X0aa71X0fb5Y09a08y0b9f6Y0a16bY0c257Y0a90cz0b125z09391X0a293X0b291X01184Y29af4X0aa73X0baf2z2c394z21337Y2a981y0cb77z0d49cz0a295X0b293X06eaX28f9X0b68X0e3fX01186X01545X01984X01e4bX023a2X02991X03020Y03757X03f3eX247ddX0513cX05b63X0665aX07229X07ed8Z08586Z08c6fX09af6Z0a296Z0aa75Z0b294Z0baf4X0cc7bX2337dY0a9faY0cbf8z0d51fz0b1daz0ba37z0de08z0e7b8z07e7X2a25X0cc7X0fd5X01357X01755X01bd7X020e5X02687X02cc5X03b35X04377X24c75X05637X060c5X06c27X07865X09395X0c397X0d5a5X23759Y08c71Y03b0bY0935bY03f42Y09afay1434dY0a25dy147e3Y04c4bY05144y1560dy1"),
			new CatalogItem(2, "Front Left Side", "1a3y11fey1280y12f8y129dZ0324Z039dY0436Y03beZ0468Z0502Y05c0Y0a4X211bY01c2Y02a1Y03c0Y0527Y06deY08edY0b5cY0e33Y0117aY01539Y01978x21e3fY02396Y02985Z02cb8Z03014Z0339aZ0374bZ03b28Z03f32Z0436aZ047d1Z04c68Z05130Z0562aZ05b57Y0664eY0721dX215dY021dY0319Y0459Y05e5Y07c5Y0a01Y0ca1Y0fadY0132dY01729Y020b5Y02655Y06085Y06be5Y06b7Y079eY0dbX21bcbx27859X23016Y1374dy23f34Y16650X0721fX07eceZ2857cZ23373Y13affy2433fY18c4Y09d8Y06c1dX0785bX07221X07ed0Z0857eZ08c67Z0938cZ0b31Y0c76Y0785dX07ed2X08c69Z0938eZ09af0Z0a290Z0e06Y2f80Y28581X08c6bX09af2Z0a292Z0aa71Z0b290Z0114bY012feY09391X09af4X0aa73Z0b292Z0baf2Z2c394Z21508Y216f8Y2a295X06eaX28f9y0b68y0e3fy01186y01545y01984y01e4by023a2y02991y03020y03757y03f3ex247ddy0513cY05b63Z060c4Z0665aZ06c26Z07229Z07864Z07ed8Z08586Z08c6fZ09394Z09af6Z0a296Z0aa75Y0baf4Y0cc7bX2a0dy0cady0fb9y01339y01735y01bb5y020c1y02661y02c9dy0337dy03b09y04c45y05605Y0b255Y0c355Y01945Y01b76Y07e7X24377x2d5a5X23759Y08c71Y03b0bY0935bY03f42Y09afay1434dY0a25dy147e3Y04c4bY05144y1560dy1"),
			new CatalogItem(3, "Rear Right Side", "1a3y31fey3267y02dfy0280y32f8y33dy084Y0f3Y0192Y0269Y0380x04dfy068eY0895Y0afcY0dcby059y0b1Y0135Y01edY02e1Y059dy0775Y09a9Y0c41Y0f45y0427x086y1110cY0b3y112bfY0f7Y114c5Y1139Y116b5Y1198y118feZ01b4cZ01f3y1271y11dbfZ02054Z02e9y138ay14e9y0698y089fY0b06x1dd5y11114x114cby11902x11dc1Y02310Y0423y15a7y077fy09b3Y0f4fy116bby12037Y025cfY0c61x112e1x11b51x14eby18a1y228f9Z02c28Z05a9y19b5y269cy1b0ay02f82Z03304Z0783y1c4fy08a5y1ddby236b3Z03a8cZ09b9y1f55y2b0ey1dddy0111cY014d3Y0190ax11dc9y12318x128ffy12f86x136b5Y03e94Y0c53y1f57y012cfY016c3Y0203fy12c0by13a67Y0429fY01b59x125f9x13309x13759z13b36z13ee9z2431fz2ddfy1472dY0f59y14b95Y01120y15086Y012d3y1554fY047e3z14c7az150e3z255dbz214d9y15aa7Y016c9y15fd5Y01912y16598Y01b43y16b2fY01dd3Y07161Y02049Y07765Y02324Y0290by02f92Y036c1Y03ea0x14737y1508ex15aady1659cx17163Y07e0aY025e3Y02c17y032efY03a73Y04b9fy15fdby17767Y0847fY042d5x15585x16b65x1290dY08b9bY02c19Y09285Y02f96Y09a1cY032f3Y0a17fY036c7Y0a995Y03a79Y0b175Y03ea8Y0ba0eY042b3Y0c26fY04741Y1cb8fY14ba9Y1d475Y1509aY0de20Y05563Y0e78fY07ef2x18c16x15abby065aax07171x07e18x08ba7x09a26x0a99dx0ba14x0cb93x0de22x0f1c9y05fe9y0fbc5y085a1x1933ax16b73x077a9x084c3x092c9x0a1c3x0b1b9x0c2b3x0d4b9x0e7d3x0"),
			new CatalogItem(4, "Rear Left Side", "113y0155y01a3y31fey39y020Y04fY09eY0115Y01bcx029by03baY0521Y06d8Y08e7y0fy02fY06bY0cbY0157Y0313y0453Y05dfY07bfY09fby0280y32f8y3225x022Y0b58Y031Y0c9dY053Y1e31Y16fY1fabY1a4y1117aZ0134aZ0d1y111dY1153bZ0174aZ015fY11c6Y12a5Z032cZ03c4y052bY06e2Z07deZ08f1Z0a1cZ0b60Z0cbeZ0e37Z0fccZ0117eZ0134eZ0153dY0197cY0221Y145dy05e9Y0172dY01badY02a7Y11e45Z020deZ031fY13c8Y1239eZ02682Z0461Y1531Y1298fZ02cc2Z05efY16eaY13020Y07d1Y1337dY08fbY13759Y0a0fY13b0bY03ee9z1431fz1472dz14bc0z1b6cy13f42Y0cb1y1434dY0e45y147e3Y0fbfy14c4bY050e3z155dbz15aa7z16004z1118eY05144Y01341Y0560dY0154fY0198eZ01be0Z01e55Z020eeZ023acZ02690Z0299bZ02cceZ0302aZ033b0Z03761Z03b3eZ05b6dY0173fY0609bY01990Y03f4aZ14382Z147e9Z04c80Z05148Z05642Z05b6fZ060d0Z06666Y01bc1Y06bfdY01e59Y047ebZ24c82Z27237Y020cfY0783bY023b2Y0514cZ15646Z15b73Z060d4Z0666aZ06c36Z07239Z07874Z07ee8Y02671Y0855dY029a3Y08c81Y02cafY0936bY03034Y09b0aY03391Y0a26dY0376dY1aa8bY13b1fY1b26bY13f56Y0bb0cY04361Y0c36dY047f7y05156x05b7dx06674x07243x07ef2x08c89x09b10x0aa8fx0bb0ex0cc95y04c5fy0d57by08c16x19a26x15651x060dfx06c41x0787fx085a1x093afx0a2b1x0b2afx0c3b1x0933ax1a1c3x1"),
			new CatalogItem(5, "Motor Assembly", "0y17Y11ey04dX09cY0113X01baX0299X03b8X051fY16d6Y21y1dY12dy0c9Y05ddY17bdY242Y08dY0100Y05eY0baY0142Y082Y0f1Y0190Y0afY0133Y01ebY0181Y0254Y01dcY02ccY0176Y1245Y0354Y01d1Y12bdY03edY0498X171X0161X0223X0321X0463X0560X19y04fY2115Y029bY0521Y08e7Y0fy06bY2157Y0313Y05dfY09fbY08fY21a5Y0bcY2200Y0f3Y2135Y2247Y22bfY222y151Y1a0Y0117Y01beY029dX03bcY0523Y06daY08e9Y1b58Y231y16dY1cdY0159Y0219Y0455Y05e1Y07c1Y09fdY1c9dY2104Y0282Y0146Y02faY0194Y01efY0358Y13f1Y1325X0119Y029fY015bY0317Y01a9Y039fY0204Y0438Y01c2Y03c0Y021dY0459Y0286Y0504Y02feY05c2Y02a3Y03c2Y0529Y031bY045bY05e7Y03a3Y0506Y06b9Y143cY05c4Y07a0Y13c4Y06e2Y045dY07c9Y0508Y08c6Y05c6Y09daY052dY08f3Y05ebY0a07Y06bdY0b33Y07a4Y0c78Y06e6Y0b64Y07cdY0ca9Y08caY0e08Y09deY0f82Y08f7Y1e3dY0a0bY1fb7Y0b37Y1114dY0c7cY11300Y0b68Y0e3fY01186Y01545Y1cadY0fb9Y01339Y01735Y1e0cY0114fY0150aY01945Y1f86Y01302Y016faY01b76Y11986X21bd9X2")
		];
	}
	private onSelectPart(item: CatalogItem, event: MouseEvent) {
		editor.part = Part.fromString(item.string);
		editor.updateMesh(true);
		window.history.pushState({}, document.title, "?part=" + item.string);
		event.preventDefault();
	}
}