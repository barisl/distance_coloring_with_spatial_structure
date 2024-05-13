var infoContainer = document.getElementById('infoContainer');
var svg,quadtree,longestEdgeLength,selectedPointQuad,pathMatrix;
var data = [];
var edges = [];
var total_col = [];
var neighbor = [];
var neighbor_col = [];
var poss_col = [];
var colorMap = {};
const maxX = 500;
const maxY = 500;
var dist = 2;

d3.csv("graph_example.csv", function(csvData) {
    let isSourceTarget = false;
    csvData.forEach(function(d) {
        if(!isSourceTarget) {
            if(d.vertex == "source"){
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
    console.log(data);
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
        if (edgeLength > longestEdgeLength) {
            longestEdgeLength = edgeLength;
            longestEdge = edge
        }
    }
    var width = 550,
        height = 550;

    quadtree = d3.geom.quadtree().extent([[-1, -1], [height, width]])(data.map(d => [d.x, d.y]));

    svg = d3.select("#svg-container")
        .attr("width", width)
        .attr("height", height)
        .append("g")
    var rect = svg.selectAll(".node")
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
            if (edge.source === longestEdge.source && edge.target === longestEdge.target) {
                svg.append("line")
                    .attr("class", "longest-edge")
                    .attr("x1", sourceNode.x)
                    .attr("y1", sourceNode.y)
                    .attr("x2", targetNode.x)
                    .attr("y2", targetNode.y);
            }
        }
    });
    var point = svg.selectAll(".point")
        .data(data)
        .enter().append("circle")
        .attr("class","point")
        .attr("cx", function (d) {return d.x;})
        .attr("cy", function (d) {return d.y;})
        .attr("r", 3)
    pathMatrix = calculatePaths(data,edges);
    console.log(pathMatrix);
});
var index = 0;
var prevPoint = null;
var button = document.getElementById('allButton');
button.addEventListener('click', drawNextCircle);
function drawNextCircle() {
    for (var i = 0; i < data.length; i++) {
        //svg.selectAll("line").remove();
        if (prevPoint) {
            prevPoint.point.remove();
            prevPoint.ring.remove();
            svg.selectAll(".longest-edge").remove();
            svg.selectAll(".neighbor-point").remove();
            // svg.selectAll(".central-point").remove();
            svg.selectAll(".intersect-point").remove();
            poss_col = [];
            neighbor_col = [];
            neighbor = [];
        }
        var selectedPoint = data[index];
        var point = svg.append("circle")
            .attr("class", "point central-point")
            .attr("cx", selectedPoint.x)
            .attr("cy", selectedPoint.y)
            .attr("r", 3)
            .style("fill", getColor(selectedPoint.col));
        var ringRadius = calculateRingRadius(selectedPoint, dist);
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
                var dist_upperleft = distance(selectedPoint, {x: quad.x1, y: quad.y1});
                var dist_lowerright = distance(selectedPoint, {x: quad.x2, y: quad.y2});
                var dist_upperright = distance(selectedPoint, {x: quad.x2, y: quad.y1});
                var dist_lowerleft = distance(selectedPoint, {x: quad.x1, y: quad.y2});
                var dist = distance(selectedPoint, {x: quadPointX, y: quadPointY});
                if (dist == 0) {
                    selectedPointQuad = quad.point;
                }
                if ((dist <= ringRadius || (dist_upperleft <= ringRadius || dist_lowerright <= ringRadius || dist_upperright <= ringRadius || dist_lowerleft <= ringRadius)) && dist != 0) {
                    neighbor_col.push(quad.point.col);
                }
            }
            return x1 >= selectedPoint.x + ringRadius || x2 <= selectedPoint.x - ringRadius ||
                y1 >= selectedPoint.y + ringRadius || y2 <= selectedPoint.y - ringRadius;
        });
        if (!total_col.length) {
            maxNeighbor = d3.max(neighbor_col);
            total_col.push(maxNeighbor + 1);
        }
        total_col.forEach(function (d) {
            if (!neighbor_col.includes(d) && !poss_col.includes(d)) {
                poss_col.push(d)
            }
        });
        if (!poss_col.length) {
            maxTotal = d3.max(total_col);
            poss_col.push(maxTotal + 1);
        }
        selectedPoint.col = d3.min(poss_col);
        selectedPointQuad.col = d3.min(poss_col);
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
        if ((index == data.length) && selectedPointQuad.col != 0) {
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
function distance(point1, point2) {
    var dx = point1.x - point2.x;
    var dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
}
function calculateRingRadius(point, d) {
    var deltaX = d * (longestEdgeLength/2);
    var deltaY = d * (longestEdgeLength/2);
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
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
    infoContainer.innerHTML = `
                <p>Nachbarsfarben: ${neighbor_col}</p>
                <p>Mögliche Farben: ${poss_col}</p>
                 <p>Gewählte Farbe: ${selectedPointQuad.col}</p>
                <p>Alle Farben: ${total_col}</p>
            `;
}
function updateLastInfo() {
    infoContainer.innerHTML = `
                <p>d = ${dist}</p>
                <p>k = ${total_col.length}</p>
                <p>p = ${wrongPaths(data, pathMatrix, svg, dist)}</p>
            `;
}
function calculatePaths(data, edges) {
    const adjacencyList = new Array(data.length).fill().map(() => []);
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
                    .attr("r", 3);
                svg.append("circle")
                    .attr("class", "point")
                    .attr("cx", targetNode.x)
                    .attr("cy", targetNode.y)
                    .attr("r", 3);
            }
        }
    }
    return count;
}