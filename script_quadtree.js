var infoContainer = document.getElementById('infoContainer');
var svg, quadtree, longestEdgeLength, averageEdgeLength, selectedPointQuad, pathMatrix,csvFile;
var useLongestEdge = true;
var outsideCircle = true;
var sumEdgeLength = 0;
var data = [];
var edges = [];
var total_col = [];
var neighbor_col = [];
var colorMap = {};
const maxX = 500;
const maxY = 500;
const width = 550;
const height = 550;
var dist;

    var edgeLengthOption = document.getElementById('edgeLengthOption').value;
    csvFile = document.getElementById('csvFileOption').value;
    useLongestEdge = (edgeLengthOption === 'longest');
    outsideCircle = document.getElementById('outsideCircle').value === 'true';
    dist = parseInt(document.getElementById('distanceInput').value, 10);
    document.querySelector('.settings-container').style.display = 'none';
    document.getElementById('allButton').style.display = 'block';
    initialSettings();

function initialSettings() {
    d3.csv(csvFile, function(csvData) {
        let isSourceTarget = false;
        csvData.forEach(function(d) {
            if(!isSourceTarget) {
                if(d.vertex === "source"){
                    isSourceTarget = true;
                } else {
                    data.push({vertex: d.vertex, x: +d.x, y: +d.y});
                }
            } else {
                edges.push({ source: d.vertex, target: d.x });
            }
        });
        let min_x = d3.min(data.map(d => d.x));
        let min_y = d3.min(data.map(d => d.y));
        let max_x = d3.max(data.map(d => d.x));
        let max_y = d3.max(data.map(d => d.y));

        data.forEach(d => {
            d.x = (d.x - min_x) / (max_x - min_x) * maxX;
            d.y = (d.y - min_y) / (max_y - min_y) * maxY;
        });

        longestEdgeLength = 0;
        var longestEdge = null;

        for (var i = 0; i < edges.length; i++) {
            var edge = edges[i];
            var sourceNode = data.find(function (node) {
                return node.vertex === edge.source;
            });
            var targetNode = data.find(function (node) {
                return node.vertex === edge.target;
            });
            var edgeLength = distance(sourceNode, targetNode);
            sumEdgeLength += edgeLength;
            if (edgeLength > longestEdgeLength) {
                longestEdgeLength = edgeLength;
                longestEdge = edge
            }
        }

        quadtree = d3.geom.quadtree().extent([[-1, -1], [height, width]])(data.map(d => [d.x, d.y]));

        svg = d3.select("#svg-container")
            .attr("width", width)
            .attr("height", height)
            .append("g")
        svg.selectAll(".node")
            .data(nodes(quadtree))
            .enter().append("rect")
            .attr("class", "node")
            .attr("x", function(d) { return d.x1; })
            .attr("y", function(d) { return d.y1; })
            .attr("width", function(d) { return d.x2 - d.x1; })
            .attr("height", function(d) { return d.y2 - d.y1; });
        edges.forEach(function(edge) {
            var sourceNode = data.find(function(node) { return node.vertex === edge.source; });
            var targetNode = data.find(function(node) { return node.vertex === edge.target; });
            if (sourceNode && targetNode) {
                svg.append("line")
                    .attr("class", "edge")
                    .attr("x1", sourceNode.x)
                    .attr("y1", sourceNode.y)
                    .attr("x2", targetNode.x)
                    .attr("y2", targetNode.y);
                if (edge.source === longestEdge.source && edge.target === longestEdge.target && useLongestEdge) {
                    svg.append("line")
                        .attr("class", "longest-edge")
                        .attr("x1", sourceNode.x)
                        .attr("y1", sourceNode.y)
                        .attr("x2", targetNode.x)
                        .attr("y2", targetNode.y);
                }
            }
        });
        svg.selectAll(".point")
            .data(data)
            .enter().append("circle")
            .attr("class","point")
            .attr("cx", function (d) {return d.x;})
            .attr("cy", function (d) {return d.y;})
            .attr("r", 3);
        pathMatrix = calculatePaths(data,edges);
    });
}

var index = 0;
var prevPoint = null;
var button = document.getElementById('allButton');
button.addEventListener('click', distanceColoring);

