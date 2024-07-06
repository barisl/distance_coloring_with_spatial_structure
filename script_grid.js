var infoContainer = document.getElementById('infoContainer');
var svg, pathMatrix, csvFile, longestEdgeLength, gridSize,rectSize;
var sumEdgeLength = 0;
var useLongestEdge = true;
var data = [];
var edges = [];
var colorMap = {};
const maxX = 500;
const maxY = 500;
const width = 550;
const height = 550;
var dist;

var edgeLengthOption = document.getElementById('edgeLengthOption').value;
dist = parseInt(document.getElementById('distanceInput').value, 10);
csvFile = document.getElementById('csvFileOption').value;
useLongestEdge = (edgeLengthOption === 'longest');
document.querySelector('.settings-container').style.display = 'none';
document.getElementById('allButton').style.display = 'block';
initialSettings();
var button = document.getElementById('allButton');
button.addEventListener('click', gridColoring);

function initialSettings() {
    d3.csv(csvFile, function(csvData) {
        let isSourceTarget = false;
        csvData.forEach(function(d) {
            if (!isSourceTarget) {
                if (d.vertex === "source") {
                    isSourceTarget = true;
                } else {
                    data.push({ vertex: d.vertex, x: +d.x, y: +d.y });
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
                longestEdge = edge;
            }
        }
        svg = d3.select("#svg-container")
            .attr("width", width)
            .attr("height", height)
            .append("g");
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
            .attr("class", "point")
            .attr("cx", function (d) { return d.x; })
            .attr("cy", function (d) { return d.y; })
            .attr("r", 3);
        pathMatrix = calculatePaths(data, edges);
        rectSize = calculateGridSize(dist);
        if(useLongestEdge){
            gridSize = longestEdgeLength;
        }
        else{
            gridSize = averageEdgeLength = sumEdgeLength / edges.length;
        }
        drawGridLines(gridSize);
    });
}
function gridColoring() {
    data.forEach(node => {
        node.col = 0;
    });
    const grid = {};
    data.forEach(node => {
        const gridX = Math.floor(node.x / gridSize);
        const gridY = Math.floor(node.y / gridSize);
        const key = `${gridX}-${gridY}`;
        if (!grid[key]) {
            grid[key] = [];
        }
        grid[key].push(node);
    });

    Object.values(grid).forEach(cell => {
        cell.forEach(node => {
            const neighbors = getNeighbors(node, grid);
            const neighborColors = neighbors.map(n => n.col);

            let color = 1;
            while (neighborColors.includes(color)) {
                color++;
            }
            node.col = color;
        });
    });

    svg.selectAll(".point")
        .style("fill", function(d) { return getColor(d.col); });

    button.remove();
    updateLastInfo();
}
function getNeighbors(node, grid) {
    const gridX = Math.floor(node.x / gridSize);
    const gridY = Math.floor(node.y / gridSize);

    const neighbors = [];

    for (let i = gridX - dist; i <= gridX + dist; i++) {
        for (let j = gridY - dist; j <= gridY + dist; j++) {
            const key = `${i}-${j}`;
            if (grid[key]) {
                grid[key].forEach(neighbor => {
                    if (neighbor !== node && pathMatrix[data.indexOf(node)][data.indexOf(neighbor)] <= dist) {
                        neighbors.push(neighbor);
                    }
                });
            }
        }
    }

    return neighbors;
}
function distance(point1, point2) {
    var dx = point2.x - point1.x;
    var dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
}
function calculateGridSize(d) {
    if (useLongestEdge) {
        return d * longestEdgeLength;
    } else {
        averageEdgeLength = sumEdgeLength / edges.length;
        return d * averageEdgeLength;
    }
}
function getColor(col) {
    if (colorMap[col]) {
        return colorMap[col];
    } else {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        colorMap[col] = color;
        return color;
    }
}
function updateLastInfo() {
    var distinctColors = new Set(data.map(node => node.col));
    infoContainer.innerHTML = `
        <p>d = ${dist}</p>
        <p>k = ${distinctColors.size}</p>
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
function drawGridLines(gridSize) {
    svg.selectAll('.grid-line').remove();
    for (let x = 0; x <= width; x += gridSize) {
        svg.append('line')
            .attr('class', 'grid-line')
            .attr('x1', x)
            .attr('y1', 0)
            .attr('x2', x)
            .attr('y2', height)
            .attr('stroke', 'white')
            .attr('stroke-width', 1);
    }
    for (let y = 0; y <= height; y += gridSize) {
        svg.append('line')
            .attr('class', 'grid-line')
            .attr('x1', 0)
            .attr('y1', y)
            .attr('x2', width)
            .attr('y2', y)
            .attr('stroke', 'white')
            .attr('stroke-width', 1);
    }
}
