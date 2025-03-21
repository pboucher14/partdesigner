let gl;
var editor;
var catalog;
window.onload = () => {
    catalog = new Catalog();
    editor = new Editor();
};
window.onpopstate = function (event) {
    if (event.state) {
        var url = new URL(document.URL);
        if (url.searchParams.has("part")) {
            editor.part = Part.fromString(url.searchParams.get("part"));
            editor.updateMesh(true);
        }
    }
};
class MeshGenerator {
    triangles = [];
    measurements;
    constructor(measurements) {
        this.measurements = measurements;
    }
    getMesh() {
        return new Mesh(this.triangles);
    }
    createQuad(v1, v2, v3, v4, flipped = false) {
        if (!flipped) {
            this.triangles.push(new Triangle(v1, v2, v4));
            this.triangles.push(new Triangle(v2, v3, v4));
        }
        else {
            this.triangles.push(new Triangle(v4, v2, v1));
            this.triangles.push(new Triangle(v4, v3, v2));
        }
    }
    createQuadWithNormals(v1, v2, v3, v4, n1, n2, n3, n4, flipped = false) {
        if (!flipped) {
            this.triangles.push(new TriangleWithNormals(v1, v2, v4, n1, n2, n4));
            this.triangles.push(new TriangleWithNormals(v2, v3, v4, n2, n3, n4));
        }
        else {
            this.triangles.push(new TriangleWithNormals(v4, v2, v1, n4.times(-1), n2.times(-1), n1.times(-1)));
            this.triangles.push(new TriangleWithNormals(v4, v3, v2, n4.times(-1), n3.times(-1), n2.times(-1)));
        }
    }
    createCircleWithHole(block, innerRadius, outerRadius, offset, inverted = false, square = false) {
        let center = block.getCylinderOrigin(this).plus(block.forward.times(offset));
        for (var i = 0; i < this.measurements.subdivisionsPerQuarter; i++) {
            let i1 = block.getOnCircle(Math.PI / 2 * i / this.measurements.subdivisionsPerQuarter);
            let i2 = block.getOnCircle(Math.PI / 2 * (i + 1) / this.measurements.subdivisionsPerQuarter);
            var o1 = i1;
            var o2 = i2;
            if (square) {
                if (Math.abs(o1.dot(block.right)) > Math.abs(o1.dot(block.up))) {
                    o1 = o1.times(1 / Math.abs(o1.dot(block.right)));
                }
                else {
                    o1 = o1.times(1 / Math.abs(o1.dot(block.up)));
                }
                if (Math.abs(o2.dot(block.right)) > Math.abs(o2.dot(block.up))) {
                    o2 = o2.times(1 / Math.abs(o2.dot(block.right)));
                }
                else {
                    o2 = o2.times(1 / Math.abs(o2.dot(block.up)));
                }
            }
            this.createQuad(i1.times(innerRadius).plus(center), i2.times(innerRadius).plus(center), o2.times(outerRadius).plus(center), o1.times(outerRadius).plus(center), inverted);
        }
    }
    createCircle(block, radius, offset, inverted = false) {
        let center = block.getCylinderOrigin(this).plus(block.forward.times(offset));
        for (var i = 0; i < this.measurements.subdivisionsPerQuarter; i++) {
            let p1 = block.getOnCircle(Math.PI / 2 * i / this.measurements.subdivisionsPerQuarter, radius);
            let p2 = block.getOnCircle(Math.PI / 2 * (i + 1) / this.measurements.subdivisionsPerQuarter, radius);
            if (inverted) {
                this.triangles.push(new Triangle(center.plus(p1), center, center.plus(p2)));
            }
            else {
                this.triangles.push(new Triangle(center, center.plus(p1), center.plus(p2)));
            }
        }
    }
    createCylinder(block, offset, radius, distance, inverted = false) {
        let center = block.getCylinderOrigin(this).plus(block.forward.times(offset));
        for (var i = 0; i < this.measurements.subdivisionsPerQuarter; i++) {
            let v1 = block.getOnCircle(Math.PI / 2 * i / this.measurements.subdivisionsPerQuarter);
            let v2 = block.getOnCircle(Math.PI / 2 * (i + 1) / this.measurements.subdivisionsPerQuarter);
            this.createQuadWithNormals(center.plus(v1.times(radius)), center.plus(v2.times(radius)), center.plus(v2.times(radius)).plus(block.forward.times(distance)), center.plus(v1.times(radius)).plus(block.forward.times(distance)), v1, v2, v2, v1, !inverted);
        }
    }
    tinyIndexToWorld(p) {
        let i = Math.floor((p + 1) / 3);
        let j = p - i * 3;
        var f = 0.5 * i;
        if (j == 0) {
            f += this.measurements.edgeMargin;
        }
        else if (j == 1) {
            f += 0.5 - this.measurements.edgeMargin;
        }
        return f;
    }
    tinyBlockToWorld(position) {
        return new Vector3(this.tinyIndexToWorld(position.x), this.tinyIndexToWorld(position.y), this.tinyIndexToWorld(position.z));
    }
}
class PartMeshGenerator extends MeshGenerator {
    smallBlocks;
    tinyBlocks;
    constructor(part, measurements) {
        super(measurements);
        this.smallBlocks = part.createSmallBlocks();
        this.createDummyBlocks();
        this.updateRounded();
        this.createTinyBlocks();
        this.processTinyBlocks();
        this.checkInteriors();
        this.mergeSimilarBlocks();
        this.renderPerpendicularRoundedAdapters();
        this.renderRoundedExteriors();
        this.renderInteriors();
        this.renderAttachments();
        this.renderTinyBlockFaces();
    }
    updateRounded() {
        var perpendicularRoundedAdapters = [];
        for (var block of this.smallBlocks.values()) {
            if (block.isAttachment) {
                block.rounded = true;
                continue;
            }
            if (!block.rounded) {
                continue;
            }
            var next = this.smallBlocks.getOrNull(block.position.plus(block.forward));
            if (next != null && next.orientation == block.orientation && next.quadrant != block.quadrant) {
                block.rounded = false;
                continue;
            }
            var previous = this.smallBlocks.getOrNull(block.position.minus(block.forward));
            if (previous != null && previous.orientation == block.orientation && previous.quadrant != block.quadrant) {
                block.rounded = false;
                continue;
            }
            var neighbor1 = this.smallBlocks.getOrNull(block.position.plus(block.horizontal));
            var neighbor2 = this.smallBlocks.getOrNull(block.position.plus(block.vertical));
            if ((neighbor1 == null || (neighbor1.isAttachment && neighbor1.forward.dot(block.right) == 0))
                && (neighbor2 == null || (neighbor2.isAttachment && neighbor2.forward.dot(block.up) == 0))) {
                continue;
            }
            if (this.createPerpendicularRoundedAdapterIfPossible(block)) {
                perpendicularRoundedAdapters.push(block);
                continue;
            }
            block.rounded = false;
        }
        // Remove adapters where the neighbor was later changed from rounded to not rounded
        var anythingChanged;
        do {
            anythingChanged = false;
            for (var block of perpendicularRoundedAdapters) {
                if (block.perpendicularRoundedAdapter != null && !block.perpendicularRoundedAdapter.neighbor.rounded) {
                    block.perpendicularRoundedAdapter = null;
                    block.rounded = false;
                    anythingChanged = true;
                }
            }
        } while (anythingChanged);
    }
    createDummyBlocks() {
        var addedAnything = false;
        for (var block of this.smallBlocks.values()) {
            if (!block.isAttachment) {
                continue;
            }
            var affectedPositions = [
                block.position,
                block.position.minus(block.horizontal),
                block.position.minus(block.vertical),
                block.position.minus(block.horizontal).minus(block.vertical)
            ];
            for (var forwardDirection = -1; forwardDirection <= 1; forwardDirection += 2) {
                var count = countInArray(affectedPositions, (p) => this.smallBlocks.containsKey(p.plus(block.forward.times(forwardDirection))));
                if (count != 0 && count != 4) {
                    var source = new Block(block.orientation, BlockType.Solid, true);
                    for (var position of affectedPositions) {
                        var targetPosition = position.plus(block.forward.times(forwardDirection));
                        if (!this.smallBlocks.containsKey(targetPosition)) {
                            this.smallBlocks.set(targetPosition, new SmallBlock(this.smallBlocks.get(position).quadrant, targetPosition, source));
                        }
                    }
                    addedAnything = true;
                }
            }
        }
        if (addedAnything) {
            this.createDummyBlocks();
        }
    }
    createPerpendicularRoundedAdapterIfPossible(block) {
        var neighbor1 = this.smallBlocks.getOrNull(block.position.plus(block.horizontal));
        var neighbor2 = this.smallBlocks.getOrNull(block.position.plus(block.vertical));
        var hasHorizontalNeighbor = neighbor2 == null && neighbor1 != null && neighbor1.forward.dot(block.horizontal) != 0 && neighbor1.rounded;
        var hasVerticalNeighbor = neighbor1 == null && neighbor2 != null && neighbor2.forward.dot(block.vertical) != 0 && neighbor2.rounded;
        if (hasHorizontalNeighbor == hasVerticalNeighbor) {
            return false;
        }
        var adapter = new PerpendicularRoundedAdapter();
        adapter.directionToNeighbor = hasVerticalNeighbor ? block.vertical : block.horizontal;
        adapter.isVertical = hasVerticalNeighbor;
        adapter.neighbor = hasHorizontalNeighbor ? neighbor1 : neighbor2;
        adapter.facesForward = block.forward.dot(adapter.neighbor.horizontal.plus(adapter.neighbor.vertical)) < 0;
        adapter.sourceBlock = block;
        if (!this.smallBlocks.containsKey(block.position.plus(block.forward.times(adapter.facesForward ? 1 : -1)))) {
            return false;
        }
        block.perpendicularRoundedAdapter = adapter;
        return true;
    }
    createTinyBlocks() {
        this.tinyBlocks = new VectorDictionary();
        for (let block of this.smallBlocks.values()) {
            if (block.isAttachment) {
                continue;
            }
            let pos = block.position;
            for (var a = -1; a <= 1; a++) {
                for (var b = -1; b <= 1; b++) {
                    for (var c = -1; c <= 1; c++) {
                        if (this.isSmallBlock(pos.plus(new Vector3(a, 0, 0)))
                            && this.isSmallBlock(pos.plus(new Vector3(0, b, 0)))
                            && this.isSmallBlock(pos.plus(new Vector3(0, 0, c)))
                            && this.isSmallBlock(pos.plus(new Vector3(a, b, c)))
                            && this.isSmallBlock(pos.plus(new Vector3(a, b, 0)))
                            && this.isSmallBlock(pos.plus(new Vector3(a, 0, c)))
                            && this.isSmallBlock(pos.plus(new Vector3(0, b, c)))) {
                            this.createTinyBlock(pos.times(3).plus(new Vector3(a, b, c)), block);
                        }
                    }
                }
            }
        }
        for (let block of this.smallBlocks.values()) {
            if (!block.isAttachment) {
                continue;
            }
            for (var a = -2; a <= 2; a++) {
                var neighbor = block.position.plus(block.forward.times(sign(a)));
                if (!this.smallBlocks.containsKey(neighbor) || (Math.abs(a) >= 2 && this.smallBlocks.get(neighbor).isAttachment)) {
                    continue;
                }
                for (var b = -1; b <= 0; b++) {
                    for (var c = -1; c <= 0; c++) {
                        this.createTinyBlock(block.position.times(3).plus(block.forward.times(a)).plus(block.horizontal.times(b)).plus(block.vertical.times(c)), block);
                    }
                }
            }
        }
    }
    isTinyBlock(position) {
        return this.tinyBlocks.containsKey(position) && !this.tinyBlocks.get(position).isAttachment;
    }
    pushBlock(smallBlock, forwardFactor) {
        var nextBlock = this.smallBlocks.getOrNull(smallBlock.position.plus(smallBlock.forward.times(forwardFactor)));
        for (var a = -2; a <= 2; a++) {
            for (var b = -2; b <= 2; b++) {
                var from = smallBlock.position.times(3)
                    .plus(smallBlock.right.times(a))
                    .plus(smallBlock.up.times(b))
                    .plus(smallBlock.forward.times(forwardFactor));
                var to = from.plus(smallBlock.forward.times(forwardFactor));
                if (!this.tinyBlocks.containsKey(to)) {
                    continue;
                }
                if (!this.tinyBlocks.containsKey(from)) {
                    this.tinyBlocks.remove(to);
                    continue;
                }
                if (smallBlock.orientation == nextBlock.orientation) {
                    if (Math.abs(a) < 2 && Math.abs(b) < 2) {
                        this.tinyBlocks.get(to).rounded = true;
                    }
                }
                else {
                    this.createTinyBlock(to, this.tinyBlocks.get(from));
                }
            }
        }
    }
    processTinyBlocks() {
        // Disable interiors when adjacent quadrants are missing
        for (var block of this.tinyBlocks.values()) {
            if (block.isCenter
                && !block.isAttachment
                && (block.hasInterior || block.rounded)
                && (!this.isTinyBlock(block.position.minus(block.horizontal.times(3))) || !this.isTinyBlock(block.position.minus(block.vertical.times(3))))) {
                for (var a = -1; a <= 1; a++) {
                    for (var b = -1; b <= 1; b++) {
                        var position = block.position.plus(block.right.times(a)).plus(block.up.times(b));
                        if (this.tinyBlocks.containsKey(position)) {
                            this.tinyBlocks.get(position).rounded = false;
                            this.tinyBlocks.get(position).hasInterior = false;
                        }
                    }
                }
            }
        }
        for (var smallBlock of this.smallBlocks.values()) {
            var nextBlock = this.smallBlocks.getOrNull(smallBlock.position.plus(smallBlock.forward));
            // Offset rounded to non rounded transitions to make them flush
            if (smallBlock.rounded && nextBlock != null && !nextBlock.rounded && smallBlock.perpendicularRoundedAdapter == null) {
                this.pushBlock(smallBlock, 1);
            }
            var previousBlock = this.smallBlocks.getOrNull(smallBlock.position.minus(smallBlock.forward));
            // Offset rounded to non rounded transitions to make them flush
            if (smallBlock.rounded && previousBlock != null && !previousBlock.rounded && smallBlock.perpendicularRoundedAdapter == null) {
                this.pushBlock(smallBlock, -1);
            }
            if (smallBlock.rounded && nextBlock != null && nextBlock.rounded && smallBlock.orientation != nextBlock.orientation) {
                this.pushBlock(smallBlock, 1);
            }
            if (smallBlock.rounded && previousBlock != null && previousBlock.rounded && smallBlock.orientation != previousBlock.orientation) {
                this.pushBlock(smallBlock, -1);
            }
        }
    }
    // Sets HasInterior to false for all tiny blocks that do not form coherent blocks with their neighbors
    checkInteriors() {
        for (var block of this.tinyBlocks.values()) {
            if (!block.isCenter || !block.hasInterior) {
                continue;
            }
            for (var a = 0; a <= 1; a++) {
                for (var b = 1 - a; b <= 1; b++) {
                    var neighborPos = block.position.minus(block.horizontal.times(3 * a)).minus(block.vertical.times(3 * b));
                    if (!this.tinyBlocks.containsKey(neighborPos)) {
                        block.hasInterior = false;
                    }
                    else {
                        var neighbor = this.tinyBlocks.get(neighborPos);
                        if (block.orientation != neighbor.orientation
                            || block.type != neighbor.type
                            || neighbor.localX != block.localX - a * block.directionX
                            || neighbor.localY != block.localY - b * block.directionY) {
                            block.hasInterior = false;
                        }
                    }
                }
            }
        }
    }
    getPerpendicularRoundedNeighborOrNull(block) {
        var verticalNeighbor = this.smallBlocks.getOrNull(block.smallBlockPosition.plus(block.vertical));
        var horizontalNeighbor = this.smallBlocks.getOrNull(block.smallBlockPosition.plus(block.horizontal));
        var neighbor = verticalNeighbor != null ? verticalNeighbor : horizontalNeighbor;
        var verticalOrHorizontal = verticalNeighbor != null ? block.vertical : block.horizontal;
        if (neighbor != null && neighbor.rounded && neighbor.forward.dot(verticalOrHorizontal) != 0) {
            return neighbor;
        }
        else {
            return null;
        }
    }
    getPerpendicularRoundedNeighborOrNull2(block) {
        var smallBlock = this.smallBlocks.get(block.smallBlockPosition);
        if (smallBlock.perpendicularRoundedAdapter != null) {
            return smallBlock.perpendicularRoundedAdapter.neighbor;
        }
        else {
            return null;
        }
    }
    preventMergingForPerpendicularRoundedBlock(block1, block2) {
        if (!block1.rounded || !block2.rounded || !block1.isCenter) {
            return false;
        }
        var neighbor1 = this.getPerpendicularRoundedNeighborOrNull(block1);
        var neighbor2 = this.getPerpendicularRoundedNeighborOrNull(block2);
        var inside1 = neighbor1 != null && block1.position.minus(neighbor1.position.times(3)).dot(neighbor1.vertical.plus(neighbor1.horizontal)) <= 0;
        var inside2 = neighbor2 != null && block2.position.minus(neighbor2.position.times(3)).dot(neighbor2.vertical.plus(neighbor2.horizontal)) <= 0;
        return inside1 != inside2 || (inside1 && inside2 && !neighbor1.position.equals(neighbor2.position));
    }
    mergeSimilarBlocks() {
        for (var block of this.tinyBlocks.values()) {
            if (block.isExteriorMerged) {
                continue;
            }
            var amount = 0;
            while (true) {
                var pos = block.position.plus(block.forward.times(amount + 1));
                if (!this.tinyBlocks.containsKey(pos)) {
                    break;
                }
                var nextBlock = this.tinyBlocks.get(pos);
                if (nextBlock.orientation != block.orientation
                    || nextBlock.quadrant != block.quadrant
                    || nextBlock.isAttachment != block.isAttachment
                    || nextBlock.hasInterior != block.hasInterior
                    || (nextBlock.isAttachment && (nextBlock.type != block.type))
                    || nextBlock.rounded != block.rounded
                    || this.isTinyBlock(block.position.plus(block.right)) != this.isTinyBlock(nextBlock.position.plus(block.right))
                    || this.isTinyBlock(block.position.minus(block.right)) != this.isTinyBlock(nextBlock.position.minus(block.right))
                    || this.isTinyBlock(block.position.plus(block.up)) != this.isTinyBlock(nextBlock.position.plus(block.up))
                    || this.isTinyBlock(block.position.minus(block.up)) != this.isTinyBlock(nextBlock.position.minus(block.up))
                    || this.preventMergingForPerpendicularRoundedBlock(this.tinyBlocks.get(block.position.plus(block.forward.times(amount))), nextBlock)) {
                    break;
                }
                amount += nextBlock.exteriorMergedBlocks;
                nextBlock.isExteriorMerged = true;
                if (nextBlock.exteriorMergedBlocks != 1) {
                    break;
                }
            }
            block.exteriorMergedBlocks += amount;
        }
        for (var block of this.tinyBlocks.values()) {
            if (block.isInteriorMerged || !block.hasInterior) {
                continue;
            }
            var amount = 0;
            while (true) {
                var pos = block.position.plus(block.forward.times(amount + 1));
                if (!this.tinyBlocks.containsKey(pos)) {
                    break;
                }
                var nextBlock = this.tinyBlocks.get(pos);
                if (!nextBlock.hasInterior
                    || nextBlock.orientation != block.orientation
                    || nextBlock.quadrant != block.quadrant
                    || nextBlock.type != block.type) {
                    break;
                }
                amount += nextBlock.interiorMergedBlocks;
                nextBlock.isInteriorMerged = true;
                if (nextBlock.interiorMergedBlocks != 1) {
                    break;
                }
            }
            block.interiorMergedBlocks += amount;
        }
    }
    isSmallBlock(position) {
        return this.smallBlocks.containsKey(position) && !this.smallBlocks.get(position).isAttachment;
    }
    createTinyBlock(position, source) {
        this.tinyBlocks.set(position, new TinyBlock(position, source));
    }
    getNextBlock(block, interior) {
        var mergedAmount = interior ? block.interiorMergedBlocks : block.exteriorMergedBlocks;
        return this.tinyBlocks.getOrNull(block.position.plus(block.forward.times(mergedAmount)));
    }
    getPreviousBlock(block) {
        return this.tinyBlocks.getOrNull(block.position.minus(block.forward));
    }
    hasOpenEnd(block, interior) {
        var pos = block.position;
        var mergedAmount = interior ? block.interiorMergedBlocks : block.exteriorMergedBlocks;
        return !this.tinyBlocks.containsKey(pos.plus(block.forward.times(mergedAmount)))
            && !this.tinyBlocks.containsKey(pos.plus(block.forward.times(mergedAmount)).minus(block.horizontal.times(3)))
            && !this.tinyBlocks.containsKey(pos.plus(block.forward.times(mergedAmount)).minus(block.vertical.times(3)))
            && !this.tinyBlocks.containsKey(pos.plus(block.forward.times(mergedAmount)).minus(block.horizontal.times(3)).minus(block.vertical.times(3)));
    }
    hasOpenStart(block) {
        var pos = block.position;
        return !this.tinyBlocks.containsKey(pos.minus(block.forward))
            && !this.tinyBlocks.containsKey(pos.minus(block.forward).minus(block.horizontal.times(3)))
            && !this.tinyBlocks.containsKey(pos.minus(block.forward).minus(block.vertical.times(3)))
            && !this.tinyBlocks.containsKey(pos.minus(block.forward).minus(block.horizontal.times(3)).minus(block.vertical.times(3)));
    }
    hideStartEndFaces(position, block, forward) {
        var direction = forward ? block.forward : block.forward.times(-1);
        this.hideFaceIfExists(position, direction);
        this.hideFaceIfExists(position.minus(block.horizontal), direction);
        this.hideFaceIfExists(position.minus(block.vertical), direction);
        this.hideFaceIfExists(position.minus(block.vertical).minus(block.horizontal), direction);
    }
    hideFaceIfExists(position, direction) {
        if (this.tinyBlocks.containsKey(position)) {
            this.tinyBlocks.get(position).hideFace(direction);
        }
    }
    hideOutsideFaces(centerBlock) {
        var vertical = centerBlock.vertical;
        var horizontal = centerBlock.horizontal;
        centerBlock.hideFace(vertical);
        centerBlock.hideFace(horizontal);
        this.tinyBlocks.get(centerBlock.position.minus(vertical)).hideFace(horizontal);
        this.tinyBlocks.get(centerBlock.position.minus(horizontal)).hideFace(vertical);
    }
    renderPerpendicularRoundedAdapters() {
        for (var block of this.smallBlocks.values()) {
            if (block.perpendicularRoundedAdapter == null) {
                continue;
            }
            var adapter = block.perpendicularRoundedAdapter;
            var center = block.forward.times(this.tinyIndexToWorld(block.forward.dot(block.position) * 3 - (adapter.facesForward ? 0 : 1)))
                .plus(block.right.times((block.position.dot(block.right) + (1 - block.localX)) * 0.5))
                .plus(block.up.times((block.position.dot(block.up) + (1 - block.localY)) * 0.5));
            var radius = 0.5 - this.measurements.edgeMargin;
            var forward = block.forward;
            for (var i = 0; i < this.measurements.subdivisionsPerQuarter; i++) {
                var angle1 = Math.PI / 2 * i / this.measurements.subdivisionsPerQuarter;
                var angle2 = Math.PI / 2 * (i + 1) / this.measurements.subdivisionsPerQuarter;
                var sincos1 = 1 - (block.odd() == adapter.isVertical ? Math.sin(angle1) : Math.cos(angle1));
                var sincos2 = 1 - (block.odd() == adapter.isVertical ? Math.sin(angle2) : Math.cos(angle2));
                let vertex1 = center.plus(block.getOnCircle(angle1).times(radius)).plus(forward.times(adapter.facesForward ? 0 : radius));
                let vertex2 = center.plus(block.getOnCircle(angle2).times(radius)).plus(forward.times(adapter.facesForward ? 0 : radius));
                var vertex3 = vertex2.plus(forward.times(sincos2 * (adapter.facesForward ? 1 : -1) * radius));
                var vertex4 = vertex1.plus(forward.times(sincos1 * (adapter.facesForward ? 1 : -1) * radius));
                var normal1 = block.getOnCircle(angle1).times(adapter.facesForward ? 1 : -1);
                var normal2 = block.getOnCircle(angle2).times(adapter.facesForward ? 1 : -1);
                this.createQuadWithNormals(vertex1, vertex2, vertex3, vertex4, normal1, normal2, normal2, normal1, adapter.facesForward);
                var invertAngle = ((adapter.isVertical ? block.localY : block.localX) != 1) != adapter.facesForward;
                var vertex5 = vertex4.plus(adapter.directionToNeighbor.times(radius * sincos1));
                var vertex6 = vertex3.plus(adapter.directionToNeighbor.times(radius * sincos2));
                var normal3 = adapter.neighbor.getOnCircle(invertAngle ? angle1 : Math.PI / 2 - angle1).times(adapter.facesForward ? -1 : 1);
                var normal4 = adapter.neighbor.getOnCircle(invertAngle ? angle2 : Math.PI / 2 - angle2).times(adapter.facesForward ? -1 : 1);
                this.createQuadWithNormals(vertex5, vertex6, vertex3, vertex4, normal3, normal4, normal4, normal3, !adapter.facesForward);
            }
        }
    }
    isPerpendicularRoundedAdapter(block) {
        if (block.perpendicularRoundedAdapter == null) {
            return false;
        }
        var localForward = block.position.minus(block.perpendicularRoundedAdapter.sourceBlock.position.times(3)).dot(block.forward);
        return localForward == 0 || (localForward > 0) == block.perpendicularRoundedAdapter.facesForward;
    }
    renderRoundedExteriors() {
        var blockSizeWithoutMargin = 0.5 - this.measurements.edgeMargin;
        for (let block of this.tinyBlocks.values()) {
            if (block.isExteriorMerged || !block.isCenter || block.isAttachment) {
                continue;
            }
            var nextBlock = this.getNextBlock(block, false);
            var previousBlock = this.getPreviousBlock(block);
            var distance = block.getExteriorDepth(this);
            var hasOpenEnd = this.hasOpenEnd(block, false);
            var hasOpenStart = this.hasOpenStart(block);
            // Back cap
            if (nextBlock == null && (block.rounded || block.hasInterior)) {
                this.createCircleWithHole(block, block.hasInterior && hasOpenEnd ? this.measurements.interiorRadius : 0, blockSizeWithoutMargin, distance, false, !block.rounded);
                this.hideStartEndFaces(block.position.plus(block.forward.times(block.exteriorMergedBlocks - 1)), block, true);
            }
            // Front cap
            if (previousBlock == null && (block.rounded || block.hasInterior)) {
                this.createCircleWithHole(block, block.hasInterior && hasOpenStart ? this.measurements.interiorRadius : 0, blockSizeWithoutMargin, 0, true, !block.rounded);
                this.hideStartEndFaces(block.position, block, false);
            }
            if (block.rounded) {
                if (!this.isPerpendicularRoundedAdapter(block)) {
                    this.createCylinder(block, 0, blockSizeWithoutMargin, distance);
                    // Rounded to non rounded adapter
                    if (nextBlock != null && !nextBlock.rounded) {
                        this.createCircleWithHole(block, blockSizeWithoutMargin, blockSizeWithoutMargin, distance, true, true);
                    }
                    if (previousBlock != null && !previousBlock.rounded) {
                        this.createCircleWithHole(block, blockSizeWithoutMargin, blockSizeWithoutMargin, 0, false, true);
                    }
                }
                // Rounded corners
                for (var i = 0; i < block.exteriorMergedBlocks; i++) {
                    this.hideOutsideFaces(this.tinyBlocks.get(block.position.plus(block.forward.times(i))));
                }
            }
        }
    }
    renderInteriors() {
        for (let block of this.tinyBlocks.values()) {
            if (block.isInteriorMerged || !block.isCenter || !block.hasInterior) {
                continue;
            }
            if (block.type == BlockType.PinHole) {
                this.renderPinHoleInterior(block);
            }
            else if (block.type == BlockType.AxleHole) {
                this.renderAxleHoleInterior(block);
            }
        }
    }
    renderAttachments() {
        for (var block of this.tinyBlocks.values()) {
            if (block.isExteriorMerged || !block.isCenter) {
                continue;
            }
            switch (block.type) {
                case BlockType.Pin:
                    this.renderPin(block);
                    break;
                case BlockType.Axle:
                    this.renderAxle(block);
                    break;
                case BlockType.BallJoint:
                    this.renderBallJoint(block);
                    break;
            }
        }
    }
    renderLip(block, zOffset) {
        var center = block.getCylinderOrigin(this).plus(block.forward.times(zOffset));
        for (var i = 0; i < this.measurements.subdivisionsPerQuarter; i++) {
            var out1 = block.getOnCircle(i / 2 * Math.PI / this.measurements.subdivisionsPerQuarter);
            var out2 = block.getOnCircle((i + 1) / 2 * Math.PI / this.measurements.subdivisionsPerQuarter);
            for (var j = 0; j < this.measurements.lipSubdivisions; j++) {
                var angleJ = j * Math.PI / this.measurements.lipSubdivisions;
                var angleJ2 = (j + 1) * Math.PI / this.measurements.lipSubdivisions;
                this.createQuadWithNormals(center.plus(out1.times(this.measurements.pinRadius)).plus(out1.times(Math.sin(angleJ) * this.measurements.pinLipRadius).plus(block.forward.times(Math.cos(angleJ) * this.measurements.pinLipRadius))), center.plus(out2.times(this.measurements.pinRadius)).plus(out2.times(Math.sin(angleJ) * this.measurements.pinLipRadius).plus(block.forward.times(Math.cos(angleJ) * this.measurements.pinLipRadius))), center.plus(out2.times(this.measurements.pinRadius)).plus(out2.times(Math.sin(angleJ2) * this.measurements.pinLipRadius).plus(block.forward.times(Math.cos(angleJ2) * this.measurements.pinLipRadius))), center.plus(out1.times(this.measurements.pinRadius)).plus(out1.times(Math.sin(angleJ2) * this.measurements.pinLipRadius).plus(block.forward.times(Math.cos(angleJ2) * this.measurements.pinLipRadius))), out1.times(-Math.sin(angleJ)).plus(block.forward.times(-Math.cos(angleJ))), out2.times(-Math.sin(angleJ)).plus(block.forward.times(-Math.cos(angleJ))), out2.times(-Math.sin(angleJ2)).plus(block.forward.times(-Math.cos(angleJ2))), out1.times(-Math.sin(angleJ2)).plus(block.forward.times(-Math.cos(angleJ2))));
            }
        }
    }
    renderPin(block) {
        var nextBlock = this.getNextBlock(block, false);
        var previousBlock = this.getPreviousBlock(block);
        var distance = block.getExteriorDepth(this);
        var startOffset = (previousBlock != null && previousBlock.isAttachment && previousBlock.type != BlockType.Pin) ? this.measurements.attachmentAdapterSize : 0;
        if (previousBlock == null) {
            startOffset += 2 * this.measurements.pinLipRadius;
        }
        var endOffset = (nextBlock != null && nextBlock.isAttachment && nextBlock.type != BlockType.Pin) ? this.measurements.attachmentAdapterSize : 0;
        if (nextBlock == null) {
            endOffset += 2 * this.measurements.pinLipRadius;
        }
        this.createCylinder(block, startOffset, this.measurements.pinRadius, distance - startOffset - endOffset);
        if (nextBlock == null) {
            this.createCircle(block, this.measurements.pinRadius, distance, true);
            this.renderLip(block, distance - this.measurements.pinLipRadius);
        }
        if (previousBlock == null) {
            this.createCircle(block, this.measurements.pinRadius, 0);
            this.renderLip(block, this.measurements.pinLipRadius);
        }
        if (nextBlock != null && !nextBlock.isAttachment) {
            this.createCircleWithHole(block, this.measurements.pinRadius, 0.5 - this.measurements.edgeMargin, distance, true, !nextBlock.rounded);
            this.hideStartEndFaces(nextBlock.position, block, false);
        }
        if (previousBlock != null && !previousBlock.isAttachment) {
            this.createCircleWithHole(block, this.measurements.pinRadius, 0.5 - this.measurements.edgeMargin, 0, false, !previousBlock.rounded);
            this.hideStartEndFaces(previousBlock.position, block, true);
        }
        if (nextBlock != null && nextBlock.isAttachment && nextBlock.type != BlockType.Pin) {
            this.createCircleWithHole(block, this.measurements.pinRadius, this.measurements.attachmentAdapterRadius, distance - this.measurements.attachmentAdapterSize, true);
        }
        if (previousBlock != null && previousBlock.isAttachment && previousBlock.type != BlockType.Pin) {
            this.createCircleWithHole(block, this.measurements.pinRadius, this.measurements.attachmentAdapterRadius, this.measurements.attachmentAdapterSize);
            this.createCylinder(block, -this.measurements.attachmentAdapterSize, this.measurements.attachmentAdapterRadius, this.measurements.attachmentAdapterSize * 2);
        }
    }
    renderAxle(block) {
        var nextBlock = this.getNextBlock(block, false);
        var previousBlock = this.getPreviousBlock(block);
        var start = block.getCylinderOrigin(this);
        var end = start.plus(block.forward.times(block.getExteriorDepth(this)));
        if (previousBlock != null && previousBlock.isAttachment && previousBlock.type != BlockType.Axle) {
            start = start.plus(block.forward.times(this.measurements.attachmentAdapterSize));
        }
        if (nextBlock != null && nextBlock.isAttachment && nextBlock.type != BlockType.Axle) {
            end = end.minus(block.forward.times(this.measurements.attachmentAdapterSize));
        }
        var horizontalInner = block.horizontal.times(this.measurements.axleSizeInner);
        var horizontalOuter = block.horizontal.times(this.measurements.axleSizeOuter);
        var verticalInner = block.vertical.times(this.measurements.axleSizeInner);
        var verticalOuter = block.vertical.times(this.measurements.axleSizeOuter);
        var odd = block.odd();
        this.createQuad(start.plus(horizontalInner).plus(verticalInner), start.plus(horizontalInner).plus(verticalOuter), end.plus(horizontalInner).plus(verticalOuter), end.plus(horizontalInner).plus(verticalInner), odd);
        this.createQuad(start.plus(horizontalInner).plus(verticalInner), start.plus(horizontalOuter).plus(verticalInner), end.plus(horizontalOuter).plus(verticalInner), end.plus(horizontalInner).plus(verticalInner), !odd);
        this.createQuad(end.plus(horizontalOuter), start.plus(horizontalOuter), start.plus(horizontalOuter).plus(verticalInner), end.plus(horizontalOuter).plus(verticalInner), odd);
        this.createQuad(end.plus(verticalOuter), start.plus(verticalOuter), start.plus(verticalOuter).plus(horizontalInner), end.plus(verticalOuter).plus(horizontalInner), !odd);
        if (nextBlock == null) {
            this.createQuad(end.plus(horizontalInner).plus(verticalInner), end.plus(verticalInner), end, end.plus(horizontalInner), odd);
            this.createQuad(end.plus(horizontalInner), end.plus(horizontalOuter), end.plus(horizontalOuter).plus(verticalInner), end.plus(horizontalInner).plus(verticalInner), odd);
            this.createQuad(end.plus(verticalInner), end.plus(verticalOuter), end.plus(verticalOuter).plus(horizontalInner), end.plus(verticalInner).plus(horizontalInner), !odd);
        }
        if (previousBlock == null) {
            this.createQuad(start.plus(horizontalInner).plus(verticalInner), start.plus(verticalInner), start, start.plus(horizontalInner), !odd);
            this.createQuad(start.plus(horizontalInner), start.plus(horizontalOuter), start.plus(horizontalOuter).plus(verticalInner), start.plus(horizontalInner).plus(verticalInner), !odd);
            this.createQuad(start.plus(verticalInner), start.plus(verticalOuter), start.plus(verticalOuter).plus(horizontalInner), start.plus(verticalInner).plus(horizontalInner), odd);
        }
        var blockSizeWithoutMargin = 0.5 - this.measurements.edgeMargin;
        if (nextBlock != null && nextBlock.type != block.type && !nextBlock.rounded) {
            this.createQuad(end.plus(block.horizontal.times(blockSizeWithoutMargin)), end.plus(horizontalOuter), end.plus(horizontalOuter).plus(verticalInner), end.plus(block.horizontal.times(blockSizeWithoutMargin)).plus(verticalInner), odd);
            this.createQuad(end.plus(block.vertical.times(blockSizeWithoutMargin)), end.plus(verticalOuter), end.plus(verticalOuter).plus(horizontalInner), end.plus(block.vertical.times(blockSizeWithoutMargin)).plus(horizontalInner), !odd);
            this.createQuad(end.plus(horizontalInner).plus(verticalInner), end.plus(block.horizontal.times(blockSizeWithoutMargin)).plus(verticalInner), end.plus(block.horizontal.times(blockSizeWithoutMargin)).plus(block.vertical.times(blockSizeWithoutMargin)), end.plus(horizontalInner).plus(block.vertical.times(blockSizeWithoutMargin)), !odd);
        }
        if (previousBlock != null && previousBlock.type != block.type && !previousBlock.rounded) {
            this.createQuad(start.plus(block.horizontal.times(blockSizeWithoutMargin)), start.plus(horizontalOuter), start.plus(horizontalOuter).plus(verticalInner), start.plus(block.horizontal.times(blockSizeWithoutMargin)).plus(verticalInner), !odd);
            this.createQuad(start.plus(block.vertical.times(blockSizeWithoutMargin)), start.plus(verticalOuter), start.plus(verticalOuter).plus(horizontalInner), start.plus(block.vertical.times(blockSizeWithoutMargin)).plus(horizontalInner), odd);
            this.createQuad(start.plus(horizontalInner).plus(verticalInner), start.plus(block.horizontal.times(blockSizeWithoutMargin)).plus(verticalInner), start.plus(block.horizontal.times(blockSizeWithoutMargin)).plus(block.vertical.times(blockSizeWithoutMargin)), start.plus(horizontalInner).plus(block.vertical.times(blockSizeWithoutMargin)), odd);
        }
        if (nextBlock != null && nextBlock.type != block.type && nextBlock.rounded) {
            this.createAxleToCircleAdapter(end, block, nextBlock.isAttachment ? this.measurements.attachmentAdapterRadius : blockSizeWithoutMargin);
        }
        if (previousBlock != null && previousBlock.type != block.type && previousBlock.rounded) {
            this.createAxleToCircleAdapter(start, block, previousBlock.isAttachment ? this.measurements.attachmentAdapterRadius : blockSizeWithoutMargin, true);
        }
        if (nextBlock != null && !nextBlock.isAttachment) {
            this.hideStartEndFaces(nextBlock.position, block, false);
        }
        if (previousBlock != null && !previousBlock.isAttachment) {
            this.hideStartEndFaces(previousBlock.position, block, true);
        }
        if (previousBlock != null && previousBlock.isAttachment && previousBlock.type != BlockType.Axle) {
            this.createCylinder(block, -this.measurements.attachmentAdapterSize, this.measurements.attachmentAdapterRadius, this.measurements.attachmentAdapterSize * 2);
        }
    }
    renderBallJoint(block) {
        var nextBlock = this.getNextBlock(block, false);
        var previousBlock = this.getPreviousBlock(block);
        var distance = block.getExteriorDepth(this);
        var startOffset = (previousBlock != null && previousBlock.isAttachment && previousBlock.type != BlockType.BallJoint) ? this.measurements.attachmentAdapterSize : 0;
        if (previousBlock == null) {
            startOffset += 2 * this.measurements.pinLipRadius;
        }
        var endOffset = (nextBlock != null && nextBlock.isAttachment && nextBlock.type != BlockType.BallJoint) ? this.measurements.attachmentAdapterSize : 0;
        if (nextBlock == null) {
            endOffset += 2 * this.measurements.pinLipRadius;
        }
        var ballCenterDistance;
        if (nextBlock == null) {
            var offset = mod(block.position.dot(block.forward) - 1, 3) - 1;
            ballCenterDistance = 0.5 - offset * this.measurements.edgeMargin;
        }
        else {
            var offset = mod(block.position.dot(block.forward) + block.exteriorMergedBlocks - 1, 3) - 1;
            ballCenterDistance = distance - 0.5 - offset * this.measurements.edgeMargin;
        }
        var ballCenter = block.getCylinderOrigin(this).plus(block.forward.times(ballCenterDistance));
        var angle = Math.acos(this.measurements.ballBaseRadius / this.measurements.ballRadius);
        for (var i = 0; i < this.measurements.subdivisionsPerQuarter; i++) {
            var angleStart = lerp(-angle, +angle, i / this.measurements.subdivisionsPerQuarter);
            var angleEnd = lerp(-angle, +angle, (i + 1) / this.measurements.subdivisionsPerQuarter);
            var ballCenterStart = ballCenter.plus(block.forward.times(Math.sin(angleStart) * this.measurements.ballRadius));
            var ballCenterEnd = ballCenter.plus(block.forward.times(Math.sin(angleEnd) * this.measurements.ballRadius));
            var radiusStart = this.measurements.ballRadius * Math.cos(angleStart);
            var radiusEnd = this.measurements.ballRadius * Math.cos(angleEnd);
            for (var j = 0; j < this.measurements.subdivisionsPerQuarter; j++) {
                var out1 = block.getOnCircle(j / 2 * Math.PI / this.measurements.subdivisionsPerQuarter);
                var out2 = block.getOnCircle((j + 1) / 2 * Math.PI / this.measurements.subdivisionsPerQuarter);
                this.createQuadWithNormals(ballCenterStart.plus(out2.times(radiusStart)), ballCenterStart.plus(out1.times(radiusStart)), ballCenterEnd.plus(out1.times(radiusEnd)), ballCenterEnd.plus(out2.times(radiusEnd)), out2.times(-Math.cos(angleStart)).minus(block.forward.times(Math.sin(angleStart))), out1.times(-Math.cos(angleStart)).minus(block.forward.times(Math.sin(angleStart))), out1.times(-Math.cos(angleEnd)).minus(block.forward.times(Math.sin(angleEnd))), out2.times(-Math.cos(angleEnd)).minus(block.forward.times(Math.sin(angleEnd))));
            }
        }
        var ballStart = ballCenterDistance - Math.sin(angle) * this.measurements.ballRadius;
        var ballEnd = ballCenterDistance + Math.sin(angle) * this.measurements.ballRadius;
        if (nextBlock == null) {
            this.createCircle(block, this.measurements.ballBaseRadius, ballEnd, true);
        }
        else {
            this.createCylinder(block, ballEnd, this.measurements.ballBaseRadius, distance - endOffset - ballEnd);
        }
        if (previousBlock == null) {
            this.createCircle(block, this.measurements.ballBaseRadius, ballStart);
        }
        else {
            this.createCylinder(block, startOffset, this.measurements.ballBaseRadius, ballStart - startOffset);
        }
        if (nextBlock != null && !nextBlock.isAttachment) {
            this.createCircleWithHole(block, this.measurements.ballBaseRadius, 0.5 - this.measurements.edgeMargin, distance, true, !nextBlock.rounded);
            this.hideStartEndFaces(nextBlock.position, block, false);
        }
        if (previousBlock != null && !previousBlock.isAttachment) {
            this.createCircleWithHole(block, this.measurements.ballBaseRadius, 0.5 - this.measurements.edgeMargin, 0, false, !previousBlock.rounded);
            this.hideStartEndFaces(previousBlock.position, block, true);
        }
        if (nextBlock != null && nextBlock.isAttachment && nextBlock.type != BlockType.BallJoint) {
            this.createCircleWithHole(block, this.measurements.ballBaseRadius, this.measurements.attachmentAdapterRadius, distance - this.measurements.attachmentAdapterSize, true);
        }
        if (previousBlock != null && previousBlock.isAttachment && previousBlock.type != BlockType.BallJoint) {
            this.createCircleWithHole(block, this.measurements.ballBaseRadius, this.measurements.attachmentAdapterRadius, this.measurements.attachmentAdapterSize);
            this.createCylinder(block, -this.measurements.attachmentAdapterSize, this.measurements.attachmentAdapterRadius, this.measurements.attachmentAdapterSize * 2);
        }
    }
    createAxleToCircleAdapter(center, block, radius, flipped = false) {
        var horizontalInner = block.horizontal.times(this.measurements.axleSizeInner);
        var horizontalOuter = block.horizontal.times(this.measurements.axleSizeOuter);
        var verticalInner = block.vertical.times(this.measurements.axleSizeInner);
        var verticalOuter = block.vertical.times(this.measurements.axleSizeOuter);
        var odd = block.odd();
        for (var i = 0; i < this.measurements.subdivisionsPerQuarter; i++) {
            var focus = center.copy();
            if (i < this.measurements.subdivisionsPerQuarter / 2 == !odd) {
                focus = focus.plus(horizontalInner).plus(verticalOuter);
            }
            else {
                focus = focus.plus(horizontalOuter).plus(verticalInner);
            }
            this.triangles.push(new Triangle(focus, center.plus(block.getOnCircle(Math.PI / 2 * i / this.measurements.subdivisionsPerQuarter, radius)), center.plus(block.getOnCircle(Math.PI / 2 * (i + 1) / this.measurements.subdivisionsPerQuarter, radius)), flipped));
        }
        this.triangles.push(new Triangle(center.plus(horizontalInner).plus(verticalOuter), center.plus(verticalOuter), center.plus(block.vertical.times(radius)), odd != flipped));
        this.triangles.push(new Triangle(center.plus(verticalInner).plus(horizontalOuter), center.plus(horizontalOuter), center.plus(block.horizontal.times(radius)), odd == flipped));
        this.createQuad(center.plus(verticalInner).plus(horizontalInner), center.plus(verticalOuter).plus(horizontalInner), center.plus(block.getOnCircle(45 * DEG_TO_RAD, radius)), center.plus(verticalInner).plus(horizontalOuter), odd != flipped);
    }
    showInteriorCap(currentBlock, neighbor) {
        if (neighbor == null) {
            return false;
        }
        if (neighbor.orientation != currentBlock.orientation
            || neighbor.quadrant != currentBlock.quadrant
            || !neighbor.hasInterior) {
            return true;
        }
        if (currentBlock.type == BlockType.AxleHole && neighbor.type == BlockType.PinHole
            || neighbor.type == BlockType.AxleHole && currentBlock.type == BlockType.PinHole) {
            // Pin hole to axle hole adapter
            return false;
        }
        return currentBlock.type != neighbor.type;
    }
    renderPinHoleInterior(block) {
        var nextBlock = this.getNextBlock(block, true);
        var previousBlock = this.getPreviousBlock(block);
        var distance = block.getInteriorDepth(this);
        var hasOpenEnd = this.hasOpenEnd(block, true);
        var hasOpenStart = this.hasOpenStart(block);
        var showInteriorEndCap = this.showInteriorCap(block, nextBlock) || (nextBlock == null && !hasOpenEnd);
        var showInteriorStartCap = this.showInteriorCap(block, previousBlock) || (previousBlock == null && !hasOpenStart);
        var offset = this.measurements.pinHoleOffset;
        var endMargin = showInteriorEndCap ? this.measurements.interiorEndMargin : 0;
        var startMargin = showInteriorStartCap ? this.measurements.interiorEndMargin : 0;
        var offsetStart = (hasOpenStart || showInteriorStartCap ? offset : 0) + startMargin;
        var offsetEnd = (hasOpenEnd || showInteriorEndCap ? offset : 0) + endMargin;
        var interiorRadius = this.measurements.interiorRadius;
        this.createCylinder(block, offsetStart, this.measurements.pinHoleRadius, distance - offsetStart - offsetEnd, true);
        if (hasOpenStart || showInteriorStartCap) {
            this.createCylinder(block, startMargin, interiorRadius, offset, true);
            this.createCircleWithHole(block, this.measurements.pinHoleRadius, interiorRadius, offset + startMargin, true);
        }
        if (hasOpenEnd || showInteriorEndCap) {
            this.createCylinder(block, distance - offset - endMargin, interiorRadius, offset, true);
            this.createCircleWithHole(block, this.measurements.pinHoleRadius, interiorRadius, distance - offset - endMargin, false);
        }
        if (showInteriorEndCap) {
            this.createCircle(block, interiorRadius, distance - endMargin, false);
        }
        if (showInteriorStartCap) {
            this.createCircle(block, interiorRadius, startMargin, true);
        }
    }
    renderAxleHoleInterior(block) {
        var nextBlock = this.getNextBlock(block, true);
        var previousBlock = this.getPreviousBlock(block);
        var hasOpenEnd = this.hasOpenEnd(block, true);
        var hasOpenStart = this.hasOpenStart(block);
        var showInteriorEndCap = this.showInteriorCap(block, nextBlock) || (nextBlock == null && !hasOpenEnd);
        var showInteriorStartCap = this.showInteriorCap(block, previousBlock) || (previousBlock == null && !hasOpenStart);
        var distance = block.getInteriorDepth(this);
        var holeSize = this.measurements.axleHoleSize;
        var start = block.getCylinderOrigin(this).plus(showInteriorStartCap ? block.forward.times(this.measurements.interiorEndMargin) : Vector3.zero());
        var end = start.plus(block.forward.times(distance - (showInteriorStartCap ? this.measurements.interiorEndMargin : 0) - (showInteriorEndCap ? this.measurements.interiorEndMargin : 0)));
        var axleWingAngle = Math.asin(holeSize / this.measurements.pinHoleRadius);
        var axleWingAngle2 = 90 * DEG_TO_RAD - axleWingAngle;
        var subdivAngle = 90 / this.measurements.subdivisionsPerQuarter * DEG_TO_RAD;
        var adjustedRadius = this.measurements.pinHoleRadius * Math.cos(subdivAngle / 2) / Math.cos(subdivAngle / 2 - (axleWingAngle - Math.floor(axleWingAngle / subdivAngle) * subdivAngle));
        this.createQuad(start.plus(block.horizontal.times(holeSize)).plus(block.vertical.times(holeSize)), start.plus(block.getOnCircle(axleWingAngle, adjustedRadius)), end.plus(block.getOnCircle(axleWingAngle, adjustedRadius)), end.plus(block.horizontal.times(holeSize)).plus(block.vertical.times(holeSize)), true);
        this.createQuad(start.plus(block.horizontal.times(holeSize)).plus(block.vertical.times(holeSize)), start.plus(block.getOnCircle(axleWingAngle2, adjustedRadius)), end.plus(block.getOnCircle(axleWingAngle2, adjustedRadius)), end.plus(block.horizontal.times(holeSize)).plus(block.vertical.times(holeSize)), false);
        for (var i = 0; i < this.measurements.subdivisionsPerQuarter; i++) {
            var angle1 = lerp(0, 90, i / this.measurements.subdivisionsPerQuarter) * DEG_TO_RAD;
            var angle2 = lerp(0, 90, (i + 1) / this.measurements.subdivisionsPerQuarter) * DEG_TO_RAD;
            var startAngleInside = angle1;
            var endAngleInside = angle2;
            var startAngleOutside = angle1;
            var endAngleOutside = angle2;
            var radius1Inside = this.measurements.pinHoleRadius;
            var radius2Inside = this.measurements.pinHoleRadius;
            var radius1Outside = this.measurements.pinHoleRadius;
            var radius2Outside = this.measurements.pinHoleRadius;
            if (angle1 < axleWingAngle && angle2 > axleWingAngle) {
                endAngleInside = axleWingAngle;
                startAngleOutside = axleWingAngle;
                radius1Outside = adjustedRadius;
                radius2Inside = adjustedRadius;
            }
            if (angle1 < axleWingAngle2 && angle2 > axleWingAngle2) {
                startAngleInside = axleWingAngle2;
                endAngleOutside = axleWingAngle2;
                radius2Outside = adjustedRadius;
                radius1Inside = adjustedRadius;
            }
            // Walls
            if (angle1 < axleWingAngle || angle2 > axleWingAngle2) {
                var v1 = block.getOnCircle(startAngleInside);
                var v2 = block.getOnCircle(endAngleInside);
                this.createQuadWithNormals(start.plus(v1.times(radius1Inside)), start.plus(v2.times(radius2Inside)), end.plus(v2.times(radius2Inside)), end.plus(v1.times(radius1Inside)), v1, v2, v2, v1, false);
            }
            // Outside caps
            if (hasOpenStart || (previousBlock != null && previousBlock.type == BlockType.PinHole && !showInteriorStartCap)) {
                if (angle2 > axleWingAngle && angle1 < axleWingAngle2) {
                    this.triangles.push(new Triangle(start.plus(block.horizontal.times(holeSize)).plus(block.vertical.times(holeSize)), start.plus(block.getOnCircle(startAngleOutside, radius1Outside)), start.plus(block.getOnCircle(endAngleOutside, radius2Outside))));
                }
            }
            if (hasOpenEnd || (nextBlock != null && nextBlock.type == BlockType.PinHole && !showInteriorEndCap)) {
                if (angle2 > axleWingAngle && angle1 < axleWingAngle2) {
                    this.triangles.push(new Triangle(end.plus(block.horizontal.times(holeSize)).plus(block.vertical.times(holeSize)), end.plus(block.getOnCircle(endAngleOutside, radius2Outside)), end.plus(block.getOnCircle(startAngleOutside, radius1Outside))));
                }
            }
            // Inside caps
            if (showInteriorEndCap && (angle1 < axleWingAngle || angle2 > axleWingAngle2)) {
                this.triangles.push(new Triangle(end, end.plus(block.getOnCircle(startAngleInside, radius1Outside)), end.plus(block.getOnCircle(endAngleInside, radius2Outside))));
            }
            if (showInteriorStartCap && (angle1 < axleWingAngle || angle2 > axleWingAngle2)) {
                this.triangles.push(new Triangle(start, start.plus(block.getOnCircle(endAngleInside, radius2Outside)), start.plus(block.getOnCircle(startAngleInside, radius1Outside))));
            }
        }
        if (hasOpenEnd) {
            this.createCircleWithHole(block, this.measurements.pinHoleRadius, this.measurements.interiorRadius, distance, false);
        }
        if (hasOpenStart) {
            this.createCircleWithHole(block, this.measurements.pinHoleRadius, this.measurements.interiorRadius, 0, true);
        }
        if (showInteriorEndCap) {
            this.triangles.push(new Triangle(end.plus(block.horizontal.times(holeSize)).plus(block.vertical.times(holeSize)), end, end.plus(block.getOnCircle(axleWingAngle, adjustedRadius))));
            this.triangles.push(new Triangle(end, end.plus(block.horizontal.times(holeSize)).plus(block.vertical.times(holeSize)), end.plus(block.getOnCircle(axleWingAngle2, adjustedRadius))));
        }
        if (showInteriorStartCap) {
            this.triangles.push(new Triangle(start, start.plus(block.horizontal.times(holeSize)).plus(block.vertical.times(holeSize)), start.plus(block.getOnCircle(axleWingAngle, adjustedRadius))));
            this.triangles.push(new Triangle(start.plus(block.horizontal.times(holeSize)).plus(block.vertical.times(holeSize)), start, start.plus(block.getOnCircle(axleWingAngle2, adjustedRadius))));
        }
    }
    isFaceVisible(position, direction) {
        var block = this.tinyBlocks.getOrNull(position);
        return block != null
            && !this.isTinyBlock(block.position.plus(direction))
            && !block.isAttachment
            && block.isFaceVisible(direction);
    }
    createTinyFace(position, size, direction) {
        var vertices = null;
        if (direction.x > 0) {
            vertices = RIGHT_FACE_VERTICES;
        }
        else if (direction.x < 0) {
            vertices = LEFT_FACE_VERTICES;
        }
        else if (direction.y > 0) {
            vertices = UP_FACE_VERTICES;
        }
        else if (direction.y < 0) {
            vertices = DOWN_FACE_VERTICES;
        }
        else if (direction.z > 0) {
            vertices = FORWARD_FACE_VERTICES;
        }
        else if (direction.z < 0) {
            vertices = BACK_FACE_VERTICES;
        }
        else {
            throw new Error("Invalid direction: " + direction.toString());
        }
        this.createQuad(this.tinyBlockToWorld(position.plus(vertices[0].elementwiseMultiply(size))), this.tinyBlockToWorld(position.plus(vertices[1].elementwiseMultiply(size))), this.tinyBlockToWorld(position.plus(vertices[2].elementwiseMultiply(size))), this.tinyBlockToWorld(position.plus(vertices[3].elementwiseMultiply(size))));
    }
    isRowOfVisibleFaces(position, rowDirection, faceDirection, count) {
        for (var i = 0; i < count; i++) {
            if (!this.isFaceVisible(position.plus(rowDirection.times(i)), faceDirection)) {
                return false;
            }
        }
        return true;
    }
    /* Finds a connected rectangle of visible faces in the given direction by starting with
    the supplied position and a rectangle of size 1x1 and expanding it in the 4 directions
    that are tangential to the supplied face direction, until it is no longer possible to
    expand in any direction.
    Returns the lower left corner of the rectangle and its size.
    The component of the size vector of the direction supplied by the direction parameter is
    always 1. The component of the position vector in the direction supplied by the direction
    parameter remains unchanged. */
    findConnectedFaces(position, direction) {
        var tangent1 = new Vector3(direction.x == 0 ? 1 : 0, direction.x == 0 ? 0 : 1, 0);
        var tangent2 = new Vector3(0, direction.z == 0 ? 0 : 1, direction.z == 0 ? 1 : 0);
        var size = Vector3.one();
        while (true) {
            var hasChanged = false;
            if (this.isRowOfVisibleFaces(position.minus(tangent2), tangent1, direction, size.dot(tangent1))) {
                position = position.minus(tangent2);
                size = size.plus(tangent2);
                hasChanged = true;
            }
            if (this.isRowOfVisibleFaces(position.minus(tangent1), tangent2, direction, size.dot(tangent2))) {
                position = position.minus(tangent1);
                size = size.plus(tangent1);
                hasChanged = true;
            }
            if (this.isRowOfVisibleFaces(position.plus(tangent2.times(size.dot(tangent2))), tangent1, direction, size.dot(tangent1))) {
                size = size.plus(tangent2);
                hasChanged = true;
            }
            if (this.isRowOfVisibleFaces(position.plus(tangent1.times(size.dot(tangent1))), tangent2, direction, size.dot(tangent2))) {
                size = size.plus(tangent1);
                hasChanged = true;
            }
            if (!hasChanged) {
                return [position, size];
            }
        }
    }
    hideFaces(position, size, direction) {
        for (var x = 0; x < size.x; x++) {
            for (var y = 0; y < size.y; y++) {
                for (var z = 0; z < size.z; z++) {
                    this.hideFaceIfExists(new Vector3(position.x + x, position.y + y, position.z + z), direction);
                }
            }
        }
    }
    renderTinyBlockFaces() {
        for (let block of this.tinyBlocks.values()) {
            for (let direction of FACE_DIRECTIONS) {
                if (!this.isFaceVisible(block.position, direction)) {
                    continue;
                }
                var expanded = this.findConnectedFaces(block.position, direction);
                var position = expanded[0];
                var size = expanded[1];
                this.createTinyFace(position, size, direction);
                this.hideFaces(position, size, direction);
            }
        }
    }
}
function triangularNumber(n) {
    return n * (n + 1) / 2;
}
function inverseTriangularNumber(s) {
    return Math.floor((Math.floor(Math.sqrt(8 * s + 1)) - 1) / 2);
}
function tetrahedralNumber(n) {
    return n * (n + 1) * (n + 2) / 6;
}
function inverseTetrahedralNumber(s) {
    if (s == 0) {
        return 0;
    }
    let f = Math.pow(1.73205080757 * Math.sqrt(243 * Math.pow(s, 2) - 1) + 27 * s, 1 / 3);
    return Math.floor(f / 2.08008382305 + 0.69336127435 / f - 1);
}
let DEG_TO_RAD = Math.PI / 180;
function min(iterable, selector) {
    var initialized = false;
    var minValue;
    for (let item of iterable) {
        let currentValue = selector(item);
        if (!initialized || currentValue < minValue) {
            initialized = true;
            minValue = currentValue;
        }
    }
    return minValue;
}
function sign(a) {
    if (a == 0) {
        return 0;
    }
    else if (a < 0) {
        return -1;
    }
    else {
        return 1;
    }
}
function lerp(a, b, t) {
    return a + t * (b - a);
}
function clamp(lower, upper, value) {
    if (value > upper) {
        return upper;
    }
    else if (value < lower) {
        return lower;
    }
    else {
        return value;
    }
}
function countInArray(items, selector) {
    var result = 0;
    for (var item of items) {
        if (selector(item)) {
            result++;
        }
    }
    return result;
}
function ease(value) {
    return value < 0.5 ? 2 * value * value : -1 + (4 - 2 * value) * value;
}
function mod(a, b) {
    return ((a % b) + b) % b;
}
function containsPoint(list, query) {
    for (var item of list) {
        if (query.equals(item)) {
            return true;
        }
    }
    return false;
}
class Measurements {
    technicUnit = 8;
    edgeMargin = 0.2 / this.technicUnit;
    interiorRadius = 3.2 / this.technicUnit;
    pinHoleRadius = 2.475 / this.technicUnit;
    pinHoleOffset = 0.89 / this.technicUnit;
    axleHoleSize = 1.01 / this.technicUnit;
    pinRadius = 2.44 / this.technicUnit;
    ballBaseRadius = 1.6 / this.technicUnit;
    ballRadius = 3.0 / this.technicUnit;
    pinLipRadius = 0.06 / this.technicUnit;
    axleSizeInner = 0.82 / this.technicUnit;
    axleSizeOuter = 2.09 / this.technicUnit;
    attachmentAdapterSize = 0.4 / this.technicUnit;
    attachmentAdapterRadius = 3 / this.technicUnit;
    interiorEndMargin = 0.2 / this.technicUnit;
    lipSubdivisions = 6;
    subdivisionsPerQuarter = 8;
    enforceConstraints() {
        this.lipSubdivisions = Math.max(2, Math.ceil(this.lipSubdivisions));
        this.subdivisionsPerQuarter = Math.max(2, Math.ceil(this.subdivisionsPerQuarter / 2) * 2);
        this.edgeMargin = Math.min(0.49, this.edgeMargin);
        this.interiorRadius = Math.min(0.5 - this.edgeMargin, this.interiorRadius);
        this.interiorEndMargin = Math.min(0.49, this.interiorEndMargin);
        this.pinHoleRadius = Math.min(this.interiorRadius, this.pinHoleRadius);
        this.pinHoleOffset = Math.min(0.5 - this.edgeMargin, this.pinHoleOffset);
        this.axleHoleSize = Math.min(this.interiorRadius / 2, this.axleHoleSize);
        this.pinRadius = Math.min(0.5 - this.edgeMargin, this.pinRadius);
        this.axleSizeOuter = Math.min(Math.sqrt(Math.pow(Math.min(0.5 - this.edgeMargin, this.attachmentAdapterRadius), 2.0) - Math.pow(this.axleSizeInner, 2.0)), this.axleSizeOuter);
        this.axleSizeInner = Math.min(this.axleSizeOuter, this.axleSizeInner);
        this.attachmentAdapterSize = Math.min((0.5 - this.edgeMargin) / 2, this.attachmentAdapterSize);
        this.ballBaseRadius = Math.min(this.ballBaseRadius, this.interiorRadius);
        this.ballRadius = Math.max(Math.min(this.ballRadius, 0.5 - this.attachmentAdapterSize), this.ballBaseRadius);
    }
}
const DEFAULT_MEASUREMENTS = new Measurements();
class Catalog {
    container;
    pbocontainer;
    initialized = false;
    pboinitialized = false;
    items;
    pboitems;
    constructor() {
        this.container = document.getElementById("catalog");
        this.createCatalogItems();
        document.getElementById("catalog").addEventListener("toggle", (event) => this.onToggleCatalog(event));
        this.pbocontainer = document.getElementById("pbocatalog");
        this.createPBOCatalogItems();
        document.getElementById("pbocatalog").addEventListener("toggle", (event) => this.onTogglePBOCatalog(event));
    }
    onToggleCatalog(event) {
        if (event.target.open && !this.initialized) {
            this.createCatalogUI();
        }
    }
    onTogglePBOCatalog(event) {
        if (event.target.open && !this.pboinitialized) {
            this.createPBOCatalogUI();
        }
    }
    createCatalogUI() {
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
            var catalogLink = document.createElement("a");
            catalogLink.className = "catalogItem";
            catalogLink.href = "?part=" + item.string + "&name=" + encodeURIComponent(item.name);
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
            catalogLink.addEventListener("click", (event) => this.onSelectPart(itemCopy, event));
        }
        gl = oldRenderingContext;
        this.initialized = true;
        this.container.removeChild(canvas);
    }
    createPBOCatalogUI() {
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
            var catalogLink = document.createElement("a");
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
            catalogLink.addEventListener("click", (event) => this.onSelectPart(itemCopy, event));
        }
        gl = oldRenderingContext;
        this.pboinitialized = true;
        this.pbocontainer.removeChild(canvas);
    }
    createCatalogItems() {
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
    createPBOCatalogItems() {
        this.pboitems = [
            // General
            new CatalogItem(1, "Pin 2L", "0y01y04y3ay314y323y3"),
            new CatalogItem(2, "Pin 2.5L", "0y01y04y3ay314y323y338y3"),
            new CatalogItem(4, "Axle pin 1.5L", "0y01y04y4ay414y4"),
            new CatalogItem(5, "Axle pin 2L", "0y01y04y4ay414y423y4"),
            new CatalogItem(6, "Half beam 3 holes", "0Y17y11eY1"),
            new CatalogItem(7, "Half beam 3L 2 axle holes", "1ex27X00x2"),
            // Rewinder
            new CatalogItem(10, "Rewinder Front Right Side", "113Y2155Y21bcY0217Y029dY0315Y03beY0457Y0a4X211bX01c2X02a1X03c0X0527Y06deX08edX0b5cX0e33X0117aX01539X01978X21e3fX02396X02985Z02cb8Z03014Z0339aZ0374bZ03b28Z03f32Z0436aZ047d1Z04c68Z05130Z0562aZ05b57Z060b8Z0664eY0721dX25e5Y06be5Y02fc5Y136f8Y03edbY05af4Y071b2Y03322Y03aaaY042e6Y06022z065b5z077b6Y036a9Y03e88Y0471fY07df2z0849cz03a5bX04293X04b87X0dbX2169X022bX0329X046bX07dbX0a19X0cbbX0fc9X0134bX01749X01bcbX220d9X0267bX07859X23e61X046f6X0504bX06e0X06650X0721fX07ecez2857cz2714dy08b83Y04295Y14b89Y25541Y1926dY046ceY15021Y25a3cY17ddX06c1dX0785bX08f1X07221X07ed0Y08c67X08545Y07df6Z084a0Z09a04Y0a167Y08b1az09239z0a1dX0785dX0938dX0b62Y27ed2X08c69x09af0X0ca7Y28b87y0a97dY19271z199cez1b15dY1a0faY08581X0938fx0a291X0e3bY08c6bX09af2X0aa71X0fb5Y09a08y0b9f6Y0a16bY0c257Y0a90cz0b125z09391X0a293X0b291X01184Y29af4X0aa73X0baf2z2c394z21337Y2a981y0cb77z0d49cz0a295X0b293X06eaX28f9X0b68X0e3fX01186X01545X01984X01e4bX023a2X02991X03020Y03757X03f3eX247ddX0513cX05b63X0665aX07229X07ed8Z08586Z08c6fX09af6Z0a296Z0aa75Z0b294Z0baf4X0cc7bX2337dY0a9faY0cbf8z0d51fz0b1daz0ba37z0de08z0e7b8z07e7X2a25X0cc7X0fd5X01357X01755X01bd7X020e5X02687X02cc5X03b35X04377X24c75X05637X060c5X06c27X07865X09395X0c397X0d5a5X23759Y08c71Y03b0bY0935bY03f42Y09afay1434dY0a25dy147e3Y04c4bY05144y1560dy1"),
            new CatalogItem(11, "Rewinder Front Left Side", "1a3Y21feY21bcX0280X0225X0306X029dZ0324Z039dY0436Y03beZ0468Z0502Y05c0Y0a4X211bY01c2Y02a1Y03c0Y0527Y06deY08edY0b5cY0e33Y0117aY01539Y01978x21e3fY02396Y02985Z02cb8Z03014Z0339aZ0374bZ03b28Z03f32Z0436aZ047d1Z04c68Z05130Z0562aZ05b57Y0664eY0721dX215dY021dY0319Y0459Y05e5Y07c5Y0a01Y0ca1Y0fadY0132dY01729Y020b5Y02655Y06085Y06be5Y06b7Y079eY0dbX21bcbx27859X23016Y1374dy23f34Y16650X0721fX07eceZ2857cZ23373Y13affy2433fY18c4Y09d8Y06c1dX0785bX07221X07ed0Z0857eZ08c67Z0938cZ0b31Y0c76Y0785dX07ed2X08c69Z0938eZ09af0Z0a290Z0e06Y2f80Y28581X08c6bX09af2Z0a292Z0aa71Z0b290Z0114bY012feY09391X09af4X0aa73Z0b292Z0baf2Z2c394Z21508Y216f8Y2a295X06eaX28f9y0b68y0e3fy01186y01545y01984y01e4by023a2y02991y03020y03757y03f3ex247ddy0513cY05b63Z060c4Z0665aZ06c26Z07229Z07864Z07ed8Z08586Z08c6fZ09394Z09af6Z0a296Z0aa75Y0baf4Y0cc7bX2a0dy0cady0fb9y01339y01735y01bb5y020c1y02661y02c9dy0337dy03b09y04c45y05605Y0b255Y0c355Y01945Y01b76Y07e7X24377x2d5a5X23759Y08c71Y03b0bY0935bY03f42Y09afay1434dY0a25dy147e3Y04c4bY05144y1560dy1"),
            new CatalogItem(12, "Rewinder Rear Right Side", "0y07X21eY04dY09cY0113Y21bay0299Y03b8Y051fY06d6y01y02dY069Y0c9Y0155Y2215y0311Y0451Y05ddY07bdy011X29X08e7Y09fbY013X022Y1b58Y231Y1c9dY253y1e31Z0fc6Z06fy1a4y1117aZ0134aZ0d1y111dy11c4y02a3y03c2Y0529x06e0x08efx0b5ex0e35x0117cY0153bY015fy121fy031by045bY0132fY0172bY05fbx07ddx0a1bx0cbdx0fcbx01c6y13c4y2197cZ01bceZ0221y145dy22a7y152dy01e45Z020deZ031fy15eby03c8y16e6y2239eZ02682Z0461y17cdy2531y16e8y08f7Y0b66Y0e3dx01184x01543x01982x01e49x023a0Y0298fY05efy17cfy0a0bY0cabY0265fY02c9bY0fd3x01355x01753x01bd5x020e3x06eay13020Z233a6Z27d1y18fby13759Y0a0fy13b0bY0b6cy13f42Z2437aZ2cb1y1e45y147e3Y0fbfy14c4bY0118eY05144Y01341Y0560dY0154fY0198ey01e55Y023acY0299bx0302ax03761x03f48x047e7x05146Y05b6dY0173fY01bbfy020cbY0266bY0560fY0609bY02ccfx033b1x03b3fx04381x04c7fx01990Y06666Y01bc1Y06bfdY01e59Y07237Y020cfY0783bY023b2Y07ee8Y02671Y0855dY029a3Y08c81Y02cafY0936bY03034Y19b0aY23391Y1a26dY2376dY0aa8bY03b1fY0b26bY03f56y047f5x05154x05b7bx06672x07241X27ef0x08c87x09b0ex0aa8dx0bb0cy04361y0c36dy04c8dx0564fx060ddx06c3fx0787dX2859fx093adx0a2afx0b2adx0"),
            new CatalogItem(13, "Rewinder Rear Left Side", "0y07X21eY04dY09cY0113Y21bay0299Y03b8Y051fY06d6y01y02dY069Y0c9Y0155Y2215y0311Y0451Y05ddY07bdy011X29Y08e7Y0fY09fbY022Y1b58Y231Y1c9dY253y1e31Z0fc6Z06fy1a4Y1117aZ0134aZ0d1Y111dY11c4Z022cZ02a3y03c2Y0529Z05faZ06e0Z07dcZ08efZ0a1aZ0b5eZ0cbcZ0e35Z0fcaZ0117cY0153bY015fY131by045bY0132fY0172bY01c6Y1197cZ01bceZ0221Y12a7Y11e45Z020deZ031fY13c8Y1239eZ02682Z0461Y1531Y1298fY05efY12c9bY06eaY13020Z233a6Z27d1Y18fby13759Y0a0fy13b0bY0b6cy13f42Z2437aZ2cb1y1e45Y047e3Y0fbfY04c4bY0118eY0154dZ0175cZ0198cZ01bdeZ01e53Z020ecZ023aaZ0268eZ02999Z02cccZ03028Z033aeZ05144Y01341Y0560dY0154fY03761Z13b3eZ13f48Z04380Z047e7Z04c7eZ05146Z05640Z05b6dY0173fY0609bY01990Y03f4aZ24382Z26666Y01bc1Y06bfdY01e59Y047ebZ14c82Z1514aZ05644Z05b71Z060d2Z06668Z06c34Z07237Y020cfY0783bY023b2Y07ee8Y02671Y0855dY029a3Y08c81Y02cafY0936bY03034Y19b0aY23391Y1a26dY2376dY0aa8bY03b1fY0b26bY03f56y047f5x05154x05b7bx06672x07241X27ef0x08c87x09b0ex0aa8dx0bb0cy04361y0c36dy04c8dx0564fx060ddx06c3fx0787dX2859fx093adx0a2afx0b2adx0"),
            new CatalogItem(14, "Rewinder Motor Assembly", "1eY02dY042Y05eY082Y0afY0e6Y0128Y0176X123ax033aX1489X0628x01d7X12b8x03d9X154fX0719x04fX073X051Z074Z0a0X0117Y029dY0523Z05f4Z08e9Z0a14Z0e2fZ0fc4Z0159Y0315Y046Y291Y0104Y01a7Y0282y039dX0500Y06b3Y08beY0b29Y0dfcY0113fY014faY2202Y026bY04e1Y02e3Y059fY036bY1671Y0404Y1758Y0855Y0969Y0a95Y0bdaY0d39X1d7X0446X0ec3X13beY0457Y093Y0502Y01937Y04c8Y2586Y211bZ0168Z02a1Y0527Y08edZ0a18Z0e33Z0fc8Z01539Z01748Z0319Y05e5Y0108Y21abY0286Y03a1Y0504y06b7Y08c2Y0b2dY0e00Y01143Y014feY01939Y01dfcY243aY04e5Y05a3Y0675Y175cY13c2Y06e0Y052bY08f1z0a1cz06e4Y0b62X0e06X01116Y112c9Y1cc1X0f9aX08f5Y0e3bz0fd0z0b66Y01184Y0e3fz0fd4z01545Y01188X01547x01986y01e4dy01bb7y020c3y0150cX0190cY11b3dY11359X01757x0171aX0e43Z2fd8Z2118aY01549y023a6X02995Y03024Y0375bY03f42Y047e1Z24c78Z2133dY01739y02ca1Y03381Y03b0dY0434dY0294aX02f8aY132e7Y1268bX02c7cX02997X02ccbX03028Y23385Y2"),
            new CatalogItem(15, "Rewinder Wheel Drive Assembly", "d1aY1e94Y1b9aZ0d03Y0102aY113c9Y017e8Z0e73Z01c6cZ011bcZ1217cZ1a76Y1bbbY11047X013cbY0d37X0120aX0ec1X024fbX03dbX01fa2X02530X21d0X22baX013ecZ015edZ017ecY0a7aZ0bccZ0d39Z0ec2Z01068Z0122cZ0140fZ01612Z01836Z01a7cZ01ce5Z01f72Z02224Z024fcZ027fbZ02b22Z0823Z0942Z062cZ071cZ048dZ0552Z0be9Z0108bZ02257X0349X0ed2Y0978Z2d7bZ2767Z0874Y0ad7Z0690Z0788Z0500Z05cfZ03bcY4455Y42532X03eaX0"),
            new CatalogItem(16, "Rewinder 12L Brace", "0Z22Z29X013X022X037X053X077X0a4X0dbX011dX016bX01c6X022fX02a7X032fX03c8X0473X0531X0603X06eaX07e7X08fbZ2a26Z2"),
            new CatalogItem(17, "Rewinder 13L Brace", "9Z012Z022Z036Z053Z076Z0a4Z0daZ011dZ016aZ01c6Z022eZ02a7Z032eZ03c8Z0472Z0531Z0602Z06eaZ07e6Z08fbZ0a26Z0b6cZ2ccaZ20Z22Z2"),
            new CatalogItem(18, "Rewinder 11L Inside Brace", "0X23X29X013X022X037X053X077X0a4X0dbX011dX016bX01c6X022fX02a7X032fX03c8X0473X0531X0603X06eaX27e7X2"),
            new CatalogItem(19, "Rewinder Linking Bracket Left", "4dZ270Z24x017Z029Z042Z063Z08dx014Z024Z038Z255Z2cx0c2x0"),
            new CatalogItem(20, "Rewinder Linking Bracket Right", "1eZ232Z24x017X042x014X038z055z0cx02aX064x025X07dZ2adZ2"),
            new CatalogItem(21, "Rewinder Drive Lock Lever", "0Y21Y24Z1bZ1"),
            //Air Exchanger
            new CatalogItem(31, "AirExchanger Bracket", "0x07X01eX04dX04X017X042X08dX014X03bX082X0f1X038X07bX0e6X0181X078X0dfX0176X0245X0dcX016fX023aX0345X016cX0233X033aX0489X0230X0333X047eX0619X0330X0477X060eX07fdX0474X0607X07f2X0a3dX0604X07ebX0a32X0ce1X07e8X0a2bX0cd6X0ff1X0a28X0ccfX0fe6X01375X0cccX0fdfX0136aX01775X0fdcx01363X0176aX01bf9X01e4Y024dY011acX01386X02d8Y0360Y01580X0179bX0410Y04bbY019d8X01c38X0594Y0666Y01ebcX02165X076cY0869Y02434X0272aX09a0Y0accY02a48X02d8fX0c38Y0d97Y03100X0349cX07b8X09f2X1c63X1f3cY010d2Y03864X08caX0b35X1dd9X13c59X09f4X012b4X01675Y01885Y01ab6Y01d09Y01f7fY02219Y024d8Y027bdY02ac9Y02dfdY0315aY034e1Y03893Y03c71Y0407cY044b5Y0491dX1527eX1b37X0149eX04dceX15792X1c94Y0df3Y0f40y012b6Y016a8Y010d6y01487Y018b8Y0fa0Y11136Y112b8Y016aaY11b20Y01489Y018baY11d73Y01320Z0150dZ016acy01b22Y02024Y018bcy01d75Y022beY0171cX025bcX02badY02ee1Y0323eY035c5Y03977Y03d55Y04160Y04599Y04a01Y04e99Y05362Y0585dY05d8bY062edY06884Y06e51Y07455Y07a91Y08106Y187b5Y1194bX028c2X01b9cX020a6X125ffX12bf0X13281X139baX141a3X14a44X153a5X15dceX168c7X17498X18149X18ee2Y19608Y11e10X02363X12907X12f47X1362bX13dbbX145ffX14effX158c3X16353X16eb7X17af7X1881bX1"),
            new CatalogItem(32, "AirExchanger Caddy", "33Y171Y148Y195Y173Y2d5Y297Y210cY2d7Y1165Y110eY11b3Y1167Y0229Z02a0Z0327y01b5Y03afy0169Y022bY0329y146bZ0528Z0dbX01b7Y0294Y03b1y1154Z11acZ11fdZ1270Z12deZ1370Z13ffZ14b4Z111dX032by046dZ052aZ05fby03b3y06cdy05fdx06e4x01eX04dX0"),
            new CatalogItem(33, "AirExchanger Motor assembly", "9Y0115X0fY02fY06bY0cbY019Z02bZ044X08fX1102X01a5Z020bZ03dY084Y0f3Y0192Y0269Z02ecZ059Y0163X066X0c4X114eX022Y01beY031Y0219Y046Y0282Y062Z18bZ12faZ138fZ1b3Z1efZ141bZ14d3Z10Z12Z19cZ1d2Z114Z124Z1190Z11f4Z1"),
            new CatalogItem(34, "AirExchanger End Plate", "82y0f1Y0190y0afy0133Y01eby0f3Y0192Y1269Y0135Y01edY12e1Y03bcZ1466Z1500Z15cfZ186Z1b8Z1f5Y1194Y026bY0382Y04e1Z05aeZ0690Z0788Z0137Y11efY02e3Y041bY0")
        ];
    }
    onSelectPart(item, event) {
        editor.part = Part.fromString(item.string);
        editor.updateMesh(true);
        window.history.pushState({}, document.title, "?part=" + item.string + "&name=" + encodeURIComponent(item.name));
        event.preventDefault();
        editor.setName(item.name);
    }
}
class CatalogItem {
    part = null;
    id;
    string;
    name;
    constructor(id, name, string) {
        this.id = id;
        this.name = name;
        this.string = string;
        this.part = Part.fromString(string);
    }
}
var MouseMode;
(function (MouseMode) {
    MouseMode[MouseMode["None"] = 0] = "None";
    MouseMode[MouseMode["Manipulate"] = 1] = "Manipulate";
    MouseMode[MouseMode["Translate"] = 2] = "Translate";
    MouseMode[MouseMode["Rotate"] = 3] = "Rotate";
})(MouseMode || (MouseMode = {}));
class Editor {
    camera;
    partRenderer;
    partNormalDepthRenderer;
    contourEffect;
    wireframeRenderer;
    part;
    canvas;
    translation = new Vector3(0, 0, 0);
    center;
    rotationX = 45;
    rotationY = -20;
    zoom = 5;
    zoomStep = 0.9;
    mouseMode = MouseMode.None;
    lastMousePosition;
    handles;
    editorState;
    style = RenderStyle.Contour;
    measurements = new Measurements();
    previousMousePostion;
    constructor() {
        var url = new URL(document.URL);
        if (url.searchParams.has("part")) {
            this.part = Part.fromString(url.searchParams.get("part"));
            if (url.searchParams.has("name")) {
                this.setName(url.searchParams.get("name"));
            }
        }
        else {
            this.part = Part.fromString(catalog.items[Math.floor(Math.random() * catalog.items.length)].string);
        }
        this.displayMeasurements();
        this.editorState = new EditorState();
        this.canvas = document.getElementById('canvas');
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
        this.canvas.addEventListener("mousedown", (event) => this.onMouseDown(event));
        this.canvas.addEventListener("mouseup", (event) => this.onMouseUp(event));
        this.canvas.addEventListener("mousemove", (event) => this.onMouseMove(event));
        this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
        this.canvas.addEventListener("wheel", (event) => this.onScroll(event));
        window.addEventListener("keydown", (event) => this.onKeydown(event));
        document.getElementById("clear").addEventListener("click", (event) => this.clear());
        document.getElementById("share").addEventListener("click", (event) => this.share());
        document.getElementById("save-stl").addEventListener("click", (event) => this.saveSTL());
        document.getElementById("save-studio").addEventListener("click", (event) => this.saveStudioPart());
        document.getElementById("remove").addEventListener("click", (event) => this.remove());
        document.getElementById("style").addEventListener("change", (event) => this.setRenderStyle(parseInt(event.srcElement.value)));
        window.addEventListener("resize", (e) => this.camera.onResize());
        document.getElementById("applymeasurements").addEventListener("click", (event) => this.applyMeasurements());
        document.getElementById("resetmeasurements").addEventListener("click", (event) => this.resetMeasurements());
        this.initializeEditor("type", (typeName) => this.setType(typeName));
        this.initializeEditor("orientation", (orientationName) => this.setOrientation(orientationName));
        this.initializeEditor("size", (sizeName) => this.setSize(sizeName));
        this.initializeEditor("rounded", (roundedName) => this.setRounded(roundedName));
        document.getElementById("blockeditor").addEventListener("toggle", (event) => this.onNodeEditorClick(event));
        this.getNameTextbox().addEventListener("change", (event) => this.onPartNameChange(event));
        this.getNameTextbox().addEventListener("keyup", (event) => this.onPartNameChange(event));
    }
    onNodeEditorClick(event) {
        this.handles.visible = event.srcElement.open;
        this.camera.render();
    }
    saveSTL() {
        STLExporter.saveSTLFile(this.part, this.measurements, this.getName());
    }
    saveStudioPart() {
        StudioPartExporter.savePartFile(this.part, this.measurements, this.getName());
    }
    initializeEditor(elementId, onchange) {
        var element = document.getElementById(elementId);
        for (var i = 0; i < element.children.length; i++) {
            var child = element.children[i];
            if (child.tagName.toLowerCase() == "label") {
                child.addEventListener("click", (event) => onchange(event.target.previousElementSibling.value));
            }
        }
    }
    clear() {
        this.part.blocks.clear();
        this.updateMesh();
    }
    share() {
        var name = this.getName();
        var url = "?part=" + this.part.toString();
        if (name.length != 0) {
            url += '&name=' + encodeURIComponent(name);
        }
        window.history.pushState({}, document.title, url);
    }
    remove() {
        this.part.clearBlock(this.handles.getSelectedBlock(), this.editorState.orientation);
        if (this.editorState.fullSize) {
            this.part.clearBlock(this.handles.getSelectedBlock().plus(FORWARD[this.editorState.orientation]), this.editorState.orientation);
        }
        this.updateMesh();
    }
    setType(typeName) {
        this.editorState.type = BLOCK_TYPE[typeName];
        this.updateBlock();
    }
    setOrientation(orientatioName) {
        this.editorState.orientation = ORIENTATION[orientatioName];
        this.handles.setMode(this.editorState.fullSize, this.editorState.orientation);
        this.updateBlock();
    }
    setSize(sizeName) {
        this.editorState.fullSize = sizeName == "full";
        this.handles.setMode(this.editorState.fullSize, this.editorState.orientation);
        this.camera.render();
    }
    setRounded(roundedName) {
        this.editorState.rounded = roundedName == "true";
        this.updateBlock();
    }
    setRenderStyle(style) {
        this.style = style;
        this.partNormalDepthRenderer.enabled = style == RenderStyle.Contour;
        this.contourEffect.enabled = style == RenderStyle.Contour;
        this.partRenderer.enabled = style != RenderStyle.Wireframe;
        this.wireframeRenderer.enabled = style == RenderStyle.SolidWireframe || style == RenderStyle.Wireframe;
        this.updateMesh();
    }
    updateBlock() {
        this.part.placeBlockForced(this.handles.getSelectedBlock(), new Block(this.editorState.orientation, this.editorState.type, this.editorState.rounded));
        if (this.editorState.fullSize) {
            this.part.placeBlockForced(this.handles.getSelectedBlock().plus(FORWARD[this.editorState.orientation]), new Block(this.editorState.orientation, this.editorState.type, this.editorState.rounded));
        }
        this.updateMesh();
    }
    updateMesh(center = false) {
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
        }
        else {
            this.translation = this.translation.plus(this.getRotation().transformDirection(this.center.minus(newCenter)));
        }
        this.center = newCenter;
        this.updateTransform();
        this.handles.updateTransforms();
        this.camera.render();
    }
    getRotation() {
        return Matrix4.getRotation(new Vector3(0, this.rotationX, this.rotationY));
    }
    updateTransform() {
        this.camera.transform =
            Matrix4.getTranslation(this.center)
                .times(this.getRotation())
                .times(Matrix4.getTranslation(this.translation.plus(new Vector3(0, 0, -15))));
    }
    onMouseDown(event) {
        this.canvas.focus();
        const { ctrlKey, shiftKey } = event;
        if (event.button === 0 && !ctrlKey && !shiftKey) {
            if (this.handles.onMouseDown(event)) {
                this.mouseMode = MouseMode.Manipulate;
            }
        }
        else if (event.button === 1 || shiftKey) {
            this.mouseMode = MouseMode.Translate;
            this.previousMousePostion = [event.clientX, event.clientY];
        }
        else if (event.button === 2 || ctrlKey) {
            this.mouseMode = MouseMode.Rotate;
        }
        event.preventDefault();
    }
    onMouseUp(event) {
        this.mouseMode = MouseMode.None;
        this.handles.onMouseUp();
        event.preventDefault();
    }
    onMouseMove(event) {
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
    onScroll(event) {
        this.zoom *= event.deltaY < 0 ? this.zoomStep : 1 / this.zoomStep;
        this.camera.size = this.zoom;
        this.camera.render();
    }
    onKeydown(event) {
        const keyActions = {
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
    displayMeasurements() {
        for (var namedMeasurement of NAMED_MEASUREMENTS) {
            namedMeasurement.applyToDom(this.measurements);
        }
    }
    applyMeasurements() {
        for (var namedMeasurement of NAMED_MEASUREMENTS) {
            namedMeasurement.readFromDOM(this.measurements);
        }
        this.measurements.enforceConstraints();
        this.displayMeasurements();
        this.updateMesh();
    }
    resetMeasurements() {
        this.measurements = new Measurements();
        this.displayMeasurements();
        this.updateMesh();
    }
    getNameTextbox() {
        return document.getElementById('partName');
    }
    getName() {
        var name = this.getNameTextbox().value.trim();
        if (name.length == 0) {
            name = 'Part';
        }
        return name;
    }
    onPartNameChange(event) {
        var name = this.getNameTextbox().value.trim();
        if (name.length == 0) {
            document.title = 'Part Designer';
        }
        else {
            document.title = name + ' ⋅ Part Designer';
        }
    }
    setName(name) {
        document.title = name + ' ⋅ Part Designer';
        this.getNameTextbox().value = name;
    }
}
class EditorState {
    orientation = Orientation.X;
    type = BlockType.PinHole;
    fullSize = true;
    rounded = true;
}
const ARROW_RADIUS_INNER = 0.05;
const ARROW_RADIUS_OUTER = 0.15;
const ARROW_LENGTH = 0.35;
const ARROW_TIP = 0.15;
const HANDLE_DISTANCE = 0.5;
const GRAB_RADIUS = 0.1;
const GRAB_START = 0.4;
const GRAB_END = 1.1;
const UNSELECTED_ALPHA = 0.5;
var Axis;
(function (Axis) {
    Axis[Axis["None"] = 0] = "None";
    Axis[Axis["X"] = 1] = "X";
    Axis[Axis["Y"] = 2] = "Y";
    Axis[Axis["Z"] = 3] = "Z";
})(Axis || (Axis = {}));
class Handles {
    xNegative;
    xPositive;
    yNegative;
    yPositive;
    zNegative;
    zPositive;
    meshRenderers = [];
    position;
    block;
    camera;
    handleAlpha = Vector3.one().times(UNSELECTED_ALPHA);
    grabbedAxis = Axis.None;
    grabbedPosition;
    visible = true;
    box;
    fullSize = true;
    orientation = Orientation.X;
    size;
    createRenderer(mesh, color) {
        let renderer = new MeshRenderer();
        renderer.setMesh(mesh);
        renderer.color = color;
        this.meshRenderers.push(renderer);
        return renderer;
    }
    getBlockCenter(block) {
        if (this.fullSize) {
            return this.block.plus(Vector3.one()).times(0.5);
        }
        else {
            return this.block.plus(Vector3.one()).times(0.5).minus(FORWARD[this.orientation].times(0.25));
        }
    }
    getBlock(worldPosition) {
        if (this.fullSize) {
            return worldPosition.times(2).minus(Vector3.one().times(0.5)).floor();
        }
        else {
            return worldPosition.times(2).minus(Vector3.one().minus(FORWARD[this.orientation]).times(0.5)).floor();
        }
    }
    constructor(camera) {
        this.box = new WireframeBox();
        let mesh = Handles.getArrowMesh(20);
        this.xNegative = this.createRenderer(mesh, new Vector3(1, 0, 0));
        this.xPositive = this.createRenderer(mesh, new Vector3(1, 0, 0));
        this.yNegative = this.createRenderer(mesh, new Vector3(0, 1, 0));
        this.yPositive = this.createRenderer(mesh, new Vector3(0, 1, 0));
        this.zNegative = this.createRenderer(mesh, new Vector3(0, 0, 1));
        this.zPositive = this.createRenderer(mesh, new Vector3(0, 0, 1));
        this.block = Vector3.zero();
        this.setMode(true, Orientation.X, false);
        this.camera = camera;
    }
    render(camera) {
        if (!this.visible) {
            return;
        }
        this.box.render(camera);
        this.xPositive.alpha = this.handleAlpha.x;
        this.xNegative.alpha = this.handleAlpha.x;
        this.yPositive.alpha = this.handleAlpha.y;
        this.yNegative.alpha = this.handleAlpha.y;
        this.zPositive.alpha = this.handleAlpha.z;
        this.zNegative.alpha = this.handleAlpha.z;
        gl.colorMask(false, false, false, false);
        gl.depthFunc(gl.ALWAYS);
        for (let renderer of this.meshRenderers) {
            renderer.render(camera);
        }
        gl.depthFunc(gl.LEQUAL);
        for (let renderer of this.meshRenderers) {
            renderer.render(camera);
        }
        gl.colorMask(true, true, true, true);
        for (let renderer of this.meshRenderers) {
            renderer.render(camera);
        }
    }
    updateTransforms() {
        this.xPositive.transform = Quaternion.euler(new Vector3(0, -90, 0)).toMatrix()
            .times(Matrix4.getTranslation(this.position.plus(new Vector3(this.size.x * HANDLE_DISTANCE, 0, 0))));
        this.xNegative.transform = Quaternion.euler(new Vector3(0, 90, 0)).toMatrix()
            .times(Matrix4.getTranslation(this.position.plus(new Vector3(this.size.x * -HANDLE_DISTANCE, 0, 0))));
        this.yPositive.transform = Quaternion.euler(new Vector3(90, 0, 0)).toMatrix()
            .times(Matrix4.getTranslation(this.position.plus(new Vector3(0, this.size.y * HANDLE_DISTANCE, 0))));
        this.yNegative.transform = Quaternion.euler(new Vector3(-90, 0, 0)).toMatrix()
            .times(Matrix4.getTranslation(this.position.plus(new Vector3(0, this.size.y * -HANDLE_DISTANCE, 0))));
        this.zPositive.transform = Matrix4.getTranslation(this.position.plus(new Vector3(0, 0, this.size.z * HANDLE_DISTANCE)));
        this.zNegative.transform = Quaternion.euler(new Vector3(180, 0, 0)).toMatrix()
            .times(Matrix4.getTranslation(this.position.plus(new Vector3(0, 0, this.size.z * -HANDLE_DISTANCE))));
        this.box.transform = Matrix4.getTranslation(this.getBlockCenter(this.block));
        this.box.scale = this.size.times(0.5);
    }
    static getVector(angle, radius, z) {
        return new Vector3(radius * Math.cos(angle), radius * Math.sin(angle), z);
    }
    static getArrowMesh(subdivisions) {
        let triangles = [];
        for (let i = 0; i < subdivisions; i++) {
            let angle1 = i / subdivisions * 2 * Math.PI;
            let angle2 = (i + 1) / subdivisions * 2 * Math.PI;
            // Base
            triangles.push(new Triangle(Handles.getVector(angle1, ARROW_RADIUS_INNER, 0), Vector3.zero(), Handles.getVector(angle2, ARROW_RADIUS_INNER, 0)));
            // Side
            triangles.push(new TriangleWithNormals(Handles.getVector(angle1, ARROW_RADIUS_INNER, 0), Handles.getVector(angle2, ARROW_RADIUS_INNER, 0), Handles.getVector(angle2, ARROW_RADIUS_INNER, ARROW_LENGTH), Handles.getVector(angle1, 1, 0).times(-1), Handles.getVector(angle2, 1, 0).times(-1), Handles.getVector(angle2, 1, 0).times(-1)));
            triangles.push(new TriangleWithNormals(Handles.getVector(angle1, ARROW_RADIUS_INNER, ARROW_LENGTH), Handles.getVector(angle1, ARROW_RADIUS_INNER, 0), Handles.getVector(angle2, ARROW_RADIUS_INNER, ARROW_LENGTH), Handles.getVector(angle1, 1, 0).times(-1), Handles.getVector(angle1, 1, 0).times(-1), Handles.getVector(angle2, 1, 0).times(-1)));
            // Tip base
            triangles.push(new Triangle(Handles.getVector(angle1, ARROW_RADIUS_INNER, ARROW_LENGTH), Handles.getVector(angle2, ARROW_RADIUS_INNER, ARROW_LENGTH), Handles.getVector(angle2, ARROW_RADIUS_OUTER, ARROW_LENGTH)));
            triangles.push(new Triangle(Handles.getVector(angle1, ARROW_RADIUS_OUTER, ARROW_LENGTH), Handles.getVector(angle1, ARROW_RADIUS_INNER, ARROW_LENGTH), Handles.getVector(angle2, ARROW_RADIUS_OUTER, ARROW_LENGTH)));
            // Tip
            let alpha = Math.tan(ARROW_TIP / ARROW_RADIUS_OUTER);
            triangles.push(new TriangleWithNormals(new Vector3(0, 0, ARROW_LENGTH + ARROW_TIP), Handles.getVector(angle1, ARROW_RADIUS_OUTER, ARROW_LENGTH), Handles.getVector(angle2, ARROW_RADIUS_OUTER, ARROW_LENGTH), Handles.getVector(angle1, -Math.sin(alpha), -Math.cos(alpha)), Handles.getVector(angle1, -Math.sin(alpha), -Math.cos(alpha)), Handles.getVector(angle2, -Math.sin(alpha), -Math.cos(alpha))));
        }
        return new Mesh(triangles);
    }
    getRay(axis) {
        switch (axis) {
            case Axis.X:
                return new Ray(this.position, new Vector3(1, 0, 0));
            case Axis.Y:
                return new Ray(this.position, new Vector3(0, 1, 0));
            case Axis.Z:
                return new Ray(this.position, new Vector3(0, 0, 1));
        }
        throw new Error("Unknown axis: " + axis);
    }
    getMouseHandle(event) {
        var mouseRay = this.camera.getScreenToWorldRay(event);
        for (let axis of [Axis.X, Axis.Y, Axis.Z]) {
            var axisRay = this.getRay(axis);
            if (mouseRay.getDistanceToRay(axisRay) < GRAB_RADIUS) {
                var position = axisRay.getClosestToRay(mouseRay);
                if (Math.abs(position) > GRAB_START && Math.abs(position) < GRAB_END) {
                    return [axis, position];
                }
            }
        }
        return [Axis.None, 0];
    }
    onMouseDown(event) {
        var handleData = this.getMouseHandle(event);
        this.grabbedAxis = handleData[0];
        this.grabbedPosition = handleData[1];
        return this.grabbedAxis != Axis.None;
    }
    onMouseMove(event) {
        if (this.grabbedAxis != Axis.None) {
            var mouseRay = this.camera.getScreenToWorldRay(event);
            var axisRay = this.getRay(this.grabbedAxis);
            var mousePosition = axisRay.getClosestToRay(mouseRay);
            this.position = this.position.plus(axisRay.direction.times(mousePosition - this.grabbedPosition));
            this.block = this.getBlock(this.position);
            this.updateTransforms();
            this.camera.render();
        }
        else {
            var axis = this.getMouseHandle(event)[0];
            var newAlpha = new Vector3(axis == Axis.X ? 1 : UNSELECTED_ALPHA, axis == Axis.Y ? 1 : UNSELECTED_ALPHA, axis == Axis.Z ? 1 : UNSELECTED_ALPHA);
            if (!newAlpha.equals(this.handleAlpha)) {
                this.handleAlpha = newAlpha;
                this.camera.render();
            }
        }
    }
    onMouseUp() {
        if (this.grabbedAxis != Axis.None) {
            this.grabbedAxis = Axis.None;
            this.animatePositionAndSize(this.getBlockCenter(this.block), this.size, false, 100);
        }
    }
    move(direction) {
        this.position = this.position.plus(direction);
        this.block = this.getBlock(this.position);
        this.updateTransforms();
        this.camera.render();
    }
    getSelectedBlock() {
        return this.block;
    }
    setMode(fullSize, orientation, animate = true) {
        if (this.fullSize == fullSize && this.orientation == orientation && animate) {
            return;
        }
        switch (orientation) {
            case Orientation.X:
                this.box.color = new Vector3(1.0, 0.0, 0.0);
                break;
            case Orientation.Y:
                this.box.color = new Vector3(0.0, 0.8, 0.0);
                break;
            case Orientation.Z:
                this.box.color = new Vector3(0.0, 0.0, 1.0);
                break;
        }
        this.fullSize = fullSize;
        this.orientation = orientation;
        var targetPosition = this.getBlockCenter(this.block);
        var targetSize = Vector3.one();
        if (!this.fullSize) {
            targetSize = targetSize.minus(FORWARD[this.orientation].times(0.5));
        }
        if (!animate) {
            this.position = targetPosition;
            this.size = Vector3.one();
            this.updateTransforms();
            return;
        }
        this.animatePositionAndSize(targetPosition, targetSize);
    }
    animatePositionAndSize(targetPosition, targetSize, animateBox = true, time = 300) {
        var startPosition = this.position;
        var startSize = this.size;
        var start = new Date().getTime();
        var end = start + time;
        var handles = this;
        function callback() {
            var progress = ease(Math.min(1.0, (new Date().getTime() - start) / (end - start)));
            handles.position = Vector3.lerp(startPosition, targetPosition, progress);
            handles.size = Vector3.lerp(startSize, targetSize, progress);
            handles.updateTransforms();
            if (animateBox) {
                handles.box.transform = Matrix4.getTranslation(handles.position);
            }
            handles.camera.render();
            if (progress < 1.0) {
                window.requestAnimationFrame(callback);
            }
        }
        window.requestAnimationFrame(callback);
    }
}
class NamedMeasurement {
    name;
    relative;
    displayDouble;
    domElement;
    resetElement;
    constructor(name, relative, displayDouble) {
        this.name = name;
        this.relative = relative;
        this.displayDouble = displayDouble;
        this.domElement = document.getElementById(name);
        this.resetElement = this.domElement.previousElementSibling;
        if (this.domElement == null) {
            throw new Error("DOM Element " + this.name + " not found.");
        }
        this.resetElement.addEventListener("click", (event) => this.reset(event));
    }
    readFromDOM(measurements) {
        var value = parseFloat(this.domElement.value);
        if (!isFinite(value) || value < 0) {
            return;
        }
        if (this.relative) {
            value /= measurements.technicUnit;
        }
        if (this.displayDouble) {
            value /= 2;
        }
        measurements[this.name] = value;
    }
    applyToDom(measurements) {
        var value = measurements[this.name];
        if (this.relative) {
            value *= measurements.technicUnit;
        }
        if (this.displayDouble) {
            value *= 2;
        }
        value = Math.round(value * 1000) / 1000;
        this.domElement.value = value.toString();
        this.resetElement.style.visibility = measurements[this.name] == DEFAULT_MEASUREMENTS[this.name] ? "hidden" : "visible";
    }
    reset(event) {
        editor.measurements[this.name] = DEFAULT_MEASUREMENTS[this.name];
        this.applyToDom(DEFAULT_MEASUREMENTS);
        editor.updateMesh();
        event.preventDefault();
    }
}
const NAMED_MEASUREMENTS = [
    new NamedMeasurement("technicUnit", false, false),
    new NamedMeasurement("edgeMargin", true, false),
    new NamedMeasurement("interiorRadius", true, true),
    new NamedMeasurement("pinHoleRadius", true, true),
    new NamedMeasurement("pinHoleOffset", true, false),
    new NamedMeasurement("axleHoleSize", true, true),
    new NamedMeasurement("pinRadius", true, true),
    new NamedMeasurement("pinLipRadius", true, true),
    new NamedMeasurement("axleSizeInner", true, false),
    new NamedMeasurement("axleSizeOuter", true, false),
    new NamedMeasurement("attachmentAdapterSize", true, true),
    new NamedMeasurement("attachmentAdapterRadius", true, true),
    new NamedMeasurement("interiorEndMargin", true, false),
    new NamedMeasurement("lipSubdivisions", false, false),
    new NamedMeasurement("subdivisionsPerQuarter", false, false),
    new NamedMeasurement("ballRadius", true, true),
    new NamedMeasurement("ballBaseRadius", true, true)
];
var RenderStyle;
(function (RenderStyle) {
    RenderStyle[RenderStyle["Contour"] = 0] = "Contour";
    RenderStyle[RenderStyle["Solid"] = 1] = "Solid";
    RenderStyle[RenderStyle["Wireframe"] = 2] = "Wireframe";
    RenderStyle[RenderStyle["SolidWireframe"] = 3] = "SolidWireframe";
})(RenderStyle || (RenderStyle = {}));
class STLExporter {
    buffer;
    view;
    constructor(size) {
        this.buffer = new ArrayBuffer(size);
        this.view = new DataView(this.buffer, 0, size);
    }
    writeVector(offset, vector) {
        this.view.setFloat32(offset, vector.z, true);
        this.view.setFloat32(offset + 4, vector.x, true);
        this.view.setFloat32(offset + 8, vector.y, true);
    }
    writeTriangle(offset, triangle, scalingFactor) {
        this.writeVector(offset, triangle.normal().times(-1));
        this.writeVector(offset + 12, triangle.v1.times(scalingFactor));
        this.writeVector(offset + 24, triangle.v2.times(scalingFactor));
        this.writeVector(offset + 36, triangle.v3.times(scalingFactor));
        this.view.setInt16(offset + 48, 0, true);
    }
    static fixOpenEdges(triangles) {
        var points = [];
        for (var triangle of triangles) {
            if (!containsPoint(points, triangle.v1)) {
                points.push(triangle.v1);
            }
            if (!containsPoint(points, triangle.v2)) {
                points.push(triangle.v2);
            }
            if (!containsPoint(points, triangle.v3)) {
                points.push(triangle.v3);
            }
        }
        var result = [];
        for (var triangle of triangles) {
            var edge1Hits = [0];
            var edge2Hits = [0];
            var edge3Hits = [0];
            var edge1Direction = triangle.v2.minus(triangle.v1);
            var edge2Direction = triangle.v3.minus(triangle.v2);
            var edge3Direction = triangle.v1.minus(triangle.v3);
            let edge1LengthSquared = Math.pow(edge1Direction.magnitude(), 2);
            let edge2LengthSquared = Math.pow(edge2Direction.magnitude(), 2);
            let edge3LengthSquared = Math.pow(edge3Direction.magnitude(), 2);
            for (var point of points) {
                var vertex1Relative = point.minus(triangle.v1);
                var vertex2Relative = point.minus(triangle.v2);
                var vertex3Relative = point.minus(triangle.v3);
                if (Vector3.isCollinear(edge1Direction, vertex1Relative)) {
                    let progress = vertex1Relative.dot(edge1Direction) / edge1LengthSquared;
                    if (progress > 0.0001 && progress < 0.999) {
                        edge1Hits.push(progress);
                        continue;
                    }
                    continue;
                }
                if (Vector3.isCollinear(edge2Direction, vertex2Relative)) {
                    let progress = vertex2Relative.dot(edge2Direction) / edge2LengthSquared;
                    if (progress > 0.0001 && progress < 0.999) {
                        edge2Hits.push(progress);
                        continue;
                    }
                    continue;
                }
                if (Vector3.isCollinear(edge3Direction, vertex3Relative)) {
                    let progress = vertex3Relative.dot(edge3Direction) / edge3LengthSquared;
                    if (progress > 0.0001 && progress < 0.999) {
                        edge3Hits.push(progress);
                        continue;
                    }
                    continue;
                }
            }
            if (edge1Hits.length == 1 && edge2Hits.length == 1 && edge3Hits.length == 1) {
                result.push(triangle);
                continue;
            }
            edge1Hits.sort();
            edge2Hits.sort();
            edge3Hits.sort();
            for (var i = 0; i < edge1Hits.length - 1; i++) {
                result.push(new Triangle(triangle.getOnEdge1(edge1Hits[i]), triangle.getOnEdge1(edge1Hits[i + 1]), triangle.getOnEdge3(edge3Hits[edge3Hits.length - 1])));
            }
            for (var i = 0; i < edge2Hits.length - 1; i++) {
                result.push(new Triangle(triangle.getOnEdge2(edge2Hits[i]), triangle.getOnEdge2(edge2Hits[i + 1]), triangle.getOnEdge1(edge1Hits[edge1Hits.length - 1])));
            }
            for (var i = 0; i < edge3Hits.length - 1; i++) {
                result.push(new Triangle(triangle.getOnEdge3(edge3Hits[i]), triangle.getOnEdge3(edge3Hits[i + 1]), triangle.getOnEdge2(edge2Hits[edge2Hits.length - 1])));
            }
            if (edge1Hits.length > 1 && edge2Hits.length == 1) {
                result.push(new Triangle(triangle.getOnEdge1(edge1Hits[edge1Hits.length - 1]), triangle.getOnEdge2(edge2Hits[0]), triangle.getOnEdge3(edge3Hits[edge3Hits.length - 1])));
            }
            else if (edge2Hits.length > 1 && edge3Hits.length == 1) {
                result.push(new Triangle(triangle.getOnEdge2(edge2Hits[edge2Hits.length - 1]), triangle.getOnEdge3(edge3Hits[0]), triangle.getOnEdge1(edge1Hits[edge1Hits.length - 1])));
            }
            else if (edge3Hits.length > 1 && edge1Hits.length == 1) {
                result.push(new Triangle(triangle.getOnEdge3(edge3Hits[edge3Hits.length - 1]), triangle.getOnEdge1(edge1Hits[0]), triangle.getOnEdge2(edge2Hits[edge2Hits.length - 1])));
            }
        }
        return result;
    }
    static createBuffer(part, measurements) {
        let mesh = new PartMeshGenerator(part, measurements).getMesh();
        let triangles = STLExporter.fixOpenEdges(mesh.triangles);
        let exporter = new STLExporter(84 + 50 * triangles.length);
        for (var i = 0; i < 80; i++) {
            exporter.view.setInt8(i, 0);
        }
        var p = 80;
        exporter.view.setInt32(p, triangles.length, true);
        p += 4;
        for (let triangle of triangles) {
            exporter.writeTriangle(p, triangle, measurements.technicUnit);
            p += 50;
        }
        return exporter.buffer;
    }
    static saveSTLFile(part, measurements, name = "part") {
        let filename = name.toLowerCase().replaceAll(" ", "_") + ".stl";
        let blob = new Blob([STLExporter.createBuffer(part, measurements)], { type: "application/octet-stream" });
        let link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }
}
class StudioPartExporter {
    static formatPoint(vector) {
        return (vector.x * 20).toFixed(4) + " " + (-vector.y * 20).toFixed(4) + " " + (-vector.z * 20).toFixed(4);
    }
    static formatVector(vector) {
        return (vector.x).toFixed(4) + " " + (-vector.y).toFixed(4) + " " + (-vector.z).toFixed(4);
    }
    static formatConnector(position, block, facesForward) {
        let result = "0 PE_CONN ";
        switch (block.type) {
            case BlockType.PinHole:
                result += "0 2";
                break;
            case BlockType.AxleHole:
                result += "0 6";
                break;
            case BlockType.Axle:
                result += "0 7";
                break;
            case BlockType.Pin:
                result += "0 3";
                break;
            case BlockType.BallJoint:
                result += "1 5";
                break;
            default: throw new Error("Unknown block type: " + block.type);
        }
        if (facesForward) {
            result += " "
                + StudioPartExporter.formatVector(block.right) + " "
                + StudioPartExporter.formatVector(block.forward) + " "
                + StudioPartExporter.formatVector(block.up) + " "
                + StudioPartExporter.formatPoint(position.plus(new Vector3(1, 1, 1).plus(block.forward)).times(0.5));
        }
        else {
            result += " "
                + StudioPartExporter.formatVector(block.right.times(-1)) + " "
                + StudioPartExporter.formatVector(block.forward.times(-1)) + " "
                + StudioPartExporter.formatVector(block.up) + " "
                + StudioPartExporter.formatPoint(position.plus(new Vector3(1, 1, 1).minus(block.forward)).times(0.5));
        }
        result += " 0 0 0.8 0 0\n";
        return result;
    }
    static createFileContent(part, measurements, name, filename) {
        let smallBlocks = part.createSmallBlocks();
        let mesh = new PartMeshGenerator(part, measurements).getMesh();
        var result = `0 FILE ` + filename + `
0 Description: part
0 Name: ` + name + `
0 Author: 
0 BFC CERTIFY CCW
1 16 0.0000 -0.5000 0.0000 1.0000 0.0000 0.0000 0.0000 1.0000 0.0000 0.0000 0.0000 1.0000 part.obj_grouped
0 NOFILE
0 FILE part.obj_grouped
0 Description: part.obj_grouped
0 Name: 
0 Author: 
0 ModelType: Part
0 BFC CERTIFY CCW
1 16 0.0000 0.0000 0.0000 1.0000 0.0000 0.0000 0.0000 1.0000 0.0000 0.0000 0.0000 1.0000 part.obj
`;
        for (let position of part.blocks.keys()) {
            let startBlock = part.blocks.get(position);
            if (startBlock.type == BlockType.Solid) {
                continue;
            }
            let previousBlock = part.blocks.getOrNull(position.minus(startBlock.forward));
            let isFirstInRow = previousBlock == null || previousBlock.orientation != startBlock.orientation || previousBlock.type != startBlock.type;
            if (!isFirstInRow) {
                continue;
            }
            let facesForward = false;
            if (startBlock.isAttachment) {
                for (let x = 0; x <= 1; x++) {
                    for (let y = 0; y <= 1; y++) {
                        let supportBlockPosition = position.minus(startBlock.forward).plus(startBlock.right.times(x)).plus(startBlock.up.times(y));
                        let supportBlock = smallBlocks.getOrNull(supportBlockPosition);
                        if (supportBlock != null && !supportBlock.isAttachment) {
                            facesForward = true;
                            break;
                        }
                    }
                    if (facesForward) {
                        break;
                    }
                }
            }
            let block = startBlock;
            let offset = 0;
            while (true) {
                let nextBlock = part.blocks.getOrNull(position.plus(startBlock.forward));
                let isLastInRow = nextBlock == null || nextBlock.orientation != startBlock.orientation || nextBlock.type != startBlock.type;
                if (isLastInRow && offset % 2 == 0 && offset > 0) {
                    result += StudioPartExporter.formatConnector(position.minus(startBlock.forward), block, facesForward);
                }
                else if (offset % 2 == 0) {
                    result += StudioPartExporter.formatConnector(position, block, facesForward);
                }
                if (isLastInRow) {
                    break;
                }
                offset += 1;
                position = position.plus(startBlock.forward);
                block = nextBlock;
            }
        }
        result += `
0 NOFILE
0 FILE part.obj
0 Description: part.obj
0 Name: 
0 Author: 
0 BFC CERTIFY CCW
`;
        for (let triangle of mesh.triangles) {
            result += "3 16 " + this.formatPoint(triangle.v1) + " " + this.formatPoint(triangle.v2) + " " + this.formatPoint(triangle.v3) + "\n";
        }
        result += "0 NOFILE\n";
        return result;
    }
    static savePartFile(part, measurements, name = "part") {
        let filename = name.toLowerCase().replaceAll(" ", "_") + ".part";
        let content = StudioPartExporter.createFileContent(part, measurements, name, filename);
        let link = document.createElement('a');
        link.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
        link.download = filename;
        link.click();
    }
}
class Matrix4 {
    elements;
    constructor(elements) {
        this.elements = elements;
    }
    get(i, j) {
        return this.elements[4 * i + j];
    }
    times(other) {
        let result = [];
        for (var i = 0; i < 4; i++) {
            for (var j = 0; j < 4; j++) {
                let element = 0;
                for (var k = 0; k < 4; k++) {
                    element += this.get(i, k) * other.get(k, j);
                }
                result.push(element);
            }
        }
        return new Matrix4(result);
    }
    transpose() {
        return new Matrix4([
            this.elements[0], this.elements[4], this.elements[8], this.elements[12],
            this.elements[1], this.elements[5], this.elements[9], this.elements[13],
            this.elements[2], this.elements[6], this.elements[10], this.elements[14],
            this.elements[3], this.elements[7], this.elements[10], this.elements[15]
        ]);
    }
    invert() {
        // based on http://www.euclideanspace.com/maths/algebra/matrix/functions/inverse/fourD/index.htm
        // via https://github.com/mrdoob/three.js/blob/dev/src/math/Matrix4.js
        var el = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], n11 = this.elements[0], n21 = this.elements[1], n31 = this.elements[2], n41 = this.elements[3], n12 = this.elements[4], n22 = this.elements[5], n32 = this.elements[6], n42 = this.elements[7], n13 = this.elements[8], n23 = this.elements[9], n33 = this.elements[10], n43 = this.elements[11], n14 = this.elements[12], n24 = this.elements[13], n34 = this.elements[14], n44 = this.elements[15], t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44, t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44, t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44, t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;
        var det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
        if (det == 0) {
            throw new Error("Warning: Trying to invert matrix with determinant zero.");
        }
        var detInv = 1 / det;
        el[0] = t11 * detInv;
        el[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv;
        el[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv;
        el[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv;
        el[4] = t12 * detInv;
        el[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv;
        el[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv;
        el[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv;
        el[8] = t13 * detInv;
        el[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv;
        el[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv;
        el[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv;
        el[12] = t14 * detInv;
        el[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv;
        el[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv;
        el[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv;
        return new Matrix4(el);
    }
    transformPoint(point) {
        return new Vector3(point.x * this.elements[0] + point.y * this.elements[4] + point.z * this.elements[8] + this.elements[12], point.x * this.elements[1] + point.y * this.elements[5] + point.z * this.elements[9] + this.elements[13], point.x * this.elements[2] + point.y * this.elements[6] + point.z * this.elements[10] + this.elements[14]);
    }
    transformDirection(point) {
        return new Vector3(point.x * this.elements[0] + point.y * this.elements[4] + point.z * this.elements[8], point.x * this.elements[1] + point.y * this.elements[5] + point.z * this.elements[9], point.x * this.elements[2] + point.y * this.elements[6] + point.z * this.elements[10]);
    }
    static getProjection(near = 0.1, far = 1000, fov = 25) {
        let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
        return new Matrix4([
            1 / (Math.tan(fov * DEG_TO_RAD / 2) * aspectRatio), 0, 0, 0,
            0, 1 / Math.tan(fov * DEG_TO_RAD / 2), 0, 0,
            0, 0, -(far + near) / (far - near), -1,
            0, 0, -0.2, 0
        ]);
    }
    static getOrthographicProjection(far = 1000, size = 5) {
        let aspectRatio = gl.canvas.width / gl.canvas.height;
        return new Matrix4([
            2 / size / aspectRatio, 0, 0, 0,
            0, 2 / size, 0, 0,
            0, 0, -1 / far, 0,
            0, 0, 0, 1
        ]);
    }
    static getIdentity() {
        return new Matrix4([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
    }
    static getTranslation(vector) {
        return new Matrix4([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            vector.x, vector.y, vector.z, 1
        ]);
    }
    static getRotation(euler) {
        let phi = euler.x * DEG_TO_RAD;
        let theta = euler.y * DEG_TO_RAD;
        let psi = euler.z * DEG_TO_RAD;
        let sin = Math.sin;
        let cos = Math.cos;
        return new Matrix4([
            cos(theta) * cos(phi), -cos(psi) * sin(phi) + sin(psi) * sin(theta) * cos(phi), sin(psi) * sin(phi) + cos(psi) * sin(theta) * cos(phi), 0,
            cos(theta) * sin(phi), cos(psi) * cos(phi) + sin(psi) * sin(theta) * sin(phi), -sin(psi) * cos(phi) + cos(psi) * sin(theta) * sin(phi), 0,
            -sin(theta), sin(psi) * cos(theta), cos(psi) * cos(theta), 0,
            0, 0, 0, 1
        ]);
    }
}
class Mesh {
    triangles;
    vertexBuffer = null;
    normalBuffer = null;
    constructor(triangles) {
        this.triangles = triangles;
    }
    createVertexBuffer() {
        if (this.vertexBuffer != null) {
            return this.vertexBuffer;
        }
        let vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        var positions = [];
        for (let triangle of this.triangles) {
            this.pushVector(positions, triangle.v1);
            this.pushVector(positions, triangle.v2);
            this.pushVector(positions, triangle.v3);
        }
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
        this.vertexBuffer = vertexBuffer;
        return vertexBuffer;
    }
    createNormalBuffer() {
        if (this.normalBuffer != null) {
            return this.normalBuffer;
        }
        let normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        var normals = [];
        for (let triangle of this.triangles) {
            if (triangle instanceof TriangleWithNormals) {
                this.pushVector(normals, triangle.n1);
                this.pushVector(normals, triangle.n2);
                this.pushVector(normals, triangle.n3);
            }
            else {
                for (var i = 0; i < 3; i++) {
                    this.pushVector(normals, triangle.normal());
                }
            }
        }
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
        this.normalBuffer = normalBuffer;
        return normalBuffer;
    }
    createWireframeVertexBuffer() {
        let vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        var positions = [];
        for (let triangle of this.triangles) {
            this.pushVector(positions, triangle.v1);
            this.pushVector(positions, triangle.v2);
            this.pushVector(positions, triangle.v2);
            this.pushVector(positions, triangle.v3);
            this.pushVector(positions, triangle.v3);
            this.pushVector(positions, triangle.v1);
        }
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
        return vertexBuffer;
    }
    pushVector(array, vector) {
        array.push(vector.x);
        array.push(vector.y);
        array.push(vector.z);
    }
    getVertexCount() {
        return this.triangles.length * 3;
    }
}
class Quaternion {
    x;
    y;
    z;
    w;
    constructor(x, y, z, w) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }
    times(other) {
        return new Quaternion(this.x * other.x - this.y * other.y - this.z * other.z - this.w * other.w, this.x * other.y + other.x * this.y + this.z * other.w - other.z * this.w, this.x * other.z + other.x * this.z + this.w * other.y - other.w * this.y, this.x * other.w + other.x * this.w + this.y * other.z - other.y * this.z);
    }
    toMatrix() {
        return new Matrix4([
            1 - 2 * Math.pow(this.z, 2) - 2 * Math.pow(this.w, 2), 2 * this.y * this.z - 2 * this.w * this.x, 2 * this.y * this.w + 2 * this.z * this.x, 0,
            2 * this.y * this.z + 2 * this.w * this.x, 1 - 2 * Math.pow(this.y, 2) - 2 * Math.pow(this.w, 2), 2 * this.z * this.w - 2 * this.y * this.x, 0,
            2 * this.y * this.w - 2 * this.z * this.x, 2 * this.z * this.w + 2 * this.y * this.x, 1 - 2 * Math.pow(this.y, 2) - 2 * Math.pow(this.z, 2), 0,
            0, 0, 0, 1
        ]);
    }
    static euler(angles) {
        return Quaternion.angleAxis(angles.z, new Vector3(0, 0, 1))
            .times(Quaternion.angleAxis(angles.y, new Vector3(0, 1, 0)))
            .times(Quaternion.angleAxis(angles.x, new Vector3(1, 0, 0)));
    }
    static angleAxis(angle, axis) {
        let theta_half = angle * DEG_TO_RAD * 0.5;
        return new Quaternion(Math.cos(theta_half), axis.x * Math.sin(theta_half), axis.y * Math.sin(theta_half), axis.z * Math.sin(theta_half));
    }
    static identity() {
        return new Quaternion(1, 0, 0, 0);
    }
}
class Ray {
    point;
    direction;
    constructor(point, direction) {
        this.point = point;
        this.direction = direction;
    }
    get(t) {
        return this.point.plus(this.direction.times(t));
    }
    getDistanceToRay(other) {
        var normal = this.direction.cross(other.direction).normalized();
        var d1 = normal.dot(this.point);
        var d2 = normal.dot(other.point);
        return Math.abs(d1 - d2);
    }
    getClosestToPoint(point) {
        return this.direction.dot(this.point.minus(point));
    }
    getClosestToRay(other) {
        var connection = this.direction.cross(other.direction).normalized();
        var planeNormal = connection.cross(other.direction).normalized();
        var planeToOrigin = other.point.dot(planeNormal);
        var result = (-this.point.dot(planeNormal) + planeToOrigin) / this.direction.dot(planeNormal);
        return result;
    }
}
class Triangle {
    v1;
    v2;
    v3;
    constructor(v1, v2, v3, flipped = false) {
        if (flipped) {
            this.v1 = v2;
            this.v2 = v1;
            this.v3 = v3;
        }
        else {
            this.v1 = v1;
            this.v2 = v2;
            this.v3 = v3;
        }
    }
    normal() {
        return this.v3.minus(this.v1).cross(this.v2.minus(this.v1)).normalized();
    }
    getOnEdge1(progress) {
        return Vector3.interpolate(this.v1, this.v2, progress);
    }
    getOnEdge2(progress) {
        return Vector3.interpolate(this.v2, this.v3, progress);
    }
    getOnEdge3(progress) {
        return Vector3.interpolate(this.v3, this.v1, progress);
    }
}
class TriangleWithNormals extends Triangle {
    n1;
    n2;
    n3;
    constructor(v1, v2, v3, n1, n2, n3) {
        super(v1, v2, v3);
        this.n1 = n1;
        this.n2 = n2;
        this.n3 = n3;
    }
}
class Vector3 {
    x;
    y;
    z;
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    times(factor) {
        return new Vector3(this.x * factor, this.y * factor, this.z * factor);
    }
    plus(other) {
        return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
    }
    minus(other) {
        return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
    }
    dot(other) {
        return this.x * other.x + this.y * other.y + this.z * other.z;
    }
    cross(other) {
        return new Vector3(this.y * other.z - this.z * other.y, this.z * other.x - this.x * other.z, this.x * other.y - this.y * other.x);
    }
    elementwiseMultiply(other) {
        return new Vector3(this.x * other.x, this.y * other.y, this.z * other.z);
    }
    magnitude() {
        return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2) + Math.pow(this.z, 2));
    }
    normalized() {
        return this.times(1 / this.magnitude());
    }
    toString() {
        return "(" + this.x + ", " + this.y + ", " + this.z + ")";
    }
    copy() {
        return new Vector3(this.x, this.y, this.z);
    }
    equals(other) {
        return this.x == other.x && this.y == other.y && this.z == other.z;
    }
    floor() {
        return new Vector3(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
    }
    toNumber() {
        let layer3D = this.x + this.y + this.z;
        let layer2D = layer3D - this.y;
        return tetrahedralNumber(layer3D) + triangularNumber(layer2D) + this.x;
    }
    static fromNumber(value) {
        let layer3D = inverseTetrahedralNumber(value);
        value -= tetrahedralNumber(layer3D);
        let layer2D = inverseTriangularNumber(value);
        let x = value - triangularNumber(layer2D);
        let y = layer3D - layer2D;
        let z = layer3D - x - y;
        return new Vector3(x, y, z);
    }
    static zero() {
        return new Vector3(0, 0, 0);
    }
    static one() {
        return new Vector3(1, 1, 1);
    }
    static lerp(a, b, progress) {
        return a.plus(b.minus(a).times(progress));
    }
    static isCollinear(a, b) {
        var factor = null;
        if (a.x == 0 || b.x == 0) {
            if (Math.abs(a.x + b.x) > 0.001) {
                return false;
            }
        }
        else {
            factor = a.x / b.x;
        }
        if (a.y == 0 || b.y == 0) {
            if (Math.abs(a.y + b.y) > 0.001) {
                return false;
            }
        }
        else {
            if (factor == null) {
                factor = a.y / b.y;
            }
            else if (Math.abs(factor - a.y / b.y) > 0.001) {
                return false;
            }
        }
        if (a.z == 0 || b.z == 0) {
            if (Math.abs(a.z + b.z) > 0.001) {
                return false;
            }
        }
        else if (factor != null && Math.abs(factor - a.z / b.z) > 0.001) {
            return false;
        }
        return true;
    }
    static interpolate(a, b, t) {
        return a.times(1.0 - t).plus(b.times(t));
    }
}
const RIGHT_FACE_VERTICES = [
    new Vector3(1, 1, 0),
    new Vector3(1, 1, 1),
    new Vector3(1, 0, 1),
    new Vector3(1, 0, 0)
];
const LEFT_FACE_VERTICES = [
    new Vector3(0, 0, 0),
    new Vector3(0, 0, 1),
    new Vector3(0, 1, 1),
    new Vector3(0, 1, 0)
];
const UP_FACE_VERTICES = [
    new Vector3(0, 1, 0),
    new Vector3(0, 1, 1),
    new Vector3(1, 1, 1),
    new Vector3(1, 1, 0)
];
const DOWN_FACE_VERTICES = [
    new Vector3(1, 0, 0),
    new Vector3(1, 0, 1),
    new Vector3(0, 0, 1),
    new Vector3(0, 0, 0)
];
const FORWARD_FACE_VERTICES = [
    new Vector3(1, 0, 1),
    new Vector3(1, 1, 1),
    new Vector3(0, 1, 1),
    new Vector3(0, 0, 1)
];
const BACK_FACE_VERTICES = [
    new Vector3(0, 0, 0),
    new Vector3(0, 1, 0),
    new Vector3(1, 1, 0),
    new Vector3(1, 0, 0)
];
const FACE_DIRECTIONS = [
    new Vector3(1, 0, 0),
    new Vector3(-1, 0, 0),
    new Vector3(0, 1, 0),
    new Vector3(0, -1, 0),
    new Vector3(0, 0, 1),
    new Vector3(0, 0, -1)
];
class VectorDictionary {
    data = {};
    containsKey(key) {
        return key.x in this.data && key.y in this.data[key.x] && key.z in this.data[key.x][key.y];
    }
    get(key) {
        if (!this.containsKey(key)) {
            throw new Error("Dictionary does not contain key: " + key.toString());
        }
        return this.data[key.x][key.y][key.z];
    }
    getOrNull(key) {
        if (!this.containsKey(key)) {
            return null;
        }
        return this.data[key.x][key.y][key.z];
    }
    set(key, value) {
        if (!(key.x in this.data)) {
            this.data[key.x] = {};
        }
        if (!(key.y in this.data[key.x])) {
            this.data[key.x][key.y] = {};
        }
        this.data[key.x][key.y][key.z] = value;
    }
    remove(key) {
        if (key.x in this.data && key.y in this.data[key.x] && key.z in this.data[key.x][key.y]) {
            delete this.data[key.x][key.y][key.z];
        }
    }
    clear() {
        this.data = {};
    }
    *keys() {
        for (let x in this.data) {
            for (let y in this.data[x]) {
                for (let z in this.data[x][y]) {
                    yield new Vector3(parseInt(x), parseInt(y), parseInt(z));
                }
            }
        }
    }
    *values() {
        for (let x in this.data) {
            for (let y in this.data[x]) {
                for (let z in this.data[x][y]) {
                    yield this.data[x][y][z];
                }
            }
        }
    }
    any() {
        for (let x in this.data) {
            for (let y in this.data[x]) {
                for (let z in this.data[x][y]) {
                    return true;
                }
            }
        }
        return false;
    }
}
class Block {
    orientation;
    type;
    rounded;
    right;
    up;
    forward;
    isAttachment;
    constructor(orientation, type, rounded) {
        this.orientation = orientation;
        this.type = type;
        this.rounded = rounded;
        this.right = RIGHT[this.orientation];
        this.up = UP[this.orientation];
        this.forward = FORWARD[this.orientation];
        this.isAttachment = this.type == BlockType.Pin || this.type == BlockType.Axle || this.type == BlockType.BallJoint;
    }
}
///<reference path="../geometry/Vector3.ts" />
let CUBE = [
    new Vector3(0, 0, 0),
    new Vector3(0, 0, 1),
    new Vector3(0, 1, 0),
    new Vector3(0, 1, 1),
    new Vector3(1, 0, 0),
    new Vector3(1, 0, 1),
    new Vector3(1, 1, 0),
    new Vector3(1, 1, 1)
];
class Part {
    blocks = new VectorDictionary();
    createSmallBlocks() {
        var result = new VectorDictionary();
        for (let position of this.blocks.keys()) {
            let block = this.blocks.get(position);
            for (let local of CUBE) {
                if (block.forward.dot(local) == 1) {
                    continue;
                }
                result.set(position.plus(local), SmallBlock.createFromLocalCoordinates(block.right.dot(local), block.up.dot(local), position.plus(local), block));
            }
        }
        return result;
    }
    isSmallBlockFree(position) {
        for (let local of CUBE) {
            if (!this.blocks.containsKey(position.minus(local))) {
                continue;
            }
            var block = this.blocks.get(position.minus(local));
            if (block.forward.dot(local) == 1) {
                return false;
            }
        }
        return true;
    }
    clearSingle(position) {
        for (let local of CUBE) {
            if (!this.blocks.containsKey(position.minus(local))) {
                continue;
            }
            var block = this.blocks.get(position.minus(local));
            if (block.forward.dot(local) != 1) {
                this.blocks.remove(position.minus(local));
            }
        }
    }
    clearBlock(position, orientation) {
        for (let local of CUBE) {
            if (FORWARD[orientation].dot(local) != 1) {
                this.clearSingle(position.plus(local));
            }
        }
    }
    isBlockPlaceable(position, orientation, doubleSize) {
        for (let local of CUBE) {
            if (!doubleSize && FORWARD[orientation].dot(local) == 1) {
                continue;
            }
            if (!this.isSmallBlockFree(position.plus(local))) {
                return false;
            }
        }
        return true;
    }
    placeBlockForced(position, block) {
        this.clearBlock(position, block.orientation);
        this.blocks.set(position, block);
    }
    toString() {
        var result = "";
        if (!this.blocks.any()) {
            return result;
        }
        var origin = new Vector3(min(this.blocks.keys(), p => p.x), min(this.blocks.keys(), p => p.y), min(this.blocks.keys(), p => p.z));
        for (let position of this.blocks.keys()) {
            result += position.minus(origin).toNumber().toString(16).toLowerCase();
            let block = this.blocks.get(position);
            let orientationAndRounded = block.orientation == Orientation.X ? "x" : (block.orientation == Orientation.Y ? "y" : "z");
            if (!block.rounded) {
                orientationAndRounded = orientationAndRounded.toUpperCase();
            }
            result += orientationAndRounded;
            result += block.type.toString();
        }
        return result;
    }
    static fromString(s) {
        let XYZ = "xyz";
        let part = new Part();
        var p = 0;
        while (p < s.length) {
            var chars = 1;
            while (XYZ.indexOf(s[p + chars].toLowerCase()) == -1) {
                chars++;
            }
            let position = Vector3.fromNumber(parseInt(s.substr(p, chars), 16));
            p += chars;
            let orientationString = s[p].toString().toLowerCase();
            let orientation = orientationString == "x" ? Orientation.X : (orientationString == "y" ? Orientation.Y : Orientation.Z);
            let rounded = s[p].toLowerCase() == s[p];
            let type = parseInt(s[p + 1]);
            part.blocks.set(position, new Block(orientation, type, rounded));
            p += 2;
        }
        return part;
    }
    getBoundingBox() {
        let defaultPosition = this.blocks.keys().next().value;
        var minX = defaultPosition.x;
        var minY = defaultPosition.y;
        var minZ = defaultPosition.z;
        var maxX = defaultPosition.x;
        var maxY = defaultPosition.y;
        var maxZ = defaultPosition.z;
        for (var position of this.blocks.keys()) {
            var forward = this.blocks.get(position).forward;
            if (position.x < minX) {
                minX = position.x;
            }
            if (position.y < minY) {
                minY = position.y;
            }
            if (position.z < minZ) {
                minZ = position.z;
            }
            if (position.x + (1.0 - forward.x) > maxX) {
                maxX = position.x + (1.0 - forward.x);
            }
            if (position.y + (1.0 - forward.y) > maxY) {
                maxY = position.y + (1.0 - forward.y);
            }
            if (position.z + (1.0 - forward.z) > maxZ) {
                maxZ = position.z + (1.0 - forward.z);
            }
        }
        return [new Vector3(minX, minY, minZ), new Vector3(maxX, maxY, maxZ)];
    }
    getCenter() {
        if (!this.blocks.any()) {
            return Vector3.zero();
        }
        var boundingBox = this.getBoundingBox();
        var min = boundingBox[0];
        var max = boundingBox[1];
        return min.plus(max).plus(Vector3.one()).times(0.5);
    }
    getSize() {
        var boundingBox = this.getBoundingBox();
        var min = boundingBox[0];
        var max = boundingBox[1];
        return Math.max(max.x - min.x, Math.max(max.y - min.y, max.z - min.z)) + 1;
    }
}
class PerpendicularRoundedAdapter {
    isVertical;
    neighbor;
    directionToNeighbor;
    facesForward;
    sourceBlock;
}
class SmallBlock extends Block {
    quadrant;
    position;
    hasInterior;
    perpendicularRoundedAdapter = null;
    localX;
    localY;
    directionX;
    directionY;
    horizontal;
    vertical;
    constructor(quadrant, positon, source) {
        super(source.orientation, source.type, source.rounded);
        this.quadrant = quadrant;
        this.position = positon;
        this.hasInterior = source.type != BlockType.Solid;
        this.localX = localX(this.quadrant);
        this.localY = localY(this.quadrant);
        this.directionX = this.localX == 1 ? 1 : -1;
        this.directionY = this.localY == 1 ? 1 : -1;
        this.horizontal = this.localX == 1 ? RIGHT[this.orientation] : LEFT[this.orientation];
        this.vertical = this.localY == 1 ? UP[this.orientation] : DOWN[this.orientation];
    }
    static createFromLocalCoordinates(localX, localY, position, source) {
        return new SmallBlock(SmallBlock.getQuadrantFromLocal(localX, localY), position, source);
    }
    odd() {
        return this.quadrant == Quadrant.BottomRight || this.quadrant == Quadrant.TopLeft;
    }
    static getQuadrantFromLocal(x, y) {
        if (x == 0) {
            if (y == 0) {
                return Quadrant.BottomLeft;
            }
            else {
                return Quadrant.TopLeft;
            }
        }
        else {
            if (y == 0) {
                return Quadrant.BottomRight;
            }
            else {
                return Quadrant.TopRight;
            }
        }
    }
    getOnCircle(angle, radius = 1) {
        return this.right.times(Math.sin(angle + getAngle(this.quadrant)) * radius).plus(this.up.times(Math.cos(angle + getAngle(this.quadrant)) * radius));
    }
}
class TinyBlock extends SmallBlock {
    exteriorMergedBlocks = 1;
    isExteriorMerged = false;
    interiorMergedBlocks = 1;
    isInteriorMerged = false;
    visibleFaces = null;
    angle;
    isCenter;
    smallBlockPosition;
    constructor(position, source) {
        super(source.quadrant, position, source);
        this.visibleFaces = [true, true, true, true, true, true];
        this.perpendicularRoundedAdapter = source.perpendicularRoundedAdapter;
        this.angle = getAngle(this.quadrant);
        this.smallBlockPosition = new Vector3(Math.floor((position.x + 1) / 3), Math.floor((position.y + 1) / 3), Math.floor((position.z + 1) / 3));
        var localPosition = position.minus(this.smallBlockPosition.times(3));
        this.isCenter = localPosition.dot(this.up) == 0 && localPosition.dot(this.right) == 0;
    }
    getCylinderOrigin(meshGenerator) {
        return this.forward.times(meshGenerator.tinyIndexToWorld(this.forward.dot(this.position)))
            .plus(this.right.times((this.smallBlockPosition.dot(this.right) + (1 - this.localX)) * 0.5))
            .plus(this.up.times((this.smallBlockPosition.dot(this.up) + (1 - this.localY)) * 0.5));
    }
    getExteriorDepth(meshGenerator) {
        return meshGenerator.tinyIndexToWorld(this.forward.dot(this.position) + this.exteriorMergedBlocks) - meshGenerator.tinyIndexToWorld(this.forward.dot(this.position));
    }
    getInteriorDepth(meshGenerator) {
        return meshGenerator.tinyIndexToWorld(this.forward.dot(this.position) + this.interiorMergedBlocks) - meshGenerator.tinyIndexToWorld(this.forward.dot(this.position));
    }
    isFaceVisible(direction) {
        if (direction.x > 0 && direction.y == 0 && direction.z == 0) {
            return this.visibleFaces[0];
        }
        else if (direction.x < 0 && direction.y == 0 && direction.z == 0) {
            return this.visibleFaces[1];
        }
        else if (direction.x == 0 && direction.y > 0 && direction.z == 0) {
            return this.visibleFaces[2];
        }
        else if (direction.x == 0 && direction.y < 0 && direction.z == 0) {
            return this.visibleFaces[3];
        }
        else if (direction.x == 0 && direction.y == 0 && direction.z > 0) {
            return this.visibleFaces[4];
        }
        else if (direction.x == 0 && direction.y == 0 && direction.z < 0) {
            return this.visibleFaces[5];
        }
        else {
            throw new Error("Invalid direction vector.");
        }
    }
    hideFace(direction) {
        if (direction.x > 0 && direction.y == 0 && direction.z == 0) {
            this.visibleFaces[0] = false;
        }
        else if (direction.x < 0 && direction.y == 0 && direction.z == 0) {
            this.visibleFaces[1] = false;
        }
        else if (direction.x == 0 && direction.y > 0 && direction.z == 0) {
            this.visibleFaces[2] = false;
        }
        else if (direction.x == 0 && direction.y < 0 && direction.z == 0) {
            this.visibleFaces[3] = false;
        }
        else if (direction.x == 0 && direction.y == 0 && direction.z > 0) {
            this.visibleFaces[4] = false;
        }
        else if (direction.x == 0 && direction.y == 0 && direction.z < 0) {
            this.visibleFaces[5] = false;
        }
        else {
            throw new Error("Invalid direction vector.");
        }
    }
}
var BlockType;
(function (BlockType) {
    BlockType[BlockType["Solid"] = 0] = "Solid";
    BlockType[BlockType["PinHole"] = 1] = "PinHole";
    BlockType[BlockType["AxleHole"] = 2] = "AxleHole";
    BlockType[BlockType["Pin"] = 3] = "Pin";
    BlockType[BlockType["Axle"] = 4] = "Axle";
    BlockType[BlockType["BallJoint"] = 5] = "BallJoint";
    BlockType[BlockType["BallSocket"] = 6] = "BallSocket";
})(BlockType || (BlockType = {}));
const BLOCK_TYPE = {
    "solid": BlockType.Solid,
    "pinhole": BlockType.PinHole,
    "axlehole": BlockType.AxleHole,
    "pin": BlockType.Pin,
    "axle": BlockType.Axle,
    "balljoint": BlockType.BallJoint,
    "ballsocket": BlockType.BallSocket
};
var Orientation;
(function (Orientation) {
    Orientation[Orientation["X"] = 0] = "X";
    Orientation[Orientation["Y"] = 1] = "Y";
    Orientation[Orientation["Z"] = 2] = "Z";
})(Orientation || (Orientation = {}));
const ORIENTATION = {
    "x": Orientation.X,
    "y": Orientation.Y,
    "z": Orientation.Z
};
const FORWARD = {
    0: new Vector3(1, 0, 0),
    1: new Vector3(0, 1, 0),
    2: new Vector3(0, 0, 1)
};
const RIGHT = {
    0: new Vector3(0, 1, 0),
    1: new Vector3(0, 0, 1),
    2: new Vector3(1, 0, 0)
};
const UP = {
    0: new Vector3(0, 0, 1),
    1: new Vector3(1, 0, 0),
    2: new Vector3(0, 1, 0)
};
const LEFT = {
    0: new Vector3(0, -1, 0),
    1: new Vector3(0, 0, -1),
    2: new Vector3(-1, 0, 0)
};
const DOWN = {
    0: new Vector3(0, 0, -1),
    1: new Vector3(-1, 0, 0),
    2: new Vector3(0, -1, 0)
};
var Quadrant;
(function (Quadrant) {
    Quadrant[Quadrant["TopLeft"] = 0] = "TopLeft";
    Quadrant[Quadrant["TopRight"] = 1] = "TopRight";
    Quadrant[Quadrant["BottomLeft"] = 2] = "BottomLeft";
    Quadrant[Quadrant["BottomRight"] = 3] = "BottomRight";
})(Quadrant || (Quadrant = {}));
function localX(quadrant) {
    return (quadrant == Quadrant.TopRight || quadrant == Quadrant.BottomRight) ? 1 : 0;
}
function localY(quadrant) {
    return (quadrant == Quadrant.TopRight || quadrant == Quadrant.TopLeft) ? 1 : 0;
}
function getAngle(quadrant) {
    switch (quadrant) {
        case Quadrant.TopRight:
            return 0;
        case Quadrant.BottomRight:
            return 90 * DEG_TO_RAD;
        case Quadrant.BottomLeft:
            return 180 * DEG_TO_RAD;
        case Quadrant.TopLeft:
            return 270 * DEG_TO_RAD;
    }
    throw new Error("Unknown quadrant: " + quadrant);
}
class Camera {
    renderers = [];
    transform = Matrix4.getIdentity();
    size = 5;
    frameBuffer;
    normalTexture;
    depthTexture;
    clearColor = new Vector3(0.95, 0.95, 0.95);
    supersample = 1;
    constructor(canvas, supersample = 1) {
        gl = canvas.getContext("webgl");
        if (gl == null) {
            throw new Error("WebGL is not supported.");
        }
        gl.getExtension('WEBGL_depth_texture');
        this.supersample = supersample;
        canvas.width = Math.round(canvas.clientWidth * window.devicePixelRatio) * this.supersample;
        canvas.height = Math.round(canvas.clientHeight * window.devicePixelRatio) * this.supersample;
        this.createBuffers();
    }
    createBuffers() {
        this.normalTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.normalTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.depthTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, gl.canvas.width, gl.canvas.height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.frameBuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.normalTexture, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.depthTexture, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    getProjectionMatrix() {
        return Matrix4.getOrthographicProjection(30, this.size);
    }
    render() {
        gl.clearColor(this.clearColor.x, this.clearColor.y, this.clearColor.z, 1.0);
        gl.colorMask(true, true, true, true);
        gl.clearDepth(1.0);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.CULL_FACE);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        for (var renderer of this.renderers) {
            renderer.render(this);
        }
        gl.colorMask(false, false, false, true);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
    onResize() {
        gl.canvas.width = Math.round(gl.canvas.clientWidth * window.devicePixelRatio) * this.supersample;
        gl.canvas.height = Math.round(gl.canvas.clientHeight * window.devicePixelRatio) * this.supersample;
        this.createBuffers();
        this.render();
    }
    getScreenToWorldRay(event) {
        var rect = gl.canvas.getBoundingClientRect();
        var x = event.clientX - rect.left;
        var y = event.clientY - rect.top;
        x = x / gl.canvas.clientWidth * 2 - 1;
        y = y / gl.canvas.clientHeight * -2 + 1;
        let viewSpacePoint = new Vector3(x * this.size / 2 * gl.drawingBufferWidth / gl.drawingBufferHeight, y * this.size / 2, 0);
        let viewSpaceDirection = new Vector3(0, 0, -1);
        let inverseCameraTransform = this.transform.invert();
        return new Ray(inverseCameraTransform.transformPoint(viewSpacePoint), inverseCameraTransform.transformDirection(viewSpaceDirection));
    }
}
class ContourPostEffect {
    shader;
    vertices;
    enabled = true;
    constructor() {
        this.shader = new Shader(COUNTOUR_VERTEX, CONTOUR_FRAGMENT);
        this.shader.setAttribute("vertexPosition");
        this.shader.setUniform("normalTexture");
        this.shader.setUniform("depthTexture");
        this.shader.setUniform("resolution");
        this.vertices = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices);
        var positions = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    }
    render(camera) {
        if (!this.enabled) {
            return;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices);
        gl.vertexAttribPointer(this.shader.attributes["vertexPosition"], 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shader.attributes["vertexPosition"]);
        gl.useProgram(this.shader.program);
        gl.depthFunc(gl.ALWAYS);
        gl.depthMask(false);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, camera.normalTexture);
        gl.uniform1i(this.shader.attributes["normalTexture"], 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, camera.depthTexture);
        gl.uniform1i(this.shader.attributes["depthTexture"], 1);
        gl.uniform2f(this.shader.attributes["resolution"], gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.depthFunc(gl.LEQUAL);
        gl.depthMask(true);
    }
}
class MeshRenderer {
    shader;
    vertices;
    normals;
    vertexCount;
    transform;
    color = new Vector3(1, 0, 0);
    alpha = 1;
    enabled = true;
    constructor() {
        this.shader = new Shader(VERTEX_SHADER, FRAGMENT_SHADER);
        this.shader.setAttribute("vertexPosition");
        this.shader.setAttribute("normal");
        this.shader.setUniform("projectionMatrix");
        this.shader.setUniform("modelViewMatrix");
        this.shader.setUniform("albedo");
        this.shader.setUniform("alpha");
        this.transform = Matrix4.getIdentity();
    }
    setMesh(mesh) {
        this.vertexCount = mesh.getVertexCount();
        this.vertices = mesh.createVertexBuffer();
        this.normals = mesh.createNormalBuffer();
    }
    render(camera) {
        if (!this.enabled) {
            return;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices);
        gl.vertexAttribPointer(this.shader.attributes["vertexPosition"], 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shader.attributes["vertexPosition"]);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normals);
        gl.vertexAttribPointer(this.shader.attributes["normal"], 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shader.attributes["normal"]);
        gl.useProgram(this.shader.program);
        gl.uniformMatrix4fv(this.shader.attributes["projectionMatrix"], false, camera.getProjectionMatrix().elements);
        gl.uniformMatrix4fv(this.shader.attributes["modelViewMatrix"], false, this.transform.times(camera.transform).elements);
        gl.uniform3f(this.shader.attributes["albedo"], this.color.x, this.color.y, this.color.z);
        gl.uniform1f(this.shader.attributes["alpha"], this.alpha);
        gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    }
}
class NormalDepthRenderer {
    shader;
    vertices;
    normals;
    transform;
    vertexCount;
    enabled = true;
    constructor() {
        this.prepareShaders();
        this.transform = Matrix4.getIdentity();
    }
    prepareShaders() {
        this.shader = new Shader(VERTEX_SHADER, NORMAL_FRAGMENT_SHADER);
        this.shader.setAttribute("vertexPosition");
        this.shader.setAttribute("normal");
        this.shader.setUniform("projectionMatrix");
        this.shader.setUniform("modelViewMatrix");
    }
    setMesh(mesh) {
        this.vertexCount = mesh.getVertexCount();
        this.vertices = mesh.createVertexBuffer();
        this.normals = mesh.createNormalBuffer();
    }
    render(camera) {
        if (!this.enabled) {
            return;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, camera.frameBuffer);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.clearColor(0.5, 0.5, -1.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices);
        gl.vertexAttribPointer(this.shader.attributes["vertexPosition"], 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shader.attributes["vertexPosition"]);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normals);
        gl.vertexAttribPointer(this.shader.attributes["normal"], 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shader.attributes["normal"]);
        gl.useProgram(this.shader.program);
        gl.uniformMatrix4fv(this.shader.attributes["projectionMatrix"], false, camera.getProjectionMatrix().elements);
        gl.uniformMatrix4fv(this.shader.attributes["modelViewMatrix"], false, this.transform.times(camera.transform).elements);
        gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
}
class Shader {
    program;
    attributes = {};
    loadShader(type, source) {
        let shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            var lines = source.split("\n");
            for (var index = 0; index < lines.length; index++) {
                console.log((index + 1) + ": " + lines[index]);
            }
            throw new Error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        }
        return shader;
    }
    constructor(vertexSource, fragmentSource) {
        const vertexShader = this.loadShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.loadShader(gl.FRAGMENT_SHADER, fragmentSource);
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw new Error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(this.program));
        }
    }
    setAttribute(name) {
        this.attributes[name] = gl.getAttribLocation(this.program, name);
    }
    setUniform(name) {
        this.attributes[name] = gl.getUniformLocation(this.program, name);
    }
}
class WireframeBox {
    shader;
    positions;
    transform;
    visible = true;
    color = new Vector3(0.0, 0.0, 1.0);
    alpha = 0.8;
    colorOccluded = new Vector3(0.0, 0.0, 0.0);
    alphaOccluded = 0.15;
    scale = Vector3.one();
    constructor() {
        this.shader = new Shader(SIMPLE_VERTEX_SHADER, COLOR_FRAGMENT_SHADER);
        this.shader.setAttribute("vertexPosition");
        this.shader.setUniform("projectionMatrix");
        this.shader.setUniform("modelViewMatrix");
        this.shader.setUniform("color");
        this.shader.setUniform("scale");
        this.positions = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positions);
        var positions = [
            -1, -1, -1, -1, -1, +1,
            +1, -1, -1, +1, -1, +1,
            -1, +1, -1, -1, +1, +1,
            +1, +1, -1, +1, +1, +1,
            -1, -1, -1, -1, +1, -1,
            -1, -1, +1, -1, +1, +1,
            +1, -1, -1, +1, +1, -1,
            +1, -1, +1, +1, +1, +1,
            -1, -1, -1, +1, -1, -1,
            -1, +1, -1, +1, +1, -1,
            -1, -1, +1, +1, -1, +1,
            -1, +1, +1, +1, +1, +1
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    }
    render(camera) {
        if (!this.visible) {
            return;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positions);
        gl.vertexAttribPointer(this.shader.attributes["vertexPosition"], 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shader.attributes["vertexPosition"]);
        gl.useProgram(this.shader.program);
        gl.uniformMatrix4fv(this.shader.attributes["projectionMatrix"], false, camera.getProjectionMatrix().elements);
        gl.uniformMatrix4fv(this.shader.attributes["modelViewMatrix"], false, this.transform.times(camera.transform).elements);
        gl.uniform3f(this.shader.attributes["scale"], this.scale.x, this.scale.y, this.scale.z);
        gl.depthFunc(gl.GREATER);
        gl.depthMask(false);
        gl.uniform4f(this.shader.attributes["color"], this.colorOccluded.x, this.colorOccluded.y, this.colorOccluded.z, this.alphaOccluded);
        gl.drawArrays(gl.LINES, 0, 24);
        gl.depthFunc(gl.LEQUAL);
        gl.depthMask(true);
        gl.uniform4f(this.shader.attributes["color"], this.color.x, this.color.y, this.color.z, this.alpha);
        gl.drawArrays(gl.LINES, 0, 24);
    }
}
class WireframeRenderer {
    shader;
    vertices;
    vertexCount;
    transform;
    enabled = true;
    color = new Vector3(0.0, 0.0, 0.0);
    alpha = 0.5;
    constructor() {
        this.shader = new Shader(SIMPLE_VERTEX_SHADER, COLOR_FRAGMENT_SHADER);
        this.shader.setAttribute("vertexPosition");
        this.shader.setUniform("projectionMatrix");
        this.shader.setUniform("modelViewMatrix");
        this.shader.setUniform("color");
        this.shader.setUniform("scale");
        this.transform = Matrix4.getIdentity();
    }
    setMesh(mesh) {
        this.vertexCount = mesh.getVertexCount() * 2;
        this.vertices = mesh.createWireframeVertexBuffer();
    }
    render(camera) {
        if (!this.enabled) {
            return;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices);
        gl.vertexAttribPointer(this.shader.attributes["vertexPosition"], 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shader.attributes["vertexPosition"]);
        gl.useProgram(this.shader.program);
        gl.uniformMatrix4fv(this.shader.attributes["projectionMatrix"], false, camera.getProjectionMatrix().elements);
        gl.uniformMatrix4fv(this.shader.attributes["modelViewMatrix"], false, this.transform.times(camera.transform).elements);
        gl.uniform3f(this.shader.attributes["scale"], 1, 1, 1);
        gl.uniform4f(this.shader.attributes["color"], this.color.x, this.color.y, this.color.z, this.alpha);
        gl.drawArrays(gl.LINES, 0, this.vertexCount);
    }
}
const VERTEX_SHADER = `
    attribute vec4 vertexPosition;
    attribute vec4 normal;

    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;

    varying vec3 v2fNormal;

    void main() {
        v2fNormal = (modelViewMatrix * vec4(normal.xyz, 0.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vertexPosition;
    }
`;
const FRAGMENT_SHADER = `
    precision mediump float;

    const vec3 lightDirection = vec3(-0.7, -0.7, 0.14);
    const float ambient = 0.2;
    const float diffuse = 0.8;
    const float specular = 0.3;
    const vec3 viewDirection = vec3(0.0, 0.0, 1.0);

    varying vec3 v2fNormal;

    uniform vec3 albedo;
    uniform float alpha;

    void main() {
        vec3 color = albedo * (ambient
             + diffuse * (0.5 + 0.5 * dot(lightDirection, v2fNormal))
             + specular * pow(max(0.0, dot(reflect(-lightDirection, v2fNormal), viewDirection)), 2.0));

        gl_FragColor = vec4(color.r, color.g, color.b, alpha);
    }
`;
const NORMAL_FRAGMENT_SHADER = `
    precision mediump float;

    varying vec3 v2fNormal;

    void main() {
        vec3 normal = vec3(0.5) + 0.5 * normalize(v2fNormal);
        gl_FragColor = vec4(normal, 1.0);
    }
`;
const COUNTOUR_VERTEX = `
    attribute vec2 vertexPosition;

    varying vec2 uv;

    void main() {
        uv = vertexPosition / 2.0 + vec2(0.5);
        gl_Position = vec4(vertexPosition, 0.0, 1.0);
    }
`;
const CONTOUR_FRAGMENT = `
    precision mediump float;

    uniform sampler2D normalTexture;
    uniform sampler2D depthTexture;
    uniform vec2 resolution;

    varying vec2 uv;
    
    const float NORMAL_THRESHOLD = 0.5;

    vec3 getNormal(vec2 uv) {
        vec4 sample = texture2D(normalTexture, uv);
        return 2.0 * sample.xyz - vec3(1.0);
    }

    float getDepth(vec2 uv) {
        return texture2D(depthTexture, uv).r;
    }

    bool isContour(vec2 uv, float referenceDepth, vec3 referenceNormal) {
        float depth = getDepth(uv);
        vec3 normal = getNormal(uv);
        float angle = abs(referenceNormal.z);
        
        float threshold = mix(0.005, 0.0001, pow(-referenceNormal.z, 0.5));

        if (abs(depth - referenceDepth) > threshold) {
            return true;
        }

        if (abs(dot(normal, referenceNormal)) < NORMAL_THRESHOLD) {
            return true;
        }

        return false;
    }

    void main() {
        vec2 pixelSize = vec2(1.0 / resolution.x, 1.0 / resolution.y);

        float depth = getDepth(uv);
        vec3 normal = getNormal(uv);

        float count = 0.0;

        for (float x = -1.0; x <= 1.0; x++) {
            for (float y = -1.0; y <= 1.0; y++) {
                if ((x != 0.0 || y != 0.0) && isContour(uv + pixelSize * vec2(x, y), depth, normal)) {
                    count++;
                }
            }
        }
        float contour = count == 1.0 ? 0.0 : (count - 0.2) / 5.0;
        
        gl_FragColor = vec4(vec3(0.0), contour);
    }
`;
const SIMPLE_VERTEX_SHADER = `
    attribute vec4 vertexPosition;

    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;

    uniform vec3 scale;

    void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4((vertexPosition.xyz * scale), vertexPosition.a);
    }
`;
const COLOR_FRAGMENT_SHADER = `
    precision mediump float;

    uniform vec4 color;

    void main() {
        gl_FragColor = color;
    }
`;
//# sourceMappingURL=app.js.map