function distanceColoring() {
    for (var i = 0; i < data.length; i++) {
        if (prevPoint) {
            prevPoint.point.remove();
            prevPoint.ring.remove();
            svg.selectAll(".longest-edge").remove();
            svg.selectAll(".neighbor-point").remove();
            svg.selectAll(".intersect-point").remove();
            neighbor_col = [];
        }

        var selectedPoint = data[index];
        var point = svg.append("circle")
            .attr("class", "point central-point")
            .attr("cx", selectedPoint.x)
            .attr("cy", selectedPoint.y)
            .attr("r", 3)
            .style("fill", getColor(selectedPoint.col));

        var ringRadius = calculateRingRadius(dist);
        var ring = svg.append("circle")
            .attr("class", "ring")
            .attr("cx", selectedPoint.x)
            .attr("cy", selectedPoint.y)
            .attr("r", ringRadius);

        quadtree.visit(function (quad, x1, y1, x2, y2) {
            if (quad.point) {
                var quadPoint = quad.point;
                var quadPointX = quadPoint[0];
                var quadPointY = quadPoint[1];
                var quadUp = intersects(x1, y1, x2, y1, selectedPoint.x, selectedPoint.y, ringRadius);
                var quadRight = intersects(x2, y1, x2, y2, selectedPoint.x, selectedPoint.y, ringRadius);
                var quadDown = intersects(x2, y2, x1, y2, selectedPoint.x, selectedPoint.y, ringRadius);
                var quadLeft = intersects(x2, y2, x1, y1, selectedPoint.x, selectedPoint.y, ringRadius);
                var dist = distance(selectedPoint, {x: quadPointX, y: quadPointY});

                if (dist === 0) {
                    selectedPointQuad = quad.point;
                }
                if (outsideCircle) {
                    if ((dist <= ringRadius || (quadUp || quadRight || quadDown || quadLeft)) && dist !== 0) {
                        neighbor_col.push(quad.point.col);
                    }
                } else {
                    if (dist <= ringRadius && dist !== 0) {
                        neighbor_col.push(quad.point.col);
                    }
                }
            }
            return x1 >= selectedPoint.x + ringRadius || x2 <= selectedPoint.x - ringRadius ||
                y1 >= selectedPoint.y + ringRadius || y2 <= selectedPoint.y - ringRadius;
        });

        var minAvailableColor = 1;
        while (neighbor_col.includes(minAvailableColor)) {
            minAvailableColor++;
        }
        selectedPoint.col = minAvailableColor;
        selectedPointQuad.col = minAvailableColor;
        svg.append("circle")
            .attr("class", "point central-point")
            .attr("cx", selectedPoint.x)
            .attr("cy", selectedPoint.y)
            .attr("r", 3)
            .style("fill", getColor(selectedPoint.col))
        if (!total_col.includes(selectedPoint.col) || !total_col.includes(selectedPointQuad.col)) {
            total_col.push(selectedPointQuad.col);
        }
        index++;
        updateInfo();
        if ((index === data.length) && selectedPointQuad.col !== 0) {
            button.remove();
            updateLastInfo();
            svg.selectAll(".ring").remove();
        }
        prevPoint = {
            point: point,
            ring: ring
        }
    }
}

function intersects(x1, y1, x2, y2, cx, cy, r) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var fx = x1 - cx;
    var fy = y1 - cy;
    var a = dx * dx + dy * dy;
    var b = 2 * (fx * dx + fy * dy);
    var c = (fx * fx + fy * fy) - r * r;
    var dis = b * b - 4 * a * c;
    if (dis < 0) {
        return false;
    } else {
        var disSqrt = Math.sqrt(dis);
        var t1 = (-b - disSqrt) / (2 * a);
        var t2 = (-b + disSqrt) / (2 * a);
        return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
    }
}

function distance(point1, point2) {
    var dx = point2.x - point1.x;
    var dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function calculateRingRadius(d) {
    if (useLongestEdge) {
        return d * longestEdgeLength;
    } else {
        averageEdgeLength = sumEdgeLength / edges.length;
        return d * averageEdgeLength;
    }
}

function nodes(quadtree) {
    var nodes = [];
    quadtree.depth = 0;
    quadtree.visit(function(node, x1, y1, x2, y2) {
        node.x1 = x1;
        node.y1 = y1;
        node.x2 = x2;
        node.y2 = y2;
        nodes.push(node);
        if (node.point) {
            node.point.col = 0;
        }
        for (var i=0; i<data.length; i++) {
            if (node.nodes[i]) {
                node.nodes[i].depth = node.depth + 1;
            }
        }
    });
    return nodes;
}

function getColor(col) {
    if (colorMap[col]) {
        return colorMap[col];
    } else {
        var letters = '0123456789ABCDEF';
        var color = '#';
        for (var i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        colorMap[col] = color;
        return color;
    }
}

function updateInfo() {
    function formatGUI(arr,end) {
        var split = [];
        if (arr.length > end) {
            let firstEntries = arr.slice(0, end-3);
            let lastEntry = arr[arr.length - 1];
            let truncatedArr = [...firstEntries, "... ", lastEntry];
            for (let i = 0; i < truncatedArr.length; i += 10) {
                split.push(truncatedArr.slice(i, i + 10).join(', '));
            }
        } else {
            for (let i = 0; i < arr.length; i += 10) {
                split.push(arr.slice(i, i + 10).join(', '));
            }
        }
        return split.join('<br>');
    }

    let neighborColFormatted = formatGUI(neighbor_col,150);
    let totalColFormatted = formatGUI(total_col,90);

    infoContainer.innerHTML = `
        <p>Nachbarsfarben:<br>${neighborColFormatted}</p>
        <p>Gewählte Farbe: ${selectedPointQuad.col}</p>
        <p>Alle Farben:<br>${totalColFormatted}</p>
    `;
}
function updateLastInfo() {
    infoContainer.innerHTML = `
                <p>d = ${dist}</p>
                <p>k = ${total_col.length}</p>
                <p>p = ${wrongPaths(data, pathMatrix, svg, dist)}</p>
            `;
}
function calculateAdjacencyList(data, edges){
    const adjacencyList = new Array(data.length).fill().map(() => []);
    for (var edge of edges) {
        const { source, target } = edge;
        const sourceIndex = data.findIndex(node => node.vertex === source);
        const targetIndex = data.findIndex(node => node.vertex === target);
        adjacencyList[sourceIndex].push(targetIndex);
        adjacencyList[targetIndex].push(sourceIndex);
    }
    return adjacencyList;
}
function calculatePaths(data, edges) {
    const adjacencyList = calculateAdjacencyList(data,edges);
    for (var edge of edges) {
        const { source, target } = edge;
        const sourceIndex = data.findIndex(node => node.vertex === source);
        const targetIndex = data.findIndex(node => node.vertex === target);
        adjacencyList[sourceIndex].push(targetIndex);
        adjacencyList[targetIndex].push(sourceIndex);
    }
    const calculatePathsMatrix = [];
    for (var i = 0; i < data.length; i++) {
        const row = new Array(data.length).fill(Infinity);
        row[i] = 0;
        const queue = [i];
        const visited = new Array(data.length).fill(false);
        visited[i] = true;
        while (queue.length > 0) {
            const currentNode = queue.shift();
            const currentDistance = row[currentNode];
            for (var neighbor of adjacencyList[currentNode]) {
                if (!visited[neighbor]) {
                    row[neighbor] = currentDistance + 1;
                    queue.push(neighbor);
                    visited[neighbor] = true;
                }
            }
        }
        calculatePathsMatrix.push(row);
    }
    return calculatePathsMatrix;
}
function wrongPaths(data, pathMatrix, svg, dist) {
    var count = 0;
    for (var i = 0; i < data.length; i++) {
        for (var j = i + 1; j < data.length; j++) {
            if (data[i].col === data[j].col && pathMatrix[i][j] <= dist) {
                count++;
                const sourceNode = data[i];
                const targetNode = data[j];
                console.log("Source:", sourceNode, "Target:", targetNode);
                svg.append("line")
                    .attr("class", "wrong-path")
                    .attr("x1", sourceNode.x)
                    .attr("y1", sourceNode.y)
                    .attr("x2", targetNode.x)
                    .attr("y2", targetNode.y);
                svg.append("circle")
                    .attr("class", "point")
                    .attr("cx", sourceNode.x)
                    .attr("cy", sourceNode.y)
                    .attr("r", 3)
                    .style("fill", getColor(sourceNode.col));
                svg.append("circle")
                    .attr("class", "point")
                    .attr("cx", targetNode.x)
                    .attr("cy", targetNode.y)
                    .attr("r", 3)
                    .style("fill", getColor(targetNode.col));
            }
        }
    }
    return count;
}